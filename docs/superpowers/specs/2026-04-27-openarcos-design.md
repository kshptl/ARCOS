# openarcos.org — Design Spec

- **Date**: 2026-04-27
- **Owner**: Kush Patel
- **Status**: Approved in brainstorm; ready for implementation planning
- **Domain**: openarcos.org (DNS on Cloudflare)
- **Repo root**: `/home/kush/ARCOS`

## 1. Purpose & audience

Build a visually striking web experience at openarcos.org that analyzes and displays the distribution of prescription opioids in America using three public datasets. The site is a portfolio piece demonstrating data-science, backend/data-engineering, and frontend skills, but it is designed for a **general-public / journalist audience** as the primary reader. Engineering depth is findable (methodology page, GitHub links, clean repo) but never in the way.

### Success criteria

- A first-time visitor understands the scale and arc of the story in under 60 seconds.
- A journalist can look up their county and share a page that renders well on social.
- A reviewing engineer can clone the repo, run `make all`, and produce a byte-identical site from raw data.
- Lighthouse ≥90 on Performance, Accessibility, Best Practices, SEO for `/`, `/explorer`, and a random `/county/[fips]`.
- WCAG AA compliance across the site.

### Non-goals (locked out of v1)

- User accounts / logins / saved views.
- Comments or any user-generated content.
- Real-time / live ingestion. Data is historical and rebuilt on a schedule.

Mobile is in scope as a first-class experience, not a degraded one.

## 2. Data

### Sources

| Source | What it gives us | Access | Coverage |
|--------|------------------|--------|----------|
| **Washington Post ARCOS aggregates** (`wpinvestigative/arcos-api`) | County-level and pharmacy-level oxycodone + hydrocodone shipment totals by year, distributor-level shipments | Public GitHub + CSV releases | 2006–2014 |
| **DEA reporting summaries** (Diversion Control annual reports, enforcement actions) | Enforcement-action counts, policy inflection dates, quotas | Public PDF / CSV | ~2000–present |
| **CDC WONDER** (underlying cause of death, drug-overdose ICD codes) | County-level drug-overdose deaths by year, with <10 suppression | Public query/export API | 1999–most recent year |

All three are public-record data. Attribution:
- Footer on every page credits WaPo, DEA, and CDC.
- `/methodology` page has full citation block with URLs and access dates.

### Thesis — 4-act narrative

1. **Scale**: 76 billion pills shipped; a few counties absorbed staggering per-capita doses.
2. **Distributors**: three companies (McKesson, Cardinal Health, AmerisourceBergen) shipped most of the pills.
3. **Enforcement**: shipments climbed for years despite DEA red flags; only fell after enforcement + state laws shifted.
4. **Aftermath**: pills shipped then don't stay on shelves; overdose deaths rose as shipments fell (shown as county-level correlation, not claimed causation).

### Guardrails on interpretation

- No causal overreach. The site shows volumes and correlations; it does not claim any specific distributor caused specific deaths.
- Every pull stat has a source footnote.
- Pharmacy-level data mirrors WaPo's framing (names + addresses are public record). No analysis implying individual wrongdoing beyond what the data directly shows.
- CDC-suppressed counties (<10 deaths) are visually distinct (hatched), not hidden. The suppression is itself part of the story.

## 3. System architecture

Two units, one build-time hand-off, no runtime backend.

```
┌─────────────────────────────────────┐        ┌───────────────────────────────────┐
│  /pipeline  (Python 3.12)           │        │  /web  (Next.js + TypeScript)     │
│                                     │        │                                   │
│  1. fetch   WaPo ARCOS aggregates   │        │  Build: reads /web/public/data/   │
│             DEA summary PDFs/CSVs   │        │         → SSG everything          │
│             CDC WONDER export       │        │  Runtime: static files on Vercel  │
│  2. clean   normalize schemas, FIPS │  →     │         + client JS (Deck.gl,     │
│  3. join    on FIPS + year          │ build  │           Observable Plot)        │
│  4. agg     DuckDB queries →        │        │                                   │
│             per-view slices         │        │  Routes: /, /explorer, /county/*, │
│  5. emit    Parquet (heavy) +       │        │          /methodology, /rankings, │
│             JSON (light) under      │        │          /about                   │
│             /web/public/data/       │        │                                   │
└─────────────────────────────────────┘        └───────────────────────────────────┘
        runs in CI (GitHub Actions)                     deploys to Vercel
        reproducible: `make build-data`                 `vercel deploy`
```

