"""End-to-end: fixture raw files → clean → join → aggregate. Exits 0 and writes every expected parquet."""

from __future__ import annotations

import shutil
from pathlib import Path

import polars as pl
from typer.testing import CliRunner

from openarcos_pipeline.aggregate import discover_sql
from openarcos_pipeline.cli import app


def _seed_raw(raw_dir: Path, fixtures_dir: Path) -> None:
    (raw_dir / "census").mkdir(parents=True, exist_ok=True)
    shutil.copy(
        fixtures_dir / "census" / "co-est2019-sample.csv",
        raw_dir / "census" / "co-est2019-alldata.csv",
    )

    (raw_dir / "wapo").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "wapo").glob("*.json"):
        # Canonicalise filenames so clean step picks them up
        if (
            src.name.startswith("county_")
            or src.name.startswith("distributors_")
            or src.name.startswith("pharmacies_")
        ):
            shutil.copy(src, raw_dir / "wapo" / src.name)

    (raw_dir / "cdc").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "cdc").glob("*.xml"):
        shutil.copy(src, raw_dir / "cdc" / src.name)

    (raw_dir / "dea").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "dea").glob("*.pdf"):
        # Rename to <year>.pdf convention if needed
        stem = src.stem.replace("diversion_", "").replace("_sample", "")
        shutil.copy(src, raw_dir / "dea" / f"{stem}.pdf")


def test_full_pipeline_through_aggregate(tmp_path, fixtures_dir, monkeypatch):
    data_root = tmp_path / "data"
    emit_dir = tmp_path / "emit"
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(data_root))
    monkeypatch.setenv("OPENARCOS_EMIT_DIR", str(emit_dir))

    _seed_raw(data_root / "raw", fixtures_dir)

    runner = CliRunner()
    for cmd in (["clean"], ["join", "--years-start", "2011", "--years-end", "2013"], ["aggregate"]):
        result = runner.invoke(app, cmd)
        assert result.exit_code == 0, f"command {cmd} failed:\n{result.stdout}"

    agg_dir = data_root / "agg"
    produced = {p.stem for p in agg_dir.glob("*.parquet")}
    assert produced == set(discover_sql())
    for name in discover_sql():
        df = pl.read_parquet(agg_dir / f"{name}.parquet")
        assert df.height > 0, f"empty aggregation: {name}"
