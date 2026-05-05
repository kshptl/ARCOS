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

export interface LoadCDCOverdoseOptions {
  preferJson?: boolean;
}

interface CDCOverdoseCacheEntry {
  rows: CDCOverdoseByCountyYear[];
  byFips: Map<string, CDCOverdoseByCountyYear[]>;
}

let jsonFirstCache: CDCOverdoseCacheEntry | null = null;
let parquetOnlyCache: CDCOverdoseCacheEntry | null = null;

export function resetCDCOverdoseCache(): void {
  jsonFirstCache = null;
  parquetOnlyCache = null;
}

export async function loadCDCOverdose(
  options: LoadCDCOverdoseOptions = {},
): Promise<CDCOverdoseByCountyYear[]> {
  const preferJson = options.preferJson ?? true;
  const cache = preferJson ? jsonFirstCache : parquetOnlyCache;
  if (cache) return cache.rows;

  if (preferJson) {
    try {
      const json = await fs.readFile(JSON_DATA_PATH, "utf8");
      const artifact = JSON.parse(json) as CDCCountyOverdoseArtifact;
      jsonFirstCache = buildCache(artifact.records.map(normalizeJsonRecord));
      return jsonFirstCache.rows;
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }
  }

  try {
    await fs.access(PARQUET_DATA_PATH);
  } catch {
    const emptyCache = buildCache([]);
    if (preferJson) jsonFirstCache = emptyCache;
    else parquetOnlyCache = emptyCache;
    return emptyCache.rows;
  }
  const buf = await fs.readFile(PARQUET_DATA_PATH);
  if (buf.byteLength === 0) {
    const emptyCache = buildCache([]);
    if (preferJson) jsonFirstCache = emptyCache;
    else parquetOnlyCache = emptyCache;
    return emptyCache.rows;
  }
  const parquetCache = buildCache(await readParquetRows<CDCOverdoseByCountyYear>(buf));
  if (preferJson) jsonFirstCache = parquetCache;
  else parquetOnlyCache = parquetCache;
  return parquetCache.rows;
}

export async function loadCDCOverdoseByFips(
  fips: string,
  options: LoadCDCOverdoseOptions = {},
): Promise<CDCOverdoseByCountyYear[]> {
  await loadCDCOverdose(options);
  const cache = options.preferJson === false ? parquetOnlyCache : jsonFirstCache;
  return cache?.byFips.get(normalizeFips(fips)) ?? [];
}

function normalizeJsonRecord(
  row: CDCCountyOverdoseArtifact["records"][number],
): CDCOverdoseByCountyYear {
  const fips = normalizeFips(row.county_fips ?? row.fips ?? "");
  return {
    ...row,
    fips,
    county_fips: row.county_fips === undefined ? undefined : fips,
    unreliable: isUnreliable(row),
  };
}

function isUnreliable(row: CDCCountyOverdoseArtifact["records"][number]): boolean | undefined {
  if (!row.suppressed && row.deaths !== null && row.deaths !== undefined && row.deaths <= 20) {
    return true;
  }
  return row.unreliable;
}

function buildCache(rows: CDCOverdoseByCountyYear[]): CDCOverdoseCacheEntry {
  const byFips = new Map<string, CDCOverdoseByCountyYear[]>();
  for (const row of rows) {
    const normalizedFips = normalizeFips(row.fips);
    if (row.fips !== normalizedFips) row.fips = normalizedFips;
    const bucket = byFips.get(normalizedFips) ?? [];
    bucket.push(row);
    byFips.set(normalizedFips, bucket);
  }
  for (const arr of byFips.values()) arr.sort((a, b) => a.year - b.year);
  return { rows, byFips };
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
