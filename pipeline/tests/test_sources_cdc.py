"""Legacy CDC WONDER XML API client documents county-level refusal."""

import httpx

from openarcos_pipeline.sources.cdc_wonder import CDCWonderClient, build_request_xml

def test_build_request_xml_contains_years():
    body = build_request_xml(state_fips="54", years=[2012, 2013, 2014])
    assert "<value>2012</value>" in body
    assert "<value>2013</value>" in body
    assert "<value>54</value>" in body
    assert "accept_datause_restrictions" in body


def test_fetch_raises_on_county_level_api_refusal():
    def handler(req: httpx.Request) -> httpx.Response:
        assert req.method == "POST"
        return httpx.Response(
            500,
            text="Only national data are available for this dataset when using the WONDER web service.",
            headers={"content-type": "text/plain"},
        )

    with CDCWonderClient(transport=httpx.MockTransport(handler), max_retries=1) as client:
        try:
            client.fetch(state_fips="54", years=[2012, 2013, 2014])
        except httpx.HTTPStatusError as exc:
            assert exc.response.status_code == 500
        else:  # pragma: no cover - assertion path
            raise AssertionError("county-level D76 API refusal should raise")
