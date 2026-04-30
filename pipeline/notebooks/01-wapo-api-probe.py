"""Spike: probe WaPo ARCOS API and record fixtures. Run once, commit output."""

import json
from pathlib import Path

import httpx

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "wapo"
OUT.mkdir(parents=True, exist_ok=True)

BASE = "https://arcos-api.ext.nile.works"
KEY = "WaPo"  # public key per WaPo README

calls = [
    ("county_2012_54059.json", "/v1/county_raw", {"state": "WV", "county": "Mingo"}),
    ("distributors_54059.json", "/v1/combined_distributor_state_county",
     {"state": "WV", "county": "Mingo"}),
    ("pharmacies_54059.json", "/v1/pharmacy_raw", {"state": "WV", "county": "Mingo"}),
    ("county_list_wv.json", "/v1/county_list", {"state": "WV"}),
]

with httpx.Client(base_url=BASE, timeout=120.0) as client:
    for fname, path, params in calls:
        resp = client.get(path, params={**params, "key": KEY})
        print(path, resp.status_code, len(resp.content), "bytes")
        resp.raise_for_status()
        data = resp.json()
        # For very large responses, truncate to first 100 rows for a fixture.
        if isinstance(data, list) and len(data) > 100:
            data = data[:100]
        (OUT / fname).write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")

print("fixtures written:", sorted(p.name for p in OUT.glob("*.json")))


TEN_COUNTIES = [
    ("WV", "Mingo"), ("VA", "Norton"), ("WV", "Cabell"), ("WV", "Logan"),
    ("WV", "Boone"), ("WV", "Fayette"), ("WV", "Mercer"),
    ("KY", "Floyd"), ("KY", "Pike"), ("KY", "Martin"),
]

with httpx.Client(base_url=BASE, timeout=120.0) as client:
    for state, county in TEN_COUNTIES:
        resp = client.get(
            "/v1/county_raw", params={"state": state, "county": county, "key": KEY}
        )
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list) and len(data) > 200:
            data = data[:200]
        out = OUT / f"county_raw_{state}_{county}.json"
        out.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")
        print(out.name, resp.status_code)
