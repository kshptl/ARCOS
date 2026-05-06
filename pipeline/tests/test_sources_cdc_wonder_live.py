"""Live-network integration test for the CDC WONDER scraper.

This test actually opens Chromium and hits ``https://wonder.cdc.gov``.
It is disabled by default. To run:

    PYTEST_RUN_LIVE=1 uv run pytest \\
        tests/test_sources_cdc_wonder_live.py -q

Gated so CI and local dev cycles stay offline.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from openarcos_pipeline.sources.cdc_wonder_scraper import CDCWonderScraper

LIVE = os.environ.get("PYTEST_RUN_LIVE") == "1"


@pytest.mark.skipif(not LIVE, reason="Live-network CDC scrape disabled. Set PYTEST_RUN_LIVE=1.")
def test_cdc_wonder_live_wv_2006_2014(tmp_path: Path) -> None:
    """West Virginia, all counties, 2006-2014.

    Anchors on Mingo County 2010 per round-2 investigation (14 deaths
    observed 2026-05-01). Accepts a ±1 slack because NCHS may have
    updated the 2010 vintage between the investigation date and now.
    """
    scraper = CDCWonderScraper()
    rows = scraper.scrape_state(state_fips="54", years=list(range(2006, 2015)), cache_dir=tmp_path)

    # Non-empty result.
    assert len(rows) > 0, "WV scrape returned no rows"

    # Mingo 2010 canonical.
    mingo_rows = [r for r in rows if r["county_fips"] == "54059" and r["year"] == 2010]
    assert len(mingo_rows) == 1, f"expected 1 Mingo 2010 row, got {len(mingo_rows)}"
    mingo = mingo_rows[0]
    assert mingo["suppressed"] is False
    assert mingo["deaths"] is not None
    assert 13 <= mingo["deaths"] <= 15, (
        f"Mingo 2010 deaths {mingo['deaths']} outside investigation ±1 window"
    )

    # Majority of WV's 55 counties should appear somewhere (suppressed or
    # not) across 2006-2014.
    fips_seen = {r["county_fips"] for r in rows}
    assert len(fips_seen) >= 40, f"only {len(fips_seen)} unique WV counties in response"

    # Cache files written.
    assert (tmp_path / "54_WV.tsv").exists()
    assert (tmp_path / "54_WV.html").exists()
