"""CDC WONDER D76 client."""

from __future__ import annotations

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from openarcos_pipeline.log import get_logger

URL = "https://wonder.cdc.gov/controller/datarequest/D76"
log = get_logger("openarcos.sources.cdc")

# ICD-10 codes for drug poisoning + intent categories (per spec §2).
DRUG_POISONING_ICD10 = [
    "X40", "X41", "X42", "X43", "X44", "X60", "X61", "X62",
    "X63", "X64", "X85", "Y10", "Y11", "Y12", "Y13", "Y14",
]


def build_request_xml(state_fips: str, years: list[int]) -> str:
    """Build the D76 XML body for `state_fips` across `years`."""
    year_values = "".join(f"<value>{y}</value>" for y in years)
    icd_values = "".join(f"<value>{c}</value>" for c in DRUG_POISONING_ICD10)
    return f"""<?xml version="1.0" encoding="utf-8"?>
<request-parameters>
  <parameter><name>accept_datause_restrictions</name><value>true</value></parameter>
  <parameter><name>B_1</name><value>D76.V1-level3</value></parameter>
  <parameter><name>B_2</name><value>D76.V1-level1</value></parameter>
  <parameter><name>F_D76.V1</name>{year_values}</parameter>
  <parameter><name>F_D76.V9</name><value>{state_fips}</value></parameter>
  <parameter><name>F_D76.V10</name><value>*All*</value></parameter>
  <parameter><name>F_D76.V2</name><value>*All*</value></parameter>
  <parameter><name>F_D76.V17</name>{icd_values}</parameter>
  <parameter><name>O_javascript</name><value>on</value></parameter>
  <parameter><name>O_precision</name><value>1</value></parameter>
  <parameter><name>O_rate_per</name><value>100000</value></parameter>
  <parameter><name>O_title</name><value>openarcos</value></parameter>
  <parameter><name>V_D76.V1</name><value/></parameter>
  <parameter><name>V_D76.V9</name><value/></parameter>
  <parameter><name>action-Send</name><value>Send</value></parameter>
  <parameter><name>stage</name><value>request</value></parameter>
</request-parameters>
"""


class CDCWonderClient:
    def __init__(
        self,
        url: str = URL,
        timeout: float = 180.0,
        max_retries: int = 4,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._url = url
        self._client = httpx.Client(
            timeout=timeout, follow_redirects=True, transport=transport
        )
        self._max_retries = max_retries

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "CDCWonderClient":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def fetch(self, state_fips: str, years: list[int]) -> str:
        body = build_request_xml(state_fips, years)

        @retry(
            stop=stop_after_attempt(self._max_retries),
            wait=wait_exponential_jitter(initial=2.0, max=30.0),
            retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
            reraise=True,
        )
        def _do() -> str:
            log.info("cdc POST", extra={"state": state_fips, "years": years})
            resp = self._client.post(self._url, data={"request_xml": body})
            if resp.status_code >= 500:
                resp.raise_for_status()
            resp.raise_for_status()
            return resp.text

        return _do()
