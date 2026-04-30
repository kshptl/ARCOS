"""End-to-end CLI test: seed raw/, run clean + join, assert master.parquet content."""

from __future__ import annotations

import shutil
from pathlib import Path

import polars as pl
from typer.testing import CliRunner

from openarcos_pipeline.cli import app


def _seed_raw(raw_dir: Path, fixtures_dir: Path) -> None:
    (raw_dir / "census").mkdir(parents=True, exist_ok=True)
    shutil.copy(
        fixtures_dir / "census" / "co-est2019-sample.csv",
        raw_dir / "census" / "co-est2019-alldata.csv",
    )

    (raw_dir / "wapo").mkdir(parents=True, exist_ok=True)
    # Single WaPo fixture covers 54059
    shutil.copy(
        fixtures_dir / "wapo" / "county_2012_54059.json",
        raw_dir / "wapo" / "county_WV_54059.json",
    )

    (raw_dir / "cdc").mkdir(parents=True, exist_ok=True)
    shutil.copy(
        fixtures_dir / "cdc" / "wv_2012_2014.xml",
        raw_dir / "cdc" / "WV_2012-2014.xml",
    )


def test_cli_clean_then_join_produces_valid_master(tmp_path, fixtures_dir, monkeypatch):
    data_root = tmp_path / "data"
    emit_dir = tmp_path / "emit"
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(data_root))
    monkeypatch.setenv("OPENARCOS_EMIT_DIR", str(emit_dir))

    _seed_raw(data_root / "raw", fixtures_dir)

    runner = CliRunner()
    # Clean
    result = runner.invoke(app, ["clean"])
    assert result.exit_code == 0, result.stdout
    # Join, narrower window for test determinism
    result = runner.invoke(app, ["join", "--years-start", "2011", "--years-end", "2013"])
    assert result.exit_code == 0, result.stdout

    master = data_root / "joined" / "master.parquet"
    assert master.exists()
    df = pl.read_parquet(master)
    # 4 counties × 3 years = 12 rows (per Census fixture which has 4 counties)
    assert len(df) == 12
    assert set(df.columns) == {"fips", "year", "pop", "pills", "deaths", "suppressed"}
    # 54059 should have a non-null pills figure in 2012 (the year the WaPo fixture covers)
    mingo_2012 = df.filter((pl.col("fips") == "54059") & (pl.col("year") == 2012)).to_dicts()[0]
    assert mingo_2012["pills"] is not None and mingo_2012["pills"] > 0
