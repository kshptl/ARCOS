"""Full clean pass on fixture data: CDC + DEA + WaPo produce parquets."""

import shutil
from pathlib import Path

from typer.testing import CliRunner

from openarcos_pipeline.cli import app
from openarcos_pipeline.config import Config

runner = CliRunner()
FIX = Path(__file__).parent / "fixtures"


def test_clean_produces_all_parquets(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    # Seed raw dirs with fixtures.
    (cfg.raw_dir / "cdc").mkdir(parents=True, exist_ok=True)
    shutil.copy(FIX / "cdc" / "wv_2012_2014.xml", cfg.raw_dir / "cdc" / "WV_2012-2014.xml")

    (cfg.raw_dir / "dea").mkdir(parents=True, exist_ok=True)
    shutil.copy(
        FIX / "dea" / "diversion_2012_sample.pdf",
        cfg.raw_dir / "dea" / "2012.pdf",
    )

    (cfg.raw_dir / "wapo").mkdir(parents=True, exist_ok=True)
    # Copy the county_raw fixture under the runner-expected naming.
    shutil.copy(
        FIX / "wapo" / "county_2012_54059.json",
        cfg.raw_dir / "wapo" / "county_raw_WV_Mingo.json",
    )
    shutil.copy(
        FIX / "wapo" / "distributors_54059.json",
        cfg.raw_dir / "wapo" / "distributors_WV_Mingo.json",
    )
    shutil.copy(
        FIX / "wapo" / "pharmacies_54059.json",
        cfg.raw_dir / "wapo" / "pharmacies_WV_Mingo.json",
    )

    result = runner.invoke(app, ["clean"])
    assert result.exit_code == 0, result.stdout

    assert (cfg.clean_dir / "cdc_overdose.parquet").exists()
    assert (cfg.clean_dir / "dea_enforcement.parquet").exists()
    assert (cfg.clean_dir / "wapo_county.parquet").exists()
    assert (cfg.clean_dir / "wapo_distributors.parquet").exists()
    assert (cfg.clean_dir / "wapo_pharmacies.parquet").exists()
