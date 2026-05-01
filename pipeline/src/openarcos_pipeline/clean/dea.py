"""Classify & aggregate DEA Federal Register enforcement notices.

Replaces the prior PDF-based synthetic pipeline. Given FR notices
fetched by ``sources/dea_summaries.py``, this module classifies each
notice by action type and aggregates annual counts. Methodology:
pipeline/notes/dea-investigation-2026-05-01.md.
"""

from __future__ import annotations

import datetime as dt
import re
from collections import defaultdict
from collections.abc import Iterable
from enum import StrEnum
from typing import Any


class ActionType(StrEnum):
    """Canonical administrative-action buckets used in the annual count.

    ``NON_ACTION`` items (scheduling, quotas, importer/manufacturer
    registrations, information collections) are excluded from totals
    but retained in the raw audit trail.
    """

    FINAL_ORDER_REVOCATION = "FINAL_ORDER_REVOCATION"
    IMMEDIATE_SUSPENSION = "IMMEDIATE_SUSPENSION"
    ORDER_TO_SHOW_CAUSE = "ORDER_TO_SHOW_CAUSE"
    SETTLEMENT = "SETTLEMENT"
    ADMONITION = "ADMONITION"
    OTHER_REGISTRANT_ACTION = "OTHER_REGISTRANT_ACTION"
    NON_ACTION = "NON_ACTION"


# Regex patterns for the "NON_ACTION" exclusion list. These must be
# checked FIRST so that scheduling / quota / importer registrations are
# never classified as registrant-actions. The list is derived from a
# survey of 2006–2014 DEA Notice titles in the Federal Register.
_NON_ACTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bSchedules?\s+of\s+Controlled\s+Substances\b", re.I),
    re.compile(r"\bControlled\s+Substance\s+(Registrant|Registration)\s+Fee\b", re.I),
    re.compile(r"\b(Aggregate|Assessment\s+of\s+Annual)\s+(Production\s+)?Quotas?\b", re.I),
    re.compile(r"\bProduction\s+Quotas?\b", re.I),
    re.compile(r"\bBulk\s+Manufacturer\s+of\s+Controlled\s+Substances\b", re.I),
    re.compile(r"\bImporter\s+of\s+Controlled\s+Substances\b", re.I),
    re.compile(r"\bManufacturer\s+of\s+Controlled\s+Substances\b", re.I),
    re.compile(r"\bExporter\s+of\s+Controlled\s+Substances\b", re.I),
    re.compile(
        r"\bNotice\s+of\s+(Registration|Application)\b.*Controlled\s+Substances",
        re.I,
    ),
    re.compile(r"\bAgency\s+Information\s+Collection\s+Activities\b", re.I),
    re.compile(r"\bRecords,\s+Reports,?\s+and\s+Inventory\b", re.I),
    re.compile(r"\bPublic\s+Meeting\b", re.I),
    re.compile(r"\bControlled\s+Substances\s+Staff\b", re.I),
)

