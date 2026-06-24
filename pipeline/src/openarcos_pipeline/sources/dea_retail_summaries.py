"""Fetch DEA ARCOS retail summary report PDFs."""

from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

import httpx

from openarcos_pipeline.config import Config
from openarcos_pipeline.log import get_logger

REPORTS_PAGE_URL = (
    "https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/"
    "arcos-drug-summary-reports.html"
)
FIRST_RETAIL_SUMMARY_YEAR = 2015
LAST_VERIFIED_RETAIL_SUMMARY_YEAR = 2024

log = get_logger("openarcos.dea.retail_summaries")


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        for name, value in attrs:
            if name.lower() == "href" and value:
                self.hrefs.append(value)


def discover_report_pdfs(
    html: str,
    *,
    base_url: str = REPORTS_PAGE_URL,
    first_year: int = FIRST_RETAIL_SUMMARY_YEAR,
    last_year: int = LAST_VERIFIED_RETAIL_SUMMARY_YEAR,
) -> list[tuple[int, str]]:
    """Return post-2014 Report 4-capable PDF URLs from the DEA reports page."""
    parser = _LinkParser()
    parser.feed(html)
    found: dict[int, str] = {}

    for href in parser.hrefs:
        combined = re.search(r"report_yr_(\d{4})\.pdf$", href)
        if combined:
            year = int(combined.group(1))
            if first_year <= year <= last_year:
                found[year] = urljoin(base_url, href)
            continue

        separate = re.search(r"(\d{4})/(\d{4})_rpt4\.pdf$", href)
        if separate:
            year = int(separate.group(1))
            if first_year <= year <= last_year:
                found[year] = urljoin(base_url, href)

    return sorted(found.items())


def fetch_report_pdfs(
    cfg: Config,
    *,
    page_url: str = REPORTS_PAGE_URL,
    first_year: int = FIRST_RETAIL_SUMMARY_YEAR,
    last_year: int = LAST_VERIFIED_RETAIL_SUMMARY_YEAR,
) -> list[Path]:
    """Download official DEA post-2014 retail summary PDFs into raw storage."""
    out_dir = cfg.raw_dir / "arcos_retail_summary"
    out_dir.mkdir(parents=True, exist_ok=True)

    log.info("dea retail summaries: fetch page start", extra={"url": page_url})
    with httpx.Client(timeout=90, follow_redirects=True) as client:
        page = client.get(page_url)
        page.raise_for_status()
        reports = discover_report_pdfs(
            page.text,
            base_url=page_url,
            first_year=first_year,
            last_year=last_year,
        )

        outputs: list[Path] = []
        for year, url in reports:
            out = out_dir / f"arcos_retail_summary_{year}.pdf"
            if out.exists() and out.stat().st_size > 0:
                log.info("dea retail summaries: cached", extra={"year": year, "path": str(out)})
                outputs.append(out)
                continue

            log.info("dea retail summaries: download start", extra={"year": year, "url": url})
            with client.stream("GET", url) as response:
                response.raise_for_status()
                with out.open("wb") as handle:
                    for chunk in response.iter_bytes():
                        handle.write(chunk)
            log.info(
                "dea retail summaries: download complete",
                extra={"year": year, "path": str(out), "bytes": out.stat().st_size},
            )
            outputs.append(out)

    manifest = [
        {"year": year, "url": url, "path": str(out_dir / f"arcos_retail_summary_{year}.pdf")}
        for year, url in reports
    ]
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return outputs
