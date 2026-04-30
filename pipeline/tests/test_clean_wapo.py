"""clean/wapo: takes raw WaPo JSON, emits canonical polars DataFrame."""

import json
from pathlib import Path

import polars as pl

from openarcos_pipeline.clean.wapo import (
    clean_county_raw,
    clean_distributors,
    clean_pharmacies,
)

FIXTURES = Path(__file__).parent / "fixtures" / "wapo"


def test_clean_county_raw_produces_expected_columns():
    raw = json.loads((FIXTURES / "county_2012_54059.json").read_text())
    df = clean_county_raw(raw, state="WV", county_fips="54059")
    assert set(df.columns) >= {"fips", "year", "pills"}
    assert df["fips"].dtype == pl.Utf8
    assert df["year"].dtype == pl.Int64
    assert df["pills"].dtype == pl.Int64
    assert (df["fips"] == "54059").all()
    assert (df["pills"] >= 0).all()


def test_clean_distributors_produces_expected_columns():
    raw = json.loads((FIXTURES / "distributors_54059.json").read_text())
    df = clean_distributors(raw)
    assert set(df.columns) >= {"distributor", "year", "pills"}
    assert (df["pills"] >= 0).all()


def test_clean_pharmacies_produces_expected_columns():
    raw = json.loads((FIXTURES / "pharmacies_54059.json").read_text())
    df = clean_pharmacies(raw, county_fips="54059")
    assert set(df.columns) >= {"pharmacy_id", "name", "address", "fips", "total_pills"}
    assert (df["fips"] == "54059").all()
