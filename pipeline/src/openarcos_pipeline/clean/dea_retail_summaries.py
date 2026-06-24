"""Clean DEA ARCOS retail summary Report 4 text into state-year MME rows."""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from pathlib import Path

import pdfplumber
import polars as pl
from pdfminer.high_level import extract_text

from openarcos_pipeline.fips import FIPS_STATE_MAP
from openarcos_pipeline.log import get_logger
from openarcos_pipeline.sources.dea_retail_summaries import REPORTS_PAGE_URL

log = get_logger("openarcos.clean.dea_retail_summaries")

REPORT4_SCHEMA = {
    "state_fips": pl.Utf8,
    "state": pl.Utf8,
    "year": pl.Int64,
    "drug_code": pl.Utf8,
    "drug_name": pl.Utf8,
    "population": pl.Int64,
    "grams": pl.Float64,
    "grams_per_100k": pl.Float64,
    "source_url": pl.Utf8,
}

STATE_MME_SCHEMA = {
    "state_fips": pl.Utf8,
    "state": pl.Utf8,
    "year": pl.Int64,
    "population": pl.Int64,
    "mme": pl.Float64,
    "mme_per_capita": pl.Float64,
    "mme_per_100k": pl.Float64,
    "included_drug_codes": pl.List(pl.Utf8),
    "excluded_drug_codes": pl.List(pl.Utf8),
    "source_urls": pl.List(pl.Utf8),
}

STATE_NAME_TO_FIPS = {
    "ALABAMA": "01",
    "ALASKA": "02",
    "ARIZONA": "04",
    "ARKANSAS": "05",
    "CALIFORNIA": "06",
    "COLORADO": "08",
    "CONNECTICUT": "09",
    "DELAWARE": "10",
    "DISTRICT OF COLUMBIA": "11",
    "FLORIDA": "12",
    "GEORGIA": "13",
    "HAWAII": "15",
    "IDAHO": "16",
    "ILLINOIS": "17",
    "INDIANA": "18",
    "IOWA": "19",
    "KANSAS": "20",
    "KENTUCKY": "21",
    "LOUISIANA": "22",
    "MAINE": "23",
    "MARYLAND": "24",
    "MASSACHUSETTS": "25",
    "MICHIGAN": "26",
    "MINNESOTA": "27",
    "MISSISSIPPI": "28",
    "MISSOURI": "29",
    "MONTANA": "30",
    "NEBRASKA": "31",
    "NEVADA": "32",
    "NEW HAMPSHIRE": "33",
    "NEW JERSEY": "34",
    "NEW MEXICO": "35",
    "NEW YORK": "36",
    "NORTH CAROLINA": "37",
    "NORTH DAKOTA": "38",
    "OHIO": "39",
    "OKLAHOMA": "40",
    "OREGON": "41",
    "PENNSYLVANIA": "42",
    "RHODE ISLAND": "44",
    "SOUTH CAROLINA": "45",
    "SOUTH DAKOTA": "46",
    "TENNESSEE": "47",
    "TEXAS": "48",
    "UTAH": "49",
    "VERMONT": "50",
    "VIRGINIA": "51",
    "WASHINGTON": "53",
    "WEST VIRGINIA": "54",
    "WISCONSIN": "55",
    "WYOMING": "56",
}

STATE_CODE_BY_FIPS = {
    state_fips: state_code
    for state_fips, state_code in FIPS_STATE_MAP.items()
    if state_fips in STATE_NAME_TO_FIPS.values()
}

# These factors match the simple per-milligram factors used in common public
# ARCOS/WaPo MME work. Drugs needing route-specific or dose-specific math stay
# out of the MME sum so we do not create fake precision from state PDF totals.
DEFAULT_MME_FACTORS = {
    "9050": 0.15,  # codeine
    "9143": 1.5,  # oxycodone
    "9150": 4.0,  # hydromorphone
    "9193": 1.0,  # hydrocodone
    "9230": 0.1,  # meperidine
    "9300": 1.0,  # morphine
    "9652": 3.0,  # oxymorphone
    "9780": 0.4,  # tapentadol
}

