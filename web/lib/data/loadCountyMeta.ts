import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CountyMetadata } from "./schemas";

let cache: CountyMetadata[] | null = null;

export function resetCountyMetaCache(): void {
  cache = null;
}

export async function loadCountyMeta(): Promise<CountyMetadata[]> {
  if (cache) return cache;
  const p = path.join(process.cwd(), "public", "data", "county-meta.json");
  try {
    const raw = await readFile(p, "utf8");
    cache = JSON.parse(raw) as CountyMetadata[];
    return cache;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cache = [];
      return cache;
    }
    throw err;
  }
}
