# openarcos-web

See `docs/superpowers/plans/2026-04-29-openarcos-web-core.md` for the plan
and `docs/superpowers/plans/2026-04-29-openarcos-web-interactive.md` for the
interactive layer.

## Quickstart

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # validates data + SSG export
pnpm test       # vitest
pnpm e2e        # playwright
```

## Explorer

`/explorer` renders a Deck.gl county choropleth powered by a client-side parquet fetch
of `/public/data/county-shipments-by-year.parquet` via `hyparquet`. A WebGL
feature-detect falls back to a static SVG choropleth with a keyboard-navigable
county list when WebGL is unavailable.

- URL state: `?year=2012&metric=pills` is the source of truth. All filter
  changes update the URL via `history.replaceState`; `popstate` re-parses.
- Metrics: `pills` (total), `pills_per_capita`, `deaths`.
- Keyboard: the slider advances ±1 year on arrow keys, ±3 on PageUp/PageDown,
  jumps to first/last on Home/End.

## Homepage scrolly

`/` is a 4-act scrolly narrative (Scale → Distributors → Enforcement →
Aftermath). Each act is a `<ScrollyStage>` region with:
- A sticky canvas that persists across sub-steps.
- A progress context (0–1) consumed by scenes to tween state.
- A `<details>` "Show data" fallback with the same numbers in a table.
- An `aria-label` summary so screen readers get the narrative without
  scrolling through animations.

Reduced motion: when `prefers-reduced-motion: reduce` matches, scenes render
at progress = 1 (end-state) and no tweening runs. See
`components/scrolly/useReducedMotion.ts`.

## Performance budget

Lighthouse CI (`.lighthouserc.json`) enforces, as errors, against a
3-run median on each URL:

- perf ≥ 0.75, a11y ≥ 0.95, best-practices ≥ 0.9, seo ≥ 0.9 on all 4 target URLs.
- `color-contrast` score = 1 (no AA violations) and `cumulative-layout-shift` ≤ 0.1 everywhere.
- LCP ≤ 5.5 s, TBT ≤ 500 ms on `/`, `/methodology`, `/county/:fips`.
- LCP ≤ 7 s on `/explorer` (heavier: deck.gl + client parquet).

Thresholds are deliberately loose relative to production because
Lighthouse emulates a mid-tier mobile device with 4× CPU throttling;
Cloudflare Pages' CDN + real hardware will score materially higher. The asserts
exist to catch regressions (a new heavy dep, a blocking script, a
contrast failure), not to prove we hit a specific end-user LCP.

Run locally:

```bash
pnpm build
# On macOS / Linux / GitHub Actions ubuntu-latest:
pnpm exec lhci autorun

# On WSL2, chrome-launcher misdetects the platform and writes garbage
# dirs into the project (literally `\\wsl.localhost\...\undefined\...`
# from an unset USERPROFILE regex); pin CHROME_PATH and TEMP:
CHROME_PATH=/opt/google/chrome/google-chrome TEMP=/tmp pnpm exec lhci autorun
# If junk directories appear anyway, clean with:
#   find . -maxdepth 1 -name '\\wsl.localhost*' -o -name 'undefined*' | xargs rm -rf
```

## Troubleshooting

- **Scrolly tweens don't run** — check that the page is not inside an iframe
  with reduced-motion forced on. DevTools → Rendering → "Emulate CSS media
  feature prefers-reduced-motion: reduce" will simulate it; remove to re-enable.
- **Explorer parquet fetch fails** — check `public/data/county-shipments-by-year.parquet`
  is present. If the pipeline hasn't emitted it yet, the loader surfaces an
  error inside the boundary; the map still renders via the WebGL fallback
  county list.
