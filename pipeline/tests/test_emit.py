"""Tests for emit.py: JSON/Parquet emission + schema validation."""

from __future__ import annotations

import json
import shutil

import polars as pl
import pytest

from openarcos_pipeline.config import Config
from openarcos_pipeline.emit import (
    SchemaValidationError,
    emit_county_metadata_json,
    emit_dea_enforcement_json,
    emit_search_index_json,
    emit_state_shipments_json,
    emit_top_distributors_json,
)


@pytest.fixture
def seeded_cfg(tmp_path, agg_master_parquet):
    """Re-run agg_master setup into a per-test writable data_root so emit tests
    are isolated from each other.
    """
    from openarcos_pipeline.aggregate import run_all

    # Copy the session-scoped clean/joined dirs into a per-test data_root so
    # tests cannot corrupt each other.
    src = agg_master_parquet
    data_root = tmp_path / "data"
    cfg = Config(data_root=data_root, emit_dir=tmp_path / "emit")
    cfg.ensure_dirs()
    for sub in ("clean", "joined"):
        src_dir = src.data_root / sub
        dst_dir = data_root / sub
        if src_dir.is_dir():
            for f in src_dir.iterdir():
                shutil.copy(f, dst_dir / f.name)
    run_all(cfg)
    cfg.emit_dir.mkdir(parents=True, exist_ok=True)
    return cfg


def test_emit_state_shipments_json_validates_and_writes(seeded_cfg):
    out = emit_state_shipments_json(seeded_cfg)
    assert out.exists()
    data = json.loads(out.read_text())
    assert isinstance(data, list)
    for row in data:
        assert set(row.keys()) == {"state", "year", "pills", "pills_per_capita"}
        assert len(row["state"]) == 2
        assert 2006 <= row["year"] <= 2014
        assert row["pills"] >= 0


def test_emit_county_metadata_json(seeded_cfg):
    out = emit_county_metadata_json(seeded_cfg)
    data = json.loads(out.read_text())
    assert len(data) >= 3
    for row in data:
        assert set(row.keys()) == {"fips", "name", "state", "pop"}
        assert len(row["fips"]) == 5


def test_emit_top_distributors_json(seeded_cfg):
    out = emit_top_distributors_json(seeded_cfg)
    data = json.loads(out.read_text())
    for row in data:
        assert set(row.keys()) == {"distributor", "year", "pills", "share_pct"}
        assert 0 <= row["share_pct"] <= 100


def test_emit_dea_enforcement_json(seeded_cfg):
    out = emit_dea_enforcement_json(seeded_cfg)
    data = json.loads(out.read_text())
    for row in data:
        assert set(row.keys()) == {"year", "action_count", "notable_actions"}
        assert isinstance(row["notable_actions"], list)
        for action in row["notable_actions"]:
            assert "title" in action and "url" in action


def test_emit_search_index_json(seeded_cfg):
    out = emit_search_index_json(seeded_cfg)
    data = json.loads(out.read_text())
    for row in data:
        assert row["type"] in {"county", "city", "zip", "distributor", "pharmacy"}
        assert "id" in row and "name" in row


def test_emit_rejects_bad_shape(seeded_cfg):
    """If the source parquet has rows that violate the schema, emit must raise without writing."""
    # Corrupt the state_shipments agg by writing a row with an invalid state code
    bad = pl.DataFrame(
        {
            "state_fips": ["QQ"],
            "year": [2012],
            "pills": [100.0],
            "pills_per_capita": [0.1],
        }
    )
    bad.write_parquet(seeded_cfg.agg_dir / "state_shipments_by_year.parquet")
    with pytest.raises(SchemaValidationError):
        emit_state_shipments_json(seeded_cfg)


def test_emit_county_shipments_parquet(seeded_cfg):
    from openarcos_pipeline.emit import emit_county_shipments_parquet

    out = emit_county_shipments_parquet(seeded_cfg)
    df = pl.read_parquet(out)
    assert set(df.columns) == {"fips", "year", "pills", "pills_per_capita"}
    assert df.height > 0


def test_emit_top_pharmacies_parquet(seeded_cfg):
    from openarcos_pipeline.emit import emit_top_pharmacies_parquet

    out = emit_top_pharmacies_parquet(seeded_cfg)
    df = pl.read_parquet(out)
    assert set(df.columns) == {"pharmacy_id", "name", "address", "fips", "total_pills"}


def test_emit_cdc_overdose_parquet(seeded_cfg):
    from openarcos_pipeline.emit import emit_cdc_overdose_parquet

    out = emit_cdc_overdose_parquet(seeded_cfg)
    df = pl.read_parquet(out)
    assert set(df.columns) == {"fips", "year", "deaths", "suppressed"}
    # Suppression invariants preserved
    for r in df.to_dicts():
        if r["suppressed"]:
            assert r["deaths"] is None


def test_emit_all_produces_eight_artifacts(seeded_cfg):
    from openarcos_pipeline.emit import emit_all

    outs = emit_all(seeded_cfg)
    # 5 JSON + 3 Parquet = 8 total
    names = {p.name for p in outs}
    assert names == {
        "county-metadata.json",
        "state-shipments-by-year.json",
        "top-distributors-by-year.json",
        "dea-enforcement-actions.json",
        "search-index.json",
        "county-shipments-by-year.parquet",
        "top-pharmacies.parquet",
        "cdc-overdose-by-county-year.parquet",
    }
    for p in outs:
        assert p.stat().st_size > 0
