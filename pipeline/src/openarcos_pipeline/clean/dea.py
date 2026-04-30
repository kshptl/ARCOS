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