### Isolation & contracts

- **Pipeline knows nothing about React.** Its contract is: emit files under `/web/public/data/` matching the JSON Schemas in `/pipeline/schemas/`.
- **Web knows nothing about DuckDB or WONDER APIs.** Its contract is: fetch the emitted files, render.
- The emitted-file schemas are the single load-bearing interface. Both sides validate against them in CI; drift on either side fails CI.
- Either half can be rebuilt without touching the other.

### Hosting

- DNS: `openarcos.org` → Vercel (Cloudflare DNS, no Cloudflare proxy required).
- CI: GitHub Actions.
  - `ci.yml` — tests + typecheck + Lighthouse on every PR.
  - `build-data.yml` — manual trigger + weekly cron. Runs pipeline, commits regenerated `/web/public/data/` back to `main`.
  - `deploy.yml` — auto on push to `main`, via Vercel.
- Data artifacts live in the repo (no LFS). Total v1 payload ~20–30 MB; well within plain-git comfort.

### Approach choice

Approach **A (fully static, build-time ETL)** selected. The design is compatible with adding an edge search API later (approach B) without reshaping. DuckDB-WASM (approach C) is deferred to a potential v2 "lab" page.

## 4. /pipeline

### Layout

```
/pipeline
├── pyproject.toml              # uv or poetry; Python 3.12
├── Makefile                    # make fetch | clean | build | all
├── src/openarcos_pipeline/
│   ├── sources/
│   │   ├── wapo_arcos.py       # downloads from wpinvestigative/arcos-api
│   │   ├── dea_summaries.py    # scrapes DEA Diversion Control annuals
│   │   └── cdc_wonder.py       # CDC WONDER API client
│   ├── clean/                  # normalize + validate each source
│   ├── join.py                 # FIPS + year merges
│   ├── aggregate.py            # DuckDB queries per viewpoint
│   └── emit.py                 # writes Parquet + JSON to /web/public/data
├── schemas/                    # JSON Schema per emitted file
├── sql/                        # aggregation SQL, one file per viewpoint
├── tests/
│   ├── fixtures/               # 10-county sample of each source
│   ├── test_clean.py
│   ├── test_join.py
│   └── test_emit.py
└── notebooks/                  # exploratory Jupyter; not part of build
```

### Stages

Each stage is idempotent and caches its output under `data/` (git-ignored for raw, committed for emitted).

| Stage | Input | Output | Key tools |
|-------|-------|--------|-----------|
| fetch | HTTP | `data/raw/*.csv,*.pdf` | `httpx`, `pdfplumber` |
| clean | raw files | `data/clean/*.parquet` | `polars` |
| join | clean parquets | `data/joined/master.parquet` | DuckDB |
| aggregate | master | per-view slices in `data/agg/` | DuckDB (SQL in `sql/`) |
| emit | agg slices | `web/public/data/*.{json,parquet}` | `polars` + stdlib `json` |

### Emitted artifacts (the load-bearing contract)

| File | Shape | Approx size | Used by |
|------|-------|-------------|---------|
| `data/state-shipments-by-year.json` | `{state, year, pills, pills_per_capita}[]` | ~30 KB | Homepage Act 1, state choropleth |
| `data/county-shipments-by-year.parquet` | `{fips, year, pills, pills_per_capita}[]` | ~5–10 MB | Explorer, county pages |
| `data/county-metadata.json` | `{fips, name, state, pop}[]` | ~300 KB | Everywhere |
| `data/top-distributors-by-year.json` | `{distributor, year, pills, share_pct}[]` | ~50 KB | Act 2, rankings |
| `data/top-pharmacies.parquet` | `{pharmacy_id, name, address, fips, total_pills}[]` | ~2–5 MB | Rankings, county pages |
| `data/dea-enforcement-actions.json` | `{year, action_count, notable_actions[]}` | ~20 KB | Act 3 |
| `data/cdc-overdose-by-county-year.parquet` | `{fips, year, deaths, suppressed}[]` | ~3–5 MB | Act 4, county pages |
| `data/search-index.json` | single file; array of type-tagged items (county/city/zip/distributor/pharmacy) — UI partitions results by type for display | ~2–4 MB | Site-wide search |

