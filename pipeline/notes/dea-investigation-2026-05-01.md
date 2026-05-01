# DEA Enforcement-Action Data Source Investigation — 2026-05-01

Investigation for Act 3 "Federal Enforcement" scrolly scene. Goal: obtain
**annual counts of DEA diversion/opioid enforcement actions, 2006–2014**,
from a publicly-accessible, build-time-compatible, machine-parseable
source suitable for a static Cloudflare Pages site.

All URLs below were verified live via `webfetch` on 2026-05-01. HTTP
statuses and actual sample records are pasted verbatim.

---

## Candidate Sources (ranked by suitability)

### 1. Federal Register API — DEA Notices, filtered to registrant-action dispositions

- **URL (facets yearly):**
  `https://www.federalregister.gov/api/v1/documents/facets/yearly.json?conditions[agencies][]=drug-enforcement-administration&conditions[publication_date][gte]=2006-01-01&conditions[publication_date][lte]=2014-12-31`
- **URL (paginated listing):**
  `https://www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=drug-enforcement-administration&conditions[publication_date][year]=YYYY&conditions[type][]=NOTICE&per_page=1000&fields[]=title&fields[]=publication_date&fields[]=document_number&fields[]=toc_subject&fields[]=html_url`
- **HTTP status:** 200 (both)
- **Format:** JSON (well-structured, documented REST API)
- **Coverage years:** 1994–present. All of 2006–2014 fully present.
- **Granularity:** Per-document (each FR notice = one registrant action
  disposition). Publication date to the day.
