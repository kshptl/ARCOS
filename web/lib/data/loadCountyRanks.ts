import fs from "node:fs/promises";
import path from "node:path";

export interface CountyRanks {
  fips: string;
  national_rank: number;
  national_total: number;
  peer_rank: number;
  peer_size: number;
  overdose_rank: number | null;
  overdose_total: number;
}

let cache: Map<string, CountyRanks> | null = null;

export function resetCountyRanksCache(): void {
  cache = null;
}

async function ensureLoaded(): Promise<Map<string, CountyRanks>> {
  if (cache) return cache;
  const file = path.resolve(process.cwd(), "public/data/county-ranks.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    const rows = JSON.parse(raw) as CountyRanks[];
    cache = new Map(rows.map((r) => [r.fips, r]));
  } catch {
    cache = new Map();
  }
  return cache;
}

export async function loadCountyRanks(fips: string): Promise<CountyRanks> {
  const m = await ensureLoaded();
  return (
    m.get(fips) ?? {
      fips,
      national_rank: 0,
      national_total: 0,
      peer_rank: 0,
      peer_size: 0,
      overdose_rank: null,
      overdose_total: 0,
    }
  );
}
