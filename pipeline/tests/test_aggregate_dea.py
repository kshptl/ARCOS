"""Aggregation of classified DEA FR notices into annual counts."""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

from openarcos_pipeline.clean.dea import (
    ActionType,
    aggregate_by_year,
    build_artifact,
    classify_notices,
)


def _mk_notice(
    title: str,
    year: int,
    doc_num: str,
    toc: str | None = None,
) -> dict:
    return {
        "title": title,
        "publication_date": f"{year}-06-15",
        "document_number": doc_num,
        "toc_subject": toc,
        "html_url": f"https://example.org/{doc_num}",
    }


def test_aggregate_dedupes_by_document_number():
    """If the same document_number appears twice in the input it must be
    counted once."""
    notices = [
        _mk_notice("A; Revocation of Registration", 2011, "DUPE-1"),
        _mk_notice("A; Revocation of Registration", 2011, "DUPE-1"),  # duplicate
        _mk_notice("B; Revocation of Registration", 2011, "OTHER-1"),
    ]
    classified = classify_notices(notices)
    by_year = aggregate_by_year(classified)
    assert by_year[2011]["total"] == 2, "expected exactly 2 unique actions"


def test_aggregate_counts_by_year_and_classification():
    """Per-year totals are split by ActionType."""
    notices = [
        _mk_notice("A; Revocation of Registration", 2011, "R1"),
        _mk_notice("B; Revocation of Registration", 2011, "R2"),
        _mk_notice("C; Suspension of Registration", 2011, "S1"),
        _mk_notice("D; Admonition of Registrant", 2012, "A1"),
        _mk_notice("E; Order Accepting Settlement Agreement", 2012, "SE1"),
    ]
    classified = classify_notices(notices)
    by_year = aggregate_by_year(classified)
    assert by_year[2011]["total"] == 3
    assert by_year[2011]["by_type"][ActionType.FINAL_ORDER_REVOCATION] == 2
    assert by_year[2011]["by_type"][ActionType.IMMEDIATE_SUSPENSION] == 1
    assert by_year[2012]["total"] == 2
    assert by_year[2012]["by_type"][ActionType.ADMONITION] == 1
    assert by_year[2012]["by_type"][ActionType.SETTLEMENT] == 1


def test_aggregate_excludes_non_actions():
    """NON_ACTION classified notices must not contribute to totals."""
    notices = [
        _mk_notice("A; Revocation of Registration", 2011, "R1"),
        _mk_notice(
            "Schedules of Controlled Substances: Placement of foo",
            2011,
            "N1",
        ),
        _mk_notice("Bulk Manufacturer of Controlled Substances Application", 2011, "N2"),
    ]
    classified = classify_notices(notices)
    by_year = aggregate_by_year(classified)
    assert by_year[2011]["total"] == 1


def test_build_artifact_matches_expected_shape(tmp_path):
    """The emitted artifact JSON has {years: [...], methodology, source, fetched_at}."""
    notices = [
        _mk_notice("A; Revocation of Registration", 2006, "R2006"),
        _mk_notice("B; Order Accepting Settlement Agreement", 2010, "SE2010"),
    ]
    classified = classify_notices(notices)
    artifact = build_artifact(classified, years=range(2006, 2015))
    assert "years" in artifact
    assert "methodology" in artifact
    assert "source" in artifact
    assert artifact["source"].startswith("Federal Register")
    # Parseable ISO timestamp
    dt.datetime.fromisoformat(artifact["fetched_at"])
    # Every year 2006-2014 is present (empty years have total=0)
    years = {y["year"] for y in artifact["years"]}
    assert years == set(range(2006, 2015))
    got_2006 = next(y for y in artifact["years"] if y["year"] == 2006)
    assert got_2006["total"] == 1
    assert got_2006["by_type"]["FINAL_ORDER_REVOCATION"] == 1
    got_2007 = next(y for y in artifact["years"] if y["year"] == 2007)
    assert got_2007["total"] == 0
    assert got_2007["by_type"] == {}


def test_build_artifact_validates_against_schema(tmp_path):
    """The artifact must validate against dea-actions-by-year.schema.json."""
    import jsonschema

    schema_path = (
        Path(__file__).parent.parent / "schemas" / "dea-actions-by-year.schema.json"
    )
    schema = json.loads(schema_path.read_text())

    notices = [
        _mk_notice("A; Revocation of Registration", 2006, "R2006"),
        _mk_notice("B; Immediate Suspension of Registration", 2011, "I2011"),
        _mk_notice("C; Admonition of Registrant", 2014, "A2014"),
    ]
    artifact = build_artifact(classify_notices(notices), years=range(2006, 2015))
    jsonschema.validate(artifact, schema)
