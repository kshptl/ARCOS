"""Tests for the CDC WONDER Playwright-based scraper.

These tests cover the pure logic (TSV parsing, throttling, session
validation) and the browser interaction via a stub browser. The live
end-to-end scrape lives in `test_sources_cdc_wonder_live.py` and is
gated behind the PYTEST_RUN_LIVE=1 env var.
"""

from __future__ import annotations

import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from openarcos_pipeline.sources.cdc_wonder_scraper import (
    CDCWonderScraper,
    SessionExpiredError,
    fetch_all_states,
    parse_tsv,
)

FIXTURES = Path(__file__).parent / "fixtures" / "cdc_wonder"
SAMPLE_TSV = FIXTURES / "sample_wv_2006_2014.tsv"


# ---------- parse_tsv ----------


def test_parse_tsv_returns_county_year_records():
    records = parse_tsv(SAMPLE_TSV.read_text())
    # Mingo 2010 is the canonical round-2 validation point.
    mingo_2010 = next(r for r in records if r["county_fips"] == "54059" and r["year"] == 2010)
    assert mingo_2010["state_fips"] == "54"
    assert mingo_2010["county_name"] == "Mingo County, WV"
    assert mingo_2010["deaths"] == 14
    assert mingo_2010["population"] == 26839
    assert mingo_2010["suppressed"] is False
    assert mingo_2010["unreliable"] is True  # crude rate = "Unreliable"
    assert mingo_2010["crude_rate"] is None  # unreliable → no numeric rate


def test_parse_tsv_non_unreliable_rate_is_float():
    records = parse_tsv(SAMPLE_TSV.read_text())
    mingo_2012 = next(r for r in records if r["county_fips"] == "54059" and r["year"] == 2012)
    assert mingo_2012["deaths"] == 21
    assert mingo_2012["crude_rate"] == pytest.approx(79.2)
    assert mingo_2012["unreliable"] is False
    assert mingo_2012["suppressed"] is False


def test_parse_tsv_suppressed_count_marked():
    records = parse_tsv(SAMPLE_TSV.read_text())
    webster_2010 = next(r for r in records if r["county_fips"] == "54101" and r["year"] == 2010)
    assert webster_2010["deaths"] is None
    assert webster_2010["suppressed"] is True
    # Population still present even when deaths suppressed.
    assert webster_2010["population"] == 9154


def test_parse_tsv_zero_count_is_suppressed_for_publication():
    body = (
        '"Notes"\t"State"\t"State Code"\t"County"\t"County Code"\t'
        '"Year"\t"Year Code"\tDeaths\tPopulation\tCrude Rate\n'
        '\t"Wyoming"\t"56"\t"Big Horn County, WY"\t"56003"\t'
        '"2014"\t"2014"\t0\t11930\tUnreliable\n'
        '"---"\n'
    )

    records = parse_tsv(body)

    assert records[0]["deaths"] is None
    assert records[0]["suppressed"] is True
    assert records[0]["unreliable"] is True


def test_parse_tsv_skips_missing_cells():
    """Cells marked 'Missing' (no data) are excluded, not returned as zero."""
    records = parse_tsv(SAMPLE_TSV.read_text())
    missing = [r for r in records if r["county_fips"] == "54043" and r["year"] == 2010]
    assert missing == []


def test_parse_tsv_stops_at_metadata_block():
    """The 'Query Parameters' / 'Dataset' block below the data table must
    not be parsed as data rows."""
    records = parse_tsv(SAMPLE_TSV.read_text())
    # Every record must have a 5-digit county_fips; if the metadata leaked
    # in we'd see non-fips strings.
    for r in records:
        assert len(r["county_fips"]) == 5
        assert r["county_fips"].isdigit()


def test_parse_tsv_empty_body_returns_empty_list():
    assert parse_tsv("") == []


def test_parse_tsv_only_metadata_returns_empty_list():
    body = '"Notes"\t"State"\t"Deaths"\n"---"\n"Dataset: Underlying Cause of Death, 1999-2020"\n'
    assert parse_tsv(body) == []


# ---------- CDCWonderScraper (stub browser) ----------


def _make_stub_page(tsv_body: str):
    """Return a MagicMock page that simulates the WONDER UI flow.

    The scraper is expected to:
      1. goto(ucd-icd10.html)
      2. click I Agree
      3. fill form / click Send
      4. click Export / Download → receive TSV body
    The stub returns `tsv_body` from the download step.
    """
    page = MagicMock()
    page.url = (
        "https://wonder.cdc.gov/controller/datarequest/D76;jsessionid=300D6C069EDE99D1EC9477DC972F"
    )

    # Simulate download response: the scraper will call page.content() or
    # retrieve a downloaded file. We expose `_download_tsv` as a hook.
    page._tsv_body = tsv_body
    return page


