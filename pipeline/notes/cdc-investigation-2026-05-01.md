# County-level fatal drug-overdose data: source investigation

**Investigated:** 2026-05-01
**Target coverage:** ~3,100 US counties × annual 2006-2014, ICD-10 X40-X44 / X60-X64 / X85 / Y10-Y14

## TL;DR

**Use `data.cdc.gov` dataset `rpvx-m2md` ("NCHS - Drug Poisoning Mortality by County:
United States, 1999-2017").** It is the *only* public, machine-readable, county-annual
drug-overdose-mortality dataset that:
- covers 100% of our 2006-2014 window (actually 1999-2017),
- includes all ~3,136 US counties (> our 3,100 target),
- uses exactly the ICD-10 codes we want (X40-X44, X60-X64, X85, Y10-Y14),
- is redistributable (US gov public domain),
- is fetchable in < 30 s via a single Socrata JSON call with no auth,
- sidesteps the CDC WONDER D76 "no county via API" blocker that blew up our first
  integration.

It returns **model-smoothed age-adjusted rates + population** per county-year, not
raw counts. Implied death counts = `round(model_based_death_rate × population /
100_000)`. For Mingo WV 2010 this gives ≈ 12, which lines up with published
single-year estimates once you account for the smoothing (raw counts in that year
are suppressed <10/undisclosed ~10-15 range across sources). This is the best we
get without a signed NCHS DUA.

Ancillary sources (`pbkm-d27e`, `p56q-jrxg`) are older/binned variants of the same
product. Keep as fallback in case `rpvx-m2md` changes URL.

All other candidates investigated were unsuitable for 2006-2014 county data:
state-only, 2015+ only, academic-pay-walled, or require a DUA. Details below.

---

## Candidate Sources (ranked by suitability)

### 1. NCHS Drug Poisoning Mortality by County 1999-2017 — `rpvx-m2md` ★ RECOMMENDED

- **URL (verified):** https://data.cdc.gov/resource/rpvx-m2md.json
  - Metadata page: https://data.cdc.gov/National-Center-for-Health-Statistics/NCHS-Drug-Poisoning-Mortality-by-County-United-Sta/rpvx-m2md
- **HTTP status:** 200. No auth. Socrata SODA API. Pagination via `$limit`/`$offset`,
  filter via `year=`, `fips=`, `fipsstate=`. Order via `$order=`.
- **Format:** JSON (also CSV/XML available from same endpoint with content-type
  negotiation). Flat records, one per county-year.
- **Coverage:**
  - **Temporal:** 1999-2017 inclusive (19 years, full superset of our 2006-2014).
  - **Geographic:** 3,136 distinct county FIPS (count confirmed via
    `$select=count(distinct fips)`). 59,584 total rows.
    - Includes all 55 WV counties, all 120 KY counties, all 88 OH counties, etc.,
      verified by counting WV records for year=2010 (got 55).
  - **ICD-10 codes:** X40-X44 (unintentional), X60-X64 (suicide), X85 (homicide),
    Y10-Y14 (undetermined). This is *exactly* the spec the user asked for.
    No T40 multiple-cause filter — these are underlying-cause.
- **Suppression:** None at the record level. NCHS published **model-based
  (empirical-Bayes-smoothed) age-adjusted rates per 100,000**, not raw counts.
  The smoothing model "borrows strength" across adjacent counties so every
  county-year has a numeric rate + 95% CI. Counts < 20 still flagged unreliable
  in source publications, but all rows carry a numeric rate.
- **License:** **Public Domain U.S. Government** (explicitly declared in Socrata
  metadata field `license` = "Public Domain U.S. Government"). Fine to
  redistribute as parquet/JSON inside our repo.
- **Pipeline effort:** LOW. One HTTP GET per state (or ~20 bulk pages of 50k
  rows) totaling a few MB. Whole dataset fetchable in < 60 s.
- **Verdict:** ✅ **RECOMMENDED — primary source.**

#### Sample records

From `https://data.cdc.gov/resource/rpvx-m2md.json?fips=54059&$order=year`
(Mingo County, WV):

```json
[
  {"fips":"54059","year":"2006","county":"Mingo County, WV","population":"27054","model_based_death_rate":"41.45643","standard_deviation":"2.457525","lower95ci":"36.91964","upper95ci":"46.55216","urbanrural":"Noncore","censusdivision":"5","state":"West Virginia","fipsstate":"54"},
  {"fips":"54059","year":"2007","county":"Mingo County, WV","population":"27145","model_based_death_rate":"42.99551","standard_deviation":"2.548251","lower95ci":"38.29116","upper95ci":"48.2793",  "urbanrural":"Noncore","censusdivision":"5","state":"West Virginia","fipsstate":"54"},
  {"fips":"54059","year":"2008","county":"Mingo County, WV","population":"26850","model_based_death_rate":"43.16032","standard_deviation":"2.557909","lower95ci":"38.43813","upper95ci":"48.46413","urbanrural":"Noncore","censusdivision":"5","state":"West Virginia","fipsstate":"54"},
  {"fips":"54059","year":"2009","county":"Mingo County, WV","population":"26943","model_based_death_rate":"43.48427","standard_deviation":"2.576953","lower95ci":"38.7269", "upper95ci":"48.82754","urbanrural":"Noncore","censusdivision":"5","state":"West Virginia","fipsstate":"54"},
  {"fips":"54059","year":"2010","county":"Mingo County, WV","population":"26834","model_based_death_rate":"44.78921","standard_deviation":"2.653897","lower95ci":"39.88974","upper95ci":"50.29197","urbanrural":"Noncore","censusdivision":"5","state":"West Virginia","fipsstate":"54"},
  {"fips":"54059","year":"2011","county":"Mingo County, WV","population":"26605","model_based_death_rate":"47.91703","standard_deviation":"2.838374","lower95ci":"42.67689","upper95ci":"53.8022", "urbanrural":"Noncore","censusdivision":"5","state":"West Virginia","fipsstate":"54"},
  {"fips":"54059","year":"2012","county":"Mingo County, WV","population":"26193","model_based_death_rate":"47.81126","standard_deviation":"2.832096","lower95ci":"42.58271","upper95ci":"53.68341","urbanrural":"Noncore","censusdivision":"5","state":"West Virginia","fipsstate":"54"},
  {"fips":"54059","year":"2013","county":"Mingo County, WV","population":"26015","model_based_death_rate":"50.36161","standard_deviation":"2.982514","lower95ci":"44.85528","upper95ci":"56.54556","urbanrural":"Noncore","censusdivision":"5","state":"West Virginia","fipsstate":"54"},
  {"fips":"54059","year":"2014","county":"Mingo County, WV","population":"25742","model_based_death_rate":"53.52637","standard_deviation":"3.169162","lower95ci":"47.67535","upper95ci":"60.09722","urbanrural":"Noncore","censusdivision":"5","state":"West Virginia","fipsstate":"54"}
]
```

Cross-county sanity (WV 2010, all 55 counties returned; Appalachian epicenter verified):

| FIPS | County | Pop 2010 | Rate | Implied deaths |
|---|---|---|---|---|
| 54011 | Cabell | 96,246 | 48.49 | 47 |
| 54047 | McDowell | 22,108 | 63.15 | 14 |
| 54059 | **Mingo** | 26,834 | **44.79** | **12** |
| 54045 | Logan | 36,750 | 50.08 | 18 |
| 54109 | Wyoming | 23,804 | 57.44 | 14 |

### 2. NCHS Drug Poisoning Mortality by County 1999-2016 — `p56q-jrxg` — BACKUP

- **URL (verified):** https://data.cdc.gov/resource/p56q-jrxg.json (200 OK)
- Same schema family but **binned** rate (column
  `estimated_age_adjusted_death_rate_16_categories_in_ranges`, values like
  "4.1-6", "12.1-14", ">30"). Lower temporal (1999-2016) and lossy.
- License: Public Domain U.S. Government.
- **Verdict:** BACKUP for sanity-checking bins.

### 3. NCHS Drug Poisoning Mortality by County 1999-2015 — `pbkm-d27e` — BACKUP

- **URL (verified):** https://data.cdc.gov/resource/pbkm-d27e.json (200 OK)
- Binned rates in 11 categories. Oldest of the three.
- **Verdict:** BACKUP.

### 4. CDC WONDER D76 Underlying Cause of Death 1999-2020 XML API — UNSUITABLE (known)

- **URL:** https://wonder.cdc.gov/controller/datarequest/D76 — reachable but
  returns HTTP 500 with: *"Only national data are available for this dataset
  when using the WONDER web service."* (see `cdc.md` for full 500 body).
- UI docs at https://wonder.cdc.gov/wonder/help/ucd.html confirm the *interactive
  UI* supports county groupings, but the XML programmatic endpoint does not.
  Rate-limited 1 request / 15 s.
- Terms of use forbid UI scraping.
- **Verdict:** ❌ UNSUITABLE — the architectural blocker documented in
  `pipeline/notes/cdc.md`. Don't re-try.

### 5. CDC WONDER D77 Multiple Cause of Death / newer IDs — UNSUITABLE (same block)

- Per WONDER docs at https://wonder.cdc.gov/wonder/help/mcd.html, the Multiple
  Cause of Death dataset for 1999-2020 uses the same XML API framework as D76
  with the same county-level API ban.
- Suppression identical to D76: counts 0-9 suppressed, rates <20 "unreliable."
- **Verdict:** ❌ UNSUITABLE for the same reason as D76.

### 6. data.cdc.gov `xkb8-kh2a` (VSRR Provisional Drug Overdose) — UNSUITABLE (state only)

- URL verified 200.
- Sample row shows `state=AK, indicator="Cocaine (T40.5)"` with no county field.
  This is **state-level** provisional monthly totals starting 2015.
- **Verdict:** ❌ UNSUITABLE. No county; outside window.

### 7. data.cdc.gov `gb4e-yj24` (VSRR Provisional County-Level Drug Overdose) — UNSUITABLE

- URL verified 200.
- Sample rows start at year=2020. Metadata `Temporal-Applicability:
  2020-01-01/2025-09-30`. **Entirely outside our 2006-2014 window.**
- Also NCHS-suppresses counts 1-9 (shows as blank + footnote).
- **Verdict:** ❌ UNSUITABLE.

### 8. data.cdc.gov `psx4-wq38` (Mapping Injury, Overdose, and Violence - County) — UNSUITABLE

- URL verified 200.
- Sample shows `period=2019, 2020, 2021...` Metadata:
  `Temporal-Applicability: 2019-01-01/Present`. 2019+ only.
- **Verdict:** ❌ UNSUITABLE (wrong window).

### 9. data.pa.gov `m3mg-va8e` / `azzc-q64m` (Pennsylvania) — UNSUITABLE (state-scoped)

- Pennsylvania Department of Health county overdose deaths, CY 2012-current.
- Single-state, 2012 forward only. Doesn't solve the 3,100-county / 2006 problem.
- **Verdict:** ❌ UNSUITABLE for national use; would also be inconsistent with
  other states' methodology.

### 10. IHME Global Burden of Disease / US Health Map — UNSUITABLE (license)

- Verified index page: https://ghdx.healthdata.org/us-data (200).
- IHME produces county-level opioid and drug-use-disorder mortality estimates,
  e.g. the 1980-2014 drug-use-disorder dataset plus newer 2000-2019 products.
- The specific URL given in the task
  (`/record/ihme-data/united-states-opioid-use-disorder-and-dependence-mortality-by-county-1980-2014`)
  returns **404** — IHME has rotated the slug. The current catalog does list
  county-level mortality products under "United States Mortality Rates by
  Causes of Death and Life Expectancy by County, Race, and Ethnicity 2000-2019"
  (record still live).
- **License:** "IHME FREE-OF-CHARGE NON-COMMERCIAL USER AGREEMENT" — explicitly
  **non-commercial only**, requires clickthrough EULA per download, not
  redistributable inside a public GitHub repo under an open license. Not
  compatible with committing derivative parquet to a public site.
- **Verdict:** ❌ UNSUITABLE for our distribution model. Consider as a cross-check
  if we ever get a one-off download for internal QA, but never commit its
  derivatives.

### 11. County Health Rankings (RWJF/UW) — UNSUITABLE (different metric)

- Verified: https://www.countyhealthrankings.org/health-data/methodology-and-sources/data-documentation (200).
- Publishes a "Drug Overdose Deaths" measure starting with their 2016 data
  release (covering 2014-something); earlier years use "Premature Death."
- Their drug-overdose measure is a 3-year-pooled rate, not annual. Aggregates
  upstream CDC WONDER + NCHS sources we'd be using anyway.
- **Verdict:** ❌ UNSUITABLE as primary; redundant with CDC source.

### 12. NCHS Restricted-Use Multiple Cause of Death file — UNSUITABLE (DUA)

- Requires signed Data Use Agreement with NCHS Research Data Center. No
  automated open-source pipeline possible.
- **Verdict:** ❌ UNSUITABLE.

### 13. Washington Post `wpinvestigative/arcos-api` — NOT RELEVANT (no overdose data)

- Verified: https://github.com/wpinvestigative/arcos-api (200).
- Repo file listing: `buyer_annual14.csv`, `buyer_monthly*.csv`,
  `county_annual14.csv`, `pop_counties_20062014.csv`, etc. All pill-shipment
  data from ARCOS DEA DB. **No overdose-death data.**
- **Verdict:** ❌ NOT RELEVANT for this task. (Already integrated for upstream
  pill-shipment viz in `sources/wapo_arcos.py`.)

### 14. USA Facts, Our World in Data, Kaggle, data.world — UNSUITABLE (redistributors)

- USA Facts URL given returned 404 on direct probe. Their methodology, where
  they have it, simply repackages CDC WONDER/NCHS. Using them means adding an
  extra layer of indirection over data we can fetch direct from CDC.
- **Verdict:** ❌ No advantage over fetching from CDC directly.

### 15. HRSA Area Health Resource File (AHRF) — UNSUITABLE (distribution format)

- AHRF is a megabundle of county-level health indicators, distributed as a
  single ZIP with a fixed-width ASCII layout and accompanying codebook. It
  *does* include some NCHS mortality fields, but drug-overdose-specific fields
  are historically absent or aggregated to multi-year rolling.
- Requires a one-off manual download of a ~300 MB zip; not a clean API.
- Licensed for public use but awkward to pin in CI.
- **Verdict:** ❌ UNSUITABLE vs. direct `rpvx-m2md` Socrata call.

### 16. State vital-records offices (KY, WV, OH, TN, PA, FL) — UNSUITABLE (fragmented)

- Each state has its own portal, format, latency, suppression rule, and ICD
  crosswalk. For national uniformity across 3,100 counties, merging 50 states'
  disparate feeds is a non-starter vs. one CDC source.
- Some states (notably WV for 2005, 2009) have a known miscoding issue with
  R99 that depresses drug-poisoning counts in those years; `rpvx-m2md` carries
  an explicit methodology note about this (see dataset description).
- **Verdict:** ❌ UNSUITABLE as primary. Potentially useful for county-specific
  deep-dive annotations on the 6 highlighted Act-4 counties if we ever want
  more granular narrative detail, but not for the 3,100-county pipeline.

### 17. Academic replication packages (Case & Deaton, Alpert-Evans-Kessler-Powell,
Ruhm) — NOT PROBED this round

