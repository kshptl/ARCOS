"""Tests for master.parquet construction."""
from __future__ import annotations

from pathlib import Path

import polars as pl
import pytest

from openarcos_pipeline.config import Config
from openarcos_pipeline.join import build_master


def _write_clean_inputs(clean_dir: Path) -> None:
    """Seed clean parquets for a 3-county × 3-year toy world.

    County universe: 54059 (Mingo WV, pop 25764), 51720 (Norton VA, pop 3892),
    21119 (Knott KY, pop 16232).
    Years: 2011–2013.
    WaPo shipments cover only 54059 and 21119 (Norton is sparse).
    CDC overdoses cover 54059 only; Knott has all years suppressed.
    """
    clean_dir.mkdir(parents=True, exist_ok=True)

    pl.DataFrame({
        "fips": ["54059", "51720", "21119"],
        "name": ["Mingo County", "Norton city", "Knott County"],
        "state": ["WV", "VA", "KY"],
        "pop": [25764, 3892, 16232],
    }).write_parquet(clean_dir / "county_metadata.parquet")

    pl.DataFrame({
        "fips":  ["54059", "54059", "54059", "21119", "21119", "21119"],
        "year":  [  2011 ,   2012 ,   2013 ,   2011 ,   2012 ,   2013 ],
        "pills": [4_000_000, 6_000_000, 5_000_000, 1_500_000, 2_100_000, 1_900_000],
    }).write_parquet(clean_dir / "wapo_county.parquet")

    pl.DataFrame({
        "fips":       ["54059", "54059", "54059", "21119", "21119", "21119"],
        "year":       [  2011 ,   2012 ,   2013 ,   2011 ,   2012 ,   2013 ],
        "deaths":     [    42 ,     55 ,     61 ,   None ,   None ,   None ],
        "suppressed": [ False ,  False ,  False ,   True ,   True ,   True ],
    }).write_parquet(clean_dir / "cdc_overdose.parquet")


def test_build_master_produces_full_grid(tmp_path):
    cfg = Config(data_root=tmp_path / "data", emit_dir=tmp_path / "emit")
    cfg.ensure_dirs()
    _write_clean_inputs(cfg.clean_dir)

    out = build_master(cfg, years=range(2011, 2014))

    assert out.exists()
    df = pl.read_parquet(out)
    # 3 counties × 3 years = 9 rows
    assert len(df) == 9
    assert set(df.columns) == {"fips", "year", "pop", "pills", "deaths", "suppressed"}
    # Every (fips, year) combination exactly once
    assert df.group_by(["fips", "year"]).len()["len"].max() == 1


def test_build_master_left_joins_sparse_coverage(tmp_path):
    cfg = Config(data_root=tmp_path / "data", emit_dir=tmp_path / "emit")
    cfg.ensure_dirs()
    _write_clean_inputs(cfg.clean_dir)

    out = build_master(cfg, years=range(2011, 2014))
    df = pl.read_parquet(out)

    # Norton (51720) has no WaPo and no CDC rows → pills and deaths null
    norton = df.filter(pl.col("fips") == "51720").sort("year").to_dicts()
    assert all(r["pills"] is None for r in norton)
    assert all(r["deaths"] is None for r in norton)
    # suppressed defaults to False for rows with no CDC source (not True)
    assert all(r["suppressed"] is False for r in norton)


def test_build_master_preserves_suppressed_flag(tmp_path):
    cfg = Config(data_root=tmp_path / "data", emit_dir=tmp_path / "emit")
    cfg.ensure_dirs()
    _write_clean_inputs(cfg.clean_dir)

    out = build_master(cfg, years=range(2011, 2014))
    df = pl.read_parquet(out)

    knott = df.filter(pl.col("fips") == "21119").sort("year").to_dicts()
    assert all(r["suppressed"] is True for r in knott)
    assert all(r["deaths"] is None for r in knott)


def test_build_master_year_range_is_inclusive_of_endpoints(tmp_path):
    cfg = Config(data_root=tmp_path / "data", emit_dir=tmp_path / "emit")
    cfg.ensure_dirs()
    _write_clean_inputs(cfg.clean_dir)

    out = build_master(cfg, years=range(2011, 2014))
    df = pl.read_parquet(out)

    years = sorted(set(df["year"].to_list()))
    assert years == [2011, 2012, 2013]
