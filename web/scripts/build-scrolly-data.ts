#!/usr/bin/env tsx
/**
 * Compose /public/data/scrolly-data.json from pipeline-emitted artifacts.
 * If a source artifact is missing (e.g. pipeline not run yet), the seed
 * fixture at public/data/scrolly-data.json is kept untouched.
 */
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const AFTERMATH_FIPS = ["54059", "51720", "54011", "54045", "21071", "21195"] as const;

type StateShip = { state: string; year: number; pills: number; pills_per_capita: number };
type TopDist = { distributor: string; year: number; pills: number; share_pct: number };
type DEA = {
  year: number;
  action_count: number;
  notable_actions: { title: string; url?: string }[];
};

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
  const startYear = years[0]!;
  const endYear = years[years.length - 1]!;
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

async function main() {
  const dataDir = path.join(process.cwd(), "public", "data");
  const state = await readJSON<StateShip[]>(path.join(dataDir, "state-shipments-by-year.json"));
  const top = await readJSON<TopDist[]>(path.join(dataDir, "top-distributors-by-year.json"));
  const dea = await readJSON<DEA[]>(path.join(dataDir, "dea-enforcement-actions.json"));

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
    act4: {
      counties: AFTERMATH_FIPS.map((fips) => ({
        fips,
        name: fips,
        state: "",
        deaths: [],
      })),
    },
  };
  await writeFile(path.join(dataDir, "scrolly-data.json"), JSON.stringify(out, null, 2));
  console.log(`[build-scrolly] wrote ${path.join(dataDir, "scrolly-data.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
