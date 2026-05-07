"""clean/wapo: takes raw WaPo JSON, emits canonical polars DataFrame."""

import json
from pathlib import Path

import polars as pl

from openarcos_pipeline.clean.wapo import (
    clean_county_csv,
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


def test_clean_county_csv_produces_national_county_year_rows(tmp_path):
    path = tmp_path / "arcos.csv"
    path.write_text(
        "\n".join(
            [
                '"BUYER_COUNTY","BUYER_STATE","year","count","DOSAGE_UNIT","countyfips"',
                '"AUTAUGA","AL",2012,2,100,"01001"',
                '"AUTAUGA","AL",2012,3,50,"01001"',
                '"MINGO","WV",2012,1,25,"54059"',
            ]
        )
    )

    df = clean_county_csv(path)

    assert df.columns == ["fips", "year", "pills"]
    assert df.to_dicts() == [
        {"fips": "01001", "year": 2012, "pills": 150},
        {"fips": "54059", "year": 2012, "pills": 25},
    ]


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
