"""clean/dea: parse annual-report PDF into canonical enforcement record."""

from pathlib import Path

from openarcos_pipeline.clean.dea import parse_annual_report

FIXTURE = Path(__file__).parent / "fixtures" / "dea" / "diversion_2012_sample.pdf"


def test_parse_returns_year_and_action_count():
    rec = parse_annual_report(FIXTURE, year=2012)
    assert rec["year"] == 2012
    assert isinstance(rec["action_count"], int)
    assert rec["action_count"] >= 0
    assert isinstance(rec["notable_actions"], list)
