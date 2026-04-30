# WaPo ARCOS API — probe notes

**Probed on:** 2026-04-30
**Base URL:** https://arcos-api.ext.nile.works
**Auth:** `?key=WaPo` (public; per https://github.com/wpinvestigative/arcos-api README)
**Rate limit:** documented ~1 req/s; batch with 0.25s sleep.

## !! SYNTHETIC FIXTURE NOTICE !!

**The live API probe could NOT be executed in this environment** because
outbound network egress is blocked (DNS resolution fails for
`arcos-api.ext.nile.works`). Running `notebooks/01-wapo-api-probe.py`
yields `httpx.ConnectError: [Errno -2] Name or service not known`.

As documented in the plan's spike-handling rules, the fixtures under
`pipeline/tests/fixtures/wapo/` were **hand-authored** to match the
documented response shapes of the WaPo ARCOS API (R package
`arcos` by The Washington Post), not captured from a live response.

**Before the first production run**, a maintainer with network access
MUST re-run `notebooks/01-wapo-api-probe.py` and overwrite these
fixtures with real captured JSON, then re-run
`pytest tests/test_fetcher_hash.py` to regenerate hash signatures in
`tests/test_fetcher_hash.py`.

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
