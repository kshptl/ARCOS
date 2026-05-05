# CDC WONDER Web Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the real CDC WONDER county-year overdose artifact into the web app while preserving suppressed cells and unreliable-rate caveats.

**Architecture:** Add a web sync step that copies `pipeline/data/processed/cdc_county_overdose.json` into `web/public/data/`, then read that richer JSON from web loaders and scrolly-data builders. Act 4 and county pages render publishable counts as numbers, suppressed cells as `<10` or gaps, and never convert suppressed deaths to zero.

**Tech Stack:** Next.js 15 static export, React 19, TypeScript, Vitest, Testing Library, existing `tsx` build scripts, JSON artifacts validated against pipeline JSON Schema.

---

## File Structure

- `web/scripts/sync-cdc-overdose.mts`: copies the processed CDC JSON artifact from `pipeline/data/processed/` into `web/public/data/` before validation/build.
- `web/tests/unit/sync-cdc-overdose.test.ts`: tests copy behavior and missing-source fallback.
- `web/lib/data/schemas.ts`: extends CDC county-year types with rich WONDER fields.
- `web/lib/data/loadCDCOverdose.ts`: loads rich JSON first, normalizes `county_fips` to `fips`, and falls back to legacy parquet if JSON is absent.
- `web/tests/unit/loaders.test.ts`: verifies rich CDC loader metadata and `loadCountyBundle` propagation.
- `web/scripts/build-scrolly-data.mts`: reads rich CDC records for Act 4, preserves suppressed/null values, and updates the six highlighted counties.
- `web/tests/unit/build-scrolly-act4.test.ts`: verifies Act 4 output preserves per-year suppression metadata.
- `web/components/scrolly/scenes/Act4Aftermath.tsx`: draws sparklines with gaps and suppressed markers.
- `web/tests/unit/act4-aftermath.test.tsx`: verifies gaps, markers, endpoint labels, and no suppressed-as-zero behavior.
- `web/components/county/CountyOverdoseTrend.tsx`: new county-page overdose-count panel.
- `web/components/county/CountyOverdoseTrend.module.css`: minimal styling for the panel.
- `web/tests/unit/county-overdose-trend.test.tsx`: tests county-page overdose rendering.
- `web/app/county/[fips]/page.tsx`: places the overdose panel on county pages.
- `web/app/methodology/page.tsx`: updates public methodology copy for raw WONDER UI scrape, suppression, and unreliable-rate caveats.
- `web/tests/unit/methodology.test.tsx`: verifies the methodology copy.

---

### Task 1: Sync The Rich CDC JSON Artifact Into `web/public/data`

**Files:**
- Create: `web/scripts/sync-cdc-overdose.mts`
- Create: `web/tests/unit/sync-cdc-overdose.test.ts`
- Modify: `web/package.json`

- [ ] **Step 1: Write the failing test**

Create `web/tests/unit/sync-cdc-overdose.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncCDCOverdose } from "@/scripts/sync-cdc-overdose.mts";

let tmpDirs: string[] = [];

async function tempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "openarcos-cdc-sync-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tmpDirs = [];
});

describe("syncCDCOverdose", () => {
  it("copies pipeline processed JSON into the web public data directory", async () => {
    const root = await tempDir();
    const source = path.join(root, "pipeline", "data", "processed", "cdc_county_overdose.json");
    const dest = path.join(root, "web", "public", "data", "cdc_county_overdose.json");
    await mkdir(path.dirname(source), { recursive: true });
    await writeFile(
      source,
      JSON.stringify({ records: [{ county_fips: "54059", year: 2010, deaths: 14, suppressed: false }] }),
      { flag: "wx" },
    );

    await syncCDCOverdose({ rootDir: root });

    const copied = JSON.parse(await readFile(dest, "utf8"));
    expect(copied.records[0]).toMatchObject({ county_fips: "54059", deaths: 14 });
  });

  it("keeps the existing web artifact when the pipeline artifact is absent", async () => {
    const root = await tempDir();
    const dest = path.join(root, "web", "public", "data", "cdc_county_overdose.json");
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, JSON.stringify({ records: [{ county_fips: "21195", year: 2014 }] }), {
      flag: "wx",
    });

    const result = await syncCDCOverdose({ rootDir: root });

    expect(result.copied).toBe(false);
    const retained = JSON.parse(await readFile(dest, "utf8"));
    expect(retained.records[0].county_fips).toBe("21195");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd web && pnpm test -- sync-cdc-overdose.test.ts`

