"""Census Bureau county metadata source.

Uses the pinned Population Estimates Program (PEP) 2010-2019 CSV. We take 2012
estimates as the canonical per-capita denominator (middle of the ARCOS
2006–2014 window). Source URL is pinned; file is small (~250 KB).
"""

from __future__ import annotations

from pathlib import Path

import httpx
import polars as pl
import tenacity

from ..config import Config
from ..fips import FIPS_STATE_MAP
from ..log import get_logger

log = get_logger(__name__)

CENSUS_POPEST_URL = (
    "https://www2.census.gov/programs-surveys/popest/datasets/"
    "2010-2019/counties/totals/co-est2019-alldata.csv"
)
POP_YEAR = 2012  # middle of ARCOS window (2006–2014)


def _state_abbrev(state_fips: str) -> str:
    """Map 2-digit state FIPS to USPS abbreviation via fips.FIPS_STATE_MAP."""
    return FIPS_STATE_MAP[state_fips.zfill(2)]


def parse_popest_csv(path: Path) -> pl.DataFrame:
    """Read a Census PEP CSV and return a clean county-metadata DataFrame.

    Output columns: fips (5-digit str), name (str), state (USPS abbrev), pop (i64).
    Filters out state-summary rows (SUMLEV != 050) and rows missing POPESTIMATE2012.
    """
    # Census CSV is latin-1 encoded (has Spanish accents in Puerto Rico names)
    raw = pl.read_csv(
        path,
        encoding="latin1",
        columns=["SUMLEV", "STATE", "COUNTY", "STNAME", "CTYNAME", "POPESTIMATE2012"],
        infer_schema_length=10000,
    )
    df = (
        raw.filter(pl.col("SUMLEV") == 50)  # county-level only (040 = state summary)
        .filter(pl.col("POPESTIMATE2012").is_not_null())
        .with_columns(
            [
                pl.col("STATE").cast(pl.Utf8).str.zfill(2).alias("_state_fips"),
                pl.col("COUNTY").cast(pl.Utf8).str.zfill(3).alias("_county_fips"),
            ]
        )
        .with_columns(
            [
                (pl.col("_state_fips") + pl.col("_county_fips")).alias("fips"),
                pl.col("CTYNAME").alias("name"),
                pl.col("_state_fips")
                .map_elements(_state_abbrev, return_dtype=pl.Utf8)
                .alias("state"),
                pl.col("POPESTIMATE2012").cast(pl.Int64).alias("pop"),
            ]
        )
        .select(["fips", "name", "state", "pop"])
    )
    log.info("census: loaded %d county rows", len(df))
    return df


@tenacity.retry(
    stop=tenacity.stop_after_attempt(5),
    wait=tenacity.wait_exponential_jitter(initial=1, max=30),
    reraise=True,
)
def _download(url: str, dest: Path, transport: httpx.BaseTransport | None = None) -> None:
    with httpx.Client(transport=transport, timeout=60.0, follow_redirects=True) as client:
        r = client.get(url)
        r.raise_for_status()
        dest.write_bytes(r.content)


def fetch_popest(cfg: Config, transport: httpx.BaseTransport | None = None) -> Path:
    """Download the Census PEP CSV to `data/raw/census/co-est2019-alldata.csv`.

    Returns the path to the downloaded file. Idempotent: if the file already
    exists and is non-empty, returns without re-downloading.
    """
    dest_dir = cfg.raw_dir / "census"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "co-est2019-alldata.csv"
    if dest.exists() and dest.stat().st_size > 0:
        log.info("census: cached at %s", dest)
        return dest
    log.info("census: downloading %s", CENSUS_POPEST_URL)
    _download(CENSUS_POPEST_URL, dest, transport=transport)
    log.info("census: wrote %s (%d bytes)", dest, dest.stat().st_size)
    return dest


def clean_to_parquet(cfg: Config, csv_path: Path) -> Path:
    """Parse Census CSV, write to data/clean/county_metadata.parquet. Returns the output path."""
    df = parse_popest_csv(csv_path)
    cfg.clean_dir.mkdir(parents=True, exist_ok=True)
    out = cfg.clean_dir / "county_metadata.parquet"
    df.write_parquet(out)
    log.info("census: wrote %s (%d rows)", out, len(df))
    return out
