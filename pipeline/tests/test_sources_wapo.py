"""WaPo fetch client: replays recorded fixtures, retries on transient errors."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from openarcos_pipeline.sources.wapo_arcos import WapoClient

FIXTURES = Path(__file__).parent / "fixtures" / "wapo"


def make_transport() -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        params = dict(request.url.params)
        if path == "/v1/county_raw" and params.get("state") == "WV":
            data = json.loads((FIXTURES / "county_2012_54059.json").read_text())
            return httpx.Response(200, json=data)
        if path == "/v1/county_list" and params.get("state") == "WV":
            data = json.loads((FIXTURES / "county_list_wv.json").read_text())
            return httpx.Response(200, json=data)
        return httpx.Response(404, json={"error": "not found"})

    return httpx.MockTransport(handler)


def test_county_raw_returns_fixture_data():
    client = WapoClient(transport=make_transport())
    rows = client.county_raw("WV", "Mingo")
    assert isinstance(rows, list)
    assert len(rows) > 0


def test_county_list_returns_fixture():
    client = WapoClient(transport=make_transport())
    counties = client.county_list("WV")
    assert isinstance(counties, list)
    assert len(counties) > 0


def test_retries_on_transient_error():
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        if call_count["n"] < 3:
            return httpx.Response(503)
        data = json.loads((FIXTURES / "county_list_wv.json").read_text())
        return httpx.Response(200, json=data)

    client = WapoClient(transport=httpx.MockTransport(handler), max_retries=3)
    counties = client.county_list("WV")
    assert len(counties) > 0
    assert call_count["n"] == 3


def test_gives_up_after_max_retries():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    client = WapoClient(transport=httpx.MockTransport(handler), max_retries=2)
    with pytest.raises(httpx.HTTPStatusError):
        client.county_list("WV")