Expected: FAIL because `@/scripts/sync-cdc-overdose.mts` does not exist.

- [ ] **Step 3: Implement the sync script**

Create `web/scripts/sync-cdc-overdose.mts`:

```ts
#!/usr/bin/env tsx
import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface SyncCDCOverdoseOptions {
  rootDir?: string;
}

export interface SyncCDCOverdoseResult {
  copied: boolean;
  source: string;
  destination: string;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function syncCDCOverdose(
  options: SyncCDCOverdoseOptions = {},
): Promise<SyncCDCOverdoseResult> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = options.rootDir ?? path.resolve(here, "..", "..");
  const source = path.join(rootDir, "pipeline", "data", "processed", "cdc_county_overdose.json");
  const destination = path.join(rootDir, "web", "public", "data", "cdc_county_overdose.json");

  if (!(await exists(source))) {
    console.log(`[sync-cdc] missing ${source}; keeping existing public artifact`);
    return { copied: false, source, destination };
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  console.log(`[sync-cdc] copied ${source} → ${destination}`);
  return { copied: true, source, destination };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncCDCOverdose().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Add the prebuild script**

Modify `web/package.json` scripts:

```json
{
  "scripts": {
    "sync-cdc": "tsx scripts/sync-cdc-overdose.mts",
    "prebuild": "pnpm sync-cdc && pnpm validate-data && pnpm build-ranks && pnpm build-similar && pnpm build-scrolly && pnpm copy-us-atlas"
  }
}
```

Keep all existing script keys; only add `sync-cdc` and prepend it to `prebuild`.

- [ ] **Step 5: Run the test and script**

Run: `cd web && pnpm test -- sync-cdc-overdose.test.ts && pnpm sync-cdc`

Expected: tests PASS and `web/public/data/cdc_county_overdose.json` exists.

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/scripts/sync-cdc-overdose.mts web/tests/unit/sync-cdc-overdose.test.ts web/public/data/cdc_county_overdose.json
git commit -m "feat(web): sync CDC WONDER overdose artifact into public data"
```

---

### Task 2: Load Rich CDC Records In Web Data Loaders

**Files:**
- Modify: `web/lib/data/schemas.ts`
- Modify: `web/lib/data/loadCDCOverdose.ts`
- Modify: `web/tests/unit/loaders.test.ts`

- [ ] **Step 1: Write failing loader tests**

Add these imports to `web/tests/unit/loaders.test.ts`:

```ts
import {
  loadCDCOverdose,
  loadCDCOverdoseByFips,
  resetCDCOverdoseCache,
} from "@/lib/data/loadCDCOverdose";
```

Add this test block:

```ts
describe("loadCDCOverdose", () => {
  beforeEach(() => {
    resetCDCOverdoseCache();
    readFileMock.mockReset();
  });

  it("normalizes rich CDC JSON records and preserves suppression metadata", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        records: [
          {
            state_fips: "54",
            county_fips: "54059",
            county_name: "Mingo County, WV",
            year: 2010,
            deaths: 14,
            population: 26839,
            crude_rate: 52.2,
            crude_rate_lower_ci: null,
            crude_rate_upper_ci: null,
            suppressed: false,
            unreliable: true,
          },
          {
            state_fips: "54",
            county_fips: "54059",
            county_name: "Mingo County, WV",
            year: 2009,
            deaths: null,
            population: 26700,
            crude_rate: null,
            crude_rate_lower_ci: null,
            crude_rate_upper_ci: null,
            suppressed: true,
            unreliable: false,
          },
        ],
      }),
    );

    const rows = await loadCDCOverdose({ preferJson: true });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      fips: "54059",
      county_fips: "54059",
      year: 2010,
      deaths: 14,
      population: 26839,
      unreliable: true,
    });
    expect(rows[1]).toMatchObject({ deaths: null, suppressed: true });
  });

  it("groups rich CDC records by normalized FIPS", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        records: [{ county_fips: "54059", year: 2014, deaths: 25, suppressed: false }],
      }),
    );

    const rows = await loadCDCOverdoseByFips("54059", { preferJson: true });

    expect(rows).toEqual([
      expect.objectContaining({ fips: "54059", year: 2014, deaths: 25, suppressed: false }),
    ]);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd web && pnpm test -- loaders.test.ts`

