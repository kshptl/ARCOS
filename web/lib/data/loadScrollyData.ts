import { readFile as defaultReadFile } from "node:fs/promises";
import path from "node:path";
import type { DEAEnforcementAction } from "./schemas";

export type Act2Series = {
  distributor: string;
  sharesByYear: number[];
  emphasized: boolean;
};

export type Act2Data = {
  years: number[];
  series: Act2Series[];
  otherAggregate: { sharesByYear: number[] };
};

export type ScrollyData = {
  act1: { totalPills: number; yearly: { year: number; pills: number }[] };
  act2: Act2Data;
  act3: { actions: DEAEnforcementAction[] };
  act4: { counties: { fips: string; name: string; state: string; deaths: number[] }[] };
};

const EMPTY: ScrollyData = {
  act1: { totalPills: 0, yearly: [] },
  act2: { years: [], series: [], otherAggregate: { sharesByYear: [] } },
  act3: { actions: [] },
  act4: { counties: [] },
};

let cache: ScrollyData | null = null;

export function resetScrollyDataCache(): void {
  cache = null;
}

export interface LoadScrollyDataOptions {
  /** Injected for tests. Defaults to node:fs/promises readFile. */
  readFile?: (p: string, enc: BufferEncoding) => Promise<string>;
  /** Override cwd for tests. */
  cwd?: string;
}

export async function loadScrollyData(options: LoadScrollyDataOptions = {}): Promise<ScrollyData> {
  if (cache) return cache;
  const readFile =
    options.readFile ??
    (defaultReadFile as unknown as (p: string, enc: BufferEncoding) => Promise<string>);
  const cwd = options.cwd ?? process.cwd();
  const filepath = path.join(cwd, "public", "data", "scrolly-data.json");
  try {
    const raw = await readFile(filepath, "utf8");
    const parsed = JSON.parse(raw) as ScrollyData;
    cache = parsed;
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cache = EMPTY;
      return EMPTY;
    }
    throw err;
  }
}
