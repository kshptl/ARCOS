"""DEA administrative enforcement actions — Federal Register fetcher.

Replaces the prior synthetic PDF-based source. Pulls DEA NOTICE-type
documents from the Federal Register API (documents.json) one year at a
time, follows pagination, and caches the raw JSON per year under
``data/raw/dea/fr_notices_<year>.json`` for auditability.

Source: https://www.federalregister.gov/developers/documentation/api/v1/

See pipeline/notes/dea-investigation-2026-05-01.md for methodology.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from openarcos_pipeline.config import Config
from openarcos_pipeline.log import get_logger

log = get_logger("openarcos.sources.dea")

FR_API = "https://www.federalregister.gov/api/v1/documents.json"
TARGET_YEARS = tuple(range(2006, 2015))

# Fields we ask the FR API to return for each document. Keeping the set
# small reduces payload size and keeps the cached JSON readable.
FR_FIELDS: tuple[str, ...] = (
    "title",
    "publication_date",
    "document_number",
    "toc_subject",
    "html_url",
)


class _RetryableError(Exception):
    """Raised from the inner fetch to signal tenacity a retry is warranted.

    We wrap httpx.Response.raise_for_status() so that 5xx and transport
    errors are retried, but 4xx errors are re-raised immediately.
    """


def _build_params(year: int) -> list[tuple[str, str]]:
    """Build query params as a list of (key, value) tuples.

    The FR API expects repeated keys like ``fields[]`` and
    ``conditions[agencies][]`` — httpx preserves insertion order when
    given a list of tuples.
    """
    params: list[tuple[str, str]] = [
        ("conditions[agencies][]", "drug-enforcement-administration"),
        ("conditions[publication_date][year]", str(year)),
        ("conditions[type][]", "NOTICE"),
        ("per_page", "1000"),
    ]
    for f in FR_FIELDS:
        params.append(("fields[]", f))
    return params


def _fetch_url(
    client: httpx.Client,
    url: str,
    params: list[tuple[str, str]] | None = None,
) -> dict[str, Any]:
    """Fetch a single FR API URL, retrying on transport / 5xx errors only.

    A 4xx response raises immediately (no retry) — it signals a malformed
    request, not a transient network condition.
    """

    @retry(
        stop=stop_after_attempt(4),
        wait=wait_exponential_jitter(initial=1.0, max=15.0),
        retry=retry_if_exception_type((_RetryableError, httpx.TransportError)),
        reraise=True,
    )
    def _do() -> dict[str, Any]:
        resp = client.get(url, params=params)
        if 500 <= resp.status_code < 600:
            # Transient; allow tenacity to retry.
            raise _RetryableError(f"{resp.status_code} from {url}")
        resp.raise_for_status()
        return resp.json()

    return _do()


def fetch_year_notices(
    cfg: Config,
    year: int,
    transport: httpx.BaseTransport | None = None,
) -> dict[str, Any]:
    """Fetch every DEA NOTICE published in ``year`` from the Federal Register.

    Returns a dict of shape ``{"results": [...], "count": N}`` with all
    pages concatenated. Also writes the combined body to
    ``cfg.raw_dir/dea/fr_notices_<year>.json`` for audit / offline
    replay.
    """
    out_dir = cfg.raw_dir / "dea"
    out_dir.mkdir(parents=True, exist_ok=True)

    log.info("dea.fr GET year", extra={"year": year})
    all_results: list[dict[str, Any]] = []
    next_url: str | None = FR_API
    params: list[tuple[str, str]] | None = _build_params(year)

    with httpx.Client(timeout=60.0, follow_redirects=True, transport=transport) as client:
        while next_url is not None:
            body = _fetch_url(client, next_url, params=params)
            results = body.get("results") or []
            all_results.extend(results)
            next_url = body.get("next_page_url")
            # Subsequent pages include their own query string; clear params
            # so we don't double-apply filters.
            params = None

    combined = {"count": len(all_results), "results": all_results}
    (out_dir / f"fr_notices_{year}.json").write_text(json.dumps(combined, indent=2))
    return combined


def fetch_reports(
    cfg: Config,
    years: list[int] | None = None,
    transport: httpx.BaseTransport | None = None,
) -> None:
    """Fetch Federal Register DEA notices for every year in the target range.

    This is the entry point wired into the pipeline CLI (``openarcos
    fetch --source dea``). Writes one raw JSON file per year under
    ``data/raw/dea/``.
    """
    years = years or list(TARGET_YEARS)
    for year in years:
        fetch_year_notices(cfg, year=year, transport=transport)
