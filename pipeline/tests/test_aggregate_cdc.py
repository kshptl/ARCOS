"""Aggregator: raw CDC WONDER TSVs → processed county_overdose artifact."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest

from openarcos_pipeline.aggregate_cdc import (
    aggregate_cdc_raw,
    build_processed_artifact,
    load_all_tsv,
)

FIXTURES = Path(__file__).parent / "fixtures" / "cdc_wonder"
SAMPLE_TSV = FIXTURES / "sample_wv_2006_2014.tsv"
SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "cdc_county_overdose.schema.json"


def _make_cache(tmp_path: Path) -> Path:
    cache = tmp_path / "raw" / "cdc"
    cache.mkdir(parents=True)
    # Single-state fixture: pretend it's "54_WV".
    (cache / "54_WV.tsv").write_text(SAMPLE_TSV.read_text())
    return cache


def test_load_all_tsv_reads_every_tsv_in_dir(tmp_path):
    cache = _make_cache(tmp_path)
    records = load_all_tsv(cache)
    # Fixture has 5 non-suppressed/non-missing rows: Berkeley 2006/2010,
    # Mingo 2010/2012, Cabell 2014 + one suppressed (Webster 2010) = 6
    # non-missing rows total. Missing row skipped.
    assert len(records) == 6
    assert all(len(r["county_fips"]) == 5 for r in records)


def test_aggregate_produces_county_year_records(tmp_path):
    cache = _make_cache(tmp_path)
    records = aggregate_cdc_raw(cache)
    # 5 non-suppressed + 1 suppressed = 6 rows.
    assert len(records) == 6
    # Mingo 2010 preserved.
    mingo = next(r for r in records if r["county_fips"] == "54059" and r["year"] == 2010)
    assert mingo["deaths"] == 14
    assert mingo["suppressed"] is False
    assert mingo["unreliable"] is True


def test_aggregate_deduplicates_by_fips_year(tmp_path):
    """Two TSVs with overlapping (county_fips, year) → keep first; no dupes."""
    cache = tmp_path / "raw" / "cdc"
    cache.mkdir(parents=True)
    (cache / "54_WV.tsv").write_text(SAMPLE_TSV.read_text())
    # Duplicate of the same TSV under a different state file name; should
    # not double-count Mingo 2010.
    (cache / "54_WV_copy.tsv").write_text(SAMPLE_TSV.read_text())
    records = aggregate_cdc_raw(cache)
    keys = [(r["county_fips"], r["year"]) for r in records]
    assert len(keys) == len(set(keys)), f"duplicate keys: {keys}"


def test_aggregate_preserves_suppressed(tmp_path):
    cache = _make_cache(tmp_path)
    records = aggregate_cdc_raw(cache)
    webster_2010 = next(r for r in records if r["county_fips"] == "54101" and r["year"] == 2010)
    assert webster_2010["deaths"] is None
    assert webster_2010["suppressed"] is True


def test_processed_artifact_validates_against_schema(tmp_path):
    cache = _make_cache(tmp_path)
    artifact = build_processed_artifact(cache)
    schema = json.loads(SCHEMA_PATH.read_text())
    jsonschema.validate(artifact, schema)


def test_processed_artifact_contains_methodology(tmp_path):
    cache = _make_cache(tmp_path)
    artifact = build_processed_artifact(cache)
    assert "D1" in artifact["methodology"] or "X40" in artifact["methodology"]
    assert artifact["source"].startswith("https://wonder.cdc.gov")
    assert artifact["fetched_at"]  # non-empty ISO-8601 timestamp
    assert artifact["totals"]["records"] == len(artifact["records"])


def test_processed_artifact_sanity_counts_real_scrape():
    """Against the real scraped cache (data/raw/cdc), the totals should
    be in the expected range.

    Skipped when the cache isn't present (e.g. a fresh checkout that
    hasn't run the live scraper).
    """
    real_cache = Path(__file__).parent.parent / "data" / "raw" / "cdc"
    tsvs = list(real_cache.glob("*.tsv"))
    if len(tsvs) < 51:
        pytest.skip(
            f"real CDC cache incomplete: {len(tsvs)} TSVs (need 51). "
            "Run `python -m openarcos_pipeline.sources.cdc_wonder_scraper "
            "--all-states --cache-dir data/raw/cdc` first."
        )
    artifact = build_processed_artifact(real_cache)
    # Total records ≤ 3136 counties × 9 years = 28,224 (plus a few
    # because CDC's export sometimes includes both 0-cell rows and
    # Suppressed rows for the same county-year, depending on the
    # show-zeros/show-suppressed toggles). Accept up to +500 slack.
    assert 20_000 <= len(artifact["records"]) <= 28_800
    # A large publishable subset remains after the <=9 suppression floor.
    non_sup = sum(1 for r in artifact["records"] if not r["suppressed"])
    assert non_sup >= 6_000
    assert all(r["deaths"] is None or r["deaths"] >= 10 for r in artifact["records"])
    # Mingo WV 2010 ≥ 10 (publishable).
    mingo_2010 = next(
        r for r in artifact["records"] if r["county_fips"] == "54059" and r["year"] == 2010
    )
    assert mingo_2010["deaths"] is not None
    assert 10 <= mingo_2010["deaths"] <= 20