Expected: FAIL because `loadCDCOverdose` does not accept options and does not read rich JSON.

- [ ] **Step 3: Extend CDC types**

Modify `web/lib/data/schemas.ts`:

```ts
export interface CDCOverdoseByCountyYear {
  fips: string;
  county_fips?: string;
  county_name?: string;
  state_fips?: string;
  year: number;
  deaths: number | null;
  population?: number;
  crude_rate?: number | null;
  crude_rate_lower_ci?: number | null;
  crude_rate_upper_ci?: number | null;
  suppressed: boolean;
  unreliable?: boolean;
}

export interface CDCCountyOverdoseArtifact {
  records: Array<Omit<CDCOverdoseByCountyYear, "fips"> & { county_fips: string }>;
  methodology?: string;
  source?: string;
  fetched_at?: string;
  totals?: Record<string, number>;
}
```

- [ ] **Step 4: Implement rich JSON loading with parquet fallback**

Modify `web/lib/data/loadCDCOverdose.ts` to include this structure:

```ts
import type { CDCCountyOverdoseArtifact, CDCOverdoseByCountyYear } from "@/lib/data/schemas";

const JSON_DATA_PATH = path.join(process.cwd(), "public", "data", "cdc_county_overdose.json");
const PARQUET_DATA_PATH = path.join(process.cwd(), "public", "data", "cdc-overdose-by-county-year.parquet");

export interface LoadCDCOverdoseOptions {
  preferJson?: boolean;
}

async function readRichJson(): Promise<CDCOverdoseByCountyYear[] | null> {
  try {
    const raw = await fs.readFile(JSON_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as CDCCountyOverdoseArtifact;
    return parsed.records.map((row) => ({
      ...row,
      fips: normalizeFips(row.county_fips),
      county_fips: normalizeFips(row.county_fips),
      unreliable: Boolean(row.unreliable),
    }));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function readLegacyParquet(): Promise<CDCOverdoseByCountyYear[]> {
  try {
    await fs.access(PARQUET_DATA_PATH);
  } catch {
    return [];
  }
  const buf = await fs.readFile(PARQUET_DATA_PATH);
  if (buf.byteLength === 0) return [];
  return readParquetRows<CDCOverdoseByCountyYear>(buf);
}

export async function loadCDCOverdose(
  _options: LoadCDCOverdoseOptions = {},
): Promise<CDCOverdoseByCountyYear[]> {
  if (cache) return cache;
  cache = (await readRichJson()) ?? (await readLegacyParquet());
  byFips = new Map();
  for (const row of cache) {
    const normalized = { ...row, fips: normalizeFips(row.fips) };
    const bucket = byFips.get(normalized.fips) ?? [];
    bucket.push(normalized);
    byFips.set(normalized.fips, bucket);
  }
  for (const arr of byFips.values()) arr.sort((a, b) => a.year - b.year);
  return cache;
}

export async function loadCDCOverdoseByFips(
  fips: string,
  options: LoadCDCOverdoseOptions = {},
): Promise<CDCOverdoseByCountyYear[]> {
  await loadCDCOverdose(options);
  return byFips?.get(normalizeFips(fips)) ?? [];
}
```

Preserve `resetCDCOverdoseCache`.

- [ ] **Step 5: Run tests**

