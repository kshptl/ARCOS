"""FIPS helpers: normalize, validate, state-from-FIPS."""

import json
from pathlib import Path

import pytest

from openarcos_pipeline.fips import is_valid_fips, normalize_fips, state_from_fips

CASES = json.loads((Path(__file__).parent / "fixtures" / "fips_cases.json").read_text())


@pytest.mark.parametrize("case", CASES["normalize_ok"])
def test_normalize_ok(case):
    assert normalize_fips(case["in"]) == case["out"]


@pytest.mark.parametrize("bad", CASES["normalize_fail"])
def test_normalize_fail(bad):
    with pytest.raises((ValueError, TypeError)):
        normalize_fips(bad)


@pytest.mark.parametrize("case", CASES["state_from_fips"])
def test_state_from_fips(case):
    assert state_from_fips(case["fips"]) == case["state"]


@pytest.mark.parametrize("fips", CASES["valid_fips"])
def test_valid_fips(fips):
    assert is_valid_fips(fips)


@pytest.mark.parametrize("fips", CASES["invalid_fips"])
def test_invalid_fips(fips):
    assert not is_valid_fips(fips)
