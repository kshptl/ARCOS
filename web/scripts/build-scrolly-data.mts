#!/usr/bin/env tsx
/**
 * Compose /public/data/scrolly-data.json from pipeline-emitted artifacts.
 * If a source artifact is missing (e.g. pipeline not run yet), the seed
 * fixture at public/data/scrolly-data.json is kept untouched.
 */
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parquetRead } from "hyparquet";

const AFTERMATH_FIPS = ["54059", "21195", "21119", "54047", "54011", "39145"] as const;
const AFTERMATH_LABELS: Record<(typeof AFTERMATH_FIPS)[number], { name: string; state: string }> = {
  "54059": { name: "Mingo County", state: "WV" },
  "21195": { name: "Pike County", state: "KY" },
  "21119": { name: "Knott County", state: "KY" },
  "54047": { name: "McDowell County", state: "WV" },
  "54011": { name: "Cabell County", state: "WV" },
  "39145": { name: "Scioto County", state: "OH" },
};

type StateShip = { state: string; year: number; pills: number; pills_per_capita: number };
type TopDist = { distributor: string; year: number; pills: number; share_pct: number };
type DEA = {
  year: number;
  action_count: number;
  by_type?: Record<string, number>;
  notable_actions: { title: string; url?: string }[];
};
type CountyMeta = { fips: string; name: string; state: string; pop: number };
type CDCRow = {
  fips: string;
  year: number;
  deaths: number | null;
  suppressed: boolean;
  unreliable: boolean;
};

export type Act4Point = CDCRow;
export type Act4County = { fips: string; name: string; state: string; points: Act4Point[] };

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJSON<T>(p: string): Promise<T | null> {
  if (!(await exists(p))) return null;
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw) as T;
}

function bufToArrayBuffer(buf: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

async function readCdcParquet(p: string): Promise<CDCRow[] | null> {
  if (!(await exists(p))) return null;
  const buf = await readFile(p);
  if (buf.byteLength === 0) return null;
  const file = bufToArrayBuffer(buf);
  const rows: CDCRow[] = [];
  await new Promise<void>((resolve, reject) => {
    parquetRead({
      file,
      rowFormat: "object",
      onComplete: (data: unknown) => {
        for (const row of data as Record<string, unknown>[]) {
          // Coerce BigInt → Number (year, deaths are Int64)
          const fips = String(row.fips);
          const year =
            typeof row.year === "bigint" ? Number(row.year) : (row.year as number);
          const rawDeaths = row.deaths;
          const deaths =
            rawDeaths === null || rawDeaths === undefined
              ? null
              : typeof rawDeaths === "bigint"
                ? Number(rawDeaths)
                : (rawDeaths as number);
          const suppressed = Boolean(row.suppressed);
          const unreliable = Boolean(row.unreliable);
          rows.push({ fips, year, deaths, suppressed, unreliable });
        }
        resolve();
      },
    }).catch(reject);
  });
  return rows;
}

function normalizeCdcRow(row: Record<string, unknown>): CDCRow {
  return {
    fips: String(row.fips ?? row.county_fips),
    year: Number(row.year),
    deaths: row.deaths === null || row.deaths === undefined ? null : Number(row.deaths),
    suppressed: Boolean(row.suppressed),
    unreliable: Boolean(row.unreliable),
  };
}

async function readCdcJson(p: string): Promise<CDCRow[] | null> {
  const raw = await readJSON<unknown>(p);
  if (raw === null) return null;
  let rows: unknown[] = [];
  if (Array.isArray(raw)) {
    rows = raw;
  } else if (Array.isArray((raw as { records?: unknown }).records)) {
    rows = (raw as { records: unknown[] }).records;
  }
  return rows.map((row) => normalizeCdcRow(row as Record<string, unknown>));
}

export async function readCdcRows(dataDir: string): Promise<CDCRow[] | null> {
  const json = await readCdcJson(path.join(dataDir, "cdc_county_overdose.json"));
  if (json !== null) return json;
  return readCdcParquet(path.join(dataDir, "cdc-overdose-by-county-year.parquet"));
}

function pickAct1(state: StateShip[]): {
  totalPills: number;
  yearly: { year: number; pills: number }[];
} {
  if (state.length === 0) return { totalPills: 0, yearly: [] };
  const byYear = new Map<number, number>();
  for (const row of state) {
    byYear.set(row.year, (byYear.get(row.year) ?? 0) + row.pills);
  }
  const yearly = Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, pills]) => ({ year, pills }));
  const total = yearly.reduce((sum, r) => sum + r.pills, 0);
  return { totalPills: total, yearly };
}

export type Act2Series = {
  distributor: string;
  sharesByYear: number[];
  emphasized: boolean;
};

export type Act2Output = {
  years: number[];
  series: Act2Series[];
  otherAggregate: { sharesByYear: number[] };
};

/**
 * Pivot per-year distributor shares into a multi-year chart shape.
 *
 * Strategy:
 *   - Extract a sorted list of every year seen in the input.
 *   - Build per-distributor shares indexed by that year list (missing → 0).
 *   - Pick the top-3 distributors by LAST year's share as the emphasized series.
 *   - Aggregate every non-emphasized distributor into `otherAggregate`
 *     (sum of remaining shares at each year — typically the long tail).
 */
