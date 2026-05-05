import fs from "node:fs/promises";
import path from "node:path";
import { readParquetRows } from "@/lib/data/parquet";
import type { CDCCountyOverdoseArtifact, CDCOverdoseByCountyYear } from "@/lib/data/schemas";
import { normalizeFips } from "@/lib/geo/fips";

const JSON_DATA_PATH = path.join(process.cwd(), "public", "data", "cdc_county_overdose.json");
const PARQUET_DATA_PATH = path.join(
  process.cwd(),
  "public",
  "data",
  "cdc-overdose-by-county-year.parquet",
);

let cache: CDCOverdoseByCountyYear[] | null = null;
let byFips: Map<string, CDCOverdoseByCountyYear[]> | null = null;

export function resetCDCOverdoseCache(): void {
  cache = null;
  byFips = null;
}

export async function loadCDCOverdose(): Promise<CDCOverdoseByCountyYear[]> {
  if (cache) return cache;
  try {
    const json = await fs.readFile(JSON_DATA_PATH, "utf8");
    const artifact = JSON.parse(json) as CDCCountyOverdoseArtifact;
    cache = artifact.records.map((row) => ({
      ...row,
      fips: normalizeFips(row.county_fips ?? row.fips ?? ""),
    }));
    buildByFipsCache(cache);
    return cache;
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }

  try {
    await fs.access(PARQUET_DATA_PATH);
  } catch {
    cache = [];
    byFips = new Map();
    return cache;
  }
  const buf = await fs.readFile(PARQUET_DATA_PATH);
  if (buf.byteLength === 0) {
    cache = [];
    byFips = new Map();
    return cache;
  }
  cache = await readParquetRows<CDCOverdoseByCountyYear>(buf);
  buildByFipsCache(cache);
  return cache;
}

export async function loadCDCOverdoseByFips(fips: string): Promise<CDCOverdoseByCountyYear[]> {
  await loadCDCOverdose();
  return byFips?.get(normalizeFips(fips)) ?? [];
}

function buildByFipsCache(rows: CDCOverdoseByCountyYear[]): void {
  byFips = new Map();
  for (const row of rows) {
    const normalizedFips = normalizeFips(row.fips);
    if (row.fips !== normalizedFips) row.fips = normalizedFips;
    const bucket = byFips.get(normalizedFips) ?? [];
    bucket.push(row);
    byFips.set(normalizedFips, bucket);
  }
  for (const arr of byFips.values()) arr.sort((a, b) => a.year - b.year);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