Each file has a corresponding `/pipeline/schemas/<name>.schema.json`.

### Testing

- **Unit tests** on `clean/` and `join.py` using a 10-county fixture (e.g. Mingo WV, Norton VA) in `tests/fixtures/`.
- **Schema tests**: every emitted file validated against its JSON Schema.
- **Snapshot tests** on aggregation SQL: deterministic query outputs pinned as CSV; meaningful changes require conscious update.
- No live-source integration tests (rate limits, flakiness). Live fetches live in the `fetch` stage, run manually or on cron.

### Three watch-outs

1. **CDC suppression**: emit a `suppressed: true` flag rather than dropping the row. Frontend renders with a distinct pattern.
2. **Time coverage mismatch**: ARCOS 2006–2014, DEA ~2000+, CDC 1999–present. The joined master has sparse cells outside the ARCOS window. The narrative acknowledges this explicitly.
3. **Pharmacy-level framing**: mirror WaPo's treatment. Public-record volume only; no language implying individual wrongdoing.

## 5. /web

### Routes

| Route | Generation | Content |
|-------|------------|---------|
| `/` | SSG | 4-act scrolly narrative + handoff to explorer |
| `/explorer` | SSG | Full interactive map, filters, year slider, tooltips |
| `/county/[fips]` | SSG (×~3,100) | Per-county deep-dive |
| `/rankings` | SSG | Top distributors + top pharmacies (tabs) |
| `/methodology` | SSG | Sources, joins, caveats, licenses, links |
| `/about` | SSG | One page: what/why/who/contact |

All routes use `output: 'export'`-compatible patterns. No server routes. Search is client-side against `search-index.json`.

### Component tree

```
/web
├── app/
│   ├── layout.tsx
│   ├── page.tsx                      # homepage scrolly
│   ├── explorer/page.tsx
│   ├── county/[fips]/page.tsx        # + generateStaticParams
│   ├── rankings/page.tsx
│   ├── methodology/page.tsx
│   └── about/page.tsx
├── components/
│   ├── scrolly/
│   │   ├── ScrollyStage.tsx          # sticky canvas + trigger steps
│   │   ├── Step.tsx
│   │   └── useScrollProgress.ts
│   ├── map/
│   │   ├── ChoroplethMap.tsx         # Deck.gl-backed
│   │   ├── TimeSlider.tsx
│   │   └── layers/
│   ├── charts/
│   │   ├── TimeSeries.tsx
│   │   ├── Bar.tsx
│   │   ├── Slope.tsx
│   │   └── Sparkline.tsx
│   ├── search/
│   │   ├── SearchBox.tsx
│   │   └── useSearchIndex.ts
│   ├── ui/                           # typography, buttons, tooltips, pills
│   └── brand/                        # BigNumeral, Accent (Bold Poster primitives)
├── lib/
│   ├── data/                         # typed loaders
│   │   ├── schemas.ts                # TS types mirroring /pipeline/schemas
│   │   ├── loadCounty.ts
│   │   └── loadTimeseries.ts
│   ├── geo/                          # FIPS helpers, us-atlas TopoJSON
│   └── format/                       # number/date/percent formatters
├── public/
│   ├── data/                         # <-- pipeline writes here
│   ├── fonts/                        # self-hosted display faces
│   └── og/                           # static OG images (auto-gen in v2)
├── styles/
│   ├── tokens.css                    # colors, type scale, spacing
│   └── globals.css
├── next.config.mjs
└── tests/                            # Vitest + Playwright
```

