"""Tests for Census county metadata source."""

from __future__ import annotations

import polars as pl

from openarcos_pipeline.sources import census


def test_parse_popest_filters_state_summaries(fixtures_dir):
    df = census.parse_popest_csv(fixtures_dir / "census" / "co-est2019-sample.csv")
    assert isinstance(df, pl.DataFrame)
    fips = df["fips"].to_list()
    # State summary row (SUMLEV=040) must be gone; only county rows remain.
    # Fixture currently has 7 county rows covering every AFTERMATH_FIPS in
    # web/scripts/build-scrolly-data.mts; update here if that list grows.
    assert len(df) == 7
    # All FIPS are zero-padded to 5 chars
    assert all(len(f) == 5 for f in fips)
    assert "54059" in fips
    assert "51720" in fips  # independent city (no "County" suffix)
    assert "21119" in fips
    assert "21195" in fips
    # Cabell, Logan, Floyd are aftermath counties (see notes/cdc.md).
    assert "54011" in fips
    assert "54045" in fips
    assert "21071" in fips


def test_parse_popest_extracts_expected_columns(fixtures_dir):
    df = census.parse_popest_csv(fixtures_dir / "census" / "co-est2019-sample.csv")
    assert set(df.columns) == {"fips", "name", "state", "pop"}
    # Population comes from POPESTIMATE2012
    row = df.filter(pl.col("fips") == "54059").to_dicts()[0]
    assert row == {
        "fips": "54059",
        "name": "Mingo County",
        "state": "WV",
        "pop": 25764,
    }


def test_parse_popest_preserves_non_county_names(fixtures_dir):
    df = census.parse_popest_csv(fixtures_dir / "census" / "co-est2019-sample.csv")
    # Virginia independent cities, Louisiana parishes, Alaska boroughs: keep full name
    row = df.filter(pl.col("fips") == "51720").to_dicts()[0]
    # Parser does NOT strip " County" because this name doesn't have that suffix;
    # raw CTYNAME "Norton city" is preserved verbatim.
    assert row["name"] == "Norton city"
    assert row["state"] == "VA"


def test_parse_popest_handles_missing_population(fixtures_dir, tmp_path):
    # Real Census CSVs have rows with no POPESTIMATE2012 for brand-new counties.
    # We should skip them rather than crash.
    missing = tmp_path / "missing.csv"
    missing.write_text(
        "SUMLEV,STATE,COUNTY,STNAME,CTYNAME,POPESTIMATE2012\n"
        "050,54,059,West Virginia,Mingo County,25764\n"
        "050,02,275,Alaska,New Borough,\n"
    )
    df = census.parse_popest_csv(missing)
    assert len(df) == 1
    assert df["fips"].to_list() == ["54059"]


def test_state_fips_maps_to_abbreviation():
    # Sanity: 54 → WV, 51 → VA, 21 → KY
    assert census._state_abbrev("54") == "WV"
    assert census._state_abbrev("51") == "VA"
    assert census._state_abbrev("21") == "KY"
