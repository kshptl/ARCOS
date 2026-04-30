import fs from "node:fs/promises";
import path from "node:path";
import { slugify } from "@/lib/format/slug";
import type { TopDistributorsByYear } from "@/lib/data/schemas";

const DATA_PATH = path.join(
  process.cwd(),
  "public",
  "data",
  "top-distributors-by-year.json",
);

let cache: TopDistributorsByYear[] | null = null;
let byYear: Map<number, TopDistributorsByYear[]> | null = null;

export function resetTopDistributorsCache(): void {
  cache = null;
  byYear = null;
}

export async function loadTopDistributors(): Promise<TopDistributorsByYear[]> {
  if (cache) return cache;
  const raw = await fs.readFile(DATA_PATH, "utf8");
  cache = JSON.parse(raw) as TopDistributorsByYear[];
  byYear = new Map();
  for (const row of cache) {
    const bucket = byYear.get(row.year) ?? [];
    bucket.push(row);
    byYear.set(row.year, bucket);
  }
  for (const arr of byYear.values()) arr.sort((a, b) => b.pills - a.pills);
  return cache;
}

export async function loadTopDistributorsByYear(): Promise<
  Map<number, TopDistributorsByYear[]>
> {
  await loadTopDistributors();
  return byYear ?? new Map();
}

export interface DistributorAggregate {
  distributor: string;
  slug: string;
  total_pills: number;
  share_pct_by_year: Array<{ year: number; share_pct: number; pills: number }>;
  mean_rank: number;
}

export async function loadDistributorsAggregated(): Promise<DistributorAggregate[]> {
  const all = await loadTopDistributors();
  const byName = new Map<string, TopDistributorsByYear[]>();
  for (const row of all) {
    const arr = byName.get(row.distributor) ?? [];
    arr.push(row);
    byName.set(row.distributor, arr);
  }
  const ranksByYear = new Map<number, Map<string, number>>();
  const grouped = new Map<number, TopDistributorsByYear[]>();
  for (const row of all) {
    const arr = grouped.get(row.year) ?? [];
    arr.push(row);
    grouped.set(row.year, arr);
  }
  for (const [year, rows] of grouped) {
    const sorted = [...rows].sort((a, b) => b.pills - a.pills);
    const m = new Map<string, number>();
    sorted.forEach((r, i) => m.set(r.distributor, i + 1));
    ranksByYear.set(year, m);
  }
  const out: DistributorAggregate[] = [];
  for (const [name, rows] of byName) {
    const total = rows.reduce((s, r) => s + r.pills, 0);
    const ranks = rows.map((r) => ranksByYear.get(r.year)?.get(name) ?? 99);
    const mean = ranks.reduce((s, r) => s + r, 0) / ranks.length;
    out.push({
      distributor: name,
      slug: slugify(name),
      total_pills: total,
      share_pct_by_year: rows
        .slice()
        .sort((a, b) => a.year - b.year)
        .map((r) => ({ year: r.year, share_pct: r.share_pct, pills: r.pills })),
      mean_rank: mean,
    });
  }
  return out.sort((a, b) => b.total_pills - a.total_pills);
}
