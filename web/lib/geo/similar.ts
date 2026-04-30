import fs from "node:fs/promises";
import path from "node:path";

export interface SimilarCountyRef {
  fips: string;
  name: string;
  state: string;
  pop: number;
  pills_total: number;
}

let cache: Map<string, SimilarCountyRef[]> | null = null;

export function resetSimilarCache(): void {
  cache = null;
}

export async function loadSimilarCounties(fips: string): Promise<SimilarCountyRef[]> {
  if (!cache) {
    const file = path.resolve(process.cwd(), "public/data/similar-counties.json");
    try {
      const raw = await fs.readFile(file, "utf-8");
      const map = JSON.parse(raw) as Record<string, SimilarCountyRef[]>;
      cache = new Map(Object.entries(map));
    } catch {
      cache = new Map();
    }
  }
  return cache.get(fips) ?? [];
}
