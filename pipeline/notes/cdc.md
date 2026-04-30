# CDC WONDER D76 — probe notes

**Probed on:** 2026-04-30
**Endpoint:** `POST https://wonder.cdc.gov/controller/datarequest/D76`
**Content-Type:** `application/x-www-form-urlencoded` with a single field `request_xml` holding an XML body.

## Probe outcome

The endpoint is reachable from this environment. However, the minimal
request body drafted from the spec (`notebooks/02-cdc-wonder-probe.py`)
returned HTTP 500 with an XML error envelope. Excerpts:

> Invalid 'Year/Month' codes were found: '2021'. ...
> Invalid 'States' codes were found: '48001-48063'. ...
> Any by-variables picked from [State, County] need to appear in the order listed,
> and other by-variables can't come between them.
> Age Adjusted Rates cannot be produced when the data is grouped by Age.

These errors are genuine — the D76 form has additional required buttons
(e.g. state/county "button where found below section #1") plus
ordering constraints on `B_1`/`B_2`. Resolving them reliably needs an
interactive session with the web form to capture a known-working URL.

Production use MUST iterate on the request body with a real browser
session to record a complete set of parameters. For now we have
captured:

- `tests/fixtures/cdc/wv_2012_2014_request.xml` — the attempted request body
- `tests/fixtures/cdc/wv_2012_2014.xml` — **hand-authored synthetic** response
  (NOT the 500 error we got live). It matches the documented D76 response
  schema: `<page><response><data-table><r><c l="Name County, ST (FIPS)"/>
  <c l="YEAR">count-or-Suppressed</c></r>...</data-table></response></page>`.
  This lets us develop `clean/cdc.py` without blocking on D76 body
  adjustments.

**Before the first production run**, a maintainer MUST:
1. Capture a known-working D76 request via the WONDER UI (export the
   "Send" URL / POST body from devtools).
2. Overwrite the probe script's `REQUEST_BODY` with the corrected params.
3. Re-run the probe and commit the real XML fixture.
4. Re-run `pytest tests/test_clean_cdc.py` to confirm downstream parsing
   still works against the real response.

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

- `wv_2012_2014.xml`: sha256=2ef8abf77c30a392def354158953298828406cc77d6cc24f242105e839440893
- `wv_2012_2014_request.xml`: sha256=acd8725b5b3bb6508881eca183b3531b2d2edeff56488a87fdd22eb99f604365

Regenerate via: `sha256sum pipeline/tests/fixtures/cdc/*.xml`