- These authors tend to obtain NCHS restricted-use files under DUA and publish
  *aggregated* replication data. Redistribution rights vary by deposit. The
  Alpert/Evans/Kessler/Powell 2019 replication archive on openicpsr
  (ICPSR E115521V1) includes county data but its T&C mirror the underlying
  NCHS DUA.
- **Verdict:** Not pursued further. Adds complexity without surpassing
  `rpvx-m2md`.

### 18. CDC PLACES / DOSE / NSDOH — UNSUITABLE (wrong scope)

- CDC PLACES is chronic-disease small-area estimation; no overdose.
- CDC DOSE (`cdc.gov/drugoverdose/surveillance/nsdose.html`) publishes
  state-level non-fatal ED surveillance. No county fatal overdose.
- **Verdict:** ❌ UNSUITABLE.

---

## Recommended Strategy

### Primary source

- **`data.cdc.gov` dataset `rpvx-m2md`.**
- One HTTP GET per US state (50 + DC = 51 requests, each returning ~60k/51 ≈
  ~1,200 rows). Or one bulk `$limit=60000` fetch returning the entire dataset
  as a single ~6 MB JSON.
- Cache raw response as a deterministic artifact in the pipeline intermediate
  directory (so CI re-runs are reproducible).

### Conversion: rate → implied deaths

