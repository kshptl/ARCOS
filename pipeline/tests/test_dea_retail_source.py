"""Tests for finding DEA ARCOS retail summary report PDFs."""

from __future__ import annotations

from openarcos_pipeline.sources.dea_retail_summaries import discover_report_pdfs


def test_discover_report_pdfs_finds_combined_and_2015_report4_links():
    html = """
    <a href="/arcos/retail_drug_summary/report_yr_2024.pdf">2024</a>
    <a href="report_yr_2016.pdf">2016</a>
    <a href="2015/2015_rpt1.pdf">2015 Report 1</a>
    <a href="2015/2015_rpt4.pdf">2015 Report 4</a>
    <a href="2014/2014_rpt4.pdf">2014 Report 4</a>
    """

    reports = discover_report_pdfs(
        html,
        base_url=(
            "https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/"
            "arcos-drug-summary-reports.html"
        ),
    )

    assert reports == [
        (
            2015,
            "https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/2015/2015_rpt4.pdf",
        ),
        (
            2016,
            "https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/report_yr_2016.pdf",
        ),
        (
            2024,
            "https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/report_yr_2024.pdf",
        ),
    ]


def test_discover_report_pdfs_ignores_unreviewed_future_years():
    html = """
    <a href="report_yr_2025.pdf">2025</a>
    <a href="report_yr_2024.pdf">2024</a>
    """

    reports = discover_report_pdfs(
        html,
        base_url=(
            "https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/"
            "arcos-drug-summary-reports.html"
        ),
    )

    assert [year for year, _url in reports] == [2024]
