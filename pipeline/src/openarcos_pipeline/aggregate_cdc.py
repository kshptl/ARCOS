"""Aggregate raw CDC WONDER TSV scrapes → processed county-year artifact.

Reads every ``{FIPS}_{ABBREV}.tsv`` under the raw cache directory,
parses each via :func:`openarcos_pipeline.sources.cdc_wonder_scraper.parse_tsv`,
deduplicates by ``(county_fips, year)``, and emits a JSON document
matching ``pipeline/schemas/cdc_county_overdose.schema.json``.

Suppression: 42 USC 242m(d) requires NCHS not to publish counts ≤ 9.
Those cells arrive as ``Suppressed`` in the TSV; we preserve them as
``{deaths: null, suppressed: true}`` so downstream consumers can render
them as a gap (or "<10" range) rather than imputing a number.

Unreliable rates: NCHS marks crude-rate cells computed from counts ≤ 20
as "Unreliable". We preserve the flag but keep the underlying count
unchanged — the caveat is about the rate's statistical precision, not
about whether the count is publishable.
"""

from __future__ import annotations

import datetime
import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from openarcos_pipeline.log import get_logger
from openarcos_pipeline.sources.cdc_wonder_scraper import (
    LANDING_URL,
    parse_tsv,
)

log = get_logger(__name__)


METHODOLOGY = (
    "CDC WONDER Underlying Cause of Death 1999-2020 (D76), scraped via the "
    "interactive UI (Playwright-driven). Filters: Drug/Alcohol Induced Causes "
    "D1+D2+D3+D4 — maps to ICD-10 X40-X44 (unintentional drug poisoning) ∪ "
    "X60-X64 (suicide by drug) ∪ X85 (homicide by drug) ∪ Y10-Y14 "
    "(undetermined drug poisoning). Group-by: State, County, Year. Years: "
    "2006-2014 annual. Show Zeros: true; Show Suppressed: true. "
    "Suppressed cells (NCHS rule, 42 USC 242m(d): counts of 9 or fewer not "
    "publishable) are carried through with deaths=null and suppressed=true. "
    "Crude-rate cells marked 'Unreliable' (NCHS rule: counts ≤ 20) arrive as "
    "crude_rate=null and unreliable=true — the count is still the ground "
    "truth. Population denominators come from CDC's bridged-race Census "
    "vintage used internally by WONDER."
)


def load_all_tsv(cache_dir: Path) -> list[dict[str, Any]]:
    """Parse every TSV in ``cache_dir`` and concatenate the records."""
    cache_dir = Path(cache_dir)
    records: list[dict[str, Any]] = []
    for tsv in sorted(cache_dir.glob("*.tsv")):
        try:
            rows = parse_tsv(tsv.read_text())
        except Exception as e:
            log.warning("cdc aggregate: failed to parse %s: %s", tsv, e)
            continue
        log.debug("cdc aggregate: %s → %d rows", tsv.name, len(rows))
        records.extend(rows)
    return records


def _dedup(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep the first record for each (county_fips, year) tuple."""
    seen: set[tuple[str, int]] = set()
    out: list[dict[str, Any]] = []
    for r in records:
        key = (r["county_fips"], r["year"])
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def aggregate_cdc_raw(cache_dir: Path) -> list[dict[str, Any]]:
    """End-to-end: load every TSV in ``cache_dir``, dedupe by (fips, year).

    Sort by FIPS + year for deterministic output.
    """
    records = _dedup(load_all_tsv(cache_dir))
    records.sort(key=lambda r: (r["county_fips"], r["year"]))
    return records


def build_processed_artifact(
    cache_dir: Path, fetched_at: str | None = None
) -> dict[str, Any]:
    """Build the full artifact dict, including methodology and totals."""
    records = aggregate_cdc_raw(cache_dir)
    suppressed = sum(1 for r in records if r["suppressed"])
    unreliable = sum(1 for r in records if r["unreliable"])
    states = {r["state_fips"] for r in records}

    return {
        "records": records,
        "methodology": METHODOLOGY,
        "source": LANDING_URL,
        "fetched_at": fetched_at or datetime.datetime.now(datetime.UTC).isoformat(),
        "totals": {
            "records": len(records),
            "suppressed": suppressed,
            "unreliable": unreliable,
            "states": len(states),
        },
    }


def write_processed_artifact(
    cache_dir: Path,
    out_path: Path,
    fetched_at: str | None = None,
) -> Path:
    """Aggregate and write the JSON artifact to ``out_path``."""
    artifact = build_processed_artifact(cache_dir, fetched_at=fetched_at)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, indent=2))
    log.info(
        "cdc aggregate: wrote %s (%d records, %d suppressed, %d unreliable, %d states)",
        out_path,
        artifact["totals"]["records"],
        artifact["totals"]["suppressed"],
        artifact["totals"]["unreliable"],
        artifact["totals"]["states"],
    )
    return out_path


def main(argv: list[str] | None = None) -> int:
    import argparse

    ap = argparse.ArgumentParser(prog="aggregate_cdc")
    ap.add_argument(
        "--cache-dir",
        default="data/raw/cdc",
        help="Directory of per-state {FIPS}_{ST}.tsv files",
    )
    ap.add_argument(
        "--out",
        default="data/processed/cdc_county_overdose.json",
        help="Output JSON path",
    )
    args = ap.parse_args(argv)
    write_processed_artifact(Path(args.cache_dir), Path(args.out))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