OPIOID_DRUG_CODES = set(DEFAULT_MME_FACTORS) | {"9064", "9250", "9250B", "9801"}

DRUG_2024_RE = re.compile(r"\bDRUG:\s*([0-9]{4}[A-Z]?)\s*-\s*(.+?)\s*$")
DRUG_2015_RE = re.compile(r"\bDRUG CODE:\s*([0-9]{4}[A-Z]?)\s+DRUG NAME:\s*(.+?)\s*$")
DRUG_CODE_ONLY_RE = re.compile(r"\bDRUG CODE:\s*([0-9]{4}[A-Z]?)\s*$")
DRUG_NAME_ONLY_RE = re.compile(r"\bDRUG NAME:\s*(.+?)\s*$")
STATE_ROW_RE = re.compile(
    r"^\s*(\d+)\s+([A-Z][A-Z ]+?)\s+([0-9,]+)\s+([0-9,]+(?:\.\d+)?)\s+([0-9,]+(?:\.\d+)?)\s*$"
)
YEAR_RE = re.compile(r"(20\d{2})")


def _parse_float(value: str) -> float:
    return float(value.replace(",", ""))


def _parse_int(value: str) -> int:
    return int(value.replace(",", ""))


def _empty_report4_frame() -> pl.DataFrame:
    return pl.DataFrame(schema=REPORT4_SCHEMA)


def _empty_state_mme_frame() -> pl.DataFrame:
    return pl.DataFrame(schema=STATE_MME_SCHEMA)


def _source_url_for_year(year: int) -> str:
    base = REPORTS_PAGE_URL.rsplit("/", 1)[0] + "/"
    if year == 2015:
        return f"{base}2015/2015_rpt4.pdf"
    return f"{base}report_yr_{year}.pdf"


def parse_report4_text(text: str, *, year: int, source_url: str) -> pl.DataFrame:
    """Parse Report 4 PDF text into one row per state, year, and drug code."""
    current_code: str | None = None
    current_name: str | None = None
    records: list[dict[str, object]] = []

    for raw_line in text.splitlines():
        line = " ".join(raw_line.strip().split())
        if not line:
            continue

        drug_match = DRUG_2024_RE.search(line) or DRUG_2015_RE.search(line)
        if drug_match:
            current_code = drug_match.group(1)
            current_name = drug_match.group(2).strip().upper()
            continue

        code_only_match = DRUG_CODE_ONLY_RE.search(line)
        if code_only_match:
            current_code = code_only_match.group(1)
            current_name = None
            continue

        name_only_match = DRUG_NAME_ONLY_RE.search(line)
        if name_only_match and current_code is not None:
            current_name = name_only_match.group(1).strip().upper()
            continue

        if current_code is None or current_name is None:
            continue

        row_match = STATE_ROW_RE.match(line)
        if not row_match:
            continue

        state_name = row_match.group(2).strip().upper()
        state_fips = STATE_NAME_TO_FIPS.get(state_name)
        if state_fips is None:
            continue

        records.append(
            {
                "state_fips": state_fips,
                "state": STATE_CODE_BY_FIPS[state_fips],
                "year": int(year),
                "drug_code": current_code,
                "drug_name": current_name,
                "population": _parse_int(row_match.group(3)),
                "grams": _parse_float(row_match.group(4)),
                "grams_per_100k": _parse_float(row_match.group(5)),
                "source_url": source_url,
            }
        )

    if not records:
        return _empty_report4_frame()
    return pl.DataFrame(records, schema=REPORT4_SCHEMA).sort(["drug_code", "state_fips"])


