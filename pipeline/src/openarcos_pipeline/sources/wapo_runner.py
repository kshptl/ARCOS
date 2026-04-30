"""Runner: iterates WaPo endpoints for a state, writes raw JSON per county."""

from __future__ import annotations

import json

from tqdm import tqdm

from openarcos_pipeline.config import Config
from openarcos_pipeline.log import get_logger
from openarcos_pipeline.sources.wapo_arcos import WapoClient

log = get_logger("openarcos.wapo.runner")


def _county_name(row: dict) -> str:
    """Extract a county name from a /v1/county_list row, tolerating key case."""
    # Real WaPo API returns BUYER_COUNTY (uppercase); older examples use `county`/`name`.
    for k in ("BUYER_COUNTY", "county", "name"):
        v = row.get(k)
        if v:
            # API returns uppercase; API query param prefers title case.
            return str(v).title() if str(v).isupper() else str(v)
    return ""


def fetch_state(client: WapoClient, cfg: Config, state: str) -> None:
    """Fetch all counties for one state, write raw JSON under data/raw/wapo/."""
    out_dir = cfg.raw_dir / "wapo"
    out_dir.mkdir(parents=True, exist_ok=True)
    counties = client.county_list(state)
    log.info("wapo runner start", extra={"state": state, "n_counties": len(counties)})
    for row in tqdm(counties, desc=f"WaPo {state}"):
        name = _county_name(row)
        if not name:
            continue
        for endpoint_name, method in [
            ("county_raw", client.county_raw),
            ("distributors", client.distributors_for_county),
            ("pharmacies", client.pharmacies_for_county),
        ]:
            try:
                data = method(state, name)
            except Exception as e:
                log.warning(
                    "wapo fetch failed",
                    extra={
                        "state": state,
                        "county": name,
                        "endpoint": endpoint_name,
                        "err": str(e),
                    },
                )
                continue
            fname = f"{endpoint_name}_{state}_{name.replace(' ', '_')}.json"
            (out_dir / fname).write_text(json.dumps(data, separators=(",", ":")))


def fetch_all(client: WapoClient, cfg: Config) -> None:
    """Fetch all 50 states + DC."""
    states = [
        "AL",
        "AK",
        "AZ",
        "AR",
        "CA",
        "CO",
        "CT",
        "DE",
        "DC",
        "FL",
        "GA",
        "HI",
        "ID",
        "IL",
        "IN",
        "IA",
        "KS",
        "KY",
        "LA",
        "ME",
        "MD",
        "MA",
        "MI",
        "MN",
        "MS",
        "MO",
        "MT",
        "NE",
        "NV",
        "NH",
        "NJ",
        "NM",
        "NY",
        "NC",
        "ND",
        "OH",
        "OK",
        "OR",
        "PA",
        "RI",
        "SC",
        "SD",
        "TN",
        "TX",
        "UT",
        "VT",
        "VA",
        "WA",
        "WV",
        "WI",
        "WY",
    ]
    for st in states:
        fetch_state(client, cfg, st)
