import fs from "node:fs/promises";
import path from "node:path";
import { readParquetRows } from "@/lib/data/parquet";
import type { CDCOverdoseByCountyYear } from "@/lib/data/schemas";
import { normalizeFips } from "@/lib/geo/fips";

const DATA_PATH = path.join(process.cwd(), "public", "data", "cdc-overdose-by-county-year.parquet");

let cache: CDCOverdoseByCountyYear[] | null = null;
let byFips: Map<string, CDCOverdoseByCountyYear[]> | null = null;

export function resetCDCOverdoseCache(): void {
  cache = null;
  byFips = null;
}

export async function loadCDCOverdose(): Promise<CDCOverdoseByCountyYear[]> {
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
  cache = await readParquetRows<CDCOverdoseByCountyYear>(buf);
  byFips = new Map();
  for (const row of cache) {
    const bucket = byFips.get(row.fips) ?? [];
    bucket.push(row);
    byFips.set(row.fips, bucket);
  }
  for (const arr of byFips.values()) arr.sort((a, b) => a.year - b.year);
  return cache;
}

export async function loadCDCOverdoseByFips(fips: string): Promise<CDCOverdoseByCountyYear[]> {
  await loadCDCOverdose();
  return byFips?.get(normalizeFips(fips)) ?? [];
}
