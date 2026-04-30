"""DEA Diversion annual report fetcher."""

from __future__ import annotations

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

# Pinned URLs; update this map when adding new years.
#
# DEA ANNUAL REPORT URLs ARE CURRENTLY UNRESOLVED — see pipeline/notes/dea.md.
# The deadiversion.usdoj.gov annual-report paths the spec assumed (2012, 2014)
# no longer exist, and Wayback Machine has no archive for those URLs. A
# maintainer must decide which substitute source to use (monthly Diversion
# News PDFs, DEA.gov press releases, Federal Register notices, etc.) and
# populate this dict with real URLs.
#
# Until then we keep the map EMPTY and fail loudly in fetch_reports() rather
# than emit placeholder "REPLACE_WITH_*" URLs that would quietly 404 in
# production.
DEA_ANNUAL_REPORTS: dict[int, str] = {
    # 2012: "https://www.deadiversion.usdoj.gov/REPLACE_WITH_2012_URL.pdf",
    # 2014: "https://www.deadiversion.usdoj.gov/REPLACE_WITH_2014_URL.pdf",
}


def fetch_reports(
    cfg: Config,
    years: list[int] | None = None,
    transport: httpx.BaseTransport | None = None,
) -> None:
    out = cfg.raw_dir / "dea"
    out.mkdir(parents=True, exist_ok=True)

    if not DEA_ANNUAL_REPORTS:
        # Loud-fail: do not silently no-op. An empty map means the upstream
        # source is unresolved; see pipeline/notes/dea.md for the maintainer
        # decision required before this fetcher can run.
        raise RuntimeError(
            "DEA source requires maintainer decision per notes/dea.md "
            "(DEA_ANNUAL_REPORTS is empty; committed PDF fixtures under "
            "pipeline/data/raw/dea/ may be used to continue the pipeline "
            "past this step)."
        )

    years = years or sorted(DEA_ANNUAL_REPORTS)

    with httpx.Client(timeout=180.0, follow_redirects=True, transport=transport) as client:
        for year in years:
            url = DEA_ANNUAL_REPORTS.get(year)
            if not url:
                log.warning("dea: no URL for year", extra={"year": year})
                continue
            dest = out / f"{year}.pdf"

            @retry(
                stop=stop_after_attempt(4),
                wait=wait_exponential_jitter(initial=1.0, max=15.0),
                retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
                reraise=True,
            )
            def _do() -> None:
                log.info("dea GET", extra={"year": year, "url": url})
                resp = client.get(url)
                resp.raise_for_status()
                dest.write_bytes(resp.content)

            _do()