def test_scraper_fetches_state_via_stub_browser(tmp_path):
    tsv_body = SAMPLE_TSV.read_text()
    page = _make_stub_page(tsv_body)

    # Inject our stub: scraper calls `browser_factory()` to get a (browser, page).
    def browser_factory():
        browser = MagicMock()
        browser.close = MagicMock()
        return browser, page

    scraper = CDCWonderScraper(browser_factory=browser_factory)
    records = scraper.scrape_state(
        state_fips="54",
        years=list(range(2006, 2015)),
        cache_dir=tmp_path,
    )

    assert any(
        r["county_fips"] == "54059" and r["year"] == 2010 and r["deaths"] == 14 for r in records
    ), "Mingo WV 2010 must come through end-to-end"

    # Raw cache written.
    assert (tmp_path / "54_WV.tsv").exists()


def test_scraper_raises_on_session_expiry():
    page = MagicMock()
    # Simulate session-expired: the scraper probes page content and sees an
    # error string. We use a dedicated hook.
    page.url = "https://wonder.cdc.gov/controller/datarequest/D76"
    page._session_expired = True

    def browser_factory():
        return MagicMock(), page

    scraper = CDCWonderScraper(browser_factory=browser_factory)
    with pytest.raises(SessionExpiredError):
        scraper.scrape_state(state_fips="54", years=[2010])


# ---------- fetch_all_states throttling ----------


def test_fetch_all_states_throttles_between_queries(tmp_path, monkeypatch):
    """Sequential state queries must leave at least `delay_s` between POSTs."""
    tsv_body = SAMPLE_TSV.read_text()
    call_times: list[float] = []

    def fake_scrape_state(self, state_fips: str, years, cache_dir=None):
        call_times.append(time.monotonic())
        return parse_tsv(tsv_body)

    monkeypatch.setattr(CDCWonderScraper, "scrape_state", fake_scrape_state)

    # Replace time.sleep with an accelerator that still advances the clock.
    base = time.monotonic()
    fake_now = [base]

    def fake_sleep(seconds):
        fake_now[0] += seconds

    def fake_monotonic():
        return fake_now[0]

    monkeypatch.setattr("openarcos_pipeline.sources.cdc_wonder_scraper.time.sleep", fake_sleep)
    monkeypatch.setattr(
        "openarcos_pipeline.sources.cdc_wonder_scraper.time.monotonic",
        fake_monotonic,
    )

    # Override call_times capture to use the fake clock.
    def fake_scrape_state_v2(self, state_fips, years, cache_dir=None):
        call_times.append(fake_now[0])
        return parse_tsv(tsv_body)

    monkeypatch.setattr(CDCWonderScraper, "scrape_state", fake_scrape_state_v2)

    records = fetch_all_states(
        years=[2010],
        states=["01", "02", "04"],
        delay_s=15,
        cache_dir=tmp_path,
    )

    # 3 states → 3 scrape calls.
    assert len(call_times) == 3
    # Allow a tiny rounding wiggle because decimal time is stored as a binary float.
    min_gap_s = 15 - 1e-9
    # 15s minimum between consecutive calls.
    for i in range(1, len(call_times)):
        assert call_times[i] - call_times[i - 1] >= min_gap_s, (
            f"gap #{i} = {call_times[i] - call_times[i - 1]}s (<15s)"
        )

    # Records accumulated from all states.
    assert len(records) > 0


def test_fetch_all_states_retries_transient_state_failures(tmp_path, monkeypatch):
    tsv_body = SAMPLE_TSV.read_text()
    attempts = {"01": 0}

    def fake_scrape_state(self, state_fips, years, cache_dir=None):
        if state_fips == "01":
            attempts["01"] += 1
            if attempts["01"] < 3:
                raise RuntimeError("transient network blip")
        return parse_tsv(tsv_body)

    monkeypatch.setattr(CDCWonderScraper, "scrape_state", fake_scrape_state)
    monkeypatch.setattr(
        "openarcos_pipeline.sources.cdc_wonder_scraper.time.sleep",
        lambda s: None,
    )

    records = fetch_all_states(years=[2010], states=["01"], delay_s=0, cache_dir=tmp_path)
    assert attempts["01"] == 3  # 2 failures + 1 success
    assert len(records) > 0


def test_fetch_all_states_gives_up_after_max_retries(tmp_path, monkeypatch):
    def always_fail(self, state_fips, years, cache_dir=None):
        raise RuntimeError("hard failure")

    monkeypatch.setattr(CDCWonderScraper, "scrape_state", always_fail)
    monkeypatch.setattr(
        "openarcos_pipeline.sources.cdc_wonder_scraper.time.sleep",
        lambda s: None,
    )

    # With continue_on_failure=True (default), the failure is logged and
    # the function returns with that state absent from results.
    records = fetch_all_states(
        years=[2010],
        states=["01", "02"],
        delay_s=0,
        cache_dir=tmp_path,
    )
    # No records for either state (both failed), but the function returns.
    assert records == []
