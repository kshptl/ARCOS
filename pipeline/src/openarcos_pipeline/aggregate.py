"""Run SQL aggregations against master.parquet and clean parquets.

Phase 8 stub: `run_single(cfg, name)` runs one SQL file. Full `run_all` lands
in Task 46.
"""
from __future__ import annotations

from pathlib import Path

import duckdb

from .config import Config
from .log import get_logger

log = get_logger(__name__)

SQL_DIR = Path(__file__).resolve().parents[2] / "sql"


def _register_inputs(conn: duckdb.DuckDBPyConnection, cfg: Config) -> None:
    """Register every clean + joined parquet as a DuckDB view."""
    mapping = {
        "master":            cfg.joined_dir / "master.parquet",
        "county_metadata":   cfg.clean_dir / "county_metadata.parquet",
        "wapo_county":       cfg.clean_dir / "wapo_county.parquet",
        "wapo_distributors": cfg.clean_dir / "wapo_distributors.parquet",
        "wapo_pharmacies":   cfg.clean_dir / "wapo_pharmacies.parquet",
        "cdc_overdose":      cfg.clean_dir / "cdc_overdose.parquet",
        "dea_enforcement":   cfg.clean_dir / "dea_enforcement.parquet",
    }
    for view_name, path in mapping.items():
        if path.exists():
            conn.execute(
                f"CREATE OR REPLACE VIEW {view_name} AS "
                f"SELECT * FROM read_parquet('{path}')"
            )


def run_single(cfg: Config, name: str) -> Path:
    """Run sql/<name>.sql and write output to data/agg/<name>.parquet. Returns output path."""
    sql_path = SQL_DIR / f"{name}.sql"
    if not sql_path.exists():
        raise FileNotFoundError(f"SQL file not found: {sql_path}")
    body = sql_path.read_text()
    cfg.agg_dir.mkdir(parents=True, exist_ok=True)
    out = cfg.agg_dir / f"{name}.parquet"
    conn = duckdb.connect()
    try:
        _register_inputs(conn, cfg)
        conn.execute(
            f"COPY ({body}) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)"
        )
    finally:
        conn.close()
    log.info("aggregate: %s → %s", name, out)
    return out