Run: `cd web && pnpm test -- loaders.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/data/schemas.ts web/lib/data/loadCDCOverdose.ts web/tests/unit/loaders.test.ts
git commit -m "feat(web): load rich CDC WONDER overdose records"
```

---

### Task 3: Preserve Suppression Metadata In Act 4 Scrolly Data

**Files:**
- Modify: `web/scripts/build-scrolly-data.mts`
- Modify: `web/lib/data/loadScrollyData.ts`
- Modify: `web/lib/data/loadScrollyData.test.ts`
- Modify: `web/tests/unit/build-scrolly-act4.test.ts`

- [ ] **Step 1: Write failing tests for Act 4 data shape**

In `web/tests/unit/build-scrolly-act4.test.ts`, replace the suppressed-as-zero test with:

```ts
it("preserves suppressed Act 4 points instead of converting them to zero", () => {
  const cdc = [
    { fips: "54059", year: 2011, deaths: null, suppressed: true, unreliable: false },
    { fips: "54059", year: 2012, deaths: 18, suppressed: false, unreliable: true },
    { fips: "54059", year: 2013, deaths: 12, suppressed: false, unreliable: true },
  ];
  const { counties } = buildAct4(null, cdc);
  const mingo = counties.find((c) => c.fips === "54059");
  expect(mingo?.points).toEqual([
    { year: 2011, deaths: null, suppressed: true, unreliable: false },
    { year: 2012, deaths: 18, suppressed: false, unreliable: true },
    { year: 2013, deaths: 12, suppressed: false, unreliable: true },
  ]);
});
```

Replace the stable-order test expected FIPS with the six epicenter counties used by the CDC scrape sanity check:

```ts
expect(counties.map((c) => c.fips)).toEqual([
  "54059",
  "21195",
  "21119",
  "54047",
  "54011",
  "39145",
]);
```

Update `web/lib/data/loadScrollyData.test.ts` sample act4 shape:

```ts
act4: {
  counties: [
    {
      fips: "54059",
      name: "Mingo",
      state: "WV",
      points: [{ year: 2010, deaths: 14, suppressed: false, unreliable: true }],
    },
  ],
},
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `cd web && pnpm test -- build-scrolly-act4.test.ts loadScrollyData.test.ts`

Expected: FAIL because Act 4 still emits `deaths: number[]` and uses the old FIPS list.

- [ ] **Step 3: Update Act 4 types and builder**

Modify `web/scripts/build-scrolly-data.mts`:

```ts
const AFTERMATH_FIPS = ["54059", "21195", "21119", "54047", "54011", "39145"] as const;

type CDCRow = {
  fips?: string;
  county_fips?: string;
  year: number;
  deaths: number | null;
  suppressed: boolean;
  unreliable?: boolean;
};

export type Act4Point = {
  year: number;
  deaths: number | null;
  suppressed: boolean;
  unreliable: boolean;
};

export type Act4County = { fips: string; name: string; state: string; points: Act4Point[] };
```

Add rich JSON reader:

```ts
async function readCdcJson(p: string): Promise<CDCRow[] | null> {
  const artifact = await readJSON<{ records: Array<CDCRow & { county_fips: string }> }>(p);
  if (!artifact) return null;
  return artifact.records.map((r) => ({ ...r, fips: r.county_fips }));
}
```

Change `buildAct4` to dedupe by year without replacing suppression:

```ts
const pointsByFips = new Map<string, Act4Point[]>();
for (const r of cdc ?? []) {
  const fips = String(r.fips ?? r.county_fips ?? "");
  if (!fips) continue;
  const arr = pointsByFips.get(fips) ?? [];
  arr.push({
    year: r.year,
    deaths: r.deaths,
    suppressed: Boolean(r.suppressed),
    unreliable: Boolean(r.unreliable),
  });
  pointsByFips.set(fips, arr);
}