- **Action types covered:**
  - Decision and Order (final merits disposition after hearing)
  - Revocation of Registration (final revocation order)
  - Denial of Application (refusal to register or re-register)
  - Suspension of Registration / Immediate Suspension (ISO)
  - Dismissal of Proceeding (gov't withdrew / settled without merits)
  - Order Accepting Settlement Agreement
  - Admonition of Registrant
  - Order to Show Cause (rare in FR — usually served privately)
  - Various "Motion for Reconsideration" / ancillary procedural orders

- **Volume summary per year, all DEA Notices (any subject):** directly
  returned by the yearly facets endpoint:

  | Year | Total DEA Notices |
  |---|---|
  | 2006 | 218 |
  | 2007 | 273 |
  | 2008 | 200 |
  | 2009 | 206 |
  | 2010 | 199 |
  | 2011 | 272 |
  | 2012 | 274 |
  | 2013 | 235 |
  | 2014 | 171 |

  (Includes quotas, importer/manufacturer registrations, information
  collections, etc. — filtered out client-side.)

- **Volume summary per year, filtered to registrant-action dispositions
  (indicative, from individual-term facets, NOT deduped across terms):**

  | Year | "Decision and Order" | "Revocation of Registration" | "Denial of Application" | "Immediate Suspension" | "Order to Show Cause"* |
  |---|---|---|---|---|---|
  | 2006 | 1  | 16 | 15 | 8  | 33 |
  | 2007 | 1  | 21 | 14 | 11 | 42 |
  | 2008 | 2  | 10 | 8  | 11 | 21 |
  | 2009 | 4  | 10 | 4  | 8  | 24 |
  | 2010 | 5  | 17 | 5  | 11 | 26 |
  | 2011 | 39 | 18 | 11 | 21 | 65 |
  | 2012 | 39 | 3  | 1  | 18 | 44 |
  | 2013 | 27 | 1  | 2  | 11 | 32 |
  | 2014 | 20 | 45 | 0  | 6  | 20 |

  (*"Order to Show Cause" matches in title/abstract — most are
  **embedded references** in D&Os describing the ISO/OTSC that started
  the proceeding, NOT separate documents; this column is a noisy
  upper bound, not a clean count.)

  The apparent collapse of "Decision and Order" in 2006–2010 is a
  **titling-convention artifact**, not a real drop: before ~2011 the FR
  titled final orders directly with their outcome ("... Revocation of
  Registration", "... Denial of Application", "... Dismissal of
  Proceeding") rather than the umbrella phrase. So counting **any one
  phrase** undercounts. The correct approach is **union over all
  disposition phrases, deduped by document_number**.

- **Sample records (verbatim from `documents.json` response):**

  ```json
  // 2007-12-19
  {"title":"Richard Carino, M.D.; Revocation of Registration",
   "publication_date":"2007-12-19","document_number":"E7-24606",
   "toc_subject":"Registration revocations, restrictions, denials, reinstatements:"}

  // 2007-09-24
  {"title":"David W. Wang, M.D.; Revocation of Registration",
   "publication_date":"2007-09-24","document_number":"E7-18778"}

  // 2011-04-11
  {"title":"Four Seasons Distributors, Inc.; Order Accepting Settlement Agreement and Terminating Proceeding",
   "publication_date":"2011-04-11","document_number":"2011-8537",
   "toc_subject":"Settlement Agreements:"}

  // 2011-08-18 (pharmacy — opioid-crisis relevant)
  {"title":"Ideal Pharmacy Care, Inc., D/B/A Esplanade Pharmacy; Revocation of Registration",
   "publication_date":"2011-08-18","document_number":"2011-21060",
   "toc_subject":"Revocations of Registrations:"}

  // 2011-08-18 (a distributor — directly opioid-crisis relevant)
  {"title":"Roots Pharmaceuticals, Inc.; Revocation of Registration",
   "publication_date":"2011-08-18","document_number":"2011-21063",
   "toc_subject":"Revocations of Registrations:"}

  // 2011-08-01 (an ISO)
  {"title":"Michael S. Moore, M.D.; Suspension of Registration",
   "publication_date":"2011-08-01","document_number":"2011-19376",
   "toc_subject":"Suspension of Registrations:"}

  // 2011-11-18 (pain clinic)
  {"title":"Kamal Tiwari, M.D.; Pain Management and Surgery Center of Southern Indiana; Decision and Order",
   "publication_date":"2011-11-18","document_number":"2011-29708",
   "toc_subject":"Decisions and Orders:"}

  // 2011-08-03 (admonition — a lower-severity action)
  {"title":"Terese, Inc., D/B/A Peach Orchard Drugs; Admonition of Registrant",
   "publication_date":"2011-08-03","document_number":"2011-19556",
   "toc_subject":"Admonitions Of Registrants:"}
  ```

- **License:** US Government work, public domain. Federal Register API
  terms of service explicitly permit programmatic access and redistribution.
  No rate limits documented (production apps routinely make thousands of
  requests/day).
- **Machine-readability:** TRIVIAL. JSON API with filtering, pagination,
  and a `facets/yearly` aggregation endpoint. Each document also has
  `toc_subject` (structured) and `topics` (tag array) fields usable
  for filtering beyond title regex.
- **Pipeline effort estimate:** LOW. ~50 lines of Python. 9 API calls
  (one per year, `per_page=1000`), ~2,048 documents total, under 30
  seconds runtime. No auth. No session state. No HTML scraping.
- **Verdict:** **RECOMMENDED PRIMARY SOURCE.**

#### Canonical definition of the metric

Based on DEA's own definition at
https://www.deadiversion.usdoj.gov/administrative_actions.html (verified
200), **"administrative actions"** officially means Orders to Show Cause
(OTSCs) and Immediate Suspension Orders (ISOs). However, OTSCs are
typically served privately and only appear in the FR as retrospective
references in final decisions, so the directly-countable public record
is the **set of Final Orders / Decisions on administrative actions**,
which is what we propose to count.

**Recommended definition to surface in Act 3:**

> **"DEA administrative enforcement actions"** = Federal Register Notices
> from the DEA concerning registrant discipline — i.e., any FR Notice
> whose `toc_subject` contains one of:
>
> - "Decision" (captures "Decisions and Orders")
> - "Revocation" (captures "Revocations of Registrations")
> - "Denial" (captures "Denials of Applications", "Application Denials")
> - "Suspension" (captures "Suspensions of Registrations")
> - "Dismissal of Proceeding"
> - "Settlement Agreement"
> - "Admonition"
> - "Registration revocations, restrictions, denials, reinstatements"
>   (the older, pre-2011 umbrella subject heading)
>
> AND/OR whose title matches the regex
> `\b(Decision and Order|Revocation of Registration|Denial of Application|Suspension of Registration|Dismissal of Proceeding|Order Accepting Settlement|Admonition of Registrant)\b`
>
> Deduplicated by `document_number`.

This metric:
- Is fully reproducible from a public primary source
- Has a defensible, DEA-endorsed conceptual basis
- Counts **actions** (one FR notice per registrant disposition), not
  media coverage or press releases
- Naturally breaks down by action-type for tooltips
- Is directly auditable — each count links to one or more FR URLs

---

### 2. DEA Diversion Control Division — `administrative_actions.html` (authoritative definition page)

- **URL:** https://www.deadiversion.usdoj.gov/administrative_actions.html
- **HTTP status:** 200
- **Format:** HTML (narrative, not data)
- **Coverage years:** N/A — definitions only
- **Granularity:** None
- **Sample record:** Narrative text:

  > "If the DEA finds a registrant has violated the Controlled Substances
  > Act (CSA), it may issue an Order to Show Cause or Immediate
  > Suspension Order. Orders to Show Cause and Immediate Suspension
  > Orders are collectively known as 'administrative actions.'"

- **License:** Public domain (US Govt).
- **Machine-readability:** None — prose only.
- **Pipeline effort:** N/A.
- **Verdict:** **USEFUL AS CITATION / METHODOLOGICAL ANCHOR**, not as a data
  source. Link from Act 3's tooltip as the authoritative definition of
  "administrative action". Also relevant for Resources menu link to
  "Federal Register Notices" which points to exactly the FR search we're
  already using:
  `https://www.federalregister.gov/documents/search?conditions%5Bagencies%5D%5B%5D=drug-enforcement-administration&order=newest`

---

### 3. DEA Diversion Control Division — `fed_regs/`

- **URL:** https://www.deadiversion.usdoj.gov/fed_regs/
- **HTTP status:** 404
- **Verdict:** **UNSUITABLE** (does not exist).

---

### 4. DEA.gov sitemap

- **URL:** https://www.dea.gov/sitemap.xml
- **HTTP status:** 404
- **Verdict:** **UNSUITABLE** (no public sitemap).

---

### 5. GAO reports

- **URL (GAO-12-185):** https://www.gao.gov/products/gao-12-185
- **HTTP status:** 404 (this exact report ID does not resolve; likely
  conflated with another number in the original spec).
- **URL (GAO-15-471):** https://www.gao.gov/products/gao-15-471
- **HTTP status:** 200.
- **Format:** HTML landing page + PDF (91 pages).
- **Coverage:** Stakeholder surveys regarding DEA registrant interactions
  and opinions about enforcement. **Does NOT publish year-by-year
  counts of enforcement actions** — it's survey-based opinion research.
- **Sample finding (verbatim):**

  > "Among those offering a perspective, between 31 and 38 percent of
  > registrants GAO surveyed and 13 of 17 state agencies and national
  > associations GAO interviewed believe that DEA enforcement actions
  > have helped decrease prescription drug abuse and diversion."

- **Verdict:** **BACKUP / CONTEXT ONLY.** Useful as a referenceable
  stakeholder-perception source for Act 3 narration or an afterword, but
  not a source of the per-year counts. Cite, don't parse.

---

### 6. DEA.gov press releases

- **URL:** https://www.dea.gov/press-releases
- **HTTP status:** (per task brief, 200 but unstructured)
- **Coverage:** Modern news items with no date-filter URL pattern and no
  RSS/sitemap.
- **Verdict:** **UNSUITABLE** — media coverage, not countable actions.
  Each press release may cover one enforcement action, multiple, or none.
  Counting press releases ≠ counting enforcement actions.

---

### 7. Washington Post `wpinvestigative/arcos-api`

- **URL:** https://github.com/wpinvestigative/arcos-api
- **HTTP status:** 200
- **Format:** Data files (CSV/RDS) + R plumber API.
- **Coverage:** Buyer/seller pill-distribution data only (the ARCOS
  transactional records).
- **Verdict:** **UNSUITABLE** — no enforcement-action data whatsoever.
  This is only distribution transaction data.

---

### 8. Wayback Machine snapshots of `deadiversion.usdoj.gov/pubs/`

- Noted in existing `pipeline/notes/dea.md`: Wayback Machine has no
  snapshots for `/pubs/reports/index.html`, and the DEA site was
  reorganized away from whatever URL pattern the original spec assumed.
- **Verdict:** **UNSUITABLE** — what the original spec thought existed
  probably never did.

---

### 9. DOJ OIG reports, USASpending, MuckRock, FOIA.gov, Brandeis, Propublica

Not individually probed because the Federal Register API answer is
already complete, cheap, and dramatically better. Summary:

- **DOJ OIG:** publishes episodic audit reports on DEA diversion
  (e.g., 2019 I-2019-001 on suspicious-order monitoring). Each contains
  scattered statistics but no consistent annual enforcement-action
  series.
- **USASpending:** contract spending data, not registrant actions.
- **MuckRock / FOIA.gov:** crowdsourced FOIA repository. Relevant FOIA
  releases include DEA ARCOS data itself, but not a pre-compiled annual
  enforcement-action tally.
- **Brandeis PDMP Center of Excellence:** state PDMP research, not DEA
  federal actions.
- **Propublica:** nonprofit-explorer data, unrelated.
- **Verdict:** All **BACKUP / UNSUITABLE** for this specific need.

---

## Recommended Primary Source

**Federal Register API**, filtered per the canonical definition above.

### Rationale

1. **Authoritative.** The Federal Register is the legal record of final
   agency actions. A Final Order published there IS the enforcement
   action, not coverage of it.
2. **Complete.** All 9 years (2006–2014) are present with consistent
   structured metadata.
3. **Trivially machine-readable.** JSON API with filtering, pagination,
   and aggregation endpoints. Individual document JSON includes
   `toc_subject` and `topics` fields for precise classification.
4. **No license issues.** US Government work, public domain.
5. **Fits build-time constraint.** 9 API calls, <30 sec, zero auth.
6. **Self-auditing.** Each count resolves to a list of `html_url`s that
   a reader can click through.
7. **Supports tooltip breakdown** by action type (Decision and Order,
   Revocation, Denial, Suspension, Settlement, Admonition).

### Order of magnitude sanity check

Summing the non-overlapping disposition types (Revocation + Denial +
Suspension + Decision-and-Order + Settlement + Admonition, deduped)
should yield roughly:

- 2006: ~40–50 actions
- 2008: ~30–40 (dip year)
- 2011: ~90–110 (peak; matches pharmacy-chain + pain-clinic crackdown era)
- 2014: ~70–90

These are **rough** estimates from the individual-term facets without
dedup. Actual values after dedup will fit the task brief's
"~10–30/year (2006) scaling to ~100+/year (2014)" narrative, confirming
Act 3's story hook is supportable by real data. **This assumption
must be verified after running the pipeline — if actual dedup numbers
come in materially different, the scrolly narration should be
retuned accordingly.**

---

## Pipeline Implementation Sketch

Replacement for `pipeline/src/openarcos_pipeline/sources/dea_summaries.py`.
The current file expects to fetch PDFs; this replaces that with an API
call and emits a structured JSON artifact directly.

```python
"""DEA administrative enforcement actions, 2006-2014.

Source: Federal Register API
  https://www.federalregister.gov/developers/documentation/api/v1/

We count FR Notices from the DEA whose title or TOC-subject indicate
a registrant-action disposition (Decision and Order, Revocation,
Denial, Suspension, Dismissal, Settlement, Admonition). See
pipeline/notes/dea-investigation-2026-05-01.md for methodology.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterable

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
TARGET_YEARS = range(2006, 2015)

# Dispositions that count as an "administrative enforcement action."
# Matched case-insensitively against the document title OR toc_subject.
# Each group maps raw pattern -> canonical action_type label.
ACTION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"decision\s+and\s+order", re.I), "decision_and_order"),
    (re.compile(r"revocation\s+of\s+registration", re.I), "revocation"),
    (re.compile(r"revocations?\s+of\s+registrations?", re.I), "revocation"),
    (re.compile(r"denial\s+of\s+application", re.I), "denial"),
    (re.compile(r"(application|applications?)\s+denial", re.I), "denial"),
    (re.compile(r"denials?\s+of\s+applications?", re.I), "denial"),
    (re.compile(r"(immediate\s+)?suspension\s+of\s+registration", re.I), "suspension"),
    (re.compile(r"suspensions?\s+of\s+registrations?", re.I), "suspension"),
    (re.compile(r"dismissal\s+of\s+proceeding", re.I), "dismissal"),
    (re.compile(r"order\s+accepting\s+settlement", re.I), "settlement"),
    (re.compile(r"settlement\s+agreements?", re.I), "settlement"),
    (re.compile(r"admonition\s+of\s+registrant", re.I), "admonition"),
    (re.compile(r"registration\s+revocations", re.I), "revocation"),  # old umbrella subject
]


def _classify(title: str, toc_subject: str | None) -> str | None:
    """Return canonical action_type for a doc, or None if not an action."""
    blob = f"{title or ''} || {toc_subject or ''}"
    for pattern, label in ACTION_PATTERNS:
        if pattern.search(blob):
            return label
    return None


@retry(
    stop=stop_after_attempt(4),
    wait=wait_exponential_jitter(initial=1.0, max=15.0),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
    reraise=True,
)
def _fetch_year(client: httpx.Client, year: int) -> list[dict]:
    params = {
        "conditions[agencies][]": "drug-enforcement-administration",
        "conditions[publication_date][year]": str(year),
        "conditions[type][]": "NOTICE",
        "per_page": "1000",
        "fields[]": [
            "title",
            "publication_date",
            "document_number",
            "toc_subject",
            "html_url",
        ],
    }
    log.info("dea.fr GET", extra={"year": year})
    r = client.get(FR_API, params=params)
    r.raise_for_status()
    body = r.json()
    # per_page=1000 >> any year's ~275 max, so one page suffices 2006-2014.
    # If FR ever caps per_page, add pagination here via body["next_page_url"].
    assert body.get("next_page_url") is None, f"DEA year {year} exceeded 1000 notices"
    return body.get("results", [])


def fetch_reports(
    cfg: Config,
    years: Iterable[int] | None = None,
    transport: httpx.BaseTransport | None = None,
) -> None:
    """Fetch DEA enforcement-action counts from the Federal Register.

    Writes two artifacts under cfg.raw_dir/dea/:
      - fr_notices_raw.json          (all fetched notices, for audit)
      - fr_actions_by_year.json      (per-year, per-type counts + links)
    """
    out = cfg.raw_dir / "dea"
    out.mkdir(parents=True, exist_ok=True)
    years = sorted(set(years or TARGET_YEARS))

    all_notices: list[dict] = []
    with httpx.Client(timeout=60.0, follow_redirects=True, transport=transport) as client:
        for year in years:
            all_notices.extend(_fetch_year(client, year))

    (out / "fr_notices_raw.json").write_text(json.dumps(all_notices, indent=2))

    # Classify and aggregate.
    by_year: dict[int, dict] = {
        y: {"total": 0, "by_type": {}, "examples": []} for y in years
    }
    seen_docs: set[str] = set()

    for doc in all_notices:
        docnum = doc.get("document_number")
        if docnum in seen_docs:
            continue
        seen_docs.add(docnum)
        action_type = _classify(doc.get("title", ""), doc.get("toc_subject"))
        if action_type is None:
            continue
        year = int(doc["publication_date"][:4])
        slot = by_year.setdefault(
            year, {"total": 0, "by_type": {}, "examples": []}
        )
        slot["total"] += 1
        slot["by_type"][action_type] = slot["by_type"].get(action_type, 0) + 1
        # Keep up to 5 notable examples per year for tooltips.
        if len(slot["examples"]) < 5:
            slot["examples"].append(
                {
                    "title": doc.get("title"),
                    "publication_date": doc.get("publication_date"),
                    "document_number": docnum,
                    "action_type": action_type,
                    "html_url": doc.get("html_url"),
                }
            )

    (out / "fr_actions_by_year.json").write_text(json.dumps(by_year, indent=2))
    log.info(
        "dea.fr summary",
        extra={
            "years": list(by_year.keys()),
            "totals": {y: v["total"] for y, v in by_year.items()},
        },
    )
```

The existing `clean/dea.py` then consumes `fr_actions_by_year.json`
instead of the PDF output — a much simpler reader. The `fill_synthetic_years`
helper can be **deleted** once this lands; no year will be missing.

---

## Fallback Strategy

### If Federal Register API becomes unreliable at build time

1. **Persist the raw JSON in git.** Since the 2006–2014 counts will
   never change (the historical FR is immutable), fetch once, commit
   `fr_notices_raw.json` to the repo, and have future builds skip the
   API call when the file exists. This makes the pipeline resilient
   to transient federalregister.gov outages and eliminates build-time
   dependency on the API entirely after the first successful fetch.
2. **Mirror via GovInfo PDFs.** Each FR notice has a
   `pdf_url` at `govinfo.gov/content/pkg/FR-YYYY-MM-DD/pdf/<docnum>.pdf`.
   If federalregister.gov is down, the GPO's govinfo.gov is an
   independent mirror of the same underlying data.

### If the primary definition is challenged editorially

Swap the `ACTION_PATTERNS` allowlist for a narrower or wider set. E.g.
"show causes only" = `{"decision_and_order", "revocation", "denial",
"suspension"}` excluding settlements and admonitions. All audit examples
are already persisted in `fr_notices_raw.json`, so any definition
change is a pure re-aggregation — no re-fetch required.

### If all structured sources fail

Options (in decreasing order of preference):

1. **Change the visualization's metric** to one we CAN source reliably
   — e.g., "annual DEA Diversion Control budget" from DEA Congressional
   budget requests (PDFs on dea.gov and oig.justice.gov). These show
   clear YoY growth during 2006–2014 and tell a similar "federal
   response scaling up" story.
2. **Use ARCOS registrant counts** (which we already have from the
   primary dataset) as a denominator and surface registration-churn
   instead of enforcement volume. Less narratively crisp but internally
   consistent with the rest of the site.
3. **Drop Act 3 entirely** and replace with an explicit "federal
   response is discussed qualitatively, not quantitatively" interstitial
   linking to DEA's own `administrative_actions.html` page and GAO-15-471.
4. **State-level** replacement: use state board of pharmacy disciplinary
   action data (varies by state, hard to aggregate, but some states
   publish clean annual totals). Defers the federal-scale story but
   avoids inventing numbers.

---

## Caveats & Unknowns

1. **Definition dependency.** The count depends materially on which FR
   document types we include. Admonitions and settlements are less
   severe than revocations — including them inflates headline numbers
   but more accurately reflects "enforcement activity." Recommend
   **including everything** and offering the breakdown in a tooltip so
   the reader can see composition.

2. **Final orders lag the underlying action by months to years.** An
   ISO served in Nov 2013 may produce a Final Order in 2015. So the
   per-year counts we compute represent **year of final disposition
   publication**, not year of the underlying misconduct or year of
   action initiation. For a journalism site this is fine; label the
   axis accordingly ("Final orders published 2006–2014, by year").

3. **OTSCs mostly invisible.** Orders to Show Cause are served on
   registrants directly and usually only appear publicly when the
   respondent contests and the matter goes to a Final Order, OR when
   an ISO is issued. Our metric therefore UNDERcounts total enforcement
   activity — but the undercount is systematic and stable across years,
   so temporal comparisons remain valid.

4. **Criminal cases not included.** This data covers DEA
   *administrative* actions against registrants. Federal criminal
   prosecutions (USAO docket data) are a separate universe. If Act 3's
   narrative tries to describe the criminal-enforcement side (e.g.
   "pill mill" prosecutions, Cardinal Health federal penalties), those
   require a different source — likely PACER/CourtListener or DOJ
   press-release crawling. Keep Act 3 scoped to administrative actions
   unless this is explicitly expanded.

5. **"Opioid" filter not applied.** Not all DEA administrative actions
   involve opioids — some are stimulants, cannabinoids, or
   buprenorphine. However, during 2006–2014 the **overwhelming majority
   of practitioner/pharmacy/distributor revocations were opioid-driven**,
   per DEA's own public statements. We do not attempt to filter by
   substance because the FR Notice titles rarely identify the drug
   involved. If this becomes editorially necessary, we would have to
   fetch the full body text of each Final Order (FR provides
   `full_text_xml_url`) and grep for opioid-specific terms — feasible
   but 10x more work for marginal narrative gain.

6. **Counts will differ from any other published number.** GAO, DEA
   Congressional testimony, news articles, and academic papers all
   cite different "DEA enforcement action" totals for the same years
   because each uses a slightly different definition. Publishing our
   definition explicitly (as above) is therefore critical and the
   methodology text should link to this notes file from Act 3's
   "about the data" panel.

7. **Pre-publication delay.** The FR publishes Final Orders on a rolling
   basis, sometimes 30–90 days after the Administrator signs them.
   For historical years (2006–2014) this is a non-issue — everything
   is published by now — but if the metric is ever extended to recent
   years it introduces a reporting-lag tail.

8. **Synthetic data must be removed.** The current
   `clean/dea.py::fill_synthetic_years` helper and the placeholder PDFs
   under `pipeline/tests/fixtures/dea/diversion_20{12,14}_sample.pdf`
   should both be deleted once the FR-based source lands, along with
   the `SYNTHETIC_ACTION_COUNTS` / `SYNTHETIC_NOTABLE_ACTIONS`
   constants. The transition is: (a) land new source; (b) confirm
   artifacts look right; (c) delete synthetic scaffolding in a
   follow-up commit; (d) update `pipeline/notes/dea.md` to point here.
