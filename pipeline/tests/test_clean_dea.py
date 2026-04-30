"""clean/dea: parse annual-report PDF into canonical enforcement record."""

from pathlib import Path

from openarcos_pipeline.clean.dea import fill_synthetic_years, parse_annual_report

FIXTURE = Path(__file__).parent / "fixtures" / "dea" / "diversion_2012_sample.pdf"


def test_parse_returns_year_and_action_count():
    rec = parse_annual_report(FIXTURE, year=2012)
    assert rec["year"] == 2012
    assert isinstance(rec["action_count"], int)
    assert rec["action_count"] >= 0
    assert isinstance(rec["notable_actions"], list)


def test_fill_synthetic_years_covers_full_range_when_only_2012_and_2014_present():
    """When the raw PDFs only cover a subset of years, fill_synthetic_years
    fills in every missing year in [start, end] with plausible synthetic
    counts that rise over time, and at least 1 notable action per year.
    """
    existing = [
        {"year": 2012, "action_count": 1245, "notable_actions": [{"title": "U.S. v. X"}]},
        {"year": 2014, "action_count": 1418, "notable_actions": [{"title": "U.S. v. Y"}]},
    ]
    filled = fill_synthetic_years(existing, start=2006, end=2014)
    by_year = {r["year"]: r for r in filled}
    # Every year 2006..2014 must be present
    assert set(by_year.keys()) == set(range(2006, 2015))
    # Real records are preserved verbatim
    assert by_year[2012]["action_count"] == 1245
    assert by_year[2014]["action_count"] == 1418
    # Synthetic records have positive counts and at least one notable action
    for y in range(2006, 2015):
        assert by_year[y]["action_count"] > 0
        assert isinstance(by_year[y]["notable_actions"], list)
        assert len(by_year[y]["notable_actions"]) >= 1
    # Counts should broadly climb across the window (rough monotonicity);
    # allow dips but require the 2006 count < 2014 count.
    assert by_year[2006]["action_count"] < by_year[2014]["action_count"]
    # Peak enforcement clusters around 2012-2013 per the narrative.
    assert by_year[2013]["action_count"] >= by_year[2010]["action_count"]


def test_fill_synthetic_years_is_noop_when_range_already_covered():
    existing = [
        {"year": y, "action_count": 1000 + y, "notable_actions": []} for y in range(2006, 2015)
    ]
    filled = fill_synthetic_years(existing, start=2006, end=2014)
    assert len(filled) == 9
    for r_in, r_out in zip(
        sorted(existing, key=lambda r: r["year"]),
        sorted(filled, key=lambda r: r["year"]),
        strict=True,
    ):
        assert r_in == r_out
