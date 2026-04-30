"""Structural-shape canary hashes.

Compared only against the *schema fingerprint* (sorted top-level keys) of the
first page of a response — not the full payload — so small data changes don't
trigger. Goal: fail loud if WaPo renames/drops columns.

Update deliberately when we knowingly accept an upstream contract change.
"""

from __future__ import annotations

# Map endpoint → expected sorted-key signature (str representation).
# Signatures below were computed from the fixtures authored during the
# Task 19 spike (see pipeline/notes/wapo.md). The spike could not run
# against the live API in this environment; when a maintainer re-records
# real responses they MUST regenerate these values.
EXPECTED_SIGNATURES: dict[str, str] = {
    "/v1/county_raw": (
        "BUYER_COUNTY|BUYER_STATE|DOSAGE_UNIT|countyfips|dosage_unit_per_cap|population|year"
    ),
    "/v1/county_list": "BUYER_COUNTY|BUYER_STATE|countyfips",
    "/v1/combined_distributor_state_county": (
        "BUYER_COUNTY|BUYER_STATE|DOSAGE_UNIT|REPORTER|countyfips|year"
    ),
    "/v1/pharmacy_raw": (
        "BUYER_ADDRESS1|BUYER_CITY|BUYER_COUNTY|BUYER_NAME|"
        "BUYER_STATE|countyfips|total_dosage_unit|years"
    ),
}


def signature_of(rows: list[dict]) -> str:
    """Stable shape fingerprint: sorted top-level keys of the first row."""
    if not rows:
        return "empty"
    return "|".join(sorted(rows[0].keys()))