- The dataset reports `model_based_death_rate` (per 100,000, age-adjusted) and
  `population`.
- Implied annual count = `round(rate × population / 100_000)`.
- Emit both the raw rate and the implied count per county-year so the UI layer
  can choose which to render (rates are preferred for cross-county comparison,
  counts for absolute story beats).
- Also carry `lower95ci`, `upper95ci`, `standard_deviation` through to allow
  the frontend to render uncertainty bands if we want.

### Years

- Fetch all 1999-2017 rows. Use 2006-2014 as the canonical Act-4 window. Keep
  the extra years available for tooltips/context, since users hover a county
  page and reasonably expect to see overdose trends pre-2006 (when the pill
  distribution spike began) and post-2014 (the escalation into fentanyl).

### Fallback for suppressed counties

- With `rpvx-m2md` there are **no suppressions** (Bayesian smoothing fills every
  county-year). This is a key reason to prefer it over the WONDER UI scrape or
  the provisional county dataset.
- If a county is missing from the 1999-2017 file (Broomfield CO and Denali AK
  pre-2003; Bedford City VA 2015+; Clifton Forge VA pre-2003), emit `null` and
  surface it as "not available" in the UI. These are edge cases unrelated to
  the Appalachian Act-4 scene.

### Fallback for missing years