### Scrolly composition

- `<ScrollyStage>` provides a sticky `<canvas>` via Deck.gl that persists across steps.
- `<Step>` children declare target **scenes**: keyframes of Deck.gl layer props (camera viewState, color scale, year, data filter, labels).
- A controller tweens between the current and next scene based on scroll progress (`0→1`) inside the active step, using `d3-interpolate` for numeric props and Deck.gl's built-in transitions for viewState.
- `prefers-reduced-motion` replaces tweens with discrete step-snap.

### Data flow at the web layer

- **Build time**: each page's loader in `lib/data/` reads the relevant Parquet/JSON, shapes it, feeds the component. Parquet is read with `parquetjs` in the Node build only; no Parquet reader is shipped to browsers except `hyparquet` on the explorer route (see below).
- **Client time**: pages ship only the shaped data they need.
  - `/` inlines its scrolly data (~1 MB total).
  - `/explorer` fetches `county-shipments-by-year.parquet` and reads it with `hyparquet`. Fallback: pre-aggregated JSON if Parquet loading proves fragile.
  - `/county/[fips]` has its per-county slice inlined at build time (~30 KB).
  - `/rankings` fetches `top-distributors-by-year.json` + paginated `top-pharmacies` slices.
  - `search-index.json` lazy-loads on first focus of the search box.

### Explorer contract

- Filters: year slider (range depends on metric), metric dropdown (*pills shipped* / *pills per capita* / *overdose deaths*), drug (oxycodone / hydrocodone / combined), geo level (auto: state zoomed out, county zoomed in).
- Click a county → routes to `/county/[fips]` (no modal; preserves deep-linking + SEO).
- URL state: every filter in query string (`?year=2012&metric=per_capita&drug=oxy`). Deep-linkable.
- Suppressed counties: hatched pattern; tooltip explains why.
- Keyboard: arrow keys advance the year slider. Counties are not individually focusable inside the WebGL canvas; instead, a collapsed "Browse counties" list beside the map is keyboard-navigable, linking out to each `/county/[fips]`.

### County deep-dive structure

Top to bottom:

1. **Hero**: county name, state, population. Giant numeral: total pills shipped 2006–2014. Secondary: peak pills-per-capita.
2. **Rank callouts** (3 cards): national rank for shipments; peer rank (counties within same population band); overdose-deaths rank.
3. **Time series**: county shipments vs state median vs national median, 2006–2014. Overdose deaths on secondary axis through most recent CDC year.
4. **Top distributors to this county** (bar chart, top 10).
5. **Top pharmacies in this county** (table: name, address, total pills, sparkline).
6. **Similar counties**: 3–4 cards linking to counties in the same state with nearest population.
7. **Methodology footer**.

### Rankings

Two leaderboards on one page with tabs.

- **Top distributors** 2006–2014 total: rank, name, pills, share, yearly sparkline. Clicking a row anchors to that distributor's line in Act 2's slope chart.
- **Top pharmacies** 2006–2014 total: rank, name, address, county (linked), pills, sparkline. Paginated (top 100 on page, "show more" fetches additional JSON).
- Dedicated `/distributor/[id]` pages are **v2**.

### Search

One component used in three places: homepage hero, global header, explorer filter.

- **Index** (`search-index.json`, ~2–4 MB, lazy-loaded):
  ```
  [
    { type: "county", fips, name, state, zips: [...], aliases: [...] },
    { type: "city", name, state, fips_of_county },
    { type: "zip", zip, fips_of_county },
    { type: "distributor", id, name },
    { type: "pharmacy", id, name, address, fips_of_county }
  ]
  ```
- **Lib**: `MiniSearch` (small bundle, good prefix search + ranking).
- **UI**: results grouped by type — **Places** (counties/cities/ZIPs), **Distributors**, **Pharmacies**. Max 5 per group. Keyboard navigable. Each result has a clear destination route.
- **First-load UX**: index loads on first focus; "Loading…" during; browser-cached for subsequent pages.

### Visual design (Bold Poster)

