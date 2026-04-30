"""Coverage assertions for scrolly-data source artifacts.

These tests guard the data quality flagged by users on openarcos.org:

D1 — Act 2: distributors must have market-share change over time. The
emitted `top-distributors-by-year.json` must cover multiple years for
at least a few distributors, with meaningfully varying `share_pct`
values (so the slope-chart actually slopes).

D2 — Act 3: DEA enforcement actions must cover the full 2006-2014 story
range (not just 2012 + 2014 as flagged in notes/dea.md).

D3a — Act 4 aftermath counties: every aftermath FIPS in the web build's
`AFTERMATH_FIPS` list must resolve to a human-readable name+state via
`county-metadata.json` (i.e. the census fixture includes them).

D3b — Act 4 aftermath deaths: every aftermath FIPS must have at least
three years of CDC overdose data in `cdc-overdose-by-county-year.parquet`
so the Sparkline has signal (suppressed → 0 still counts as "present").
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import polars as pl
from typer.testing import CliRunner

from openarcos_pipeline.cli import app

# Mirrors web/scripts/build-scrolly-data.mts:AFTERMATH_FIPS
AFTERMATH_FIPS = ("54059", "51720", "54011", "54045", "21071", "21195")


def _seed_raw(raw_dir: Path, fixtures_dir: Path) -> None:
    """Copy the shipped test fixtures into a fresh raw/ tree."""
    (raw_dir / "census").mkdir(parents=True, exist_ok=True)
    shutil.copy(
        fixtures_dir / "census" / "co-est2019-sample.csv",
        raw_dir / "census" / "co-est2019-alldata.csv",
    )
    (raw_dir / "wapo").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "wapo").glob("*.json"):
        if src.name.startswith(("county_", "distributors_", "pharmacies_")):
            shutil.copy(src, raw_dir / "wapo" / src.name)
    (raw_dir / "cdc").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "cdc").glob("*.xml"):
        shutil.copy(src, raw_dir / "cdc" / src.name)
    (raw_dir / "dea").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "dea").glob("*.pdf"):
        stem = src.stem.replace("diversion_", "").replace("_sample", "")
        shutil.copy(src, raw_dir / "dea" / f"{stem}.pdf")


def _run_full_pipeline(tmp_path: Path, fixtures_dir: Path, monkeypatch) -> Path:
    data_root = tmp_path / "data"
    emit_dir = tmp_path / "emit"
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(data_root))
    monkeypatch.setenv("OPENARCOS_EMIT_DIR", str(emit_dir))
    _seed_raw(data_root / "raw", fixtures_dir)
    runner = CliRunner()
    result = runner.invoke(
        app, ["all", "--skip-fetch", "--years-start", "2006", "--years-end", "2014"]
    )
    assert result.exit_code == 0, result.stdout
    return emit_dir


# -------------------------------------------------------------------------
# D1 — Act 2 distributors: varying share across years
# -------------------------------------------------------------------------


def test_top_distributors_json_covers_multiple_years(tmp_path, fixtures_dir, monkeypatch):
    """Emitted top-distributors must include at least 2011 AND 2013 data
    for the leading national distributors so the slope chart actually moves.
    """
    emit_dir = _run_full_pipeline(tmp_path, fixtures_dir, monkeypatch)
    rows = json.loads((emit_dir / "top-distributors-by-year.json").read_text())
    years = {int(r["year"]) for r in rows}
    assert {2011, 2013}.issubset(years), (
        f"top-distributors must cover 2011 and 2013; saw years={sorted(years)}"
    )

    # At least the 3 largest national distributors should appear in both the
    # earliest AND latest year of the series (otherwise Act 2 has no slope).
    earliest = min(years)
    latest = max(years)
    dists_early = {r["distributor"] for r in rows if int(r["year"]) == earliest}
    dists_late = {r["distributor"] for r in rows if int(r["year"]) == latest}
    overlap = dists_early & dists_late
    assert len(overlap) >= 3, (
        f"expected ≥3 distributors present in both {earliest} and {latest}; "
        f"overlap={sorted(overlap)}"
    )


def test_top_distributors_share_varies_across_years(tmp_path, fixtures_dir, monkeypatch):
    """For the 3 largest distributors by volume, share_pct must change by
    at least 0.5 percentage points between the earliest and latest years.
    A constant share across the window is what the user flagged as looking
    broken in Act 2.
    """
    emit_dir = _run_full_pipeline(tmp_path, fixtures_dir, monkeypatch)
    rows = json.loads((emit_dir / "top-distributors-by-year.json").read_text())
    years = sorted({int(r["year"]) for r in rows})
    assert len(years) >= 2
    earliest, latest = years[0], years[-1]

    share_by_dist_year: dict[tuple[str, int], float] = {}
    for r in rows:
        share_by_dist_year[(r["distributor"], int(r["year"]))] = float(r["share_pct"])

    # Find distributors present in BOTH boundary years.
    common = {
        d
        for (d, y) in share_by_dist_year
        if (d, earliest) in share_by_dist_year and (d, latest) in share_by_dist_year
    }
    assert common, "no distributors present in both earliest and latest year"

    moved = [
        d
        for d in common
        if abs(share_by_dist_year[(d, latest)] - share_by_dist_year[(d, earliest)]) >= 0.5
    ]
    assert len(moved) >= 2, (
        f"expected ≥2 distributors with ≥0.5pp share change between "
        f"{earliest} and {latest}; got {len(moved)} (common={sorted(common)})"
    )


# -------------------------------------------------------------------------
# D2 — Act 3 DEA enforcement: full 2006-2014 range
# -------------------------------------------------------------------------


def test_dea_enforcement_covers_full_2006_2014(tmp_path, fixtures_dir, monkeypatch):
    """Every year in 2006..2014 inclusive must have an entry in
    dea-enforcement-actions.json with a positive action_count.
    """
    emit_dir = _run_full_pipeline(tmp_path, fixtures_dir, monkeypatch)
    rows = json.loads((emit_dir / "dea-enforcement-actions.json").read_text())
    by_year = {int(r["year"]): r for r in rows}
    expected_years = set(range(2006, 2015))
    missing = expected_years - set(by_year)
    assert not missing, f"dea-enforcement missing years: {sorted(missing)}"
    for y in expected_years:
        assert int(by_year[y]["action_count"]) > 0, (
            f"dea-enforcement year {y} has non-positive action_count"
        )


# -------------------------------------------------------------------------
# D3a — Act 4 aftermath counties: census metadata covers every FIPS
# -------------------------------------------------------------------------


def test_county_metadata_covers_every_aftermath_fips(tmp_path, fixtures_dir, monkeypatch):
    """Every FIPS in the web build's AFTERMATH_FIPS list must resolve to a
    real name + state in county-metadata.json (otherwise Act 4 falls back
    to `name = fips`, which renders as what looks like a ZIP code).
    """
    emit_dir = _run_full_pipeline(tmp_path, fixtures_dir, monkeypatch)
    meta = json.loads((emit_dir / "county-metadata.json").read_text())
    by_fips = {m["fips"]: m for m in meta}
    for fips in AFTERMATH_FIPS:
        assert fips in by_fips, f"aftermath fips {fips} missing from county-metadata"
        m = by_fips[fips]
        # A missing-metadata row would fall through to `{name: fips, state: ""}`
        # in the web build; we guard against both here.
        assert m["name"] and m["name"] != fips, (
            f"aftermath fips {fips}: county-metadata name={m['name']!r}, "
            f"expected human-readable (not the FIPS itself)"
        )
        assert m["state"], f"aftermath fips {fips}: county-metadata state is empty"


# -------------------------------------------------------------------------
# D3b — Act 4 CDC deaths: every aftermath FIPS has multi-year data
# -------------------------------------------------------------------------


def test_cdc_parquet_covers_every_aftermath_fips(tmp_path, fixtures_dir, monkeypatch):
    """Every aftermath FIPS must have at least 3 rows (years) in
    cdc-overdose-by-county-year.parquet so the Sparkline has signal.
    """
    emit_dir = _run_full_pipeline(tmp_path, fixtures_dir, monkeypatch)
    df = pl.read_parquet(emit_dir / "cdc-overdose-by-county-year.parquet")
    rows = df.to_dicts()
    by_fips: dict[str, list[dict]] = {}
    for r in rows:
        by_fips.setdefault(str(r["fips"]), []).append(r)
    for fips in AFTERMATH_FIPS:
        assert fips in by_fips, f"CDC parquet missing aftermath fips {fips}"
        assert len(by_fips[fips]) >= 3, (
            f"CDC parquet has only {len(by_fips[fips])} rows for aftermath fips "
            f"{fips}; expected at least 3 years"
        )
