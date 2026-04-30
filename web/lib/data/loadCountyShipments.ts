import fs from "node:fs/promises";
import path from "node:path";
import { readParquetRows } from "@/lib/data/parquet";
import { normalizeFips } from "@/lib/geo/fips";
import type { CountyShipmentsByYear } from "@/lib/data/schemas";

const DATA_PATH = path.join(process.cwd(), "public", "data", "county-shipments-by-year.parquet");

let cache: CountyShipmentsByYear[] | null = null;
let byFips: Map<string, CountyShipmentsByYear[]> | null = null;

export function resetCountyShipmentsCache(): void {
  cache = null;
  byFips = null;
}

export async function loadCountyShipments(): Promise<CountyShipmentsByYear[]> {
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
  cache = await readParquetRows<CountyShipmentsByYear>(buf);
  byFips = new Map();
  for (const row of cache) {
    const bucket = byFips.get(row.fips) ?? [];
    bucket.push(row);
    byFips.set(row.fips, bucket);
  }
  for (const arr of byFips.values()) arr.sort((a, b) => a.year - b.year);
  return cache;
}

export async function loadCountyShipmentsByFips(
  fips: string,
): Promise<CountyShipmentsByYear[]> {
  await loadCountyShipments();
  return byFips?.get(normalizeFips(fips)) ?? [];
}