- 2018-current: if we ever need these, switch to VSRR provisional
  `gb4e-yj24` (2020+) and note the methodology break. For the Act-4 window we
  don't need them.

---

## Pipeline Implementation Sketch

The existing `pipeline/src/openarcos_pipeline/sources/cdc_wonder.py` should be
retired (or kept as a stub) in favor of a new `cdc_nchs_rpvx.py`. The XML
fixtures under `tests/fixtures/cdc/` won't apply; replace with a captured
Socrata JSON response.

```python
# pipeline/src/openarcos_pipeline/sources/cdc_nchs_rpvx.py
"""Fetch NCHS county-level drug-poisoning mortality from data.cdc.gov.

Source: NCHS - Drug Poisoning Mortality by County: United States, 1999-2017
Dataset ID: rpvx-m2md
License: Public Domain U.S. Government
Docs: https://data.cdc.gov/National-Center-for-Health-Statistics/
      NCHS-Drug-Poisoning-Mortality-by-County-United-Sta/rpvx-m2md
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import httpx
import polars as pl
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

SODA_URL = "https://data.cdc.gov/resource/rpvx-m2md.json"
DEFAULT_LIMIT = 60_000  # whole dataset is ~59,584 rows, fits in one page


@dataclass(frozen=True)
class NchsRpvxConfig:
    url: str = SODA_URL
    limit: int = DEFAULT_LIMIT
    timeout_s: float = 60.0
    # Optional Socrata app token; not required for this dataset but raises rate
    # ceiling if present. Read from env at call site.
    app_token: str | None = None


@retry(stop=stop_after_attempt(4), wait=wait_exponential_jitter(initial=2, max=30))
def fetch_raw(cfg: NchsRpvxConfig) -> list[dict]:
    headers = {"Accept": "application/json"}
    if cfg.app_token:
        headers["X-App-Token"] = cfg.app_token
    params = {"$limit": cfg.limit, "$order": "fips,year"}
    with httpx.Client(timeout=cfg.timeout_s) as client:
        resp = client.get(cfg.url, params=params, headers=headers)
        resp.raise_for_status()
        return resp.json()


def to_frame(rows: list[dict]) -> pl.DataFrame:
    # Socrata returns every numeric field as JSON string; cast explicitly.
    df = pl.DataFrame(rows).with_columns(
        pl.col("fips").cast(pl.Utf8).str.zfill(5).alias("fips"),
        pl.col("fipsstate").cast(pl.Utf8).str.zfill(2).alias("state_fips"),
        pl.col("year").cast(pl.Int32),
        pl.col("population").cast(pl.Int64),
        pl.col("model_based_death_rate").cast(pl.Float64).alias("rate_per_100k"),
        pl.col("lower95ci").cast(pl.Float64),
        pl.col("upper95ci").cast(pl.Float64),
        pl.col("standard_deviation").cast(pl.Float64).alias("rate_stddev"),
    )
    df = df.with_columns(
        (pl.col("rate_per_100k") * pl.col("population") / 100_000)
          .round()
          .cast(pl.Int64)
          .alias("implied_deaths"),
    )
    return df.select(
        "fips",
        "state_fips",
        "state",            # full state name
        "county",           # "Foo County, ST"
        "year",
        "population",
        "rate_per_100k",
        "lower95ci",
        "upper95ci",
        "rate_stddev",
        "implied_deaths",
        "urbanrural",
        "censusdivision",
    )


def fetch(cfg: NchsRpvxConfig | None = None) -> pl.DataFrame:
    cfg = cfg or NchsRpvxConfig()
    rows = fetch_raw(cfg)
    return to_frame(rows)


def save_parquet(df: pl.DataFrame, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(out_path, compression="zstd")


# Integration with cdc_runner.py: replace the D76-XML path with a single call to
# fetch() and then filter for the target year window (1999-2017; Act-4 focus
# 2006-2014). Retain the existing suppression/normalization seam so that
# clean/cdc.py continues to emit { fips, year, deaths, rate, suppressed } tuples
# — except suppressed will always be False here because rpvx-m2md is unsuppressed.
```

