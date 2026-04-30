"""WaPo ARCOS API client.

Public API, public key. Replayable via httpx.MockTransport in tests.
Docs: https://github.com/wpinvestigative/arcos-api
"""

from __future__ import annotations

import time
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from openarcos_pipeline.log import get_logger
from openarcos_pipeline.sources.expected_hashes import (
    EXPECTED_SIGNATURES,
    signature_of,
)

BASE_URL = "https://arcos-api.ext.nile.works"
DEFAULT_KEY = "WaPo"

log = get_logger("openarcos.sources.wapo")


class WapoClient:
    def __init__(
        self,
        base_url: str = BASE_URL,
        key: str = DEFAULT_KEY,
        timeout: float = 120.0,
        max_retries: int = 5,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url, timeout=timeout, transport=transport
        )
        self._key = key
        self._max_retries = max_retries

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "WapoClient":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def _get(self, path: str, params: dict[str, Any]) -> Any:
        attempt = 0

        @retry(
            stop=stop_after_attempt(self._max_retries),
            wait=wait_exponential_jitter(initial=0.5, max=8.0),
            retry=retry_if_exception_type(httpx.HTTPStatusError),
            reraise=True,
        )
        def _do() -> Any:
            nonlocal attempt
            attempt += 1
            q = {**params, "key": self._key}
            log.info("wapo GET", extra={"path": path, "params": q, "attempt": attempt})
            resp = self._client.get(path, params=q)
            if resp.status_code >= 500:
                resp.raise_for_status()
            resp.raise_for_status()
            time.sleep(0.25)
            data = resp.json()
            if isinstance(data, list) and path in EXPECTED_SIGNATURES:
                actual = signature_of(data)
                expected = EXPECTED_SIGNATURES[path]
                if expected != "REPLACE_ME_WITH_SIG" and actual != expected:
                    raise RuntimeError(
                        f"WaPo response shape changed for {path}: "
                        f"expected {expected!r}, got {actual!r}"
                    )
            return data

        return _do()

    def county_list(self, state: str) -> list[dict[str, Any]]:
        return self._get("/v1/county_list", {"state": state})

    def county_raw(self, state: str, county: str) -> list[dict[str, Any]]:
        return self._get("/v1/county_raw", {"state": state, "county": county})

    def distributors_for_county(
        self, state: str, county: str
    ) -> list[dict[str, Any]]:
        return self._get(
            "/v1/combined_distributor_state_county",
            {"state": state, "county": county},
        )

    def pharmacies_for_county(
        self, state: str, county: str
    ) -> list[dict[str, Any]]:
        return self._get("/v1/pharmacy_raw", {"state": state, "county": county})
