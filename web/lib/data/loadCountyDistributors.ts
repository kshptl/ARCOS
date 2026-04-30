import fs from "node:fs/promises";
import path from "node:path";

export interface CountyDistributorRow {
  distributor: string;
  pills: number;
  share_pct: number;
}

let cache: Map<string, CountyDistributorRow[]> | null = null;

export function resetCountyDistributorsCache(): void {
  cache = null;
}

export async function loadCountyDistributors(fips: string): Promise<CountyDistributorRow[]> {
  if (!cache) {
    const file = path.resolve(process.cwd(), "public/data/county-distributors.json");
    try {
      const raw = await fs.readFile(file, "utf-8");
      const map = JSON.parse(raw) as Record<string, CountyDistributorRow[]>;
      cache = new Map(Object.entries(map));
    } catch {
      cache = new Map();
    }
  }
  return (cache.get(fips) ?? []).slice(0, 10);
}