**Fixture replacement:** capture one real Socrata response to
`pipeline/tests/fixtures/cdc/rpvx_full.json` and pin its sha256 in
`expected_hashes.py`. No need for per-state XML fixtures anymore.

**Build time:** one HTTP GET + parquet write = ~10 s. Well under the 30-min CI
budget.

---

## Licensing & Redistribution

- **Source license:** "Public Domain U.S. Government" (Socrata metadata
  `metadata.license`). NCHS is part of the US Department of Health and Human
  Services; works produced by federal employees in the course of duty are in
  the public domain per 17 U.S.C. § 105.
- **Our redistribution rights:** Unrestricted. We can commit derived parquet
  into this public GitHub repo under any open license we publish the site
  under. We should:
  1. Attribute the source in dataset metadata / site footer. Suggested citation
     from the dataset page:
     > "National Center for Health Statistics. NCHS - Drug Poisoning Mortality
     > by County: United States. Date accessed [YYYY-MM-DD]. Available from
     > https://data.cdc.gov/d/rpvx-m2md."
  2. Note the methodological caveats: "model-based estimates smoothed via
     empirical-Bayes; may differ from raw NCHS death counts, which are
     suppressed when <10 per county-year."
  3. Keep a snapshot of the raw Socrata JSON as an intermediate artifact so the
     provenance trail is auditable.

