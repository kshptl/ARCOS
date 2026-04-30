# WaPo ARCOS API — probe notes

**Probed on:** 2026-04-30
**Base URL:** https://arcos-api.ext.nile.works
**Auth:** `?key=WaPo` (public; per https://github.com/wpinvestigative/arcos-api README)
**Rate limit:** documented ~1 req/s; batch with 0.25s sleep.

## !! SYNTHETIC FIXTURE NOTICE — AND: API APPEARS OFFLINE !!

**The live API probe could NOT be executed in this environment** — and
independent DNS verification (Google DNS-over-HTTPS resolver at
`https://dns.google/resolve?name=arcos-api.ext.nile.works&type=A`)
confirms that the API host is **globally unreachable**, not just
blocked from this sandbox:

```
arcos-api.ext.nile.works.  CNAME  nile-alpine1-vulcanlbext-45415112.us-east-1.elb.amazonaws.com.
nile-alpine1-vulcanlbext-45415112.us-east-1.elb.amazonaws.com.  -> NXDOMAIN (Status 3)
```

The AWS ELB backing the WaPo ARCOS API has been deleted. The parent
domain `nile.works` has SOA records but no A records for
`arcos-api.ext.*`. This means **the API is currently down for all
callers** (as of 2026-04-30), not just this sandbox. It was last
observed working publicly around 2019–2021 per WaPo reporting, but
the public mirror is no longer being maintained by nile.works.

Consequences for the pipeline:
- `build-data.yml` CI that calls `WapoClient.county_raw(...)` will
  fail with `httpx.ConnectError` at the fetch step for every county.
- There is no known alternate HTTPS endpoint. The raw CSV data WaPo
  published (see <https://www.washingtonpost.com/graphics/2019/investigations/dea-pain-pill-database/#download-resources>)
  is still downloadable as per-year zipped TSVs from S3-backed
  `arcos.s3.amazonaws.com` URLs, but **the shape is totally different
  from the API response** — it's a 130GB raw transaction log, not the
  aggregated `/v1/county_raw` shape our fixtures match.
- Before any production run, the maintainers must choose between:
  (a) standing up a self-hosted copy of the `arcos-api` server
      (the repo provides `docker-compose up` per the README) and
      pointing `BASE_URL` at it, OR
  (b) switching the fetcher to consume the raw TSV release and
      re-implementing county aggregation ourselves (substantial
      new work; not just fixture regeneration).

Fixtures under `pipeline/tests/fixtures/wapo/` are **hand-authored**
to match the documented response shapes of the WaPo ARCOS API
(R package `arcos` by The Washington Post), not captured from a
live response. They remain useful for driving the downstream
clean/join/agg test suite but are NOT suitable for publishing as
openarcos.org artifacts.

**Before the first production run**, a maintainer MUST either
(a) stand up the self-hosted `arcos-api` Docker image and re-run
`notebooks/01-wapo-api-probe.py` against `http://localhost:8000`,
overwriting these fixtures, or (b) retarget to the raw TSV
release and rewrite the fetcher. Afterwards, re-run
`pytest tests/test_sources_wapo.py` to regenerate hashes.

Fixtures labelled as synthetic-representative; they MUST reproduce
the schema faithfully enough to drive the downstream clean/join/agg
pipeline tests.

## Endpoints we use

| Endpoint | Purpose | Response shape |
|---|---|---|
| `GET /v1/county_raw?state=ST&county=Name&key=WaPo` | county-year shipments | list of row-objects with `BUYER_STATE`, `BUYER_COUNTY`, `countyfips`, `year`, `DOSAGE_UNIT`, `population`, `dosage_unit_per_cap` |
| `GET /v1/combined_distributor_state_county?state=ST&county=Name&key=WaPo` | distributor totals | list of row-objects with `BUYER_STATE`, `BUYER_COUNTY`, `countyfips`, `REPORTER`, `year`, `DOSAGE_UNIT` |
| `GET /v1/pharmacy_raw?state=ST&county=Name&key=WaPo` | pharmacy totals | list of row-objects with `BUYER_NAME`, `BUYER_ADDRESS1`, `BUYER_CITY`, `BUYER_STATE`, `BUYER_COUNTY`, `countyfips`, `total_dosage_unit`, `years` |
| `GET /v1/county_list?state=ST&key=WaPo` | county enumeration for state | list of `{BUYER_STATE, BUYER_COUNTY, countyfips}` |

## Response fields (based on public R package docs + WaPo reporting)

- **county_raw**: one row per (county, year) containing total dosage units
  distributed to that county for the year, plus the per-capita rate and
  population estimate. Units are counted as pill-equivalent "dosage units".
- **combined_distributor_state_county**: one row per (county, year,
  distributor/REPORTER). `DOSAGE_UNIT` is the total for that triple.
- **pharmacy_raw**: one row per buyer pharmacy (DEA registrant) within the
  county, summed across the covered years. `total_dosage_unit` is the
  lifetime total over the ARCOS window.
- **county_list**: minimal stub returning FIPS+county pairs for enumeration.

## Known quirks (documented upstream + anticipated)

- `BUYER_COUNTY` is uppercase, no "COUNTY" suffix; Census metadata uses
  title case with "County" suffix — our `clean/wapo.py` will join on
  `countyfips` (5-digit string), not county name.
- `countyfips` is **already canonical 5-digit zero-padded**. No normalization
  needed but `normalize_fips` is still called to be defensive.
- State/county names must be URL-encoded for multiword counties (e.g.
  `Saint%20Louis`). Our fetch client will let httpx handle this.
- Empty counties (no shipments recorded) return `[]`, not a 404.
- The API is case-insensitive for `state=` but requires title-case for
  `county=` in practice; we lowercase internally then title-case at call site.

## Content hashes of recorded fixtures (SYNTHETIC)

These hashes pin the hand-authored fixtures so CI catches unintended edits:

- `county_2012_54059.json`: sha256=9f6491c5c8d0a3caab5350f8d231c59b189f6bfc8279a89804787a1695e03b55
- `distributors_54059.json`: sha256=7e27f386a01641218a5ef97d180acf2bb044eb5cc93053e5012cb6746b9a38f8
- `pharmacies_54059.json`: sha256=122020bf120c116bc3396b4152233969058d4f31b55d0dff101f7e9d04a1a284
- `county_list_wv.json`: sha256=bd63dc788ad929b7859baa4964377247c3ade03ac20b1a4d1150366a3d2a9dd0

Regenerate via: `sha256sum pipeline/tests/fixtures/wapo/*.json`

## 10-county fixture set (SYNTHETIC — Task 22)

The plan's Task 22 asks to record `/v1/county_raw` per county for:
Mingo WV (54059), Norton VA (51720), Cabell WV (54011), Logan WV (54045),
Boone WV (54005), Fayette WV (54019), Mercer WV (54055), Floyd KY (21071),
Pike KY (21195), Martin KY (21159).

These were also hand-generated for the same network-unavailable reason
described above, using a simple pattern (rising dosage-per-capita through
2011, declining post-DEA-actions through 2014). Populations are rough
Census estimates but the per-year dosage numbers are NOT actual WaPo data.

Files: `county_raw_{state}_{county}.json` in `tests/fixtures/wapo/`.

Downstream tests only assert structural properties (columns present,
non-negative pill counts, FIPS round-trip) so the fabricated numbers are
acceptable for exercising the pipeline. **Do not publish artifacts built
from these fixtures as real openarcos.org data.**
