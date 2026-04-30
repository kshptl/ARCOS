#!/usr/bin/env tsx
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parquetRead } from "hyparquet";

interface CountyMetaRow {
  fips: string;
  name: string;
  state: string;
  pop: number;
}

interface ShipmentRow {
  fips: string;
  pills: number;
}

function bufToArrayBuffer(buf: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

function coerceBigInts(row: Record<string, unknown>): Record<string, unknown> {
  for (const key in row) {
    const value = row[key];
    if (typeof value === "bigint") row[key] = Number(value);
  }
  return row;
}

/**
 * Read parquet rows from an on-disk file. Missing/empty files yield [] (a
 * fresh checkout without pipeline output should still build). Parse errors
 * now propagate — the previous swallow-catch produced a similar-counties
 * artifact with zero pills_total for every peer (see commit history for C1).
 */
async function readParquet<T>(p: string): Promise<T[]> {
  let buf: Buffer;
  try {
    buf = await fs.readFile(p);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  if (buf.byteLength === 0) return [];
  const file = bufToArrayBuffer(buf);
  const rows: T[] = [];
  await new Promise<void>((resolve, reject) => {
    parquetRead({
      file,
      rowFormat: "object",
      onComplete: (data) => {
        for (const row of data as Record<string, unknown>[]) {
          rows.push(coerceBigInts(row) as T);
        }
        resolve();
      },
    }).catch(reject);
  });
  return rows;
}

async function main() {
  const root = path.resolve(process.cwd(), "public/data");
  const metaRaw = await fs.readFile(path.join(root, "county-metadata.json"), "utf-8");
  const meta: CountyMetaRow[] = JSON.parse(metaRaw);
  const shipments = await readParquet<ShipmentRow>(
    path.join(root, "county-shipments-by-year.parquet"),
  );
  const totals = new Map<string, number>();
  for (const r of shipments) {
    totals.set(r.fips, (totals.get(r.fips) ?? 0) + r.pills);
  }
  const byState = new Map<string, CountyMetaRow[]>();
  for (const m of meta) {
    const arr = byState.get(m.state) ?? [];
    arr.push(m);
    byState.set(m.state, arr);
  }
  const out: Record<
    string,
    Array<{ fips: string; name: string; state: string; pop: number; pills_total: number }>
  > = {};
  for (const m of meta) {
    const peers = (byState.get(m.state) ?? []).filter((p) => p.fips !== m.fips);
    peers.sort((a, b) => Math.abs(a.pop - m.pop) - Math.abs(b.pop - m.pop));
    out[m.fips] = peers.slice(0, 4).map((p) => ({
      fips: p.fips,
      name: p.name,
      state: p.state,
      pop: p.pop,
      pills_total: totals.get(p.fips) ?? 0,
    }));
  }
  await fs.writeFile(path.join(root, "similar-counties.json"), JSON.stringify(out));
  console.log(`wrote similar-counties.json for ${Object.keys(out).length} counties`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
