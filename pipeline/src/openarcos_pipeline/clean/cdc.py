"""Parse CDC WONDER D76 TSV exports into a canonical DataFrame.

The live scraper (``openarcos_pipeline.sources.cdc_wonder_scraper``)
writes one ``{state_fips}_{abbrev}.tsv`` file per state. This module
collapses those TSVs into a single ``{fips, year, deaths, suppressed}``
DataFrame consumed by the join/aggregate layers.

Richer fields (population, crude_rate, unreliable flag) live in the
parallel :mod:`openarcos_pipeline.aggregate_cdc` artifact; we
deliberately project those away here because the existing downstream
JSON-schema contract
(``pipeline/schemas/cdc-overdose-by-county-year.schema.json``) is
pinned to the four-column shape.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

from openarcos_pipeline.sources.cdc_wonder_scraper import parse_tsv

_CANONICAL_SCHEMA = {
    "fips": pl.Utf8,
    "year": pl.Int64,
    "deaths": pl.Int64,
    "suppressed": pl.Boolean,
}


def parse_d76_tsv(tsv_text: str) -> pl.DataFrame:
    """Parse one WONDER TSV and project to the canonical 4-column shape."""
    rows = parse_tsv(tsv_text)
    projected = [
        {
            "fips": r["county_fips"],
            "year": r["year"],
            "deaths": r["deaths"],
            "suppressed": r["suppressed"],
        }
        for r in rows
    ]
    return pl.DataFrame(projected, schema=_CANONICAL_SCHEMA)


def load_cache_dir(cache_dir: Path) -> pl.DataFrame:
    """Concatenate every TSV in ``cache_dir`` into one DataFrame.

    Dedupes by ``(fips, year)``; first occurrence wins.
    """
    cache_dir = Path(cache_dir)
    frames = [parse_d76_tsv(p.read_text()) for p in sorted(cache_dir.glob("*.tsv"))]
    if not frames:
        return pl.DataFrame(schema=_CANONICAL_SCHEMA)
    df = pl.concat(frames, how="vertical_relaxed")
    return df.unique(subset=["fips", "year"], keep="first").sort(["fips", "year"])


def parse_d76_response(_text: str) -> pl.DataFrame:
    """Legacy XML parser shim.

    The D76 XML API refuses county-level queries (HTTP 500 "Only
    national data are available..."). All production data now comes
    from TSV exports of the interactive UI via
    :func:`parse_d76_tsv`. This function remains only so existing tests
    that feed an unchanged XML body through a soft-deprecated path keep
    compiling; it returns an empty canonical-shape frame rather than
    silently parsing stale fixtures.
    """
    return pl.DataFrame(schema=_CANONICAL_SCHEMA)
