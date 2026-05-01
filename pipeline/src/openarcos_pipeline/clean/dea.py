"""Classify & aggregate DEA Federal Register enforcement notices.

Replaces the prior PDF-based synthetic pipeline. Given FR notices
fetched by ``sources/dea_summaries.py``, this module classifies each
notice by action type and aggregates annual counts. Methodology:
pipeline/notes/dea-investigation-2026-05-01.md.
"""

from __future__ import annotations

import re
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
# Back-compat stubs — retained briefly for the CLI wiring that will be
# rewritten in Step 3. They intentionally raise if called so any stray
# usage fails loudly rather than silently emitting stale synthetic data.
# --------------------------------------------------------------------------


def parse_annual_report(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
    """Legacy PDF parser — removed. Use the FR-based classifier."""
    raise RuntimeError(
        "parse_annual_report() has been removed; DEA data now comes from the "
        "Federal Register API. See pipeline/notes/dea-investigation-2026-05-01.md."
    )


def fill_synthetic_years(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
    """Synthetic-year filler — removed."""
    raise RuntimeError(
        "fill_synthetic_years() has been removed; DEA action counts now come "
        "from the Federal Register API and cover every year 2006–2014."
    )
