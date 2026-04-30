"""DEA summaries fetcher: downloads PDFs per pinned year→URL map.

Until a maintainer resolves the upstream source question documented in
notes/dea.md, DEA_ANNUAL_REPORTS is intentionally empty and
fetch_reports() raises RuntimeError if called — we loud-fail rather
than silently emit placeholder data.
"""

import httpx
import pytest

from openarcos_pipeline.config import Config
from openarcos_pipeline.sources.dea_summaries import (
    DEA_ANNUAL_REPORTS,
    fetch_reports,
)


def test_report_map_is_empty_until_maintainer_resolves():
    """The map must be empty: we never commit placeholder REPLACE_WITH_* URLs."""
    for year, url in DEA_ANNUAL_REPORTS.items():
        assert "REPLACE_WITH" not in url, (
            f"placeholder URL for {year}: {url} — see notes/dea.md"
        )


def test_fetch_reports_raises_when_no_urls(tmp_path, monkeypatch):
    """fetch_reports must loud-fail when DEA_ANNUAL_REPORTS is empty rather
    than silently skip — otherwise the pipeline emits DEA-derived artifacts
    from whatever's in data/raw/dea without any indication the source is
    missing.
    """
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    # No mocked transport — we shouldn't make any HTTP calls.
    with pytest.raises(RuntimeError, match="notes/dea.md"):
        fetch_reports(cfg)


def test_fetch_reports_still_works_when_urls_provided(tmp_path, monkeypatch):
    """If a maintainer populates DEA_ANNUAL_REPORTS (via the module-level
    dict or by passing explicit years with a non-empty map), fetch continues
    to work as before. We simulate this by monkeypatching the dict.
    """
    import openarcos_pipeline.sources.dea_summaries as m

    monkeypatch.setattr(m, "DEA_ANNUAL_REPORTS", {2012: "https://example.org/2012.pdf"})
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"%PDF-fake")

    transport = httpx.MockTransport(handler)
    fetch_reports(cfg, transport=transport)
    out = cfg.raw_dir / "dea"
    assert (out / "2012.pdf").exists()