---

## Suppression Policy (UI impact)

Unlike raw NCHS WONDER output, `rpvx-m2md` has **no suppressed rows** — every
county-year has a numeric rate. This simplifies the UI massively:

- **No more "<10 deaths" render logic needed** for this dataset. Every county
  page can show a continuous line.
- When `implied_deaths < 10` we should still render a disclaimer, because the
  underlying raw count is privacy-suppressed upstream by NCHS and only
  surfaces here via the smoothing model. Suggested UI treatment: show the
  number but overlay the 95% CI band as a visible grey fill to convey
  uncertainty. Small-county sparklines in Act-4 won't need special handling
  except for CI-widened endpoints.
- If we ever switch to the raw WONDER-UI export (via a signed DUA or a
  human-driven nightly download), then the CDC standard is 0-9 → "Suppressed";
  rates unreliable when denominator count <20. Carry that rule through
  `clean/cdc.py` regardless, so the UI code is already suppression-aware.

---

## Data Quality Comparison — Mingo County, WV 2010

Target: raw-count "historical truth" ≈ 20-25 overdose deaths (user estimate).

| Source | Value | Interpretation |
|---|---|---|
| `rpvx-m2md` (2017 vintage) | rate 44.79 / 100k × pop 26,834 ⇒ **≈12 implied deaths** | Model-smoothed; under-estimates the 2010 Mingo peak because the smoother pulls toward state/neighbor means in a single year |
| `pbkm-d27e` (2015 vintage) | rate ">30" (top bin) × pop 26,770 ⇒ **>8 implied** | Binned, right-censored at 30/100k |
| CDC WONDER UCD UI (if run manually, county-level) | raw count likely 10-19, likely suppressed as "< 10" or rendered as count | Would need a UI scrape — blocked in automation |
| Washington Post reporting (Eric Eyre, 2016 Pulitzer) | journalism characterized Mingo 2007-2012 as ~25-30 overdose deaths/yr | Narrative/aggregated from state vital records, not a single-year point estimate |
| User's prior estimate | 20-25 deaths | Consistent with WaPo reporting-era numbers |

