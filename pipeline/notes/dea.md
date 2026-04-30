# DEA Diversion Control — probe notes

**Probed on:** 2026-04-30
**Source index:** https://www.deadiversion.usdoj.gov/pubs/reports/index.html

## Probe outcome

`https://www.deadiversion.usdoj.gov/pubs/reports/index.html` returns
HTTP 404 — **the site was reorganized**, not just unreachable from
this sandbox. Confirmed on 2026-04-30 by direct fetch. The response
body is the DEA's 34530-byte generic 404 template (a Bootstrap-
themed "site reorganized" landing page served by
`Apache/2.4.37 (Red Hat Enterprise Linux)`).

Scraping the current DEA Diversion landing pages shows:

| Old path (in spec) | Current state |
|---|---|
| `/pubs/reports/index.html` | 404 — does not exist |
| `/pubs/index.html` | 404 with template |
| `/pubs/pubs.html` | 200, generic pubs index |
| `/pubs/pressreleases/press-release.html` | 200, lists monthly "Diversion News" PDFs from Aug-2024 through present |

Real PDFs that ARE currently accessible at the site:

- `/pubs/pressreleases/Diversion-News-April-2026.pdf` (verified 200,
  `Content-Type: application/pdf`, 382626 bytes)
- Similar monthly issues going back to ~Aug 2024

However, these are **monthly newsletters** (a few pages each about
recent enforcement actions), NOT the annual statistical summary
reports the spec expects. Per-year aggregate counts ("1,245
administrative actions in 2012") are **not available at any current
DEA Diversion URL** that we could find via directory scraping.

The Wayback Machine API returns empty for
`deadiversion.usdoj.gov/pubs/reports/index.html` across 2012–2020,
suggesting this URL pattern never existed at archive.org — either
the spec had bad assumptions about where these reports live, or the
reports were only ever distributed as FOIA releases / internal
documents / Congressional testimony, not as a stable public URL.

### Current fixtures (SYNTHETIC)

Per the plan's spike-handling rules, we kept:

1. Hand-authored **synthetic PDF fixtures** under
   `pipeline/tests/fixtures/dea/diversion_20{12,14}_sample.pdf` that
   are shape-compatible with what a real DEA annual report prose
   page looks like (regex-extractable counts + notable case titles).
   Generated via a minimal hand-rolled PDF writer so pdfplumber can
   extract text from them.
2. `notebooks/03-dea-probe.py` with placeholder `REPLACE_WITH_…` URLs.

### Path forward for a maintainer

1. **Decide what DEA data is actually desired.** The spec says
   "annual statistical reports" but those aren't posted publicly in
   2026. Substitutes include:
   - Monthly Diversion News PDFs (what IS posted) — one-off stories,
     not aggregated stats. Shape of extraction would change (one
     row per newsletter issue, not per year).
   - Federal Register notices of final scheduling actions
     (<https://www.federalregister.gov/agencies/drug-enforcement-administration>).
   - Congressional testimony archive
     (<https://judiciary.house.gov/> etc.) — ad-hoc.
   - DEA Office of Public Affairs press releases
     (<https://www.dea.gov/press-releases>) — filterable by year.
2. **Update `DEA_ANNUAL_REPORTS`** in
   `pipeline/src/openarcos_pipeline/sources/dea_summaries.py:23-26`
   to use the actual chosen URLs.
3. **Re-run** `notebooks/03-dea-probe.py` and commit the real PDFs
   to `pipeline/tests/fixtures/dea/`.
4. **Update `clean/dea.py`** if the schema of the real reports
   differs from the synthetic ones.

Until step 1 is resolved, the synthetic fixtures let the rest of
the pipeline run end-to-end but the DEA-derived artifacts published
on openarcos.org will be **placeholder data, not real**.

## Reports we extract

| Year | URL | Format |
|---|---|---|
| 2012 | synthetic placeholder | PDF, 1 page |
| 2014 | synthetic placeholder | PDF, 1 page |

## Extraction strategy

- We extract **enforcement action counts** from the summary prose
  (typically early pages) via regex (e.g. `1,245 administrative actions`)
- We extract **notable case titles** (`United States v. …`, `Operation …`)
  via best-effort regex
- PDFs change format across years; the parser tolerates (a) table-based,
  (b) prose-only, (c) mixed layouts — only prose is exercised here

## Known quirks

- Some years include a separate "Cases of Interest" subsection — we extract from there if present
- Counts are sometimes "approximately 1,250" — we parse the integer out or fall back to 0 + log a warning
- Content hashes shift year-over-year even for "the same" report — we don't canary DEA, we just recompute

## Content hashes (SYNTHETIC)

- `diversion_2012_sample.pdf`: sha256=6b257f9204203ac8d1d84c3c261a646dfd8c41497c518bbf7c71b6c711601e34
- `diversion_2014_sample.pdf`: sha256=abd95734feb0005b2974980c0b2ae4e91ecaba76dfe50bfa13ffee0c918d5436
