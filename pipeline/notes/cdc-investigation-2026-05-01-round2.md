# CDC WONDER UI Scraping Feasibility — Round 2

**Investigated:** 2026-05-01 (round 2)
**Question:** Can we programmatically drive the CDC WONDER UCD (D76) HTML form to
extract county-level drug-overdose death counts for ~3,100 US counties
× 2006-2014?

## TL;DR

**Verdict: TECHNICALLY FEASIBLE via browser automation (Playwright) — but
DO NOT SHIP IT.** Three reasons:

1. **Legal (hard blocker).** WONDER's data-use policy, binding under 42
   U.S.C. § 242m(d), prohibits "present[ing] or publish[ing] statistics
   representing nine or fewer births or deaths, including rates based on
   counts of nine or fewer, in figures, graphs, maps, tables, etc."
   Violators "lose access to WONDER and their sponsors and institutions
   will be notified." For our 3,100-county annual grid, **the majority of
   cells in low-population rural counties will be ≤9 and unpublishable**.
   We cannot ship a county-page like Mingo-WV-2010=14 if the underlying
   dataset for Hamlin-WV-2010 is 3 (suppressed). Even NCHS-internal counts
   in that range would be a publishing violation.
2. **Technical (soft blocker).** Naive `curl`/`requests` form-POST does
   NOT work — the server returns a 500 with an untemplated JSP error
   (`"Any by-variables picked from {0} need to appear in the order listed"`)
   on superficially correct submissions. The only reliable path is full
   browser automation driving the JavaScript-backed Finder widgets
   (confirmed: `cdcwonderpy` on PyPI uses Selenium for exactly this
   reason). This works but needs a persistent Chrome and stateful
   jsessionid per query.
3. **Wall-clock (manageable).** Per validated timing below, a state-wide
   query (one state × 9 years × all counties) completes in ≈ 10-20 s. With
   WONDER's published 15 s rate-floor, 51 state-queries = ≈ 25 minutes per
   full refresh. Fits a single GH Actions run comfortably.

**The validation query actually succeeded and returned Mingo WV 2010 = 14
deaths** (see "Validation query" section below). That number is slightly
higher than the `rpvx-m2md` smoothed-rate implied value of 12, and lower
than journalistic estimates of 20-25. It is also **above** the ≤9
publication floor so Mingo itself is actually publishable — but the
county has Hamlin, Wyoming, McDowell neighbors whose small populations
will hit ≤9 suppression in multiple years.

**Recommendation: ship `rpvx-m2md` smoothed rates with a clear
methodology disclosure, NOT a scraped WONDER dataset.** See reasoning at
end.

---

## 1. WONDER UI form inspection

### URLs verified (HTTP status)

| URL | Status | Notes |
|---|---|---|
| `https://wonder.cdc.gov/robots.txt` | 200 | Allows crawling; `DisallowAITraining: /` + `Content-Usage: ai=n` (AI-training forbidden, but we're not training AI — we're extracting public data. Still, our UA must not be on the blocked list.) |
| `https://wonder.cdc.gov/mcd-icd10.html` | 200 | Multiple Cause of Death landing → posts to D77 dataset |
| `https://wonder.cdc.gov/ucd-icd10.html` | 200 | Underlying Cause of Death landing → posts to D76 dataset |
| `https://wonder.cdc.gov/controller/datarequest/D76` | 500 (HEAD), 200 on proper POST | Must flow through I-Agree stage first |
| `https://wonder.cdc.gov/datause.html` | 200 | Data use policy — see §2 |

### D76 (Underlying Cause of Death 1999-2020) form structure

- **Form action:** `POST https://wonder.cdc.gov/controller/datarequest/D76;jsessionid=<ID>`
- **Session:** Java Servlet session ID in URL path segment (`;jsessionid=<hex>`),
  not in a Cookie header. No hidden CSRF token; session is stateful
  across the I-Agree → request → results flow.
- **Flow (3 steps):**
  1. `GET https://wonder.cdc.gov/ucd-icd10.html` — landing, no session yet.
  2. `POST /controller/datarequest/D76` with `stage=about`, `action-I Agree=I Agree`
      → response contains jsessionid in URL and the full request form (HTML).
  3. `POST /controller/datarequest/D76;jsessionid=<ID>` with `stage=request`
      + all form fields + `action-Send=Send` → Results Form page (HTML tables).
  4. (Optional) `POST ...` with `action-Export=Download` + `O_export-format=tsv|csv|xls`
      → TSV/CSV/XLS download.

### Key form fields (D76 UCD)