- **Display type**: Space Grotesk (free, self-hosted).
- **Body type**: Inter.
- **Numerics**: tabular figures everywhere stats are compared.
- **Palette**:
  - Canvas `#f5ecd7` (warm off-white) + ink `#1a1a1a`.
  - Accent-hot `#c23b20` (pills red — used sparingly).
  - Accent-cool `#2a5f7a` (overdose data).
  - Choropleth: viridis-like sequential, colorblind-safe, dark-to-warm.
- **Dark mode**: `/methodology` and `/about` flip dark (Editorial Dark feel); everything else light.

### Accessibility

- Charts ship with `aria-label` summary + `<details>` exposing underlying data as an HTML table.
- Map uses colorblind-safe ramp (not red→green); tooltips provide text equivalents.
- `prefers-reduced-motion` removes scroll-tied animation; content still readable.
- Keyboard: explorer slider + map + all links navigable. Focus rings visible.
- Alt text on every image; captions on every chart.

### Testing

- **Unit** (Vitest): data loaders, formatters, FIPS helpers.
- **Component** (Vitest + Testing Library): search, small charts, scrolly step logic.
- **E2E smoke** (Playwright): homepage loads, a11y scan on 3 pages, explorer interacts, random county renders.
- **Visual regression**: v2, not launch.

## 6. Narrative (the 4 acts, beat sheet)

### Act 1 — Scale: "76 billion pills"

- 1.1 Giant numeral `76,000,000,000` counts up. Low-opacity state choropleth behind.
- 1.2 Numeral collapses into a single bar; bars for 2006–2014 join in sequence. "Every year, more than the last — until it wasn't."
- 1.3 Bars morph into per-capita state choropleth. WV, KY, OK, NM light up. Camera dwells on e.g. Mingo County, WV — 203 pills per person per year.

### Act 2 — Distributors: "Three companies shipped most of them"

- 2.1 Slope chart of top 10 distributors 2006–2014; top 3 darkened (McKesson, Cardinal Health, AmerisourceBergen), rest ghosted.
- 2.2 Stacked-area market share over time with a pull-quote.
- 2.3 Map view: top distributors' shipment destinations glow per year; pharmacy points fade in for heaviest counties.

### Act 3 — Enforcement: "The red flags that didn't slow anything down"

- 3.1 National map + timeline ticks for DEA enforcement actions underneath. Shipments stay high; actions stay low.
- 3.2 Policy inflection zoom around 2012–2014 (Ensuring Patient Access Act 2016, state PMPs coming online). Shipments finally turn.
- 3.3 Map drains; side ticker shows national total dropping.

### Act 4 — Aftermath: "The pills are gone. The deaths are not."

- 4.1 Color scale switches from *pills shipped* to *overdose deaths*. Appalachia glows again.
- 4.2 Small-multiple grid of 6 heavy-shipment counties with two overlaid lines: shipments (warm) falling, overdose deaths (cool) rising.
- 4.3 Pull sentence + inline ZIP search CTA: **"See your county →"**.

Every pull stat has a `?` icon opening a tiny citation card.

## 7. Error handling, ops, launch

### Failure modes

| Failure | Where | Handling |
|---------|-------|----------|
| Upstream data source moves/breaks | pipeline `fetch/` | Pinned URL + content-hash check. Fail CI on break. Site still serves last good data (nothing live). Dated snapshots kept in `data/raw/`. |
| Schema drift in sources | pipeline `clean/` | JSON Schema validation at end of clean stage. Fail loudly with a diff. |
| Emitted-file schema drift vs web expectations | CI | `/web` build validates `public/data/*` against same `/pipeline/schemas/`. Either side drifting fails CI. |
| Parquet load failure in browser | `/explorer` | Fallback chain: Parquet → pre-aggregated JSON → error state + link to static national view. |
| Search index slow/fails to load | `SearchBox` | Skeleton → disabled state + message after 3s. `Cache-Control: public, immutable` means only first visit hits this. |
| No WebGL | `/explorer`, scrolly | Feature-detect. Fallback: static SVG choropleth for current year, no animation. |
| `prefers-reduced-motion` | scrolly | Snap-to-step; map still works. |
| Bad FIPS in URL | `/county/[fips]` | `notFound()` → 404 page with search box. |
| JS disabled | all pages | All SSG'd; content visible without JS. Interactivity is enhancement. |

