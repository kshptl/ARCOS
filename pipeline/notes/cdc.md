# CDC WONDER D76 — probe notes

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

### Options for a maintainer

1. **Switch dataset**: The [NCHS restricted-use Multiple Cause of
   Death file](https://www.cdc.gov/nchs/nvss/mortality_public_use_data.htm)
   provides county-level data but requires a signed Data Use
   Agreement (RDC). Not compatible with an open-source automated
   pipeline.
2. **Pre-computed county data**: CDC publishes county-year drug-
   overdose mortality at
   <https://www.cdc.gov/drugoverdose/deaths/data.html> as static
   spreadsheets. Refetching these as Excel/CSV is trivial but gives
   a much coarser feature set (just counts, no ICD-code detail).
3. **State-level fallback**: Call the D76 API with `B_1=*None*` and
   download national totals by year only, join to state totals from
   another source. Loses the county fidelity that motivated this
   pipeline in the first place.
4. **Scrape the interactive web UI**: possible but brittle; CDC's
   session handling explicitly rate-limits non-authenticated browsers
   at 15-second intervals (observed 429 during our probing) and the
   T&C forbid automated UI scraping.

None of these are drop-in. Pick a path, then re-spec the source.

### Current fixture (SYNTHETIC)

- `tests/fixtures/cdc/wv_2012_2014_request.xml` — the attempted request
  body (will 500 live)
- `tests/fixtures/cdc/wv_2012_2014.xml` — **hand-authored synthetic**
  response matching the schema that the interactive UI produces:
  `<page><response><data-table><r><c l="Name County, ST (FIPS)"/>
  <c l="YYYY">count-or-Suppressed</c></r>...</data-table></response></page>`.
  This lets us develop `clean/cdc.py` without blocking on the D76
  parameter adjustments, but its production applicability depends on
  which of the options above the maintainers pick.

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

### Rate limit

The WONDER API enforces **15 seconds between consecutive requests**.
Observed response when violated:

> *"Request rate exceeded. To protect system resources, API/XML
>  requests must have at least 15 seconds between consecutive
>  requests."* (HTTP 429)

`cdc_wonder.py`'s tenacity retry with `wait_exponential_jitter(initial=2.0, max=30.0)`
can hit this; `initial=15.0, max=60.0` would be safer.

## Request body parameters (known-working set)

| Parameter | Meaning |
|---|---|
| `accept_datause_restrictions=true` | Required; agrees to WONDER terms |
| `B_1 = D76.V1-level3` | Group by year |
| `B_2 = D76.V1-level1` | Group by county |
| `F_D76.V1 = <year>` (repeat) | Year filter |
| `F_D76.V9 = <state-fips>` | State FIPS filter (2-digit) |
| `F_D76.V10 = *All*` | County (all) |
| `F_D76.V17 = X40..Y14` | ICD-10 underlying-cause filter for drug-related deaths |
| `O_rate_per = 100000` | Rate denominator (we ignore, use raw count) |
| `O_precision = 1` | Decimals |

The exact working XML envelope must be recorded from a real successful
submission; the set above is a scaffold.

## Response shape

- Root element: `<page ...>` containing `<response>` with `<data-table>`
- `<data-table>` has `<r>` rows, each with `<c>` cells keyed by `<c l="label">value</c>`
- Suppressed rows carry cell value `Suppressed` (literal string); we map these to `deaths=null, suppressed=true`
- Non-suppressed rows have integer counts

## Known quirks

- Data-use restrictions terms must be accepted with the literal string "true"
- Suppressed cells contain "Suppressed"; missing cells contain "Missing"
- Responses >30k rows require pagination via `V_D76.V1` year splits (do per-state, per-year if we trip the limit)
- Response can briefly return HTML on heavy load; retry with exponential backoff
- `B_1`/`B_2` must be listed in the correct variable order (State before County); our code orders year-then-county which may need flipping.

## Content hashes (SYNTHETIC, not production)

- `wv_2012_2014.xml`: sha256=f07c2fcfb5cdf69d4e774e7a41f939db3ef432cd1225c07172326412f60beaea
- `wv_2012_2014_request.xml`: sha256=acd8725b5b3bb6508881eca183b3531b2d2edeff56488a87fdd22eb99f604365

Regenerate via: `sha256sum pipeline/tests/fixtures/cdc/*.xml`
