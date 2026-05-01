"""DEA Federal Register API fetcher tests.

The new source replaces synthetic PDF-based scaffolding with the
Federal Register documents.json API. See
pipeline/notes/dea-investigation-2026-05-01.md for the methodology.
"""

from __future__ import annotations

import json

import httpx
import pytest

from openarcos_pipeline.config import Config
from openarcos_pipeline.sources.dea_summaries import fetch_year_notices


def _mock_response(body: dict, status: int = 200) -> httpx.Response:
    return httpx.Response(status, json=body)


def test_fetch_one_year_returns_dict_with_count_and_results(tmp_path, monkeypatch):
    """A successful 1-page fetch returns a dict containing `results` (list
    of notices) and caches the raw JSON to data/raw/dea/fr_notices_<year>.json.
    """
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    calls: list[str] = []
    body = {
        "count": 2,
        "results": [
            {
                "title": "Foo M.D.; Revocation of Registration",
                "publication_date": "2011-01-05",
                "document_number": "2011-00001",
                "toc_subject": "Revocations of Registrations:",
                "html_url": "https://example.org/2011-00001",
            },
            {
                "title": "Bar Pharmacy; Order Accepting Settlement",
                "publication_date": "2011-02-07",
                "document_number": "2011-00002",
                "toc_subject": "Settlement Agreements:",
                "html_url": "https://example.org/2011-00002",
            },
        ],
        "next_page_url": None,
    }

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(str(req.url))
        return _mock_response(body)

    transport = httpx.MockTransport(handler)
    out = fetch_year_notices(cfg, year=2011, transport=transport)

    assert isinstance(out, dict)
    assert "results" in out
    assert len(out["results"]) == 2
    assert out["results"][0]["document_number"] == "2011-00001"

    # Raw cache written.
    cache_path = cfg.raw_dir / "dea" / "fr_notices_2011.json"
    assert cache_path.exists(), "raw cache must be written per year for auditability"
    cached = json.loads(cache_path.read_text())
    assert cached["results"][0]["document_number"] == "2011-00001"

    # Verify query is the federalregister.gov API with the year filter.
    assert len(calls) == 1
    assert "federalregister.gov" in calls[0]
    assert "2011" in calls[0]


def test_fetch_handles_pagination(tmp_path, monkeypatch):
    """If the first response has `next_page_url`, fetch follows it and
    concatenates results."""
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    next_url = "https://www.federalregister.gov/api/v1/documents.json?page=2"

    page1 = {
        "count": 3,
        "results": [
            {"document_number": "A", "publication_date": "2011-01-01", "title": "A"},
            {"document_number": "B", "publication_date": "2011-01-02", "title": "B"},
        ],
        "next_page_url": next_url,
    }
    page2 = {
        "count": 3,
        "results": [
            {"document_number": "C", "publication_date": "2011-01-03", "title": "C"},
        ],
        "next_page_url": None,
    }

    def handler(req: httpx.Request) -> httpx.Response:
        url = str(req.url)
        if "page=2" in url:
            return _mock_response(page2)
        return _mock_response(page1)

    transport = httpx.MockTransport(handler)
    out = fetch_year_notices(cfg, year=2011, transport=transport)
    docnums = [r["document_number"] for r in out["results"]]
    assert docnums == ["A", "B", "C"], "pagination must concatenate all pages in order"


def test_fetch_retries_on_5xx(tmp_path, monkeypatch):
    """Transient 5xx errors must be retried; eventual 200 succeeds."""
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    attempts: list[int] = []

    def handler(req: httpx.Request) -> httpx.Response:
        attempts.append(1)
        if len(attempts) < 2:
            return httpx.Response(503, text="temporary")
        return _mock_response({"count": 0, "results": [], "next_page_url": None})

    transport = httpx.MockTransport(handler)
    out = fetch_year_notices(cfg, year=2011, transport=transport)
    assert out["results"] == []
    assert len(attempts) >= 2, "expected retry after 503"


def test_fetch_fails_fast_on_4xx(tmp_path, monkeypatch):
    """Client errors (4xx) must not be retried — they indicate a bad
    request shape, not a transient condition."""
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    attempts: list[int] = []

    def handler(req: httpx.Request) -> httpx.Response:
        attempts.append(1)
        return httpx.Response(400, text="bad request")

    transport = httpx.MockTransport(handler)
    with pytest.raises(httpx.HTTPStatusError):
        fetch_year_notices(cfg, year=2011, transport=transport)
    assert len(attempts) == 1, "4xx must not retry"
