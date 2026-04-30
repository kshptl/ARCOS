"""Parquet round-trip: emitted file has same content as source aggregation."""

from __future__ import annotations

import hashlib
import shutil

import polars as pl
import pytest

from openarcos_pipeline.config import Config

PARQUET_OUTPUTS = [
    ("county_shipments_by_year", "county-shipments-by-year"),
    ("top_pharmacies", "top-pharmacies"),
    ("cdc_overdose_by_county_year", "cdc-overdose-by-county-year"),
]


@pytest.fixture
def seeded_cfg(tmp_path, agg_master_parquet):
    """Isolate per-test by copying session clean/joined dirs into tmp_path."""
    from openarcos_pipeline.aggregate import run_all

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


def _fingerprint(df: pl.DataFrame) -> str:
    """Sort-stable hash of a DataFrame's content."""
    return hashlib.sha256(df.sort(by=df.columns).write_csv().encode()).hexdigest()


@pytest.mark.parametrize("agg_name,emit_name", PARQUET_OUTPUTS)
def test_parquet_roundtrips_byte_stable(seeded_cfg, agg_name, emit_name):
    import openarcos_pipeline.emit as emit_mod

    emit_mod.emit_all(seeded_cfg)

    src = pl.read_parquet(seeded_cfg.agg_dir / f"{agg_name}.parquet")
    dst = pl.read_parquet(seeded_cfg.emit_dir / f"{emit_name}.parquet")

    # Column set identical
    assert set(src.columns) == set(dst.columns), f"column drift in {emit_name}"

    # Row content identical after sort — emit normalises numeric types to the
    # schema (e.g. pills must be integer). Cast both sides to the dst schema
    # before fingerprinting so casting alone isn't treated as drift.
    dst_schema = dst.schema
    src_normalized = src.select([pl.col(c).cast(dst_schema[c]) for c in dst.columns])
    assert _fingerprint(src_normalized) == _fingerprint(dst), f"content drift in {emit_name}"
