"""Validate every file in web/public/data against its schema."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import polars as pl
from jsonschema import Draft202012Validator

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = REPO_ROOT / "pipeline" / "schemas"
DATA_DIR = REPO_ROOT / "web" / "public" / "data"

# Maps each artifact filename to the schema it must satisfy.
ARTIFACT_TO_SCHEMA = {
    "state-shipments-by-year.json": "state-shipments-by-year.schema.json",
    "county-metadata.json": "county-metadata.schema.json",
    "top-distributors-by-year.json": "top-distributors-by-year.schema.json",
    "dea-enforcement-actions.json": "dea-enforcement-actions.schema.json",
    "search-index.json": "search-index.schema.json",
    "county-shipments-by-year.parquet": "county-shipments-by-year.schema.json",
    "top-pharmacies.parquet": "top-pharmacies.schema.json",
    "cdc-overdose-by-county-year.parquet": "cdc-overdose-by-county-year.schema.json",
}


def _load_rows(path: Path) -> list[dict]:
    if path.suffix == ".json":
        return json.loads(path.read_text())
    if path.suffix == ".parquet":
        return pl.read_parquet(path).to_dicts()
    raise ValueError(f"unknown extension: {path}")


def main() -> int:
    failures: list[str] = []
    for name, schema_name in ARTIFACT_TO_SCHEMA.items():
        data_path = DATA_DIR / name
        schema_path = SCHEMA_DIR / schema_name
        if not data_path.exists():
            failures.append(f"MISSING: {data_path.relative_to(REPO_ROOT)}")
            continue
        schema = json.loads(schema_path.read_text())
        validator = Draft202012Validator(schema)
        rows = _load_rows(data_path)
        errors = list(validator.iter_errors(rows))
        if errors:
            for err in errors[:3]:
                failures.append(
                    f"INVALID: {data_path.relative_to(REPO_ROOT)}: {err.message}"
                )
            if len(errors) > 3:
                failures.append(f"  ...and {len(errors) - 3} more errors")
        else:
            print(f"OK: {name}")

    if failures:
        print("\nSCHEMA VALIDATION FAILURES:", file=sys.stderr)
        for f in failures:
            print(f"  {f}", file=sys.stderr)
        return 1
    print(f"\nAll {len(ARTIFACT_TO_SCHEMA)} artifacts valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
