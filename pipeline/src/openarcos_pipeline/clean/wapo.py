"""Normalize raw WaPo ARCOS responses into canonical polars DataFrames.

Field names map from the WaPo API (documented in notes/wapo.md) to our schemas.
The upstream API returns SCREAMING_CASE column names (e.g. DOSAGE_UNIT,
BUYER_NAME, REPORTER) for tabular endpoints; the older R package examples
sometimes show snake_case. We normalize both to canonical snake_case before
computing outputs.
"""

from __future__ import annotations

from typing import Any

import polars as pl

from openarcos_pipeline.fips import normalize_fips


def _lower_columns(df: pl.DataFrame) -> pl.DataFrame:
    """Rename all columns to their lowercase equivalents (stable, 1-pass)."""
    mapping = {c: c.lower() for c in df.columns if c != c.lower()}
    return df.rename(mapping) if mapping else df


def clean_county_raw(rows: list[dict[str, Any]], state: str, county_fips: str) -> pl.DataFrame:
    """Raw county_raw rows → `{fips, year, pills}` DataFrame."""
    fips = normalize_fips(county_fips)
    if not rows:
        return pl.DataFrame(schema={"fips": pl.Utf8, "year": pl.Int64, "pills": pl.Int64})

    df = _lower_columns(pl.DataFrame(rows))
    # Expect either `year` column or we derive from `transaction_date`.
    if "year" not in df.columns and "transaction_date" in df.columns:
        df = df.with_columns(
            pl.col("transaction_date").str.slice(0, 4).cast(pl.Int64).alias("year")
        )
    # Prefer `dosage_unit` (pills) if present; else fall back to row count.
    pill_col = "dosage_unit" if "dosage_unit" in df.columns else None
    if pill_col is None:
        grouped = df.group_by("year").agg(pl.len().alias("pills"))
    else:
        grouped = df.group_by("year").agg(pl.col(pill_col).sum().cast(pl.Int64).alias("pills"))

    return (
        grouped.with_columns(pl.lit(fips).alias("fips"))
        .select(["fips", "year", "pills"])
        .with_columns(pl.col("year").cast(pl.Int64))
        .sort("year")
    )


def clean_distributors(rows: list[dict[str, Any]]) -> pl.DataFrame:
    """Raw distributor rows → `{distributor, year, pills}` DataFrame.

    This is the national-aggregate view used for /rankings. For per-county
    distributor breakdowns (feeding /county/[fips] pages), see
    `clean_distributors_by_county` which preserves the countyfips column.
    """
    if not rows:
        return pl.DataFrame(schema={"distributor": pl.Utf8, "year": pl.Int64, "pills": pl.Int64})
    df = _lower_columns(pl.DataFrame(rows))
    if "reporter_family" in df.columns and "distributor" not in df.columns:
        df = df.rename({"reporter_family": "distributor"})
    elif "reporter" in df.columns and "distributor" not in df.columns:
        df = df.rename({"reporter": "distributor"})
    if "year" not in df.columns and "transaction_date" in df.columns:
        df = df.with_columns(
            pl.col("transaction_date").str.slice(0, 4).cast(pl.Int64).alias("year")
        )
    pill_col = "dosage_unit" if "dosage_unit" in df.columns else None
    if pill_col is None:
        grouped = df.group_by(["distributor", "year"]).agg(pl.len().alias("pills"))
    else:
        grouped = df.group_by(["distributor", "year"]).agg(
            pl.col(pill_col).sum().cast(pl.Int64).alias("pills")
        )
    return (
        grouped.select(["distributor", "year", "pills"])
        .with_columns(pl.col("year").cast(pl.Int64))
        .sort(["year", "distributor"])
    )


def clean_distributors_by_county(rows: list[dict[str, Any]]) -> pl.DataFrame:
    """Raw distributor rows → `{fips, distributor, year, pills}` DataFrame.

    Identical to :func:`clean_distributors` except the countyfips column is
    preserved and the group-by includes it. Used by the county_top_distributors
    aggregate + county-distributors emitter so each /county/[fips] page can
    list "top distributors into this county" alongside the national ranking.
    Rows without a countyfips are dropped (can't attribute them to a page).
    """
    empty = pl.DataFrame(
        schema={
            "fips": pl.Utf8,
            "distributor": pl.Utf8,
            "year": pl.Int64,
            "pills": pl.Int64,
        }
    )
    if not rows:
        return empty
    df = _lower_columns(pl.DataFrame(rows))
    if "countyfips" not in df.columns:
        return empty
    if "reporter_family" in df.columns and "distributor" not in df.columns:
        df = df.rename({"reporter_family": "distributor"})
    elif "reporter" in df.columns and "distributor" not in df.columns:
        df = df.rename({"reporter": "distributor"})
    if "year" not in df.columns and "transaction_date" in df.columns:
        df = df.with_columns(
            pl.col("transaction_date").str.slice(0, 4).cast(pl.Int64).alias("year")
        )
    df = df.with_columns(pl.col("countyfips").cast(pl.Utf8).alias("fips")).filter(
        pl.col("fips").is_not_null()
    )
    pill_col = "dosage_unit" if "dosage_unit" in df.columns else None
    if pill_col is None:
        grouped = df.group_by(["fips", "distributor", "year"]).agg(pl.len().alias("pills"))
    else:
        grouped = df.group_by(["fips", "distributor", "year"]).agg(
            pl.col(pill_col).sum().cast(pl.Int64).alias("pills")
        )
    return (
        grouped.select(["fips", "distributor", "year", "pills"])
        .with_columns(pl.col("year").cast(pl.Int64))
        .sort(["fips", "year", "distributor"])
    )


def clean_pharmacies(rows: list[dict[str, Any]], county_fips: str) -> pl.DataFrame:
    """Raw pharmacy_raw rows → `{pharmacy_id, name, address, fips, total_pills}`."""
    fips = normalize_fips(county_fips)
    if not rows:
        return pl.DataFrame(
            schema={
                "pharmacy_id": pl.Utf8,
                "name": pl.Utf8,
                "address": pl.Utf8,
                "fips": pl.Utf8,
                "total_pills": pl.Int64,
            }
        )
    df = _lower_columns(pl.DataFrame(rows))
    rename_map = {
        "buyer_dea_no": "pharmacy_id",
        "buyer_name": "name",
        "buyer_address1": "address",
        "buyer_address": "address",
    }
    renames = {k: v for k, v in rename_map.items() if k in df.columns}
    df = df.rename(renames)
    # If no DEA number present, synthesize a stable id from name+address.
    if "pharmacy_id" not in df.columns:
        df = df.with_columns(
            (pl.col("name").cast(pl.Utf8) + "|" + pl.col("address").cast(pl.Utf8)).alias(
                "pharmacy_id"
            )
        )
    # Pick the pill total column. Prefer `total_dosage_unit` (pharmacy rollup),
    # then `dosage_unit` (if rows are transaction-level), else row count.
    if "total_dosage_unit" in df.columns:
        pill_expr = pl.col("total_dosage_unit").sum().cast(pl.Int64)
    elif "dosage_unit" in df.columns:
        pill_expr = pl.col("dosage_unit").sum().cast(pl.Int64)
    else:
        pill_expr = pl.len().cast(pl.Int64)
    agg = (
        df.group_by(["pharmacy_id", "name", "address"])
        .agg(pill_expr.alias("total_pills"))
        .with_columns(pl.lit(fips).alias("fips"))
        .select(["pharmacy_id", "name", "address", "fips", "total_pills"])
        .sort("total_pills", descending=True)
    )
    return agg