# Ordered (most-specific-first) patterns that map a registrant-action
# notice to its canonical ActionType. Evaluated AFTER NON_ACTION.
_ACTION_PATTERNS: tuple[tuple[re.Pattern[str], ActionType], ...] = (
    # ISO — must come before generic Revocation to win on Suspension titles
    (
        re.compile(r"\bImmediate\s+Suspension\s+of\s+Registration\b", re.I),
        ActionType.IMMEDIATE_SUSPENSION,
    ),
    (
        re.compile(r"\bSuspension\s+of\s+Registration\b", re.I),
        ActionType.IMMEDIATE_SUSPENSION,
    ),
    (
        re.compile(r"\bSuspensions?\s+of\s+Registrations?\b", re.I),
        ActionType.IMMEDIATE_SUSPENSION,
    ),
    (
        re.compile(r"\bAffirmance\s+of\s+Suspension\b", re.I),
        ActionType.IMMEDIATE_SUSPENSION,
    ),
    # OTSC — when it DOES appear as a standalone FR notice
    (
        re.compile(r"\bOrder\s+to\s+Show\s+Cause\b", re.I),
        ActionType.ORDER_TO_SHOW_CAUSE,
    ),
    # Revocations
    (
        re.compile(r"\bRevocation\s+of\s+Registration\b", re.I),
        ActionType.FINAL_ORDER_REVOCATION,
    ),
    (
        re.compile(r"\bRevocations?\s+of\s+Registrations?\b", re.I),
        ActionType.FINAL_ORDER_REVOCATION,
    ),
    # Settlements / MOAs
    (
        re.compile(r"\bOrder\s+Accepting\s+Settlement\b", re.I),
        ActionType.SETTLEMENT,
    ),
    (
        re.compile(r"\bSettlement\s+Agreements?\b", re.I),
        ActionType.SETTLEMENT,
    ),
    (
        re.compile(r"\bMemorandum\s+of\s+Agreement\b", re.I),
        ActionType.SETTLEMENT,
    ),
    # Admonitions
    (
        re.compile(r"\bAdmonition\s+of\s+Registrant\b", re.I),
        ActionType.ADMONITION,
    ),
    (
        re.compile(r"\bAdmonitions?\s+Of\s+Registrants?\b", re.I),
        ActionType.ADMONITION,
    ),
    # Denials of applications — these ARE registrant actions but fall
    # under the "other" bucket (the metric buckets only list the most
    # severe five dispositions explicitly).
    (
        re.compile(r"\bDenial\s+of\s+Application\b", re.I),
        ActionType.OTHER_REGISTRANT_ACTION,
    ),
    (
        re.compile(r"\bDenials?\s+of\s+Applications?\b", re.I),
        ActionType.OTHER_REGISTRANT_ACTION,
    ),
    # Dismissal of Proceeding — registrant action but not a sanction
    (
        re.compile(r"\bDismissal\s+of\s+Proceeding\b", re.I),
        ActionType.OTHER_REGISTRANT_ACTION,
    ),
    # Post-2011 umbrella title for any final merits disposition
    (
        re.compile(r"\bDecisions?\s+and\s+Orders?\b", re.I),
        ActionType.OTHER_REGISTRANT_ACTION,
    ),
    # Pre-2011 umbrella subject heading
    (
        re.compile(
            r"\bRegistration\s+revocations,?\s+restrictions,?\s+denials\b",
            re.I,
        ),
        ActionType.OTHER_REGISTRANT_ACTION,
    ),
)

# Opioid-relevant heuristic: registrant type in the title suggests a
# pharmacy / distributor / pain-clinic / wholesaler — the registrant
# classes whose 2006–2014 DEA actions were overwhelmingly opioid-driven.
# This is best-effort and intentionally under-inclusive; the metric does
# NOT filter on this flag.
_OPIOID_RELEVANT_HINTS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bPharmacy\b", re.I),
    re.compile(r"\bPharmacies\b", re.I),
    re.compile(r"\bPharmaceuticals?\b", re.I),
    re.compile(r"\bDrugs?\b", re.I),
    re.compile(r"\bDistributors?\b", re.I),
    re.compile(r"\bWholesale(rs?)?\b", re.I),
    re.compile(r"\bPain\b", re.I),
    re.compile(r"\bOpioids?\b", re.I),
    re.compile(r"\bOxycodone\b", re.I),
    re.compile(r"\bHydrocodone\b", re.I),
)


def classify_notice(
    title: str, toc_subject: str | None
) -> tuple[ActionType, str, bool]:
    """Classify a single FR notice.

    Returns ``(action_type, raw_title, opioid_relevant)``. The
    ``action_type`` is determined by (a) NON_ACTION exclusion first,
    (b) the pattern list in order of specificity against the combined
    title + TOC-subject blob. ``OTHER_REGISTRANT_ACTION`` is the
    catch-all for post-2011 "Decision and Order" titles that lack a
    more specific classification.
    """
    title = title or ""
    blob = f"{title} || {toc_subject or ''}"

    # Non-action exclusion first — prevents a quota notice from getting
    # swept up by a generic word match later.
    for pat in _NON_ACTION_PATTERNS:
        if pat.search(blob):
            return ActionType.NON_ACTION, title, False

    # Specific action classification.
    for pat, action_type in _ACTION_PATTERNS:
        if pat.search(blob):
            opioid = any(p.search(title) for p in _OPIOID_RELEVANT_HINTS)
            return action_type, title, opioid

    # Unknown title — treat as NON_ACTION. We prefer undercounting to
    # sweeping arbitrary DEA notices into the total.
    return ActionType.NON_ACTION, title, False