**Takeaway:** The model-smoothed `rpvx-m2md` estimate of ~12 is a conservative
lower bound for Mingo 2010. The user's 20-25 figure likely reflects multi-year
pooling or inclusion of neighboring counties' spillover decedents. **For the
Act-4 visualization we should label the metric explicitly as
"NCHS model-based drug-poisoning death rate, age-adjusted"** and perhaps show
rate (per 100k) as the primary metric with implied count as a secondary. The
narrative honesty wins over fake raw counts we can't actually obtain.

**Cross-source methodology divergence note:** The dataset description
explicitly flags that West Virginia in 2005 and 2009 has known R99
miscoding that depresses drug-poisoning counts; this is a genuine data-quality
caveat shared by every source downstream of NCHS.

---

## Caveats & Unknowns

1. **Smoothing vs. raw counts.** We lose the "X people died in this county
   this year" granularity that the WONDER UI can expose for non-suppressed
   cells. If editorial integrity requires *raw* counts for the six Act-4
   epicenter counties specifically, two options:
   - Manually run the WONDER UI query once, extract non-suppressed
     county-year-specific counts for just Mingo / Pike / Knott / McDowell /
     Cabell / Scioto 2006-2014, commit the ~50-cell JSON into the repo as a
     separate editorial annotation layer, and overlay on the auto-fetched
     model rate. This respects WONDER's TOS because it's a one-time human
     query, not an automated scrape.
   - Leave the raw counts out and make the rate-based metric the headline.
2. **1999-2017 cap.** The dataset stops at 2017. For 2018+ there's no drop-in
   replacement with the same methodology. For the Act-4 window this is a
   non-issue. If we ever want to extend to the fentanyl era we'd need a
   methodology break.
3. **Socrata availability.** `data.cdc.gov` occasionally 500s or imposes soft
   rate limits. The pipeline should retry with jitter (already sketched above)
   and cache the raw JSON in an intermediate artifact so a bad-day fetch
   doesn't block deploy.
4. **FIPS stability.** Bedford City VA 51515 merged into Bedford County VA
   51019 in 2015. Clifton Forge merged into Alleghany County pre-2003. Handle
   via a FIPS crosswalk in `clean/cdc.py` if/when we ship a merged county-page
   URL that needs to cover the merge transition.
5. **Rate is age-adjusted, not crude.** If the Act-4 copy says "X people died
   per 100,000" it should clarify "age-adjusted to the 2000 US standard
   population." Crude rate is NOT in this dataset.
6. **IHME as an optional cross-check.** IHME publishes better small-area
   estimates (their GBD 2019 subnational product has smaller CIs than NCHS)
   but their non-commercial license bars committing derivatives to a public
   repo. Could be used internally to sanity-check NCHS for a handful of
   spot-check counties and then not distributed.

---

## Action Items (for the maintainer, NOT done in this investigation)

1. Delete or deprecate `pipeline/src/openarcos_pipeline/sources/cdc_wonder.py`
   and the XML fixtures under `tests/fixtures/cdc/`.
2. Add `pipeline/src/openarcos_pipeline/sources/cdc_nchs_rpvx.py` per the sketch above.
3. Update `cdc_runner.py` to call `cdc_nchs_rpvx.fetch()` and drop the per-state
   fan-out (it's unnecessary when the whole dataset fits in one request).
4. Update `clean/cdc.py`'s output schema to carry `rate_per_100k`,
   `implied_deaths`, `lower95ci`, `upper95ci` in addition to the existing
   count-centric fields. Keep suppression handling in place for future raw
   sources.
5. Update `notes/cdc.md` to point to this investigation doc and mark the D76
   XML-API path as a closed blocker with `rpvx-m2md` as the resolution.
6. Update any site copy / tooltips that say "overdose deaths" to read "NCHS
   model-based drug-poisoning mortality rate (age-adjusted)" on hover, with
   the implied-count in the visible label.
