# CDC WONDER D76 Source Notes

## Current Source

The committed county-level overdose mortality artifact comes from CDC WONDER
Underlying Cause of Death 1999-2020 (`D76`) interactive UI TSV exports, not the
XML API. The scraper queries one state at a time for the fixed historical window
2006-2014 and caches the raw TSVs under `pipeline/data/raw/cdc/{FIPS}_{ST}.tsv`.

The processed artifact is `pipeline/data/processed/cdc_county_overdose.json`.
It is built by `openarcos_pipeline.aggregate_cdc` and validated by
`pipeline/schemas/cdc_county_overdose.schema.json`.

Refresh policy: the 2006-2014 story window is frozen. Refresh CDC data only by
running the manual Playwright workflow/scraper intentionally; do not refresh it
on every commit or as part of routine pipeline verification.

## Query Definition

- Dataset: CDC WONDER Underlying Cause of Death, 1999-2020.
- UI endpoint: `https://wonder.cdc.gov/ucd-icd10.html`.
- Export format: TSV, one state/DC query per file.
- Group by: State, County, Year.
- Years: 2006 through 2014.
- Geography: 50 states plus DC; territories excluded.
- Drug/alcohol-induced causes: WONDER macro D1-D4.
- Exact ICD-10 mapping: X40-X44, X60-X64, X85, Y10-Y14.

## Suppression And Reliability

Suppression follows 42 USC 242m(d): NCHS cannot publish cells with counts of 9
or fewer. The processed artifact stores these cells as `deaths=null` and
`suppressed=true`; consumers must render them as suppressed or `<10`, not impute
a number.

CDC flags rates based on counts of 20 or fewer as statistically unreliable. For
publishable counts of 10-20, the artifact retains the numeric `deaths` count and
sets `unreliable=true`; the rate fields remain nullable because the caveat is
about rate precision, not count availability.

## Investigation Log

- `pipeline/notes/cdc-investigation-2026-05-01.md`
- `pipeline/notes/cdc-investigation-2026-05-01-round2.md`

## XML API Probe Outcome

**Probed on:** 2026-04-30
**Endpoint:** `POST https://wonder.cdc.gov/controller/datarequest/D76`
**Content-Type:** `application/x-www-form-urlencoded` with a single field `request_xml` holding an XML body.

## Probe outcome — CRITICAL: API does not support county-level queries

The endpoint `POST https://wonder.cdc.gov/controller/datarequest/D76`
is reachable. Two probe attempts were made on 2026-04-30 with
increasingly complete request bodies.

### Attempt 1: minimal body (`notebooks/02-cdc-wonder-probe.py`)
→ HTTP 500 with errors about missing "button where found below
section #1" buttons and by-variable ordering.

### Attempt 2: full body with `V_D76.V9` enablement + corrected order
→ HTTP 500 with this **explicit CDC error message**:

> *"Only national data are available for this dataset when using the
>  WONDER web service. Please check that your query does not group
>  results by region, division, state, county or urbanization,
>  (B_1 through B_5), nor limit these location variables to any
>  specific values. For more information please contact CDC WONDER
>  customer support at cwus@cdc.gov or (888) 496-8347."*

The full 500-response XML is preserved at the bottom of this file.

**This is an architectural blocker, not a fixture problem.** The D76
dataset — *Underlying Cause of Death, 1999–present* — is accessible
**only at the national level** via the HTTP/XML API. The county-level
breakouts that the interactive web UI can render are intentionally
disabled for programmatic callers.

### Consequences for the pipeline

Our `cdc_wonder.py` → `build_request_xml(state_fips, years)` sets
`B_1=D76.V1-level3`, `B_2=D76.V1-level1`, `F_D76.V9=<fips>`. Both of
those trigger the "location variable" refusal. **Every live call
will return HTTP 500 with the message above.** No parameter tweaking
will change this — CDC deliberately blocks it.

### Live 500 response (for reference)

```xml
<?xml version="1.0"?>
<page>
<platform>prod</platform>
<title>Processing Error</title>
<message>Any by-variables picked from {0} need to appear in the order listed, and other by-variables can't come between them.</message>
<message>Location group by variables (B_1 through B_5) were found: D76.V9-level1</message>
<message>Selections were made to location variable D76.V9.</message>
<message>Only national data are available for this dataset when using the WONDER web service. Please check that your query does not group results by region, division, state, county or urbanization, (B_1 through B_5), nor limit these location variables to any specific values. For more information please contact CDC WONDER customer support at cwus@cdc.gov or (888) 496-8347.</message>
</page>
```

### XML API Rate Limit

The WONDER API enforces **15 seconds between consecutive requests**.
Observed response when violated:

> *"Request rate exceeded. To protect system resources, API/XML
>  requests must have at least 15 seconds between consecutive
>  requests."* (HTTP 429)

The historical XML client remains only to document the refused path. It is not
used to refresh the committed county-level TSV cache.

## TSV Response Shape

- Header columns include `State Code`, `County`, `County Code`, `Year`, `Deaths`, `Population`, and `Crude Rate`.
- Data rows end at the `---` metadata sentinel.
- Suppressed rows carry `Deaths=Suppressed`; they map to `deaths=null, suppressed=true`.
- Missing rows carry `Deaths=Missing`; they are omitted from the processed artifact.
- Non-suppressed rows have integer counts.

## Known quirks

- Data-use restrictions terms must be accepted with the literal string "true"
- TSV suppressed cells contain "Suppressed"; missing cells contain "Missing".
- Responses >30k rows require pagination via `V_D76.V1` year splits (do per-state, per-year if we trip the limit)
- Response can briefly return HTML on heavy load; retry with exponential backoff
- `B_1`/`B_2` must be listed in the correct variable order (State before County); our code orders year-then-county which may need flipping.
