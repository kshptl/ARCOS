"""CDC cleaned output must round-trip through its JSON schema."""

import json
from pathlib import Path

import jsonschema

from openarcos_pipeline.clean.cdc import parse_d76_response

FIXTURE = Path(__file__).parent / "fixtures" / "cdc" / "wv_2012_2014.xml"
SCHEMA = Path(__file__).parent.parent / "schemas" / "cdc-overdose-by-county-year.schema.json"


def test_cleaned_cdc_matches_schema():
    df = parse_d76_response(FIXTURE.read_text())
    data = df.to_dicts()
    schema = json.loads(SCHEMA.read_text())
    jsonschema.validate(data, schema)
