"""Validate fixtures against schemas."""

import json
from pathlib import Path

import jsonschema
import pytest

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def _validate(schema_name: str, fixture_name: str) -> None:
    schema = load_json(SCHEMAS_DIR / f"{schema_name}.schema.json")
    data = load_json(FIXTURES_DIR / fixture_name)
    jsonschema.validate(data, schema)


def test_county_metadata_sample_valid():
    _validate("county-metadata", "county-metadata.sample.json")


def test_county_metadata_invalid_rejected():
    schema = load_json(SCHEMAS_DIR / "county-metadata.schema.json")
    data = load_json(FIXTURES_DIR / "county-metadata.invalid.json")
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(data, schema)


def test_state_shipments_sample_valid():
    _validate("state-shipments-by-year", "state-shipments-by-year.sample.json")


def test_county_shipments_sample_valid():
    _validate("county-shipments-by-year", "county-shipments-by-year.sample.json")


def test_top_distributors_sample_valid():
    _validate("top-distributors-by-year", "top-distributors-by-year.sample.json")


def test_top_pharmacies_sample_valid():
    _validate("top-pharmacies", "top-pharmacies.sample.json")


def test_dea_enforcement_sample_valid():
    _validate("dea-enforcement-actions", "dea-enforcement-actions.sample.json")


def test_cdc_overdose_sample_valid():
    _validate("cdc-overdose-by-county-year", "cdc-overdose-by-county-year.sample.json")


def test_cdc_overdose_suppressed_with_deaths_rejected():
    """A row claiming suppressed=true with deaths set must be rejected."""
    schema = load_json(SCHEMAS_DIR / "cdc-overdose-by-county-year.schema.json")
    bad = [{"fips": "54059", "year": 2003, "deaths": 5, "suppressed": True}]
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, schema)


def test_search_index_sample_valid():
    _validate("search-index", "search-index.sample.json")
