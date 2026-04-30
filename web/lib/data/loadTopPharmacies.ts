import fs from "node:fs/promises";
import path from "node:path";
import { readParquetRows } from "@/lib/data/parquet";
import type { TopPharmacy } from "@/lib/data/schemas";
import { normalizeFips } from "@/lib/geo/fips";

const DATA_PATH = path.join(process.cwd(), "public", "data", "top-pharmacies.parquet");

let cache: TopPharmacy[] | null = null;
let byFips: Map<string, TopPharmacy[]> | null = null;

export function resetTopPharmaciesCache(): void {
  cache = null;
  byFips = null;
}

export async function loadTopPharmacies(): Promise<TopPharmacy[]> {
  if (cache) return cache;
  try {
    await fs.access(DATA_PATH);
  } catch {
    cache = [];
    byFips = new Map();
    return cache;
  }
  const buf = await fs.readFile(DATA_PATH);
  if (buf.byteLength === 0) {
    cache = [];
    byFips = new Map();
    return cache;
  }
  cache = await readParquetRows<TopPharmacy>(buf);
  byFips = new Map();
  for (const row of cache) {
    const bucket = byFips.get(row.fips) ?? [];
    bucket.push(row);
    byFips.set(row.fips, bucket);
  }
  for (const arr of byFips.values()) arr.sort((a, b) => b.total_pills - a.total_pills);
  return cache;
}

export async function loadTopPharmaciesByFips(fips: string): Promise<TopPharmacy[]> {
  await loadTopPharmacies();
  return byFips?.get(normalizeFips(fips)) ?? [];
}
