"""clean/cdc: parses D76 XML to `{fips, year, deaths, suppressed}` DataFrame."""

from pathlib import Path

import polars as pl

from openarcos_pipeline.clean.cdc import parse_d76_response

FIXTURE = Path(__file__).parent / "fixtures" / "cdc" / "wv_2012_2014.xml"


def test_parse_returns_expected_columns():
    xml = FIXTURE.read_text()
    df = parse_d76_response(xml)
    assert set(df.columns) == {"fips", "year", "deaths", "suppressed"}
    assert df["fips"].dtype == pl.Utf8
    assert df["year"].dtype == pl.Int64
    assert df["suppressed"].dtype == pl.Boolean


def test_suppressed_rows_have_null_deaths():
    xml = FIXTURE.read_text()
    df = parse_d76_response(xml)
    suppressed_rows = df.filter(pl.col("suppressed"))
    # every suppressed row has null deaths
    assert suppressed_rows["deaths"].null_count() == len(suppressed_rows)


def test_non_suppressed_rows_have_integer_deaths():
    xml = FIXTURE.read_text()
    df = parse_d76_response(xml)
    real = df.filter(~pl.col("suppressed"))
    # no nulls where not suppressed
    assert real["deaths"].null_count() == 0
    assert (real["deaths"] >= 10).all()


def test_fips_normalized_to_5_digit():
    xml = FIXTURE.read_text()
    df = parse_d76_response(xml)
    assert (df["fips"].str.len_chars() == 5).all()
