# CDC WONDER Web Wiring Design

## Purpose

Expose the newly scraped CDC WONDER county-year overdose artifact in the web app without fabricating suppressed values. The UI should use raw WONDER death counts where CDC permits publication, preserve suppressed cells as unknown values, and explain the distinction between suppression and statistical unreliability.

## Source Artifact

The web app should consume `pipeline/data/processed/cdc_county_overdose.json`, generated from CDC WONDER Underlying Cause of Death 1999-2020 UI TSV exports for 2006-2014. Each record includes county FIPS, year, death count, population, crude rate, confidence interval fields when available, `suppressed`, and `unreliable`.

Suppressed cells represent CDC/NCHS counts of 9 or fewer deaths and must not be rendered as exact counts. Non-suppressed cells with counts from 10 through 20 may render the raw death count, but rates should carry an unreliable-rate caveat.

## Data Flow

The static build should transform the processed JSON into the web artifact format currently served from `web/public/data/`. Existing parquet loaders may remain for compatibility, but the richer JSON fields should be available to Act 4 and county-page components.

The Act 4 scrolly-data builder should stop replacing `null` or suppressed deaths with `0`. It should retain per-year points with `deaths: number | null`, `suppressed: boolean`, and `unreliable: boolean`, sorted by year for each highlighted county.

County-page loaders should preserve the same metadata so charts and explanatory copy can distinguish three cases: exact publishable count, suppressed count under 10, and missing data.

## UI Behavior

Act 4 sparklines should draw only between publishable numeric points. Suppressed years should be represented with a muted marker or gap, not as zero. Endpoint labels should show the numeric value when publishable and `<10` when the endpoint year is suppressed.

County pages should continue showing shipment charts as they do now. Overdose-related UI should use the richer CDC metadata where present and should never imply that a suppressed cell is zero. When a county-year count is suppressed, render `<10` or `suppressed` depending on available space. When `unreliable` is true, keep the raw count but add a concise caveat near rates or methodology text.

The methodology page should explain that counts of 9 or fewer are legally suppressed under 42 USC 242m(d), while counts of 10-20 are publishable but produce statistically unreliable rates under CDC rules.

## Testing

Unit tests should cover parsing/loading the richer CDC artifact, Act 4 sparkline gaps and endpoint labels for suppressed values, county-page handling of suppressed and unreliable rows, and the methodology copy. Existing tests that asserted suppressed deaths become zero should be updated to assert gaps or `<10` labels instead.

Build verification should run the normal web checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## Out of Scope

This design does not add interactive tooltips to Act 4, does not change the DEA Federal Register work, does not re-run the CDC scraper, and does not redesign explorer map color scales beyond preserving suppressed/null semantics already supported there.