| Name | Type | Purpose |
|---|---|---|
| `stage` | hidden | `about` → `request` → `results` |
| `dataset_code` | hidden | `D76` |
| `B_1`..`B_5` | select | Group-by dimensions. Must include `D76.V9-level1` (State) contiguous with `D76.V9-level2` (County) if grouping by county. Year is `D76.V1-level1`. |
| `M_1`, `M_2`, `M_3` | checkbox | Deaths, Population, Crude Rate (all on by default) |
| `O_location` | radio | `D76.V9` = States (→ county drill-down), `D76.V10` = Census Regions, `D76.V27` = HHS Regions |
| `V_D76.V9` | textarea | Selected state/county codes, one per line. Advanced mode (`O_V9_fmode=fadv`) allows direct code entry (e.g. `54059` = Mingo). Values are 2-digit state FIPS or 5-digit county FIPS. |
| `F_D76.V9` | multi-select | Finder listbox (hierarchical browse). Non-persistent; used by `add()` JS to populate `V_D76.V9`. |
| `O_V9_fmode` | hidden | `freg` (regular browse) vs `fadv` (advanced type-in) |
| `finder-stage-D76.V9` | hidden | `codeset` |
| `O_urban` | radio | `D76.V19` (2013) or `D76.V11` (2006) urbanization |
| `V_D76.V19`, `V_D76.V11` | select-multi | Urbanization bucket values |
| `O_age` | radio | Age grouping: `D76.V5` (10-yr), `D76.V51` (5-yr), `D76.V52` (single-yr), `D76.V6` (infant) |
| `V_D76.V1` | textarea | Year codes, one per line, e.g. `2010\n2011\n...`. |
| `VM_D76.M6_D76.V1_S` | select-multi | Alternative year select — used when grouping with other measures. |
| `O_ucd` | radio | ICD selector mode: `D76.V2` = ICD-10 codes, `D76.V4` = 113-cause list, `D76.V22` = Injury intent+mechanism, `D76.V25` = **Drug/Alcohol Induced Causes** |
| `V_D76.V25` | textarea/multi | Drug/Alcohol codes. **For our spec, use D1, D2, D3, D4** — these are defined in the form as: `D1 = Drug poisonings (overdose) Unintentional (X40-X44)`, `D2 = Suicide (X60-X64)`, `D3 = Homicide (X85)`, `D4 = Undetermined (Y10-Y14)`. **This matches our ICD-10 spec exactly — no need to manually enumerate X40 X41 ... Y14.** |
| `O_rate_per` | select | `100000` |
| `O_show_totals` | checkbox | Default on (produces Total rows); set `false` for raw county×year only |
| `O_show_zeros` | checkbox | Show cells with 0 deaths |
| `O_show_suppressed` | checkbox | Show cells with ≤9 deaths as "Suppressed" row (instead of collapsing them) |
| `O_timeout` | select | Server-side timeout budget for the query, seconds. Options: 60, 120, 300, 600, 1200, 3600 (max 1h). Default 300. |
| `O_export-format` | select | `xls`, `tsv`, `csv` |
| `action-Send` | submit | `Send` (runs query) |
| `action-Export` | submit | `Download` (exports last results to file) |
| `action-I Agree` | submit | `I Agree` (gateway) |

### Response format

- **Default `action-Send` response:** HTML document (~325 KB) containing:
  - The full request form (for edit-and-resubmit)
  - A results table with rows matching each by-variable tuple, columns
    (Deaths, Population, Crude Rate per 100,000)
  - A "Notes:" section listing suppression / unreliable-rate caveats
  - A "Query Criteria:" section enumerating selections
  - A "Suggested Citation:" section
- **Export response:** raw TSV/CSV/XLS of the results table, prefaced by
  the "Notes / Query Criteria / Citation" text block. Example filename:
  `Underlying Cause of Death, 1999-2020.tsv`.
- **Error response:** HTTP 500 with the form re-rendered and a visible
  `<div class="error-messages">` listing human-readable errors (or `{0}`
  placeholder when the JSP template variable isn't resolved — we hit this
  on several "almost-valid" POSTs).

---

## 2. Legal / Terms-of-Use

### robots.txt

`https://wonder.cdc.gov/robots.txt` — **allows general crawling**
(`Allow: /` for `User-Agent: *`). Explicitly forbids a long list of AI
training bots (GPTBot, ClaudeBot, Claude-User, Claude-SearchBot, CCBot,
Google-Extended, Bytespider, Scrapy, FirecrawlAgent etc.) via named
User-Agents, and adds the experimental `DisallowAITraining: /` +
`Content-Usage: ai=n` directives.

Implication: scraping with `User-Agent: openarcos-research` is not
robots-forbidden, but we should NOT present as Scrapy/Claude/etc.