const byYear = new Map<number, Act4Point>();
for (const point of raw) {
  const prev = byYear.get(point.year);
  if (!prev || (prev.deaths ?? -1) < (point.deaths ?? -1)) byYear.set(point.year, point);
}
const points = Array.from(byYear.values()).sort((a, b) => a.year - b.year);
```

In `main`, prefer JSON before legacy parquet:

```ts
const cdc =
  (await readCdcJson(path.join(dataDir, "cdc_county_overdose.json"))) ??
  (await readCdcParquet(path.join(dataDir, "cdc-overdose-by-county-year.parquet")));
```

Modify `web/lib/data/loadScrollyData.ts`:

```ts
export type Act4Point = {
  year: number;
  deaths: number | null;
  suppressed: boolean;
  unreliable?: boolean;
};

export type ScrollyData = {
  act1: { totalPills: number; yearly: { year: number; pills: number }[] };
  act2: Act2Data;
  act3: { actions: DEAEnforcementAction[] };
  act4: { counties: { fips: string; name: string; state: string; points: Act4Point[] }[] };
};
```

- [ ] **Step 4: Run tests and build scrolly data**

Run: `cd web && pnpm test -- build-scrolly-act4.test.ts loadScrollyData.test.ts && pnpm build-scrolly`

Expected: tests PASS and `web/public/data/scrolly-data.json` Act 4 counties contain `points`, not `deaths`.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/build-scrolly-data.mts web/lib/data/loadScrollyData.ts web/lib/data/loadScrollyData.test.ts web/tests/unit/build-scrolly-act4.test.ts web/public/data/scrolly-data.json
git commit -m "feat(web): preserve CDC suppression metadata in Act 4 data"
```

---

### Task 4: Render Act 4 Sparklines With Gaps And Suppressed Markers

**Files:**
- Modify: `web/components/scrolly/scenes/Act4Aftermath.tsx`
- Modify: `web/tests/unit/act4-aftermath.test.tsx`

- [ ] **Step 1: Write failing component tests**

Update `COUNTIES` in `web/tests/unit/act4-aftermath.test.tsx` so each county has `points`:

```ts
const COUNTIES = [
  {
    fips: "54059",
    name: "Mingo",
    state: "WV",
    points: [
      { year: 2006, deaths: null, suppressed: true, unreliable: false },
      { year: 2007, deaths: 10, suppressed: false, unreliable: true },
      { year: 2008, deaths: 18, suppressed: false, unreliable: true },
      { year: 2009, deaths: null, suppressed: true, unreliable: false },
      { year: 2010, deaths: 14, suppressed: false, unreliable: true },
      { year: 2014, deaths: 25, suppressed: false, unreliable: false },
    ],
  },
  { fips: "21195", name: "Pike", state: "KY", points: [{ year: 2006, deaths: 15, suppressed: false, unreliable: true }, { year: 2014, deaths: 30, suppressed: false, unreliable: false }] },
  { fips: "21119", name: "Knott", state: "KY", points: [{ year: 2006, deaths: 11, suppressed: false, unreliable: true }, { year: 2014, deaths: null, suppressed: true, unreliable: false }] },
  { fips: "54047", name: "McDowell", state: "WV", points: [{ year: 2006, deaths: null, suppressed: true, unreliable: false }, { year: 2014, deaths: null, suppressed: true, unreliable: false }] },
  { fips: "54011", name: "Cabell", state: "WV", points: [{ year: 2006, deaths: 28, suppressed: false, unreliable: false }, { year: 2014, deaths: 50, suppressed: false, unreliable: false }] },
  { fips: "39145", name: "Scioto", state: "OH", points: [{ year: 2006, deaths: 23, suppressed: false, unreliable: false }, { year: 2014, deaths: 23, suppressed: false, unreliable: false }] },
];
```

Add tests:

