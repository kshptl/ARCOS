"""clean/cdc: parses CDC WONDER TSV to `{fips, year, deaths, suppressed}`."""

from pathlib import Path

import polars as pl

from openarcos_pipeline.clean.cdc import parse_d76_tsv

FIXTURE = Path(__file__).parent / "fixtures" / "cdc_wonder" / "sample_wv_2006_2014.tsv"


def test_parse_returns_expected_columns():
    df = parse_d76_tsv(FIXTURE.read_text())
    assert set(df.columns) == {"fips", "year", "deaths", "suppressed"}
    assert df["fips"].dtype == pl.Utf8
    assert df["year"].dtype == pl.Int64
    assert df["suppressed"].dtype == pl.Boolean


def test_suppressed_rows_have_null_deaths():
    df = parse_d76_tsv(FIXTURE.read_text())
    suppressed_rows = df.filter(pl.col("suppressed"))
    # every suppressed row has null deaths
    assert suppressed_rows["deaths"].null_count() == len(suppressed_rows)


def test_non_suppressed_rows_have_integer_deaths():
    df = parse_d76_tsv(FIXTURE.read_text())
    real = df.filter(~pl.col("suppressed"))
    # no nulls where not suppressed
    assert real["deaths"].null_count() == 0
    assert (real["deaths"] >= 10).all()


def test_fips_normalized_to_5_digit():
    df = parse_d76_tsv(FIXTURE.read_text())
    assert (df["fips"].str.len_chars() == 5).all()


def test_missing_rows_are_not_emitted():
    df = parse_d76_tsv(FIXTURE.read_text())
    assert "54043" not in df["fips"].to_list()