export function buildAct2(top: TopDist[]): Act2Output {
  if (top.length === 0) {
    return { years: [], series: [], otherAggregate: { sharesByYear: [] } };
  }
  const years = Array.from(new Set(top.map((r) => r.year))).sort((a, b) => a - b);
  const distNames = Array.from(new Set(top.map((r) => r.distributor)));
  // Build: distributor → (year → share_pct)
  const shareLookup = new Map<string, Map<number, number>>();
  for (const r of top) {
    const m = shareLookup.get(r.distributor) ?? new Map<number, number>();
    m.set(r.year, r.share_pct);
    shareLookup.set(r.distributor, m);
  }
  const sharesByDistributor: { distributor: string; sharesByYear: number[] }[] = distNames.map(
    (distributor) => {
      const m = shareLookup.get(distributor) ?? new Map<number, number>();
      return { distributor, sharesByYear: years.map((y) => m.get(y) ?? 0) };
    },
  );
  const lastIdx = years.length - 1;
  const ranked = [...sharesByDistributor].sort(
    (a, b) => (b.sharesByYear[lastIdx] ?? 0) - (a.sharesByYear[lastIdx] ?? 0),
  );
  const topThree = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const series: Act2Series[] = topThree.map((s) => ({
    distributor: s.distributor,
    sharesByYear: s.sharesByYear,
    emphasized: true,
  }));
  const otherShares = years.map((_, i) =>
    rest.reduce((sum, s) => sum + (s.sharesByYear[i] ?? 0), 0),
  );
  return { years, series, otherAggregate: { sharesByYear: otherShares } };
}

function pickAct3(actions: DEA[]): { actions: DEA[] } {
  return { actions: actions.sort((a, b) => a.year - b.year) };
}

/**
 * Build the Act 4 aftermath counties list.
 *
 * For each aftermath FIPS, resolve human-readable name + state from
 * `county-metadata.json` and per-year CDC overdose `points`, preserving
 * suppression metadata. FIPS missing from
 * the metadata fall back to the built-in epicenter labels; FIPS missing from
 * the CDC data get an empty points array.
 */
export function buildAct4(
  meta: CountyMeta[] | null,
  cdc: CDCRow[] | null,
): { counties: Act4County[] } {
  const metaByFips = new Map<string, CountyMeta>();
  for (const m of meta ?? []) metaByFips.set(m.fips, m);
  const pointsByFips = new Map<string, Act4Point[]>();
  for (const r of cdc ?? []) {
    const arr = pointsByFips.get(r.fips) ?? [];
    arr.push(r);
    pointsByFips.set(r.fips, arr);
  }
  const counties: Act4County[] = AFTERMATH_FIPS.map((fips) => {
    const m = metaByFips.get(fips);
    const fallback = AFTERMATH_LABELS[fips];
    const raw = pointsByFips.get(fips) ?? [];
    // Deduplicate per-year entries (the CDC parquet may have duplicate
    // suppressed + unsuppressed rows for the same county-year) by keeping
    // the highest numeric value per year, then sort by year ascending.
    const byYear = new Map<number, Act4Point>();
    for (const row of raw) {
      const existing = byYear.get(row.year);
      if (existing === undefined || (row.deaths ?? -1) > (existing.deaths ?? -1)) {
        byYear.set(row.year, row);
      }
    }
    const points = Array.from(byYear.values())
      .sort((a, b) => a.year - b.year)
      .map((point) => ({
        year: point.year,
        deaths: point.deaths,
        suppressed: point.suppressed,
        unreliable: point.unreliable,
      }));
    return {
      fips,
      name: m?.name ?? fallback.name,
      state: m?.state ?? fallback.state,
      points,
    };
  });
  return { counties };
}

async function main() {
  const dataDir = path.join(process.cwd(), "public", "data");
  const state = await readJSON<StateShip[]>(path.join(dataDir, "state-shipments-by-year.json"));
  const top = await readJSON<TopDist[]>(path.join(dataDir, "top-distributors-by-year.json"));
  const dea = await readJSON<DEA[]>(path.join(dataDir, "dea-enforcement-actions.json"));
  const meta = await readJSON<CountyMeta[]>(path.join(dataDir, "county-metadata.json"));
  const cdc = await readCdcRows(dataDir);

  if (state === null || top === null || dea === null || state.length === 0) {
    console.log(
      "[build-scrolly] one or more upstream artifacts missing/empty; keeping existing scrolly-data.json",
    );
    return;
  }

  const out = {
    act1: pickAct1(state),
    act2: buildAct2(top),
    act3: pickAct3(dea),
    act4: buildAct4(meta, cdc),
  };
  await writeFile(path.join(dataDir, "scrolly-data.json"), JSON.stringify(out, null, 2));
  console.log(`[build-scrolly] wrote ${path.join(dataDir, "scrolly-data.json")}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
