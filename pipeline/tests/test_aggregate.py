"""Tests for Phase 8 SQL aggregations. Snapshot-based."""
from __future__ import annotations

import os
from pathlib import Path

import polars as pl
import pytest

from openarcos_pipeline.aggregate import run_single


SNAPSHOTS = Path(__file__).parent / "snapshots"


def _assert_snapshot(df: pl.DataFrame, snap: Path) -> None:
    """Compare a DataFrame against a CSV snapshot. Supports regeneration via env var."""
    actual_csv = df.write_csv()
    if os.environ.get("PYTEST_UPDATE_SNAPSHOTS") == "1":
        snap.parent.mkdir(parents=True, exist_ok=True)
        snap.write_text(actual_csv)
        return
    if not snap.exists():
        pytest.fail(
            f"Snapshot missing: {snap}\n"
            f"Re-run with PYTEST_UPDATE_SNAPSHOTS=1 to create it.\n"
            f"Actual content:\n{actual_csv}"
        )
    expected = snap.read_text()
    if actual_csv != expected:
        pytest.fail(
            f"Snapshot mismatch for {snap.name}\n"
            f"--- expected\n{expected}\n--- actual\n{actual_csv}"
        )


def test_state_shipments_by_year(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "state_shipments_by_year")
    df = pl.read_parquet(out).sort(["state_fips", "year"])
    _assert_snapshot(df, SNAPSHOTS / "state_shipments_by_year.expected.csv")