# --------------------------------------------------------------------------
# Aggregation
# --------------------------------------------------------------------------

METHODOLOGY = (
    "Counts reflect Federal Register publication date, not date of underlying "
    "misconduct. Each FR Notice with a title/TOC-subject matching a "
    "registrant-action disposition is counted once (deduped by "
    "document_number). Scheduling, quota, importer/manufacturer registration, "
    "and information-collection notices are excluded. Administrative scope "
    "only — criminal prosecutions are tracked separately and not included "
    "here. See pipeline/notes/dea-investigation-2026-05-01.md."
)


def _parse_year(doc: dict[str, Any]) -> int | None:
    pd = doc.get("publication_date") or ""
    try:
        return int(pd[:4])
    except (ValueError, TypeError):
        return None


def classify_notices(
    notices: Iterable[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Classify every notice and attach ``action_type`` / ``opioid_relevant``.

    Returns a list of dicts passing through ``title``,
    ``publication_date``, ``document_number``, ``toc_subject``,
    ``html_url``, plus two added fields ``action_type`` (the
    :class:`ActionType` enum value as a string) and
    ``opioid_relevant`` (bool).
    """
    classified: list[dict[str, Any]] = []
    for n in notices:
        title = n.get("title") or ""
        toc = n.get("toc_subject")
        action, _, opioid = classify_notice(title, toc)
        classified.append(
            {
                "title": title,
                "publication_date": n.get("publication_date"),
                "document_number": n.get("document_number"),
                "toc_subject": toc,
                "html_url": n.get("html_url"),
                "action_type": action.value,
                "opioid_relevant": opioid,
            }
        )
    return classified


def aggregate_by_year(
    classified: Iterable[dict[str, Any]],
) -> dict[int, dict[str, Any]]:
    """Aggregate classified notices into per-year totals + by_type breakdown.

    * Dedupes by ``document_number`` (first-seen wins).
    * Excludes ``NON_ACTION`` items from ``total`` and ``by_type``.
    * Returns ``{year: {"total": N, "by_type": {ActionType: N, ...}}}``.
      (by_type keys are :class:`ActionType` enum values for internal use.)
    """
    seen: set[str] = set()
    by_year: dict[int, dict[str, Any]] = defaultdict(
        lambda: {"total": 0, "by_type": defaultdict(int)}
    )

    for doc in classified:
        docnum = doc.get("document_number")
        if docnum and docnum in seen:
            continue
        if docnum:
            seen.add(docnum)

        year = _parse_year(doc)
        if year is None:
            continue

        action_str = doc.get("action_type")
        try:
            action = ActionType(action_str)
        except ValueError:
            continue
        if action is ActionType.NON_ACTION:
            continue

        slot = by_year[year]
        slot["total"] += 1
        slot["by_type"][action] += 1

    # Resolve defaultdicts so callers don't get surprise writes.
    return {
        y: {"total": v["total"], "by_type": dict(v["by_type"])}
        for y, v in by_year.items()
    }


def build_artifact(
    classified: Iterable[dict[str, Any]],
    years: Iterable[int],
    *,
    fetched_at: dt.datetime | None = None,
) -> dict[str, Any]:
    """Build the ``dea_actions_by_year.json`` artifact payload.

    Years missing from the aggregated data are emitted with
    ``total=0, by_type={}`` so the series is dense across the
    requested range.
    """
    years_list = sorted(set(years))
    by_year = aggregate_by_year(classified)
    out_years: list[dict[str, Any]] = []
    for y in years_list:
        slot = by_year.get(y, {"total": 0, "by_type": {}})
        out_years.append(
            {
                "year": y,
                "total": slot["total"],
                "by_type": {k.value: v for k, v in slot["by_type"].items()},
            }
        )

    fetched = fetched_at or dt.datetime.now(tz=dt.UTC)
    return {
        "years": out_years,
        "methodology": METHODOLOGY,
        "source": "Federal Register API (federalregister.gov/api/v1)",
        "fetched_at": fetched.isoformat(),
    }
