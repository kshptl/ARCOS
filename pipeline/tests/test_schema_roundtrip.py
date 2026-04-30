"""Every schema in schemas/ must have a matching *.sample.json fixture that validates."""

import json
from pathlib import Path

import jsonschema

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_every_schema_has_matching_fixture():
    schema_files = sorted(SCHEMAS_DIR.glob("*.schema.json"))
    assert schema_files, "no schemas found"

    missing: list[str] = []
    for schema_file in schema_files:
        name = schema_file.name.replace(".schema.json", "")
        fixture = FIXTURES_DIR / f"{name}.sample.json"
        if not fixture.exists():
            missing.append(name)
            continue
        with schema_file.open() as f:
            schema = json.load(f)
        with fixture.open() as f:
            data = json.load(f)
        jsonschema.validate(data, schema)

    assert not missing, f"schemas without fixtures: {missing}"