Principle: **no runtime = no runtime errors**. Everything that can break breaks at build, loudly, in CI.

### Observability

- **Analytics**: Plausible (privacy-respecting, cookieless, GDPR-safe). Events: page view, explorer filter use, search submit, county page view. No PII.
- **Error reporting**: Sentry free tier. Errors only, not telemetry.
- **CI alerts**: GitHub Actions failure notifications on schema-drift / build-data failures.
- **Performance budget** in CI: Lighthouse CI on `/`, `/explorer`, random `/county/[fips]`. Fails PR if any score drops below 90.

### SEO

- County page titles: `"<County>, <ST> — ARCOS Opioid Data"`; meta description from county stats.
- OpenGraph + Twitter card images (static placeholders v1; auto-generated v2).
- Sitemap at `/sitemap.xml` (homepage + explorer + rankings + methodology + about + all county pages).
- Permissive `robots.txt`.
- Structured data: `Dataset` JSON-LD on methodology; `Article` on homepage.

### Security / legal

- No user data collected. No auth, no cookies (Plausible is cookieless), no PII, no GDPR/CCPA footprint.
- CSP header via Next.js config. `default-src self` plus explicit allows for Plausible + Sentry only.
- Code licensed MIT. Data follows upstream (ARCOS public record via FOIA; CDC public domain; DEA public).
- Site-wide footer attribution. Full citations + access dates on `/methodology`.

### Repo hygiene

- Root `README.md`: summary, screenshot, quickstart, architecture diagram, links to sub-READMEs.
- `/pipeline/README.md`: data sources, stages, adding a source, local run, tests.
- `/web/README.md`: routes, components, data contracts, a11y + perf budgets, local run.
- `CONTRIBUTING.md`: project norms even for a single-author repo.
- `LICENSE` (MIT).
- Pre-commit hooks: `ruff` for Python, `biome` for TS.
- GitHub Actions: `ci.yml` (PR gate), `build-data.yml` (manual + weekly cron), `deploy.yml` (Vercel on push to main).

### Launch checkpoints (timeline: build for craft)

Natural points where the site could go live even if not "done":

- **Alpha (internal)**: pipeline emits data; `/` has Act 1 only; `/explorer` works; `/county/[fips]` works for ~10 counties. Deployed to `dev.openarcos.org`. Private sanity check.
- **Soft launch**: all 4 acts, all counties, methodology. `openarcos.org` points here; don't announce yet.
- **Public launch**: rankings + search shipped; a11y audit passed; Lighthouse ≥90 everywhere. Announce (HN / LinkedIn / blog post).
- **v2 backlog**: social cards auto-gen, public API, DuckDB-WASM lab page, `/distributor/[id]` pages, richer "similar counties" via Census ACS, time-coverage extensions.

## 8. Out-of-scope (v2 or later)

- User accounts, comments, any read/write feature.
- Live / real-time data ingestion.
- Public API surface (`/api/*`).
- Social-card auto-generation.
- DuckDB-WASM browser-side querying.
- `/distributor/[id]` dedicated pages.
- "Similar counties" via k-NN over Census ACS demographics.
- Translations beyond English.

## 9. Open questions / risks

- **CDC WONDER API quirks**: the WONDER export has rate limits and an unusual query format. First pipeline milestone should prove `cdc_wonder.py` works end-to-end on a small slice before we commit to the county-year join.
- **Parquet in browser**: `hyparquet` is the plan, but we should validate it handles the ~10 MB county-shipments file well on mid-tier mobile. If not, fall back to JSON.
- **Font licensing**: confirm Space Grotesk + Inter self-host licenses before shipping public build.
- **Scroll-pinned Deck.gl polish**: highest-risk piece of engineering. Allocate time in phase 1 to validate the scrolly-stage pattern on a single act before committing to all four.