```ts
it("renders suppressed Act 4 years as <10 endpoint labels when endpoints are suppressed", () => {
  render(<ScrollyProgressContext.Provider value={1}><Act4Aftermath counties={COUNTIES} /></ScrollyProgressContext.Provider>);
  const knott = screen.getByRole("link", { name: /Knott/i }).closest("figure")!;
  const labels = knott.querySelectorAll('[data-testid="spark-endpoint"]');
  expect(labels[1]?.textContent).toBe("<10");
});

it("marks suppressed years without drawing them as zero", () => {
  render(<ScrollyProgressContext.Provider value={1}><Act4Aftermath counties={COUNTIES} /></ScrollyProgressContext.Provider>);
  const markers = screen.getAllByTestId("spark-suppressed");
  expect(markers.length).toBeGreaterThan(0);
  expect(markers[0]).toHaveAttribute("aria-label", expect.stringMatching(/suppressed/i));
});

it("does not put suppressed years on the numeric sparkline path", () => {
  render(<ScrollyProgressContext.Provider value={1}><Act4Aftermath counties={COUNTIES} /></ScrollyProgressContext.Provider>);
  const mingo = screen.getByRole("link", { name: /Mingo/i }).closest("figure")!;
  const path = mingo.querySelector("path[data-testid='spark-line']") as SVGPathElement;
  expect(path.getAttribute("d")).toMatch(/M/);
  expect(path.getAttribute("d")).not.toContain("NaN");
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `cd web && pnpm test -- act4-aftermath.test.tsx`

Expected: FAIL because `Act4Aftermath` expects `deaths: number[]` and does not render suppressed markers.

- [ ] **Step 3: Implement suppressed-aware spark geometry**

Modify `web/components/scrolly/scenes/Act4Aftermath.tsx` types:

```ts
export interface Act4Point {
  year: number;
  deaths: number | null;
  suppressed: boolean;
  unreliable?: boolean;
}

export interface Act4County {
  fips: string;
  name: string;
  state: string;
  points: Act4Point[];
}
```

Replace numeric-value helpers with point-aware logic:

```ts
function formatPointValue(point: Act4Point | undefined): string {
  if (!point) return "—";
  if (point.suppressed || point.deaths === null) return "<10";
  return String(point.deaths);
}

function numericPoints(points: Act4Point[]) {
  return points.filter((p): p is Act4Point & { deaths: number } => p.deaths !== null && !p.suppressed);
}
```

Update `buildSpark` to accept `Act4Point[]`. Compute x from chronological index, y from numeric death counts, and build a path that starts a new `M` after suppressed gaps:

```ts
let drawing = false;
const commands: string[] = [];
for (let i = 0; i < points.length; i++) {
  const point = points[i]!;
  if (point.deaths === null || point.suppressed) {
    drawing = false;
    continue;
  }
  const px = i * step;
  const py = y(point.deaths);
  commands.push(`${drawing ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`);
  drawing = true;
}
```

Render suppressed markers:

```tsx
{c.points.map((point, pointIndex) => {
  if (!point.suppressed) return null;
  const x = c.points.length <= 1 ? SPARK_W / 2 : (pointIndex * SPARK_W) / (c.points.length - 1);
  return (
    <circle
      key={`${point.year}-suppressed`}
      data-testid="spark-suppressed"
      aria-label={`${c.name} ${point.year} count suppressed under 10 deaths`}
      cx={x}
      cy={SPARK_H - 4}
      r={2}
      fill="var(--ink-50)"
    />
  );
})}
```

When recomputing `spark.length`, only add segment length when two adjacent chronological points are both numeric and unsuppressed. Do not add distance across a suppressed year, because that would animate an invisible gap.

Use endpoint labels from the first and last chronological point:

```tsx
{spark && (
  <>
    <text data-testid="spark-endpoint" className={styles.multipleEndpoint} x={2} y={8} textAnchor="start">
      {formatPointValue(c.points[0])}
    </text>
    <text data-testid="spark-endpoint" className={styles.multipleEndpoint} x={SPARK_W - 2} y={8} textAnchor="end">
      {formatPointValue(c.points[c.points.length - 1])}
    </text>
  </>
)}
```

- [ ] **Step 4: Run tests**

Run: `cd web && pnpm test -- act4-aftermath.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/components/scrolly/scenes/Act4Aftermath.tsx web/tests/unit/act4-aftermath.test.tsx
git commit -m "feat(act4): render suppressed CDC years as gaps"
```

---

### Task 5: Add County-Page Overdose Trend Panel

**Files:**
- Create: `web/components/county/CountyOverdoseTrend.tsx`
- Create: `web/components/county/CountyOverdoseTrend.module.css`
- Create: `web/tests/unit/county-overdose-trend.test.tsx`
- Modify: `web/app/county/[fips]/page.tsx`

- [ ] **Step 1: Write failing component tests**

Create `web/tests/unit/county-overdose-trend.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountyOverdoseTrend } from "@/components/county/CountyOverdoseTrend";

