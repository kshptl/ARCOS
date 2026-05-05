"""CLI clean: ingests raw CDC TSVs and emits data/clean/cdc.parquet."""

import shutil
from pathlib import Path

import polars as pl
from typer.testing import CliRunner

from openarcos_pipeline.cli import app
from openarcos_pipeline.config import Config

runner = CliRunner()
FIXTURE = Path(__file__).parent / "fixtures" / "cdc_wonder" / "sample_wv_2006_2014.tsv"


def test_clean_cdc_produces_parquet(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()
    cdc_raw = cfg.raw_dir / "cdc"
    cdc_raw.mkdir(parents=True, exist_ok=True)
    shutil.copy(FIXTURE, cdc_raw / "54_WV.tsv")

    result = runner.invoke(app, ["clean"])
    assert result.exit_code == 0, result.stdout

    out = cfg.clean_dir / "cdc_overdose.parquet"
    assert out.exists()
    df = pl.read_parquet(out)
    assert set(df.columns) == {"fips", "year", "deaths", "suppressed"}
