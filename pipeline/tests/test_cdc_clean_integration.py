"""CLI clean: ingests raw CDC XMLs and emits data/clean/cdc.parquet."""

import shutil
from pathlib import Path

import polars as pl
from typer.testing import CliRunner

from openarcos_pipeline.cli import app
from openarcos_pipeline.config import Config

runner = CliRunner()
FIXTURE = Path(__file__).parent / "fixtures" / "cdc" / "wv_2012_2014.xml"


def test_clean_cdc_produces_parquet(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()
    cdc_raw = cfg.raw_dir / "cdc"
    cdc_raw.mkdir(parents=True, exist_ok=True)
    shutil.copy(FIXTURE, cdc_raw / "WV_2012-2014.xml")

    result = runner.invoke(app, ["clean"])
    assert result.exit_code == 0, result.stdout

    out = cfg.clean_dir / "cdc_overdose.parquet"
    assert out.exists()
    df = pl.read_parquet(out)
    assert set(df.columns) == {"fips", "year", "deaths", "suppressed"}
