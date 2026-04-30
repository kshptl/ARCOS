"""End-to-end: `openarcos all --skip-fetch` against seeded raw fixtures produces all 8 artifacts, all valid."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import jsonschema
import polars as pl
import pytest
from typer.testing import CliRunner

from openarcos_pipeline.cli import app

SCHEMAS_DIR = Path(__file__).resolve().parents[1] / "schemas"

EXPECTED_OUTPUTS = {
    "county-metadata.json": "county-metadata",
    "state-shipments-by-year.json": "state-shipments-by-year",
    "top-distributors-by-year.json": "top-distributors-by-year",
    "dea-enforcement-actions.json": "dea-enforcement-actions",
    "search-index.json": "search-index",
    "county-shipments-by-year.parquet": "county-shipments-by-year",
    "top-pharmacies.parquet": "top-pharmacies",
    "cdc-overdose-by-county-year.parquet": "cdc-overdose-by-county-year",
}


def _seed_raw(raw_dir: Path, fixtures_dir: Path) -> None:
    """Same seeding as test_e2e_through_aggregate."""
    (raw_dir / "census").mkdir(parents=True, exist_ok=True)
    shutil.copy(fixtures_dir / "census" / "co-est2019-sample.csv",
                raw_dir / "census" / "co-est2019-alldata.csv")
    (raw_dir / "wapo").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "wapo").glob("*.json"):
        if src.name.startswith(("county_", "distributors_", "pharmacies_")):
            shutil.copy(src, raw_dir / "wapo" / src.name)
    (raw_dir / "cdc").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "cdc").glob("*.xml"):
        shutil.copy(src, raw_dir / "cdc" / src.name)
    (raw_dir / "dea").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "dea").glob("*.pdf"):
        stem = src.stem.replace("diversion_", "").replace("_sample", "")
        shutil.copy(src, raw_dir / "dea" / f"{stem}.pdf")


def test_all_skip_fetch_produces_valid_artifacts(tmp_path, fixtures_dir, monkeypatch):
    data_root = tmp_path / "data"
    emit_dir = tmp_path / "emit"
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(data_root))
    monkeypatch.setenv("OPENARCOS_EMIT_DIR", str(emit_dir))
    _seed_raw(data_root / "raw", fixtures_dir)

    runner = CliRunner()
    result = runner.invoke(app, ["all", "--skip-fetch", "--years-start", "2011", "--years-end", "2013"])
    assert result.exit_code == 0, result.stdout

    # All 8 expected files present
    for filename in EXPECTED_OUTPUTS:
        assert (emit_dir / filename).exists(), f"missing: {filename}"

    # Every JSON artifact validates against its schema
    for filename, schema_name in EXPECTED_OUTPUTS.items():
        schema = json.loads((SCHEMAS_DIR / f"{schema_name}.schema.json").read_text())
        path = emit_dir / filename
        if path.suffix == ".json":
            jsonschema.validate(instance=json.loads(path.read_text()), schema=schema)
        else:
            # Parquet: read, materialise, validate rows
            df = pl.read_parquet(path)
            jsonschema.validate(instance=df.to_dicts(), schema=schema)
