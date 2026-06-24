"""Tests for DEA ARCOS retail summary PDF extraction."""

from __future__ import annotations

import polars as pl

from openarcos_pipeline.clean.dea_retail_summaries import (
    convert_report4_rows_to_mme,
    parse_report4_text,
)


def test_parse_report4_text_handles_2024_combined_pdf_rows():
    text = """
    DATE RANGE: 01/01/2024 TO 12/31/2024 ARCOS 3 - REPORT 04 by GRAMS
    CUMULATIVE DISTRIBUTION BY STATE PER 100K POPULATION
    DRUG: 9143 - OXYCODONE
    RANK STATE STATE POPULATION TOTAL GRAMS TOTAL GRAMS/100K POPULATION
    1 TENNESSEE 6,910,840 1,066,379.78 15,430.54
    2 WEST VIRGINIA 1,793,716 176,221.29 9,824.36
    US TOTAL 335,025,847 7,587,510 2,264.75
    """

    rows = parse_report4_text(
        text,
        year=2024,
        source_url="https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/report_yr_2024.pdf",
    )

    assert rows.to_dicts() == [
        {
            "state_fips": "47",
            "state": "TN",
            "year": 2024,
            "drug_code": "9143",
            "drug_name": "OXYCODONE",
            "population": 6_910_840,
            "grams": 1_066_379.78,
            "grams_per_100k": 15_430.54,
            "source_url": "https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/report_yr_2024.pdf",
        },
        {
            "state_fips": "54",
            "state": "WV",
            "year": 2024,
            "drug_code": "9143",
            "drug_name": "OXYCODONE",
            "population": 1_793_716,
            "grams": 176_221.29,
            "grams_per_100k": 9_824.36,
            "source_url": "https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/report_yr_2024.pdf",
        },
    ]


def test_parse_report4_text_handles_2015_separate_report_rows():
    text = """
    ARCOS 3 - REPORT 4 CUMULATIVE DISTRIBUTION BY STATE IN GRAMS PER 100,000 POPULATION
    REPORTING PERIOD: 01/01/2015 TO 12/31/2015
    DRUG CODE:9143
    DRUG NAME:OXYCODONE
    RANK STATE 2010 POP TOTAL GRAMS GRAMS/100K POP
    1 DELAWARE 897,934 319,205.76 35,548.91
    2 DISTRICT OF COLUMBIA 601,723 93,638.75 15,560.12
    U.S. GRAMS / PER 100K: 312,825,210 57,570,386.13 18,403.37
    """

    rows = parse_report4_text(
        text,
        year=2015,
        source_url="https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/2015/2015_rpt4.pdf",
    )

    assert rows.select(["state_fips", "state", "drug_code", "grams_per_100k"]).to_dicts() == [
        {"state_fips": "10", "state": "DE", "drug_code": "9143", "grams_per_100k": 35_548.91},
        {"state_fips": "11", "state": "DC", "drug_code": "9143", "grams_per_100k": 15_560.12},
    ]


def test_convert_report4_rows_to_mme_keeps_state_level_and_excludes_unsafe_conversions():
    rows = pl.DataFrame(
        [
            {
                "state_fips": "54",
                "state": "WV",
                "year": 2024,
                "drug_code": "9143",
                "drug_name": "OXYCODONE",
                "population": 1_000_000,
                "grams": 100.0,
                "grams_per_100k": 10.0,
                "source_url": "source.pdf",
            },
            {
                "state_fips": "54",
                "state": "WV",
                "year": 2024,
                "drug_code": "9801",
                "drug_name": "FENTANYL BASE",
                "population": 1_000_000,
                "grams": 500.0,
                "grams_per_100k": 50.0,
                "source_url": "source.pdf",
            },
        ]
    )

    converted = convert_report4_rows_to_mme(rows)

    assert converted.to_dicts() == [
        {
            "state_fips": "54",
            "state": "WV",
            "year": 2024,
            "population": 1_000_000,
            "mme": 150_000.0,
            "mme_per_capita": 0.15,
            "mme_per_100k": 15_000.0,
            "included_drug_codes": ["9143"],
            "excluded_drug_codes": ["9801"],
            "source_urls": ["source.pdf"],
        }
    ]
