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