const ROWS = [
  { fips: "54059", year: 2009, deaths: null, suppressed: true, unreliable: false },
  { fips: "54059", year: 2010, deaths: 14, suppressed: false, unreliable: true },
  { fips: "54059", year: 2014, deaths: 25, suppressed: false, unreliable: false },
];

describe("CountyOverdoseTrend", () => {
  it("renders publishable deaths and suppressed values distinctly", () => {
    render(<CountyOverdoseTrend countyName="Mingo County" rows={ROWS} />);

    expect(screen.getByText("2009")).toBeInTheDocument();
    expect(screen.getByText("<10")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("shows an unreliable-rate caveat when any row is unreliable", () => {
    render(<CountyOverdoseTrend countyName="Mingo County" rows={ROWS} />);

    expect(screen.getByText(/rates are flagged unreliable/i)).toBeInTheDocument();
  });

  it("does not call suppressed cells zero", () => {
    render(<CountyOverdoseTrend countyName="Mingo County" rows={ROWS} />);

    expect(screen.queryByText(/^0$/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd web && pnpm test -- county-overdose-trend.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component**

Create `web/components/county/CountyOverdoseTrend.tsx`:

```tsx
import type { CDCOverdoseByCountyYear } from "@/lib/data/schemas";
import styles from "./CountyOverdoseTrend.module.css";

function formatDeaths(row: CDCOverdoseByCountyYear): string {
  if (row.suppressed || row.deaths === null) return "<10";
  return row.deaths.toLocaleString("en-US");
}

export function CountyOverdoseTrend({
  countyName,
  rows,
}: {
  countyName: string;
  rows: CDCOverdoseByCountyYear[];
}) {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const hasUnreliable = sorted.some((row) => row.unreliable);

  if (sorted.length === 0) {
    return <p className={styles.empty}>No CDC WONDER overdose records are available for {countyName}.</p>;
  }

  return (
    <div className={styles.root}>
      <div className={styles.grid} aria-label={`Drug overdose deaths in ${countyName}, 2006 to 2014`}>
        {sorted.map((row) => (
          <div key={row.year} className={styles.cell} data-suppressed={row.suppressed || undefined}>
            <span className={styles.year}>{row.year}</span>
            <span className={styles.value}>{formatDeaths(row)}</span>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        Counts below 10 are suppressed by CDC/NCHS and shown as <strong>&lt;10</strong>, never as zero.
        {hasUnreliable ? " Counts of 10-20 are publishable, but CDC rates are flagged unreliable." : ""}
      </p>
    </div>
  );
}
```

Create `web/components/county/CountyOverdoseTrend.module.css`:

```css
.root {
  border: 1px solid color-mix(in oklab, var(--ink-20), transparent 35%);
  border-radius: 18px;
  padding: 1rem;
  background: color-mix(in oklab, var(--paper), transparent 4%);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(68px, 1fr));
  gap: 0.5rem;
}

.cell {
  display: grid;
  gap: 0.15rem;
  padding: 0.6rem;
  border-radius: 12px;
  background: color-mix(in oklab, var(--ink-10), transparent 55%);
}

.cell[data-suppressed="true"] {
  border: 1px dashed var(--ink-40);
}

.year {
  font-size: 0.72rem;
  color: var(--ink-60);
}

.value {
  font-weight: 700;
  font-size: 1.05rem;
}

.note,
.empty {
  margin: 0.75rem 0 0;
  color: var(--ink-70);
  font-size: 0.9rem;
}
```

- [ ] **Step 4: Place the panel on county pages**

Modify `web/app/county/[fips]/page.tsx` imports:

```ts
import { CountyOverdoseTrend } from "@/components/county/CountyOverdoseTrend";
```

Add a section after the shipment time-series section:

```tsx
<section className={styles.section}>
  <h2 className={styles.sectionTitle}>Overdose deaths, year by year</h2>
  <CountyOverdoseTrend countyName={meta.name} rows={bundle.overdose} />
</section>
```

- [ ] **Step 5: Run tests**

Run: `cd web && pnpm test -- county-overdose-trend.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/components/county/CountyOverdoseTrend.tsx web/components/county/CountyOverdoseTrend.module.css web/tests/unit/county-overdose-trend.test.tsx web/app/county/[fips]/page.tsx
git commit -m "feat(county): show CDC overdose trends with suppression caveats"
```

---

### Task 6: Update Methodology Copy And Run Full Web Verification

**Files:**
- Modify: `web/app/methodology/page.tsx`
- Create or modify: `web/tests/unit/methodology.test.tsx`

- [ ] **Step 1: Write failing methodology test**

If `web/tests/unit/methodology.test.tsx` does not exist, create it:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Methodology from "@/app/methodology/page";

describe("Methodology page", () => {
  it("documents CDC WONDER UI scrape, suppression, and unreliable-rate rules", () => {
    render(<Methodology />);

    expect(screen.getByText(/CDC WONDER Underlying Cause of Death/i)).toBeInTheDocument();
    expect(screen.getByText(/42 USC 242m\(d\)/i)).toBeInTheDocument();
    expect(screen.getByText(/counts of 9 or fewer/i)).toBeInTheDocument();
    expect(screen.getByText(/counts of 10-20/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd web && pnpm test -- methodology.test.tsx`

Expected: FAIL because the current methodology copy is too generic.

- [ ] **Step 3: Update methodology CDC copy**

Modify the CDC source `<dd>` in `web/app/methodology/page.tsx` to:

```tsx
<dt>CDC WONDER</dt>
<dd>
  County-year drug overdose deaths are scraped from the CDC WONDER Underlying Cause of Death
  1999-2020 interactive UI, one state/DC query at a time for 2006-2014. The query uses WONDER's
  Drug/Alcohol Induced Causes D1-D4 macro, covering ICD-10 X40-X44, X60-X64, X85, and Y10-Y14.
  Counts of 9 or fewer deaths are suppressed under 42 USC 242m(d), so the site renders those cells
  as <strong>&lt;10</strong> rather than exact values or zero. Counts of 10-20 remain publishable as
  raw deaths, but CDC flags their rates as statistically unreliable.
  <a href="https://wonder.cdc.gov/ucd-icd10.html">View at wonder.cdc.gov</a>.
</dd>
```

Modify the caveat list item to:

```tsx
<li>
  CDC suppression hides county-year death counts of 9 or fewer under 42 USC 242m(d). The map,
  county pages, and Act 4 sparklines show these as <strong>&lt;10</strong> or visual gaps, never as
  zero.
</li>
```

- [ ] **Step 4: Run targeted tests**

Run: `cd web && pnpm test -- methodology.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run full web verification**

Run: `cd web && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Expected: lint clean, typecheck clean, all tests pass, static build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/app/methodology/page.tsx web/tests/unit/methodology.test.tsx web/public/data/scrolly-data.json web/public/data/cdc_county_overdose.json
git commit -m "docs(web): document CDC WONDER suppression rules"
```

---

## Self-Review

- Spec coverage: the plan covers public artifact sync, rich loader metadata, Act 4 gaps/markers, county-page suppression handling, methodology copy, and full web verification.
- Red-flag scan: no unresolved gaps or vague test instructions remain.
- Type consistency: Act 4 uses `points` consistently across builder, loader, scrolly JSON, and component. CDC loader normalizes `county_fips` to `fips` while preserving the original field for consumers that need it.
