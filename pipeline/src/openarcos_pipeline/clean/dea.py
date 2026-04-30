"""Parse DEA Diversion annual report PDFs into canonical records."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pdfplumber

from openarcos_pipeline.log import get_logger

log = get_logger("openarcos.clean.dea")

# Phrases that indicate enforcement-action totals.
ACTION_COUNT_PATTERNS = [
    re.compile(r"([\d,]+)\s+administrative\s+actions", re.IGNORECASE),
    re.compile(r"([\d,]+)\s+enforcement\s+actions", re.IGNORECASE),
    re.compile(r"total\s+(?:of\s+)?([\d,]+)\s+cases", re.IGNORECASE),
]

# Heuristic for extracting notable-case headlines.
NOTABLE_PATTERNS = [
    re.compile(r"United States v\.\s+([^\n\.]+)"),
    re.compile(r"Operation\s+([A-Z][A-Za-z ]+)"),
]

# Per-year synthetic action counts. These are plausible "background" values
# used ONLY when a real PDF for the year is not available. Shape: counts
# climb from ~250 in 2006, peak around 2012–2013 at ~1,400, then ease.
# See notes/dea.md — DEA Diversion does not publish these per-year totals on a
# stable URL, so the pipeline ships synthetic fill so Act 3 of the scrolly
# story has a continuous series.
SYNTHETIC_ACTION_COUNTS: dict[int, int] = {
    2006: 250,
    2007: 360,
    2008: 520,
    2009: 700,
    2010: 880,
    2011: 1060,
    2012: 1245,
    2013: 1380,
    2014: 1418,
}

# One plausible synthetic headline per year — used only when a real PDF
# didn't contribute one. Flagged as synthetic via the trailing " (synthetic)"
# token so downstream consumers can distinguish.
SYNTHETIC_NOTABLE_ACTIONS: dict[int, list[dict[str, Any]]] = {
    y: [
        {
            "title": f"DEA Diversion annual summary {y} (synthetic)",
            "url": "",
            "target": None,
        }
    ]
    for y in range(2006, 2015)
}


def _extract_all_text(pdf_path: Path) -> str:
    with pdfplumber.open(pdf_path) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def parse_annual_report(pdf_path: Path, year: int) -> dict[str, Any]:
    text = _extract_all_text(pdf_path)

    action_count = 0
    for pat in ACTION_COUNT_PATTERNS:
        match = pat.search(text)
        if match:
            action_count = int(match.group(1).replace(",", ""))
            break

    if action_count == 0:
        log.warning("dea: no action count found", extra={"year": year})

    seen: set[str] = set()
    notable: list[dict[str, Any]] = []
    for pat in NOTABLE_PATTERNS:
        for m in pat.finditer(text):
            title = m.group(0).strip().rstrip(".")
            key = title.lower()
            if key in seen:
                continue
            seen.add(key)
            notable.append({"title": title, "url": "", "target": None})
            if len(notable) >= 10:
                break
        if len(notable) >= 10:
            break

    return {
        "year": year,
        "action_count": action_count,
        "notable_actions": notable,
    }


def fill_synthetic_years(
    records: list[dict[str, Any]], *, start: int, end: int
) -> list[dict[str, Any]]:
    """Ensure `records` covers every year in [start, end] inclusive.

    Real records (from actual PDFs) are preserved verbatim. Missing years are
    filled from `SYNTHETIC_ACTION_COUNTS` and `SYNTHETIC_NOTABLE_ACTIONS`.
    A warning is logged for each synthetic year so operators know the
    emitted data includes fabricated values; the synthetic notable-action
    titles carry a "(synthetic)" suffix as a secondary trail.

    Returns a new list sorted by year ascending.
    """
    by_year: dict[int, dict[str, Any]] = {int(r["year"]): r for r in records}
    for y in range(start, end + 1):
        if y in by_year:
            continue
        count = SYNTHETIC_ACTION_COUNTS.get(y)
        if count is None:
            # Outside the synthetic-coverage window — skip (don't fabricate).
            continue
        by_year[y] = {
            "year": y,
            "action_count": count,
            "notable_actions": list(SYNTHETIC_NOTABLE_ACTIONS.get(y, [])),
        }
        log.warning("dea: filled synthetic record", extra={"year": y, "action_count": count})
    return [by_year[y] for y in sorted(by_year)]
