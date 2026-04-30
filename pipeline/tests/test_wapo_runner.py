"""WaPo runner: iterates counties, writes to data/raw/wapo/."""

import json
from pathlib import Path

import httpx

from openarcos_pipeline.config import Config
from openarcos_pipeline.sources.wapo_arcos import WapoClient
from openarcos_pipeline.sources.wapo_runner import fetch_state

FIXTURES = Path(__file__).parent / "fixtures" / "wapo"


def mock_transport() -> httpx.MockTransport:
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/v1/county_list":
            # Match the real WaPo /v1/county_list shape (uppercase BUYER_* keys).
            return httpx.Response(
                200,
                json=[
                    {"BUYER_STATE": "WV", "BUYER_COUNTY": "MINGO", "countyfips": "54059"},
                    {"BUYER_STATE": "WV", "BUYER_COUNTY": "CABELL", "countyfips": "54011"},
                ],
            )
        if req.url.path == "/v1/county_raw":
            data = json.loads((FIXTURES / "county_2012_54059.json").read_text())
            return httpx.Response(200, json=data)
        return httpx.Response(200, json=[])

    return httpx.MockTransport(handler)


def test_fetch_state_writes_files(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()
    client = WapoClient(transport=mock_transport())
    fetch_state(client, cfg, state="WV")
    wapo_raw = cfg.raw_dir / "wapo"
    assert wapo_raw.is_dir()
    files = sorted(p.name for p in wapo_raw.glob("*.json"))
    assert any("Mingo" in n for n in files)
    assert any("Cabell" in n for n in files)
