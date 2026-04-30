"""Join cleaned source parquets into a single master (fips, year) fact table.

Uses DuckDB for the join (polars could do it too, but DuckDB's SQL is more
readable for this and matches the query-builder pattern used in Phase 8).

County metadata provides the canonical FIPS universe; CROSS JOIN with the
requested year range produces the full grid. Each clean parquet LEFT JOINs
into the grid, preserving nulls where a source lacks coverage.
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import duckdb

from .config import Config
from .log import get_logger

log = get_logger(__name__)


def build_master(cfg: Config, years: Iterable[int]) -> Path:
    """Build data/joined/master.parquet from the clean parquets.

    Schema:
        fips       VARCHAR (5-digit)
        year       INTEGER
        pop        BIGINT  — nullable only if Census didn't cover the county
        pills      DOUBLE  — nullable where WaPo has no coverage
        deaths     INTEGER — nullable where CDC has no coverage or suppressed
        suppressed BOOLEAN — True where CDC suppressed the cell, False otherwise

    Returns the path to the written parquet.
    """
    year_list = sorted(set(years))
    if not year_list:
        raise ValueError("years must be non-empty")

    meta_path = cfg.clean_dir / "county_metadata.parquet"
    wapo_path = cfg.clean_dir / "wapo_county.parquet"
    cdc_path = cfg.clean_dir / "cdc_overdose.parquet"

    for p in (meta_path, wapo_path, cdc_path):
        if not p.exists():
            raise FileNotFoundError(
                f"expected clean input {p} is missing; run `openarcos clean` first"
            )

    cfg.joined_dir.mkdir(parents=True, exist_ok=True)
    out = cfg.joined_dir / "master.parquet"

    years_csv = ",".join(f"({y})" for y in year_list)
    sql = f"""
    WITH years(year) AS (VALUES {years_csv}),
    grid AS (
        SELECT m.fips, m.pop, y.year
        FROM read_parquet('{meta_path}') m
        CROSS JOIN years y
    ),
    wapo AS (
        SELECT fips, year, pills FROM read_parquet('{wapo_path}')
    ),
    cdc AS (
        SELECT fips, year, deaths, suppressed FROM read_parquet('{cdc_path}')
    )
    SELECT
        g.fips,
        g.year,
        g.pop,
        w.pills,
        c.deaths,
        COALESCE(c.suppressed, FALSE) AS suppressed
    FROM grid g
    LEFT JOIN wapo w USING (fips, year)
    LEFT JOIN cdc  c USING (fips, year)
    ORDER BY g.fips, g.year
    """

    conn = duckdb.connect()
    try:
        conn.execute(f"COPY ({sql}) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    finally:
        conn.close()

    log.info(
        "join: wrote master.parquet (%d counties × %d years)",
        _count_counties(meta_path),
        len(year_list),
    )
    return out


def _count_counties(meta_path: Path) -> int:
    conn = duckdb.connect()
    try:
        (n,) = conn.execute(f"SELECT COUNT(*) FROM read_parquet('{meta_path}')").fetchone()
        return int(n)
    finally:
        conn.close()
