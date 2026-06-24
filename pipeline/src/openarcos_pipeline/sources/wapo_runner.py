"""Runner: iterates WaPo endpoints for a state, writes raw JSON per county."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from urllib import request

import duckdb
import polars as pl
from tqdm import tqdm

from openarcos_pipeline.config import Config
from openarcos_pipeline.log import get_logger
from openarcos_pipeline.sources.wapo_arcos import WapoClient

log = get_logger("openarcos.wapo.runner")

MENDELEY_COUNTY_CSV_URL = (
    "https://data.mendeley.com/public-files/datasets/dwfgxrh7tn/files/"
    "310d3eeb-68ec-4965-bca1-80bc775d6185/file_downloaded"
)
WAPO_MME_BULK_URL = (
    "https://d2ty8gaf6rmowa.cloudfront.net/dea-pain-pill-database/bulk/"
    "arcos_all_washpost.tsv.gz"
)


def _county_name(row: dict) -> str:
    """Extract a county name from a /v1/county_list row, tolerating key case."""
    # Real WaPo API returns BUYER_COUNTY (uppercase); older examples use `county`/`name`.
    for k in ("BUYER_COUNTY", "county", "name"):
        v = row.get(k)
        if v:
            # API returns uppercase; API query param prefers title case.
            return str(v).title() if str(v).isupper() else str(v)
    return ""


def fetch_state(client: WapoClient, cfg: Config, state: str) -> None:
    """Fetch all counties for one state, write raw JSON under data/raw/wapo/."""
    out_dir = cfg.raw_dir / "wapo"
    out_dir.mkdir(parents=True, exist_ok=True)
    counties = client.county_list(state)
    log.info("wapo runner start", extra={"state": state, "n_counties": len(counties)})
    for row in tqdm(counties, desc=f"WaPo {state}"):
        name = _county_name(row)
        if not name:
            continue
        for endpoint_name, method in [
            ("county_raw", client.county_raw),
            ("distributors", client.distributors_for_county),
            ("pharmacies", client.pharmacies_for_county),
        ]:
            try:
                data = method(state, name)
            except Exception as e:
                log.warning(
                    "wapo fetch failed",
                    extra={
                        "state": state,
                        "county": name,
                        "endpoint": endpoint_name,
                        "err": str(e),
                    },
                )
                continue
            fname = f"{endpoint_name}_{state}_{name.replace(' ', '_')}.json"
            (out_dir / fname).write_text(json.dumps(data, separators=(",", ":")))


def fetch_county_csv(cfg: Config, url: str = MENDELEY_COUNTY_CSV_URL) -> None:
    """Download the national county-year ARCOS CSV used by the explorer map."""
    out_dir = cfg.raw_dir / "wapo"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / "arcos_mendeley_county.csv"
    log.info("wapo county csv fetch start", extra={"url": url})
    req = request.Request(url, headers={"User-Agent": "openarcos-data-refresh/1.0"})
    with request.urlopen(req, timeout=90) as response, out.open("wb") as handle:
        shutil.copyfileobj(response, handle)
    log.info("wapo county csv fetch complete", extra={"path": str(out), "bytes": out.stat().st_size})


def _load_county_fips_map(county_csv: Path) -> pl.DataFrame:
    """Read the small county CSV and return clean `(state, county, fips)` rows."""
    df = pl.read_csv(county_csv, infer_schema_length=1_000, schema_overrides={"countyfips": pl.Utf8})
    df = df.rename({name: name.lower() for name in df.columns if name != name.lower()})
    needed = {"buyer_state", "buyer_county", "countyfips"}
    missing = sorted(needed.difference(df.columns))
    if missing:
        raise ValueError(f"{county_csv.name} is missing columns: {', '.join(missing)}")

    return (
        df.select(["buyer_state", "buyer_county", "countyfips"])
        .with_columns(
            [
                pl.col("buyer_state")
                .cast(pl.Utf8)
                .str.strip_chars()
                .str.to_uppercase()
                .alias("buyer_state"),
                pl.col("buyer_county")
                .cast(pl.Utf8)
                .str.strip_chars()
                .str.to_uppercase()
                .alias("buyer_county"),
                pl.col("countyfips").cast(pl.Utf8).str.strip_chars().str.zfill(5).alias("fips"),
            ]
        )
        .filter(pl.col("fips").str.contains(r"^[0-9]{5}$"))
        .select(["buyer_state", "buyer_county", "fips"])
        .unique()
    )


def stream_wapo_mme_county_year(
    bulk_tsv_gz: str | Path,
    county_csv: Path,
    out_csv: Path,
    batch_size: int = 100_000,
    log_every_rows: int = 1_000_000,
) -> Path:
    """Stream WaPo's huge raw TSV and write compact `{fips, year, mme}` CSV."""
    # Kept for API compatibility with the earlier chunked version.
    _ = batch_size, log_every_rows
    fips_by_county = _load_county_fips_map(county_csv)
    log.info(
        "wapo mme stream start",
        extra={"source": str(bulk_tsv_gz), "county_keys": len(fips_by_county)},
    )
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    county_sql = str(county_csv).replace("'", "''")
    source_sql = str(bulk_tsv_gz).replace("'", "''")
    out_sql = str(out_csv).replace("'", "''")
    conn = duckdb.connect()
    try:
        conn.execute("PRAGMA enable_progress_bar")
        conn.execute(
            f"""
            COPY (
                WITH county_fips_map AS (
                    SELECT DISTINCT
                        UPPER(TRIM(BUYER_STATE)) AS buyer_state,
                        UPPER(TRIM(BUYER_COUNTY)) AS buyer_county,
                        LPAD(TRIM(countyfips), 5, '0') AS fips
                    FROM read_csv(
                        '{county_sql}',
                        header = true,
                        all_varchar = true,
                        ignore_errors = true
                    )
                    WHERE REGEXP_MATCHES(TRIM(countyfips), '^[0-9]+$')
                ),
                raw AS (
                    SELECT
                        UPPER(TRIM(BUYER_STATE)) AS buyer_state,
                        UPPER(TRIM(BUYER_COUNTY)) AS buyer_county,
                        REGEXP_REPLACE(TRIM(TRANSACTION_DATE), '[^0-9]', '', 'g') AS date_digits,
                        TRY_CAST(CALC_BASE_WT_IN_GM AS DOUBLE) AS base_weight_grams,
                        TRY_CAST(MME_Conversion_Factor AS DOUBLE) AS mme_factor
                    FROM read_csv(
                        '{source_sql}',
                        delim = '\t',
                        header = true,
                        all_varchar = true,
                        ignore_errors = true
                    )
                ),
                normalized AS (
                    SELECT
                        m.fips,
                        CASE
                            WHEN TRY_CAST(LEFT(r.date_digits, 4) AS INTEGER) BETWEEN 2000 AND 2100
                                THEN TRY_CAST(LEFT(r.date_digits, 4) AS INTEGER)
                            ELSE TRY_CAST(RIGHT(r.date_digits, 4) AS INTEGER)
                        END AS year,
                        r.base_weight_grams * 1000 * r.mme_factor AS mme
                    FROM raw r
                    JOIN county_fips_map m
                      ON r.buyer_state = m.buyer_state
                     AND r.buyer_county = m.buyer_county
                    WHERE r.base_weight_grams IS NOT NULL
                      AND r.mme_factor IS NOT NULL
                      AND LENGTH(r.date_digits) >= 4
                )
                SELECT fips, year, SUM(mme) AS mme
                FROM normalized
                WHERE year BETWEEN 2006 AND 2014
                GROUP BY fips, year
                ORDER BY fips, year
            ) TO '{out_sql}' (HEADER, DELIMITER ',')
            """
        )
    finally:
        conn.close()
    groups = pl.scan_csv(out_csv, schema_overrides={"fips": pl.Utf8}).select(pl.len()).collect()[0, 0]
    log.info(
        "wapo mme stream complete",
        extra={
            "path": str(out_csv),
            "groups": groups,
            "bytes": out_csv.stat().st_size,
        },
    )
    return out_csv


