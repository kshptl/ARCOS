"""CDC WONDER client: POSTs D76 request, returns raw XML."""

from pathlib import Path

import httpx

from openarcos_pipeline.sources.cdc_wonder import CDCWonderClient, build_request_xml

FIXTURE = Path(__file__).parent / "fixtures" / "cdc" / "wv_2012_2014.xml"


def test_build_request_xml_contains_years():
    body = build_request_xml(state_fips="54", years=[2012, 2013, 2014])
    assert "<value>2012</value>" in body
    assert "<value>2013</value>" in body
    assert "<value>54</value>" in body
    assert "accept_datause_restrictions" in body


def test_fetch_returns_xml():
    def handler(req: httpx.Request) -> httpx.Response:
        assert req.method == "POST"
        return httpx.Response(
            200, content=FIXTURE.read_bytes(), headers={"content-type": "text/xml"}
        )

    client = CDCWonderClient(transport=httpx.MockTransport(handler))
    body = client.fetch(state_fips="54", years=[2012, 2013, 2014])
    assert body.startswith("<") or body.startswith("\ufeff<")
    assert len(body) > 100
