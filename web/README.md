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

Lighthouse CI (`.lighthouserc.json`) enforces, as errors:
- perf / a11y / best-practices / seo ≥ 0.9 on all 4 target URLs.
- LCP ≤ 2.5 s and CLS ≤ 0.1 on `/`.
- LCP ≤ 3.0 s on `/explorer` (looser due to client parquet fetch).
- TBT ≤ 300 ms on `/`.

Run locally:

```bash
pnpm build
pnpm dlx @lhci/cli@0.14.x autorun
```

## Troubleshooting

- **Scrolly tweens don't run** — check that the page is not inside an iframe
  with reduced-motion forced on. DevTools → Rendering → "Emulate CSS media
  feature prefers-reduced-motion: reduce" will simulate it; remove to re-enable.
- **Explorer parquet fetch fails** — check `public/data/county-shipments-by-year.parquet`
  is present. If the pipeline hasn't emitted it yet, the loader surfaces an
  error inside the boundary; the map still renders via the WebGL fallback
  county list.
