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

const AFTERMATH_FIPS = ["54059", "51720", "54011", "54045", "21071", "21195"] as const;

type StateShip = { state: string; year: number; pills: number; pills_per_capita: number };
type TopDist = { distributor: string; year: number; pills: number; share_pct: number };
type DEA = {
  year: number;
  action_count: number;
  notable_actions: { title: string; url?: string }[];
};
type CountyMeta = { fips: string; name: string; state: string; pop: number };
type CDCRow = { fips: string; year: number; deaths: number | null; suppressed: boolean };

export type Act4County = { fips: string; name: string; state: string; deaths: number[] };

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
          rows.push({ fips, year, deaths, suppressed });
        }
        resolve();
      },
    }).catch(reject);
  });
  return rows;
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

function pickAct2(top: TopDist[]): {
  rows: { distributor: string; start: number; end: number; emphasized: boolean }[];
} {
  if (top.length === 0) return { rows: [] };
  const years = top.map((r) => r.year).sort((a, b) => a - b);
  const startYear = years[0];
  const endYear = years[years.length - 1];
  if (startYear === undefined || endYear === undefined) return { rows: [] };
  const dists = new Set(top.map((r) => r.distributor));
  const rows = Array.from(dists).map((distributor) => {
    const start =
      top.find((r) => r.distributor === distributor && r.year === startYear)?.share_pct ?? 0;
    const end =
      top.find((r) => r.distributor === distributor && r.year === endYear)?.share_pct ?? 0;
    return { distributor, start, end, emphasized: false };
  });
  rows.sort((a, b) => b.end - a.end);
  rows.slice(0, 3).forEach((r) => {
    r.emphasized = true;
  });
  return { rows };
}

function pickAct3(actions: DEA[]): { actions: DEA[] } {
  return { actions: actions.sort((a, b) => a.year - b.year) };
}

/**
 * Build the Act 4 aftermath counties list.
 *
 * For each aftermath FIPS, resolve human-readable name + state from
 * `county-metadata.json` and a per-year `deaths` array (suppressed rows → 0,
 * sorted ascending by year) from the CDC overdose parquet. FIPS missing from
 * the metadata fall back to `{ name: fips, state: "" }`; FIPS missing from
 * the CDC data get an empty deaths array.
 */
export function buildAct4(
  meta: CountyMeta[] | null,
  cdc: CDCRow[] | null,
): { counties: Act4County[] } {
  const metaByFips = new Map<string, CountyMeta>();
  for (const m of meta ?? []) metaByFips.set(m.fips, m);
  const deathsByFips = new Map<string, Array<{ year: number; deaths: number }>>();
  for (const r of cdc ?? []) {
    const arr = deathsByFips.get(r.fips) ?? [];
    // Replace suppressed/null with 0 so the Sparkline still has signal.
    arr.push({ year: r.year, deaths: r.deaths ?? 0 });
    deathsByFips.set(r.fips, arr);
  }
  const counties: Act4County[] = AFTERMATH_FIPS.map((fips) => {
    const m = metaByFips.get(fips);
    const raw = deathsByFips.get(fips) ?? [];
    // Deduplicate per-year entries (the CDC parquet may have duplicate
    // suppressed + unsuppressed rows for the same county-year) by keeping
    // the max value per year, then sort by year ascending.
    const byYear = new Map<number, number>();
    for (const row of raw) {
      byYear.set(row.year, Math.max(byYear.get(row.year) ?? 0, row.deaths));
    }
    const deaths = Array.from(byYear.entries())
      .sort(([a], [b]) => a - b)
      .map(([, d]) => d);
    return {
      fips,
      name: m?.name ?? fips,
      state: m?.state ?? "",
      deaths,
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
  const cdc = await readCdcParquet(path.join(dataDir, "cdc-overdose-by-county-year.parquet"));

  if (state === null || top === null || dea === null || state.length === 0) {
    console.log(
      "[build-scrolly] one or more upstream artifacts missing/empty; keeping existing scrolly-data.json",
    );
    return;
  }

  const out = {
    act1: pickAct1(state),
    act2: pickAct2(top),
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
