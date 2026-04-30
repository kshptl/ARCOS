import fs from "node:fs/promises";
import path from "node:path";
import type { CountyMetadata } from "@/lib/data/schemas";
import { normalizeFips } from "@/lib/geo/fips";

/**
 * Build-time loader for county-metadata.json. Reads directly from
 * public/data so that every route using generateStaticParams can iterate
 * all FIPS without a network round trip.
 */

const DATA_PATH = path.join(process.cwd(), "public", "data", "county-metadata.json");

let cache: CountyMetadata[] | null = null;
let byFips: Map<string, CountyMetadata> | null = null;

export function resetCountyMetaCache(): void {
  cache = null;
  byFips = null;
}

export async function loadCountyMeta(): Promise<CountyMetadata[]> {
  if (cache) return cache;
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const parsed = JSON.parse(raw) as CountyMetadata[];
  cache = parsed;
  byFips = new Map(parsed.map((c) => [c.fips, c]));
  return parsed;
}

export async function loadCountyMetaByFips(fips: string): Promise<CountyMetadata | null> {
  if (!cache) await loadCountyMeta();
  const key = normalizeFips(fips);
  return byFips?.get(key) ?? null;
}

export async function loadAllFips(): Promise<string[]> {
  const rows = await loadCountyMeta();
  return rows.map((r) => r.fips);
}
