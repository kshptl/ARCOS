"""DEA summaries fetcher: downloads PDFs per pinned year→URL map."""

import httpx

from openarcos_pipeline.config import Config
from openarcos_pipeline.sources.dea_summaries import (
    DEA_ANNUAL_REPORTS,
    fetch_reports,
)


def test_report_map_covers_years():
    assert 2012 in DEA_ANNUAL_REPORTS
    assert 2014 in DEA_ANNUAL_REPORTS
    for year, url in DEA_ANNUAL_REPORTS.items():
        assert url.startswith("http"), year


def test_fetch_writes_pdfs(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"%PDF-fake")

    transport = httpx.MockTransport(handler)
    fetch_reports(cfg, years=[2012, 2014], transport=transport)
    out = cfg.raw_dir / "dea"
    assert (out / "2012.pdf").exists()
    assert (out / "2014.pdf").exists()
