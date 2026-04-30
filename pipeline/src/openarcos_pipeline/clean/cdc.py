"""Parse CDC WONDER D76 XML responses."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

import polars as pl

from openarcos_pipeline.fips import normalize_fips

FIPS_IN_LABEL = re.compile(r"\((\d{5})\)")


def parse_d76_response(xml_text: str) -> pl.DataFrame:
    """Walk the response `<data-table>` and produce canonical rows.

    Per notes/cdc.md: each `<r>` is a row; `<c>` cells carry labels.
    County labels look like "Mingo County, WV (54059)"; year cells are ints.
    Suppressed cells carry the literal string "Suppressed".
    """
    rows: list[dict[str, object]] = []
    root = ET.fromstring(xml_text)
    data_table = root.find(".//data-table")
    if data_table is None:
        return pl.DataFrame(
            schema={
                "fips": pl.Utf8,
                "year": pl.Int64,
                "deaths": pl.Int64,
                "suppressed": pl.Boolean,
            }
        )

    current_county: str | None = None
    for r in data_table.findall("r"):
        cells = r.findall("c")
        if not cells:
            continue
        # WONDER responses are hierarchical: county cells appear once per group,
        # year cells in child rows. Detect by number of `l`-attr present.
        # Heuristic: a cell with an `l` attribute that matches the FIPS pattern
        # is a county header; a cell whose label looks like "YYYY" is the year;
        # a cell whose text is "Suppressed" marks suppression; any numeric text
        # is the death count.
        county_match: str | None = None
        year: int | None = None
        deaths: int | None = None
        suppressed = False
        for c in cells:
            label = (c.get("l") or "").strip()
            text = (c.text or "").strip()
            m = FIPS_IN_LABEL.search(label)
            if m:
                county_match = m.group(1)
                continue
            if label.isdigit() and len(label) == 4:
                year = int(label)
                continue
            # Value cell (no meaningful label, or label != county/year).
            if text.lower() == "suppressed":
                suppressed = True
                deaths = None
                continue
            if text.replace(",", "").isdigit():
                deaths = int(text.replace(",", ""))
                continue
            # Fall back to label-as-value if no text (older format).
            if label.lower() == "suppressed":
                suppressed = True
                deaths = None
            elif label.replace(",", "").isdigit() and len(label) != 4:
                deaths = int(label.replace(",", ""))
        if county_match is not None:
            current_county = normalize_fips(county_match)
        if year is not None and current_county is not None:
            rows.append(
                {
                    "fips": current_county,
                    "year": year,
                    "deaths": deaths,
                    "suppressed": suppressed,
                }
            )
    return pl.DataFrame(
        rows,
        schema={
            "fips": pl.Utf8,
            "year": pl.Int64,
            "deaths": pl.Int64,
            "suppressed": pl.Boolean,
        },
    )
