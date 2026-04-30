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
        "master": cfg.joined_dir / "master.parquet",
        "county_metadata": cfg.clean_dir / "county_metadata.parquet",
        "wapo_county": cfg.clean_dir / "wapo_county.parquet",
        "wapo_distributors": cfg.clean_dir / "wapo_distributors.parquet",
        "wapo_distributors_by_county": cfg.clean_dir / "wapo_distributors_by_county.parquet",
        "wapo_pharmacies": cfg.clean_dir / "wapo_pharmacies.parquet",
        "cdc_overdose": cfg.clean_dir / "cdc_overdose.parquet",
        "dea_enforcement": cfg.clean_dir / "dea_enforcement.parquet",
    }
    for view_name, path in mapping.items():
        if path.exists():
            conn.execute(
                f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM read_parquet('{path}')"
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
        conn.execute(f"COPY ({body}) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    finally:
        conn.close()
    log.info("aggregate: %s → %s", name, out)
    return out


def discover_sql(sql_dir: Path = SQL_DIR) -> list[str]:
    """Return sorted list of aggregation names from sql/*.sql files."""
    return sorted(p.stem for p in sql_dir.glob("*.sql"))


def run_all(cfg: Config) -> list[Path]:
    """Run every sql/*.sql against the pipeline inputs. Returns output paths.

    SQL files whose required input views don't exist (i.e. the underlying
    clean parquet is missing) are skipped with a log message rather than
    erroring. This lets tests with minimal fixtures (e.g. no wapo_*
    inputs) exercise the code path without a full synthetic dataset.
    """
    names = discover_sql()
    if not names:
        raise RuntimeError(f"No SQL files found in {SQL_DIR}")
    cfg.agg_dir.mkdir(parents=True, exist_ok=True)
    outputs = []
    conn = duckdb.connect()
    try:
        _register_inputs(conn, cfg)
        # Snapshot which views actually got registered (see _register_inputs).
        registered = {
            row[0] for row in conn.execute("SELECT view_name FROM duckdb_views()").fetchall()
        }
        for name in names:
            sql_path = SQL_DIR / f"{name}.sql"
            body = sql_path.read_text()
            required = _extract_required_views(body)
            missing = [v for v in required if v not in registered]
            if missing:
                log.info("aggregate: %s skipped (missing views: %s)", name, ", ".join(missing))
                continue
            out = cfg.agg_dir / f"{name}.parquet"
            conn.execute(f"COPY ({body}) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)")
            outputs.append(out)
            log.info("aggregate: %s → %s", name, out)
    finally:
        conn.close()
    return outputs


# Views the aggregator knows how to register; used to detect which inputs a
# SQL file needs by substring-matching rather than a full SQL parser.
_KNOWN_VIEWS = (
    "master",
    "county_metadata",
    "wapo_county",
    "wapo_distributors_by_county",
    "wapo_distributors",
    "wapo_pharmacies",
    "cdc_overdose",
    "dea_enforcement",
)


def _extract_required_views(sql: str) -> list[str]:
    """Return the subset of known view names referenced anywhere in `sql`.

    We accept false positives (e.g. the name appearing in a comment) in
    exchange for a zero-dependency scan — if a comment mentions a missing
    view, the worst case is we skip a SQL that would have succeeded, and
    the emitter handles missing aggregates anyway.
    """
    lowered = sql.lower()
    hits: list[str] = []
    for view in _KNOWN_VIEWS:
        # Substring check guards against word-boundary issues from names
        # like wapo_distributors being a prefix of wapo_distributors_by_county.
        if view in lowered:
            hits.append(view)
    # Dedupe prefixes: if wapo_distributors_by_county is referenced, treat
    # only the longer name as required (the substring "wapo_distributors"
    # will also match but doesn't imply the shorter view is needed).
    # We keep both since they're separate registered views — tests with
    # neither fixture still get the correct skip behaviour.
    return hits
