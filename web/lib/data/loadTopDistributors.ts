import fs from "node:fs/promises";
import path from "node:path";
import type { TopDistributorsByYear } from "@/lib/data/schemas";

const DATA_PATH = path.join(process.cwd(), "public", "data", "top-distributors-by-year.json");

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

export async function loadTopDistributorsByYear(): Promise<Map<number, TopDistributorsByYear[]>> {
  await loadTopDistributors();
  return byYear ?? new Map();
}