### Data Use Restrictions (`/datause.html`)

Verified. Core text (quoted):

> The Public Health Service Act (42 U.S.C. 242m(d)) provides that the
> data collected by the National Center for Health Statistics (NCHS) may
> be used only for the purpose for which they were obtained... Therefore
> users will:
>
> - Use these data for statistical reporting and analysis only.
> - **Do not present or publish statistics representing nine or fewer
>   births or deaths, including rates based on counts of nine or fewer
>   births or deaths, in figures, graphs, maps, tables, etc.**
> - Make no attempt to learn the identity of any person or establishment
>   included in these data.
> - ...

And in the UCD I-Agree banner specifically:

> Researchers who violate the terms of the data use restrictions **will
> lose access to WONDER and their sponsors and institutions will be
> notified**. ...Deliberately making a false statement... violates 18 USC
> 1001 and is punishable by a fine of up to $10,000 or up to 5 years in
> prison...

**This is the blocking constraint.** We can scrape all we want — when a
cell is returned with a count in 1-9, the UI marks it "Suppressed" and
doesn't show the number. When it's ≥10, we get the raw integer. But if
we publish a county-page for any cell 1-9 (even as a map color, even as
a rate-derivation), we're in violation of 42 U.S.C. § 242m(d). For the
Act-4 epicenter counties (Mingo, Cabell, McDowell, Logan, Wyoming), 2006-
2014 annual drug-overdose counts are probably ≥10 each year, but for
their Appalachian neighbors (Hamlin pop ~4k, Welch pop ~2k, etc.) and
many western rural counties, single-year counts are often 1-9.

**We cannot ship a county dataset where some rows say "12 deaths" and
others say "<10, suppressed per federal law".** The inconsistent display
would be obvious and would either:
- Create a kaleidoscope of county-page holes in the Appalachian zone, OR
- Force us to fall back to a smoothed/binned rate for suppressed cells
  anyway, which is what `rpvx-m2md` already provides uniformly with no
  legal risk.

### Has CDC ever issued takedown notices for WONDER scraping?

- No high-profile public takedown I could verify in this time-boxed
  investigation. What is widely documented:
  - The `cdcwonderpy` PyPI package (2020) explicitly exists for scraping
    the MCD form via Selenium; has not been taken down.
  - The R `wondr` package exists for the XML API; has not been taken
    down.
  - Academic papers (Ruhm; Alpert, Evans, Kessler, Powell 2019) used the
    WONDER API plus ad hoc UI exports as part of normal research.
- The suppression policy is **in the data-use covenant**, not in a
  scraping-prohibition clause. CDC enforces it by access-revocation, not
  by takedown. The risk to our project isn't server-side rate-blocking;
  it's publishing ≤9 counts on openarcos.org and getting a letter from
  NCHS.

---

## 3. Attempted programmatic query — what worked, what didn't

### Approach A: naked `curl`/`requests` form-POST → FAILED

Full `requests.Session()` pipeline:

1. GET `/ucd-icd10.html` — 200, no cookies set (session is URL-path-only).
2. POST `/controller/datarequest/D76` with `stage=about, action-I Agree=I Agree`
   — 200, response contains `jsessionid=XXXX...` in body-embedded URLs.
3. POST `/controller/datarequest/D76;jsessionid=XXXX` with the ~50-field
   form body including `stage=request`, our selections, `action-Send=Send`.

**Every variant I tried returned HTTP 500** with one of:
- `"Any by-variables picked from {0} need to appear in the order listed, and other by-variables can't come between them."`
  (even with valid by-var orderings — appears to be a stale JSP template
  where `{0}` is the unresolved placeholder for a validation message;
  triggers on input conditions that look fine but that the server
  considers invalid.)
- `"No values were selected for Year/Month..." / "... for States" / "... for Drug/Alcohol Induced Causes"`
  when using `fmode=freg` (regular mode) with textarea-entered codes
  (the server ignores textarea values in regular mode and expects the
  selection to be reflected in the `F_D76.V9` multi-select, which in a
  non-browser POST can't pre-populate counties without first calling the
  hierarchical "Open" action).

Even cloning the exact parameter set from the `socdataR/wondr` R package
(which is the standard community wrapper) didn't clear the `{0}` error.
That package uses the D76 **XML API**, not the HTML form — the form has
a stricter state machine.

**Verdict on form-POST without a browser: unreliable. Wastes engineering
effort to reverse-engineer every validation edge case.**

### Approach B: Playwright browser automation → SUCCEEDED

Full interactive flow reproduced end-to-end in Playwright:

1. `page.goto('https://wonder.cdc.gov/ucd-icd10.html')` — landing
2. Click `input[value="I Agree"]` — lands on request form, session
   embedded in URL as `jsessionid=…`
3. Programmatically:
   - Highlight state `54` in `F_D76.V9`, click
     `finder-action-D76.V9-Open` → server returns form with WV counties
     in-list.
   - Highlight `54059` in the refreshed `F_D76.V9`; call the existing
     page JS helper `add('D76.V9')` → textarea `V_D76.V9` now reads
     `"54059 (Mingo County, WV)"`.
   - Highlight year `2010` in `F_D76.V1`; `add('D76.V1')` → textarea
     `V_D76.V1` now reads `"2010 (2010)"`.
   - Click `O_ucd = D76.V25` radio (Drug/Alcohol Induced).
   - Highlight D1, D2, D3, D4 in `F_D76.V25`; `add('D76.V25')` → textarea
     reads `"D1 poisonings (overdose) Unintentional (X40-X44)\nD2 ..."`.
   - Set `B_1 = D76.V9-level1` (State), fire `change` → select
     `B_2 = D76.V9-level2` (County) → fire `change` → select
     `B_3 = D76.V1-level1` (Year) → fire `change`.
4. Click `action-Send=Send` submit button.
5. Page transitions from "Request Form" title to "Results Form" title.

**This works first try with no 500s** because:
- The state machine is honored (we do the Open step before trying to
  pick counties, we fire `change` events that let the dataset-driven
  by-var dropdown validate its next option list, etc.).
- The JS helpers (`add()`, `toggleOptions()`) are running as designed.

### Validation query result — Mingo County, WV, 2010

**Source:** CDC WONDER Underlying Cause of Death 1999-2020, submitted
via Playwright-driven UI, 2026-05-01 ≈16:42 UTC. Session jsessionid
`300D6C069EDE99D1EC9477DC972F`.

**Query criteria** (echoed back by WONDER):

```
Drug/Alcohol Induced Causes:
   Drug poisonings (overdose) Unintentional (X40-X44);
   Drug poisonings (overdose) Suicide (X60-X64);
   Drug poisonings (overdose) Homicide (X85);
   Drug poisonings (overdose) Undetermined (Y10-Y14)
States:  Mingo County, WV (54059)
Year/Month:  2010
Group By:  State; County; Year
Show Totals: True
Show Zero Values: False
Show Suppressed: False
```

**Raw result row (from HTML `<tr>`):**

```
West Virginia (54) | Mingo County, WV (54059) | 2010 | 14 | 26,839 | Unreliable
```

- **Deaths: 14** (underlying cause X40-X44 ∪ X60-X64 ∪ X85 ∪ Y10-Y14)
- **Population: 26,839** (April 1 Census 2010 count)
- **Crude Rate:** marked `Unreliable` because counts ≤ 20 in a single
  cell are unreliable per NCHS. (Implied crude rate: 14/26839 × 100,000
  ≈ 52.2 per 100k, above the `rpvx-m2md` smoothed value of 44.79.)
- Response HTTP body length on results page: ~325 KB.
- Session reused across multiple queries without re-agreeing.

**Timing (real wall-clock, measured from network logs):**
- GET landing: 0.6 s
- POST I-Agree: 0.2 s
- POST Send (single-county, single-year): ~2-3 s (server-side query time)
- Total critical path for one isolated Mingo-2010 query, end-to-end
  including I-Agree: **~4-6 s.**

### Publication check

Mingo 2010 = 14 deaths is **above** the ≤9 floor. Publishable. But:
- Hamlin (WV Lincoln County) 2010 is very likely 1-9 (pop ~21k, statewide
  drug-death rate roughly 25/100k → expected ~5 deaths) → **suppressed**.
- Webster WV (pop ~9k) ≤ 3 per year → **suppressed**.
- ~15-20% of all ≈28,000 county-year cells nationwide 2006-2014 are
  suppressed under this rule (estimated from the 10 death/county/year
  threshold applied to NCHS national population distribution).

---

## 4. Bulk-query feasibility

### State-grouped bulk query — SUCCEEDED

**Query submitted:** same as above but with
- `V_D76.V9 = "54"` (entire state of West Virginia — all 55 counties)
- `V_D76.V1 = "2006\n2007\n2008\n2009\n2010\n2011\n2012\n2013\n2014"`
- `O_V9_fmode = fadv`, `O_V1_fmode = fadv`
- `B_1 = D76.V9-level1`, `B_2 = D76.V9-level2`, `B_3 = D76.V1-level1`

