# DEA Diversion enforcement-action source notes

**Current source:** Federal Register API, `federalregister.gov/api/v1/documents.json`.
**Primary investigation:** [`dea-investigation-2026-05-01.md`](./dea-investigation-2026-05-01.md).

## What we count

**"DEA administrative enforcement actions, 2006–2014"** =
Federal Register NOTICE documents published by the DEA whose title
or `toc_subject` matches a registrant-action disposition:

- Final Order Revocation of Registration (pre- and post-2011 titling)
- Immediate Suspension / Suspension of Registration / Affirmance of
  Suspension
- Order to Show Cause (rare in the FR; most are served privately)
- Order Accepting Settlement Agreement / Memorandum of Agreement
- Admonition of Registrant
- Denial of Application / Dismissal of Proceeding / Decisions and
  Orders (post-2011 umbrella titles) → `OTHER_REGISTRANT_ACTION`

Documents are **deduped by `document_number`**. Non-action notices —
controlled-substance scheduling, production quotas,
importer/manufacturer/bulk registrations, agency information
collections, public meetings — are classified `NON_ACTION` and
**excluded** from the count.

## Methodology notes

- Counts reflect **Federal Register publication date**, not the date
  of the underlying misconduct nor the date the OTSC/ISO was served.
  Final orders routinely lag ISOs by 6–24 months, so peaks in the
  published-actions series trail the peaks of the misconduct they
  punish.
- This is **administrative scope only**. Federal criminal
  prosecutions and DOJ civil settlements (the Cardinal / McKesson /
  AmerisourceBergen actions, for example) are governed by USAO /
  DOJ-Civil and live in a different universe of records. They are
  not counted here.
- The `opioid_relevant` flag on each classified record is
  best-effort (pharmacy / distributor / pain / drug-name keyword
  match in the title). It is **not used as a filter** — all
  registrant actions are counted — but it is surfaced in the raw
  audit file for downstream analysis.
- Counts will differ from any other published "DEA enforcement
  action" total (GAO testimony, DEA budget docs, news articles)
  because each uses a slightly different definition. Publishing the
  definition explicitly is the whole point.

## Files

Under `pipeline/data/`:

| Path | Committed? | Purpose |
|---|---|---|
| `raw/dea/fr_notices_<year>.json` | ✅ | Per-year raw API payload, one file per year 2006–2014. Audit-grade. |
| `raw/dea/fr_notices_all_classified.json` | ✅ | Every fetched notice with its classifier output (`action_type`, `opioid_relevant`). |
| `processed/dea_actions_by_year.json` | ✅ | Tooltip-ready per-year total + by-type breakdown + methodology + `fetched_at`. Validates against `schemas/dea-actions-by-year.schema.json`. |
| `clean/dea_enforcement.parquet` | ✗ (build output) | Per-year totals in the legacy shape consumed by `sql/dea_enforcement.sql`. |

## Pipeline entry points

- **Fetch:** `openarcos fetch --source dea` →
  `sources/dea_summaries.py::fetch_reports` → writes
  `data/raw/dea/fr_notices_<year>.json` per year.
- **Clean:** `openarcos clean` (or `openarcos all`) →
  `cli._run_clean` reads the raw JSONs, classifies every notice via
  `clean/dea.py::classify_notices`, aggregates via
  `aggregate_by_year`, writes the processed artifact + the
  parquet.
- **Emit:** `openarcos emit` →
  `emit.py::emit_dea_enforcement_json` writes
  `web/public/data/dea-enforcement-actions.json` (includes
  optional `by_type` breakdown).

## Schema

- `schemas/dea-enforcement-actions.schema.json` — consumer-facing
  per-year list. Required: `year`, `action_count`, `notable_actions`.
  Optional: `by_type` (map of ActionType → int).
- `schemas/dea-actions-by-year.schema.json` — processed audit
  artifact. Required: `years[]`, `methodology`, `source`,
  `fetched_at`.

## Historical context

Prior to 2026-05-01 this pipeline stage shipped **synthetic
placeholder data**: hand-authored PDF fixtures under
`pipeline/tests/fixtures/dea/diversion_20{12,14}_sample.pdf`, a
`SYNTHETIC_ACTION_COUNTS` constant, and a `fill_synthetic_years`
helper. All of that is removed; the source is now real and
reproducible. See the [investigation
notes](./dea-investigation-2026-05-01.md) for the candidate sources
considered and rejected.
