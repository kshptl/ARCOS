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
            f"Snapshot mismatch for {snap.name}\n--- expected\n{expected}\n--- actual\n{actual_csv}"
        )


def test_state_shipments_by_year(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "state_shipments_by_year")
    df = pl.read_parquet(out).sort(["state_fips", "year"])
    _assert_snapshot(df, SNAPSHOTS / "state_shipments_by_year.expected.csv")


def test_county_shipments_by_year(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "county_shipments_by_year")
    df = pl.read_parquet(out).sort(["fips", "year"])
    _assert_snapshot(df, SNAPSHOTS / "county_shipments_by_year.expected.csv")


def test_top_distributors_by_year(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "top_distributors_by_year")
    df = pl.read_parquet(out).sort(["year", "pills"], descending=[False, True])
    _assert_snapshot(df, SNAPSHOTS / "top_distributors_by_year.expected.csv")


def test_top_pharmacies(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "top_pharmacies")
    df = pl.read_parquet(out).sort("total_pills", descending=True)
    _assert_snapshot(df, SNAPSHOTS / "top_pharmacies.expected.csv")


def test_cdc_overdose_preserves_suppressed(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "cdc_overdose_by_county_year")
    df = pl.read_parquet(out).sort(["fips", "year"])
    # Structural invariants (spec §4 watch-out #1)
    rows = df.to_dicts()
    for r in rows:
        assert r["suppressed"] in (True, False)
        if r["suppressed"]:
            assert r["deaths"] is None, f"suppressed row had non-null deaths: {r}"
        else:
            assert isinstance(r["deaths"], int) and r["deaths"] >= 10, f"bad unsuppressed row: {r}"
    _assert_snapshot(df, SNAPSHOTS / "cdc_overdose_by_county_year.expected.csv")


def test_dea_enforcement_passthrough(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "dea_enforcement")
    df = pl.read_parquet(out).sort("year")
    # notable_actions is a list of structs — normalize to JSON strings for snapshotting
    df2 = df.with_columns(
        pl.col("notable_actions")
        .map_elements(
            lambda v: str(v) if v is not None else "[]",
            return_dtype=pl.Utf8,
        )
        .alias("notable_actions")
    )
    _assert_snapshot(df2, SNAPSHOTS / "dea_enforcement.expected.csv")


def test_search_index(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "search_index")
    df = pl.read_parquet(out).sort(["type", "id"])
    # Every row has a non-empty label and id
    assert df["id"].null_count() == 0
    assert (df["id"].str.len_chars() > 0).all()
    assert df["label"].null_count() == 0
    # All types are from the known set
    assert set(df["type"].unique().to_list()).issubset(
        {"county", "city", "zip", "distributor", "pharmacy"}
    )
    _assert_snapshot(df, SNAPSHOTS / "search_index.expected.csv")


def test_run_all_produces_all_artifacts(agg_master_parquet):
    cfg = agg_master_parquet
    from openarcos_pipeline.aggregate import discover_sql, run_all

    outputs = run_all(cfg)
    names = {p.stem for p in outputs}
    discovered = set(discover_sql())
    # run_all skips any SQL whose input views aren't registered. The
    # agg_master fixture supplies the core views but not wapo_distributors_by_county,
    # so county_top_distributors is expected to be absent from the outputs.
    expected = discovered - {"county_top_distributors"}
    assert names == expected
    # Every artifact should be a non-empty parquet
    for p in outputs:
        assert p.exists() and p.stat().st_size > 0, p