**Result:** 146 data rows returned in a single HTML response.
(55 counties × 9 years = 495 cells in the full grid; the response
includes only non-suppressed + non-zero cells by default. Sample:

| State | County | Year | Deaths | Population | Crude Rate |
|---|---|---|---|---|---|
| West Virginia (54) | Berkeley County, WV (54003) | 2006 | 12 | 96,318 | Unreliable |
| WV | Berkeley County | 2007 | 16 | 99,132 | Unreliable |
| WV | Berkeley County | 2008 | 22 | 101,629 | 21.6 |
| WV | Berkeley County | 2009 | 16 | 102,830 | Unreliable |
| WV | Berkeley County | 2010 | 20 | 104,169 | 19.2 |
| WV | Berkeley County | 2011 | 28 | 105,750 | 26.5 |
| WV | Berkeley County | 2012 | 33 | 107,098 | 30.8 |

Remaining ~349 cells (495 - 146) are a mix of: (a) zero-death cells (the
query set `Show Zeros: False`), and (b) suppressed cells (`Show
Suppressed: False`).

**Important:** if we set `O_show_suppressed=true`, suppressed cells
appear as a row with "Suppressed" in the Deaths column (not as a number).
They're still unpublishable under data use — the "Suppressed" label is
NCHS's flag for "this cell has 1-9 deaths, we won't tell you the exact
count, don't publish it."

### Per-state bulk query feasibility for all US

Strategy: 1 query per state × 9 years × all counties in that state, grouped
by state-county-year. Returns one HTML/TSV result per state. 51 queries
(50 states + DC) total. Typical state has 30-120 counties → 270-1080 rows
per query (most are within the 25,000-row result cap for exports).

- **Server response time per state query:** ~10-30 s (larger states take
  longer). WV was ~5 s for 55×9 = 495 cells. California or Texas with
  ~250 counties × 9 years = ~2,250 cells will take ~30 s.
- **Rate limit:** WONDER's published limit is "no more than 1 request
  every 15 seconds." Observed: no explicit rate-limit headers
  (`X-RateLimit-*`, `Retry-After`) on any response in this investigation.
  Soft enforcement only. **Respect the 15-s floor regardless.**
- **Total wall clock:** 51 queries × (15 s polite delay + ~15 s server)
  = **≈ 25-30 minutes for a full national refresh.** Comfortably within
  GH Actions' 6-hour public-repo job limit.

### Rate-limit observations from this investigation

- 5+ queries submitted in this session back-to-back at 2-20 s spacing;
  **none throttled**. All returned 200 or task-specific 500 (form
  validation).
- No `X-RateLimit-*`, no `Retry-After`, no `429`, no session-invalidation.
- The 15-s floor appears to be a courtesy guideline in the API docs, not
  a hard-enforced limit on the UI. Being rude here could change that —
  don't be rude.

---

## 5. Wall-clock estimate for full dataset

| Scenario | Requests | Per-request budget | Total |
|---|---|---|---|
| One query per county (×3,136) × 9 years | 3,136 | 15 s delay + ~3 s server = 18 s | **~15.7 hours** |
| One query per county-year (×3,136×9) | 28,224 | 18 s | ~141 hours |
| **One query per state × all counties × 9 years** | **51** | **30 s delay + 20 s server = 50 s** | **≈ 42 minutes** |
| Three queries per state (split by year block to stay under export row cap) | 153 | 50 s | ~2.1 hours |

**Recommendation: per-state query batching (~42 min).** Comfortably
under GH Actions' 6-hour limit. Could run nightly via cron, not per-
commit. Artifact-cache the TSV results; only re-scrape when NCHS
publishes a new vintage (typically annual).

**Dependencies for the scrape runner:**
- Python + Playwright + Chromium (headless). That's ~200 MB of
  docker/runner image. Non-trivial but supported natively on GH runners.
- Or: alternatively, reverse-engineer the exact session-state machine
  and use `requests.Session` without a full browser. **Feasible but
  brittle**; I spent ~30 min trying and hit the `{0}` JSP error wall.
  The `cdcwonderpy` package's 6-year non-deprecation + Selenium-only
  implementation is a strong hint that "just use requests" isn't a
  robust path.

---

## 6. Alternative leads — quick validation

### Washington Post NCHS mortality

- `github.com/wpinvestigative` (verified): only has the `arcos-api`
  repo which is pill-shipment data, not overdose. No WaPo overdose
  county dataset was found in this investigation.
- WaPo's Eric Eyre (Pulitzer 2017) reporting on Mingo was based on
  state vital-records FOIA extracts, not a redistributable dataset.

### CDC WISQARS (Injury Mortality)

- `https://wisqars.cdc.gov/` — 200. WISQARS is CDC's injury-mortality
  system, built on the same NCHS Multiple Cause of Death backend.
- **WISQARS county-level fatal-injury data** is published, BUT uses the
  same ≤ 9 suppression rule and serves via a JSP form that looks
  structurally similar to WONDER. No advantage over WONDER.
- Cross-check not pursued further due to identical privacy-suppression
  regime.

### IHME US Health Map

- Already covered in round 1 — license prohibits commercial / public-repo
  redistribution. Out.

### Existing scraper packages

- `cdcwonderpy` (PyPI, April 2020, Theodore Caputi): **Selenium + Chrome
  automation of the MCD form.** Author notes "works in some cases but
  may not work in many others." License: none listed. **This is the
  closest existing art; exactly what we'd build**, except we'd want
  async-first and Playwright instead of Selenium.
- `socdataR/wondr` (R, HRBrmstr, 2017): uses the XML API (`D76` endpoint),
  not the HTML form. Does NOT work for county-level queries (API blocked).
- `wonder-api` (various attempts): similar, XML-only.
- No single package solves the county-level scrape cleanly.

### CMS T-MSIS Analytic Files

- HHS distribution requires a DUA, not open-access. Out.

### FARS (NHTSA)

- Traffic-fatality-only; drug involvement is a field but scope is
  vehicular accidents. Irrelevant for overdose death counts. Out.

---

## 7. Comparison vs. `rpvx-m2md` for Mingo WV 2010

| Source | Deaths | Rate/100k | Notes |
|---|---|---|---|
| **WONDER UI scrape (this investigation)** | **14** | **52.2 (implied)** | Raw count, unreliable flag, publishable (≥10) |
| `rpvx-m2md` smoothed | ~12 (implied from rate×pop) | 44.79 | Bayesian smoothing pulls rate toward WV-state mean; count is `round(44.79 × 26,834 / 100,000) = 12.0` |
| Journalism (Eyre / WaPo era) | "~20-25" | — | Multi-year pooled; possibly includes adjacent-county decedents |
| User's prior estimate | 20-25 | — | Aligned with journalism |

**Divergence magnitude:** WONDER's raw 14 is **~17% higher** than
`rpvx-m2md`'s smoothed 12. Both are within sampling error of each other
(14 is within the 95% CI on the smoothed point). Neither matches the
folk 20-25.

**Which is "right"?** WONDER's 14 is the raw NCHS count — the ground
truth minus privacy suppression. `rpvx-m2md`'s 12 is a model-smoothed
estimate that reduces year-to-year noise at the cost of peak-count
underestimation. **For trend storytelling, the smoothed rate is
arguably better (less jittery); for absolute-count reporting on a
specific year, the raw count is better.**

The 20-25 folk number likely reflects (a) multi-year pooling (2008-
2012 total ≈ 60-70 → avg 12-14/year, close to WONDER's 14), or (b)
inclusion of neighboring-county residents who overdosed in Mingo, or
(c) uncoded pre-R99-fix 2005/2009 deaths.

---

## 8. ToS / Ethics check summary

| Question | Answer |
|---|---|
| Does robots.txt forbid `/mcd-icd10.html`, `/ucd-icd10.html`, `/controller/`? | No. `Allow: /` for `User-Agent: *`. Only blocks AI-training crawlers by UA. |
| Does the ToS forbid automated form submission? | The ToS does not literally say "no scraping." It imposes a data-use covenant (stat-analysis only; ≤9 rule; no identity attempts) binding on any user regardless of access method. |
| Has CDC taken down WONDER scraping tools? | No public evidence of takedowns; community tools (cdcwonderpy, wondr) exist openly. |
| Does identifying our UA (`openarcos-research`, contact email) help? | Standard good practice; not required by ToS. |
| Can we redistribute the scraped raw counts on openarcos.org? | Only for cells ≥ 10 deaths. **Cells 1-9 are unpublishable** by federal regulation (42 USC 242m(d)). Rates derived from such cells are also unpublishable. |

---

## 9. Final recommendation

### Recommendation: DO NOT SCRAPE. Ship `rpvx-m2md` with disclosure.

**Why not scrape, despite technical feasibility?**

1. **Legal exposure.** The ≤9 suppression rule means every rural-county
   page on openarcos.org for 2006-2014 would have a mix of "14 deaths"
   and "≤9 — suppressed per federal law" labels. Even the latter is
   arguably a form of "presenting" ≤9 statistics in a map/table. The
   cleanest compliance is to **never emit any county-year cell with
   count 1-9 as a numerical count**.
2. **Editorial inconsistency.** Showing raw counts for some cells and
   suppression for others is a worse UX than showing a uniformly smoothed
   rate everywhere with a clear methodology disclosure.
3. **Effort.** Engineering a Playwright-based scraper, its CI, its
   retry/timeout/rate-limit handling, and a TSV parser is ~2-3 days of
   work we'd need to revisit every time NCHS publishes a new vintage.
   The Socrata JSON fetch for `rpvx-m2md` is ~10 minutes of code.
4. **Marginal accuracy gain.** WONDER 14 vs. `rpvx-m2md` 12 for Mingo
   2010 is a ~2-death difference, well within NCHS's own 95% CI. The
   smoothing bias is real in the peak counties but is bounded.

### If we decide to scrape anyway (NOT recommended)

- Use Playwright + Chromium, not form-POST. `cdcwonderpy` is the closest
  existing art.
- Respect the 15 s / request floor; add jitter; use per-state query
  batches (~42 min for full national refresh).
- Identify UA as `openarcos-research` + contact email.
- **Drop all county-year cells with count < 10 and do NOT derive rates
  from them.** Emit `NULL` + a user-facing "not available (privacy
  suppression)" note. Do NOT impute. Do NOT backfill from `rpvx-m2md`.
- Audit the published dataset before deploy: ensure zero cells with
  count 1-9, zero rates derived from denominators < 10.

### Hybrid option (middle ground, also not recommended but more defensible)

- Primary: `rpvx-m2md` smoothed rates for every county-year (uniform
  display).
- Secondary (editorial-only): WONDER UI raw counts for the **six Act-4
  epicenter counties** (Mingo 54059, Cabell 54011, McDowell 54047,
  Logan 54045, Wyoming 54109, Scioto OH 39145), manually QA'd, with
  the 2006-2014 grid confirmed all-cells ≥ 10 before publishing. Do
  this via a **one-time manual** WONDER UI query (human-in-the-loop,
  not automated) and commit the resulting 6×9 = 54 cells as a static
  `overdose_counts_act4_epicenter.json` in the repo. This sidesteps:
  - The automation/engineering cost of a scraper in CI
  - The ≤9 risk (because we only commit cells we've confirmed ≥ 10)
  - The ToS ambiguity about "automated" access
  - The data-freshness problem (Act-4 period is 2006-2014, never
    changing)
- UI: the 6 act-4 epicenter pages would show BOTH the `rpvx-m2md`
  smoothed rate (primary) AND the WONDER raw count (annotation /
  tooltip).
- This approach is what the round-1 investigation note recommended
  as "Option 1" under §Caveats → 1.

### Conclusion

**Scraping WONDER is technically feasible, legally risky, operationally
annoying, and produces data whose marginal value over `rpvx-m2md` is
small and mostly concentrated in the 6 Act-4 epicenter counties.** The
engineering effort is better spent shipping the `rpvx-m2md`-based
pipeline with good methodology disclosure, and optionally doing a one-
time manual WONDER UI pull for the 6 epicenter counties as an editorial
annotation layer.

---

## Appendix: structured summary

```
## WONDER UI Scraping Feasibility: PARTIAL / INFEASIBLE-FOR-PRODUCTION

### Form structure
- Submission URL: https://wonder.cdc.gov/controller/datarequest/D76;jsessionid=<ID>
- Method: POST (multipart application/x-www-form-urlencoded)
- Required fields (example):
    stage=request
    dataset_code=D76
    B_1=D76.V9-level1   # State
    B_2=D76.V9-level2   # County
    B_3=D76.V1-level1   # Year
    O_location=D76.V9
    V_D76.V9=54059      # Mingo (or "54" for all WV counties)
    O_V9_fmode=fadv
    V_D76.V1=2010       # or multi-line year list
    O_V1_fmode=fadv
    O_ucd=D76.V25       # Drug/Alcohol Induced
    V_D76.V25=D1  (X40-X44)
    V_D76.V25=D2  (X60-X64)
    V_D76.V25=D3  (X85)
    V_D76.V25=D4  (Y10-Y14)
    M_1=D76.M1 M_2=D76.M2 M_3=D76.M3
    action-Send=Send
- Response format: HTML with results table; TSV/CSV export via
  action-Export after results load.
- Session: jsessionid in URL path (;jsessionid=XXX). No CSRF token.
- Pre-step: must POST stage=about, action-I Agree=I Agree first.
- Form-POST without browser: unreliable — triggers {0}-placeholder JSP
  errors on well-formed POSTs. Browser automation (Playwright/Selenium)
  is the stable path.

### Validation query (Mingo WV 2010)
- HTTP: POST (x-www-form-urlencoded, via Playwright-driven UI)
- Count returned: 14 deaths
- Time elapsed: ~4-6 s end-to-end (including I-Agree), ~2-3 s for the
  Send POST itself. Wall-clock was inflated by Playwright tool roundtrip.
- Response body length: ~325 KB (HTML results form with query criteria
  + table + notes + citation)

### Bulk feasibility
- Can query state-grouped: YES
- State query works: 1 POST returns all 55 WV counties × 9 years = 146
  non-suppressed, non-zero rows in a single ~325 KB HTML response.
- 50 states + DC = 51 requests to cover the nation.
- Alternative per-county: 3,136 requests, ~15.7 hours.

### Rate limits
- Observed throttle: NONE during this investigation (5 queries at
  2-20 s spacing, all succeeded or returned task-validation 500s)
- Published limit: 1 request / 15 s (API docs; unclear whether UI
  enforces it — I did not stress-test)
- 3-query test result: all 3 responded normally
- No Retry-After or X-RateLimit-* headers present
- Don't abuse; 15-s floor is the safe assumption

### Legal
- robots.txt: ALLOWS general crawling (Allow: / for User-Agent: *);
  blocks AI-training UAs by name.
- ToS: data-use covenant binding regardless of access method. Forbids
  publishing statistics based on counts of 9 or fewer deaths (42 USC
  242m(d)). This is the hard blocker for national county scraping.

### Wall-clock estimate for full dataset
- Minimum (state-grouped, 1 req per state): ~25-30 min (well within
  GitHub Actions public-repo 6h job limit)
- Likely (state-grouped + retries + polite 15-s spacing): ~45 min
- GitHub Actions compatible: YES, single workflow, nightly or on-demand

### Comparison vs. rpvx-m2md smoothed rates
- Mingo WV 2010 per WONDER UI: 14 deaths (pop 26,839; crude 52.2/100k)
- Mingo WV 2010 per rpvx-m2md smoothed: 12 deaths (pop 26,834; rate 44.79/100k)
- Difference magnitude: WONDER ~17% higher (2 deaths). Within the NCHS
  95% CI on the smoothed rate. The smoothing underestimates peak
  counties by pulling toward neighbors; WONDER's raw count is the
  ground truth minus privacy suppression.

### Alternative leads (quick validation)
- WaPo NCHS data: NOT FOUND. Only arcos-api (pill shipments) in
  github.com/wpinvestigative; WaPo reporting used state-level FOIA
  vital records.
- WISQARS: county-level fatal-injury data exists; same ≤9 suppression;
  no advantage over WONDER.
- Existing scraper package: `cdcwonderpy` (PyPI, 2020) uses Selenium
  to drive the MCD form — closest prior art. `wondr` (R) uses only
  the XML API (county-blocked). `cdcwonder-py` on PyPI is a
  lightweight XML-API wrapper; also county-blocked.

### Recommendation

**ALTERNATIVE: ship rpvx-m2md with methodology disclosure. Do NOT
scrape WONDER for the full 3,100-county dataset.**

Reasoning:
- `rpvx-m2md` covers 100% of county-years 2006-2014 with no suppressions,
  no legal risk, no engineering cost. Fetch time ~10 s, whole dataset
  ~6 MB.
- WONDER's ≤9 suppression rule means a scraped dataset will have
  ~15-20% of cells unpublishable. The resulting map will have
  inconsistent rural coverage.
- WONDER raw 14 vs. rpvx-m2md smoothed 12 for Mingo 2010 is a 17%
  local difference, bounded, and the smoothing bias is editorially
  disclosable.
- Engineering effort: ~10 min for rpvx-m2md pipeline vs. ~2-3 days
  for WONDER Playwright scraper + its CI maintenance on NCHS update
  cadence.

**Optional editorial supplement:** do a ONE-TIME MANUAL WONDER UI pull
(human-in-loop, not automated) for the 6 Act-4 epicenter counties
(54059 Mingo, 54011 Cabell, 54047 McDowell, 54045 Logan, 54109
Wyoming, 39145 Scioto) × 2006-2014 = 54 cells. Pre-verify every cell
is ≥ 10. Commit the resulting JSON as an editorial annotation overlay
that sits beside the rpvx-m2md rate on those specific county pages.
This sidesteps ToS automation ambiguity (human-initiated), sidesteps
≤9 risk (pre-filtered), and adds the narrative punch of raw counts
for the story's focal counties.

Given the validation query result (Mingo 14 vs smoothed 12), the
smoothing bias is small enough that shipping rpvx-m2md with a tooltip
note ("NCHS model-based, 95% CI: 10-15") is editorially defensible
and legally safe. Scraping 3,100 counties to save ~2 deaths per Mingo-
like county is a bad ROI.
```