def extract_report4_text_from_pdf(path: Path) -> str:
    """Read only the DEA Report 4 pages from a PDF."""
    quick_text = extract_text(str(path))
    quick_pages = quick_text.split("\f")
    year = _year_from_pdf_path(path)

    if year == 2015:
        page_numbers = range(max(0, len(quick_pages) - 1))
    else:
        page_numbers = [
            index
            for index, page_text in enumerate(quick_pages)
            if index > 0
            and re.search(r"ARCOS 3 - REPORT 0?4", page_text.upper())
            and "CUMULATIVE DISTRIBUTION BY STATE" in page_text.upper()
        ]

    if not page_numbers:
        return quick_text

    parts: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page_number in page_numbers:
            if page_number >= len(pdf.pages):
                continue
            text = pdf.pages[page_number].extract_text() or ""
            if text:
                parts.append(text)
    return "\n".join(parts)


def _year_from_pdf_path(path: Path) -> int:
    match = YEAR_RE.search(path.name)
    if not match:
        raise ValueError(f"Could not find a 4-digit year in {path.name}")
    return int(match.group(1))


def _manifest_urls(raw_dir: Path) -> dict[int, str]:
    manifest_path = raw_dir / "manifest.json"
    if not manifest_path.exists():
        return {}
    data = json.loads(manifest_path.read_text())
    urls: dict[int, str] = {}
    for row in data:
        year = row.get("year")
        url = row.get("url")
        if isinstance(year, int) and isinstance(url, str):
            urls[year] = url
    return urls


def clean_report4_pdf_dir(raw_dir: Path) -> tuple[pl.DataFrame, pl.DataFrame]:
    """Parse all cached DEA retail summary PDFs in a raw directory."""
    pdfs = sorted(raw_dir.glob("arcos_retail_summary_*.pdf"))
    urls = _manifest_urls(raw_dir)
    report_frames: list[pl.DataFrame] = []

    for pdf_path in pdfs:
        year = _year_from_pdf_path(pdf_path)
        log.info(
            "dea retail clean: extracting PDF text",
            extra={"year": year, "path": str(pdf_path)},
        )
        text = extract_report4_text_from_pdf(pdf_path)
        report_frames.append(
            parse_report4_text(text, year=year, source_url=urls.get(year, _source_url_for_year(year)))
        )
        log.info("dea retail clean: parsed PDF", extra={"year": year})

    if not report_frames:
        report_rows = _empty_report4_frame()
    else:
        report_rows = pl.concat(report_frames, how="vertical_relaxed").sort(
            ["year", "drug_code", "state_fips"]
        )

    return report_rows, convert_report4_rows_to_mme(report_rows)


def convert_report4_rows_to_mme(
    rows: pl.DataFrame,
    mme_factors: Mapping[str, float] = DEFAULT_MME_FACTORS,
) -> pl.DataFrame:
    """Convert state-drug grams into state-year MME rows."""
    if rows.is_empty():
        return _empty_state_mme_frame()

    records: list[dict[str, object]] = []
    for key, group in rows.group_by(["state_fips", "state", "year"], maintain_order=True):
        state_fips, state, year = key
        included: list[str] = []
        excluded: list[str] = []
        mme_total = 0.0
        population = 0

        for row in group.iter_rows(named=True):
            population = max(population, int(row["population"] or 0))
            drug_code = str(row["drug_code"])
            if drug_code not in OPIOID_DRUG_CODES:
                continue
            factor = mme_factors.get(drug_code)
            if factor is None:
                excluded.append(drug_code)
                continue
            included.append(drug_code)
            mme_total += float(row["grams"] or 0) * 1000 * factor

        if not included:
            continue

        records.append(
            {
                "state_fips": str(state_fips).zfill(2),
                "state": str(state),
                "year": int(year),
                "population": population,
                "mme": mme_total,
                "mme_per_capita": mme_total / population if population > 0 else 0.0,
                "mme_per_100k": (mme_total / population * 100000) if population > 0 else 0.0,
                "included_drug_codes": sorted(set(included)),
                "excluded_drug_codes": sorted(set(excluded)),
                "source_urls": sorted({str(url) for url in group["source_url"].to_list()}),
            }
        )

    if not records:
        return _empty_state_mme_frame()
    return pl.DataFrame(records, schema=STATE_MME_SCHEMA).sort(["state_fips", "year"])
