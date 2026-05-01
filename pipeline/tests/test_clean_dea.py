"""DEA Federal Register notice classifier tests.

Verifies the title/subject-based classifier that maps each FR notice to
one of the canonical action categories (revocation, ISO, OTSC,
settlement, admonition, other-registrant-action) or NON_ACTION for
items the metric must exclude (scheduling, quotas, bulk-manufacturer
registrations, etc.).
"""

from __future__ import annotations

import pytest

from openarcos_pipeline.clean.dea import (
    ActionType,
    classify_notice,
)


@pytest.mark.parametrize(
    "title,subject,expected",
    [
        # --- Revocations ---
        (
            "Richard Carino, M.D.; Revocation of Registration",
            "Revocations of Registrations:",
            ActionType.FINAL_ORDER_REVOCATION,
        ),
        (
            "Roots Pharmaceuticals, Inc.; Revocation of Registration",
            None,
            ActionType.FINAL_ORDER_REVOCATION,
        ),
        # Post-2011 umbrella title that IS actually a revocation (subject tells us).
        (
            "Kamal Tiwari, M.D.; Pain Management and Surgery Center of Southern Indiana; Decision and Order",
            "Revocations of Registrations:",
            ActionType.FINAL_ORDER_REVOCATION,
        ),
        # --- Immediate Suspensions ---
        (
            "Michael S. Moore, M.D.; Suspension of Registration",
            "Suspension of Registrations:",
            ActionType.IMMEDIATE_SUSPENSION,
        ),
        (
            "Jane Doe, M.D.; Immediate Suspension of Registration",
            None,
            ActionType.IMMEDIATE_SUSPENSION,
        ),
        # --- Order to Show Cause ---
        (
            "John Q Practitioner; Order to Show Cause",
            None,
            ActionType.ORDER_TO_SHOW_CAUSE,
        ),
        # --- Settlements ---
        (
            "Four Seasons Distributors, Inc.; Order Accepting Settlement Agreement and Terminating Proceeding",
            "Settlement Agreements:",
            ActionType.SETTLEMENT,
        ),
        (
            "Some Pharmacy; Memorandum of Agreement",
            None,
            ActionType.SETTLEMENT,
        ),
        # --- Admonitions ---
        (
            "Terese, Inc., D/B/A Peach Orchard Drugs; Admonition of Registrant",
            "Admonitions Of Registrants:",
            ActionType.ADMONITION,
        ),
        # --- Denial of Application — still a registrant action; bucket as OTHER ---
        (
            "Jane Roe, M.D.; Denial of Application",
            "Denials of Applications:",
            ActionType.OTHER_REGISTRANT_ACTION,
        ),
        # --- Post-2011 umbrella title with no subject hint → OTHER ---
        (
            "Kamal Tiwari, M.D.; Pain Management and Surgery Center of Southern Indiana; Decision and Order",
            None,
            ActionType.OTHER_REGISTRANT_ACTION,
        ),
        # --- Dismissal of Proceeding → OTHER (an ancillary registrant action) ---
        (
            "John Doe, M.D.; Dismissal of Proceeding",
            None,
            ActionType.OTHER_REGISTRANT_ACTION,
        ),
        # Post-2011 plural-subject convention: "Decisions and Orders:"
        (
            "Glenn R. Unger, D.D.S.; Declaratory Order",
            "Decisions and Orders:",
            ActionType.OTHER_REGISTRANT_ACTION,
        ),
        # "Affirmance of Suspension Orders" — mid-period DEA titling
        (
            "Nirmal Saran, M.D.; Nisha Saran, D.O.; Affirmance of Suspension Orders",
            "Affirmance of Suspension Orders:",
            ActionType.IMMEDIATE_SUSPENSION,
        ),
        # --- NON_ACTION: scheduling / quotas / bulk manufacturer ---
        (
            "Schedules of Controlled Substances: Placement of 25I-NBOMe into Schedule I",
            None,
            ActionType.NON_ACTION,
        ),
        (
            "Established Aggregate Production Quotas for Schedule I and II Controlled Substances "
            "and Assessment of Annual Needs for the List I Chemicals Ephedrine, Pseudoephedrine, "
            "and Phenylpropanolamine for 2012",
            None,
            ActionType.NON_ACTION,
        ),
        (
            "Bulk Manufacturer of Controlled Substances Application: Cambrex Charles City, Inc.",
            None,
            ActionType.NON_ACTION,
        ),
        (
            "Importer of Controlled Substances; Notice of Registration: Johnson Matthey Pharmaceutical Materials, Inc.",
            None,
            ActionType.NON_ACTION,
        ),
        (
            "Manufacturer of Controlled Substances; Notice of Application",
            None,
            ActionType.NON_ACTION,
        ),
        # Agency information-collection notices
        (
            "Agency Information Collection Activities: Proposed Collection, Comments Requested",
            None,
            ActionType.NON_ACTION,
        ),
    ],
)
def test_classify_title(title, subject, expected):
    """The classifier maps real FR notice titles to the correct category."""
    action_type, raw_title, opioid_relevant = classify_notice(title, subject)
    assert action_type == expected, (
        f"title={title!r} subject={subject!r} → {action_type}, expected {expected}"
    )
    assert raw_title == title
    assert isinstance(opioid_relevant, bool)


def test_opioid_relevant_flag_pharmacy():
    """Pharmacy registrants are flagged opioid-relevant (best-effort heuristic)."""
    _, _, flag = classify_notice(
        "Ideal Pharmacy Care, Inc., D/B/A Esplanade Pharmacy; Revocation of Registration",
        None,
    )
    assert flag is True


def test_opioid_relevant_flag_distributor():
    """Distributor registrants are flagged opioid-relevant."""
    _, _, flag = classify_notice(
        "Roots Pharmaceuticals, Inc.; Revocation of Registration",
        None,
    )
    assert flag is True


def test_opioid_relevant_flag_unknown_practitioner():
    """A generic practitioner name with no context → flag False (not the filter)."""
    _, _, flag = classify_notice("John Doe, M.D.; Revocation of Registration", None)
    assert flag is False
