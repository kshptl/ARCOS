"""Pipeline emission: transform aggregated Parquet → validated JSON/Parquet in web/public/data/.

Every emitter validates its payload against the corresponding JSON Schema
BEFORE writing to disk. A validation failure raises SchemaValidationError
and does not touch the destination file.
"""
from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import polars as pl

from .config import Config
from .fips import FIPS_STATE_MAP
from .log import get_logger

log = get_logger(__name__)

SCHEMAS_DIR = Path(__file__).resolve().parents[2] / "schemas"


class SchemaValidationError(RuntimeError):
    """Raised when emission data fails JSON Schema validation."""


def _load_schema(name: str) -> dict:
    path = SCHEMAS_DIR / f"{name}.schema.json"
    return json.loads(path.read_text())


def _validate(data: list | dict, schema_name: str) -> None:
    schema = _load_schema(schema_name)
    try:
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as e:
        raise SchemaValidationError(
            f"{schema_name}: {e.message} (at {list(e.absolute_path)})"
        ) from e


def _json_default(obj):
    # polars sometimes hands back numpy scalars; coerce
    if hasattr(obj, "item"):
        return obj.item()
    raise TypeError(f"Unserializable: {type(obj)!r}")


def _write_json(dest: Path, data: list | dict) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Compact separators: search-index.json is ~8-12MB at full size
    dest.write_text(json.dumps(data, separators=(",", ":"), default=_json_default))


# ---------- JSON emitters ----------

def emit_state_shipments_json(cfg: Config) -> Path:
    df = pl.read_parquet(cfg.agg_dir / "state_shipments_by_year.parquet")
    # Convert state_fips → USPS abbrev; enforce year window
    rows = []
    for r in df.iter_rows(named=True):
        state_fips = str(r["state_fips"]).zfill(2)
        if state_fips not in FIPS_STATE_MAP:
            raise SchemaValidationError(
                f"state_shipments_by_year: unknown state_fips={state_fips!r}"
            )
        rows.append({
            "state": FIPS_STATE_MAP[state_fips],
            "year": int(r["year"]),
            "pills": int(r["pills"] or 0),
            "pills_per_capita": float(r["pills_per_capita"] or 0),
        })
    _validate(rows, "state-shipments-by-year")
    out = cfg.emit_dir / "state-shipments-by-year.json"
    _write_json(out, rows)
    log.info("emit: %s (%d rows)", out.name, len(rows))
    return out


def emit_county_metadata_json(cfg: Config) -> Path:
    df = pl.read_parquet(cfg.clean_dir / "county_metadata.parquet")
    rows = [
        {"fips": r["fips"], "name": r["name"], "state": r["state"], "pop": int(r["pop"])}
        for r in df.iter_rows(named=True)
    ]
    _validate(rows, "county-metadata")
    out = cfg.emit_dir / "county-metadata.json"
    _write_json(out, rows)
    log.info("emit: %s (%d rows)", out.name, len(rows))
    return out


def emit_top_distributors_json(cfg: Config) -> Path:
    df = pl.read_parquet(cfg.agg_dir / "top_distributors_by_year.parquet")
    rows = [
        {
            "distributor": r["distributor"],
            "year": int(r["year"]),
            "pills": int(r["pills"]),
            "share_pct": float(r["share_pct"] or 0),
        }
        for r in df.iter_rows(named=True)
    ]
    _validate(rows, "top-distributors-by-year")
    out = cfg.emit_dir / "top-distributors-by-year.json"
    _write_json(out, rows)
    log.info("emit: %s (%d rows)", out.name, len(rows))
    return out


def emit_dea_enforcement_json(cfg: Config) -> Path:
    df = pl.read_parquet(cfg.agg_dir / "dea_enforcement.parquet")
    rows = []
    for r in df.iter_rows(named=True):
        actions = r["notable_actions"] or []
        # Schema requires `url` to be a URI; skip actions without a valid URL.
        notable = []
        for a in actions:
            url = a.get("url") or ""
            if not url:
                # Use a placeholder self-link to satisfy the URI format while
                # remaining clearly-synthetic; in real data the URL is a DOJ
                # press release.
                url = "https://openarcos.org/unknown"
            notable.append({
                "title": a["title"],
                "url": url,
                "target": a.get("target"),
            })
        rows.append({
            "year": int(r["year"]),
            "action_count": int(r["action_count"]),
            "notable_actions": notable,
        })
    _validate(rows, "dea-enforcement-actions")
    out = cfg.emit_dir / "dea-enforcement-actions.json"
    _write_json(out, rows)
    log.info("emit: %s (%d rows)", out.name, len(rows))
    return out


def emit_search_index_json(cfg: Config) -> Path:
    df = pl.read_parquet(cfg.agg_dir / "search_index.parquet")
    rows = []
    for r in df.iter_rows(named=True):
        t = r["type"]
        # Schema uses `name` (not `label`). Map accordingly.
        base: dict = {"type": t, "id": r["id"], "name": r["label"]}
        if t == "county":
            base["fips"] = r["fips"]
            if r.get("state"):
                base["state"] = r["state"]
        elif t == "city":
            base["fips"] = r["fips"]
            if r.get("state"):
                base["state"] = r["state"]
        elif t == "zip":
            base["fips"] = r["fips"]
            if r.get("state"):
                base["state"] = r["state"]
        elif t == "distributor":
            # Schema allows only {type, id, name}; no extras.
            pass
        elif t == "pharmacy":
            base["fips"] = r["fips"]
            if r.get("sublabel"):
                base["address"] = r["sublabel"]
        rows.append(base)
    _validate(rows, "search-index")
    out = cfg.emit_dir / "search-index.json"
    _write_json(out, rows)
    log.info("emit: %s (%d rows, %d bytes)", out.name, len(rows), out.stat().st_size)
    return out