def fetch_wapo_mme(
    cfg: Config,
    url: str = WAPO_MME_BULK_URL,
    county_csv: Path | None = None,
) -> Path:
    """Explicitly fetch the huge WaPo bulk file into a compact MME county-year CSV."""
    out_dir = cfg.raw_dir / "wapo"
    out_dir.mkdir(parents=True, exist_ok=True)
    county_csv = county_csv or out_dir / "arcos_mendeley_county.csv"
    if not county_csv.exists():
        fetch_county_csv(cfg)
    return stream_wapo_mme_county_year(url, county_csv, out_dir / "arcos_mme_county_year.csv")


def fetch_all(client: WapoClient, cfg: Config) -> None:
    """Fetch all 50 states + DC."""
    states = [
        "AL",
        "AK",
        "AZ",
        "AR",
        "CA",
        "CO",
        "CT",
        "DE",
        "DC",
        "FL",
        "GA",
        "HI",
        "ID",
        "IL",
        "IN",
        "IA",
        "KS",
        "KY",
        "LA",
        "ME",
        "MD",
        "MA",
        "MI",
        "MN",
        "MS",
        "MO",
        "MT",
        "NE",
        "NV",
        "NH",
        "NJ",
        "NM",
        "NY",
        "NC",
        "ND",
        "OH",
        "OK",
        "OR",
        "PA",
        "RI",
        "SC",
        "SD",
        "TN",
        "TX",
        "UT",
        "VT",
        "VA",
        "WA",
        "WV",
        "WI",
        "WY",
    ]
    for st in states:
        fetch_state(client, cfg, st)
