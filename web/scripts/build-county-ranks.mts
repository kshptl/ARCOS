#!/usr/bin/env tsx
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parquetRead } from "hyparquet";

interface CountyShipmentRow {
  fips: string;
  year: number;
  pills: number;
  pills_per_capita: number;
}

interface CDCRow {
  fips: string;
  year: number;
  deaths: number | null;
  suppressed: boolean;
}

interface CountyMetaRow {
  fips: string;
  name: string;
  state: string;
  pop: number;
}

interface CountyRankRow {
  fips: string;
  national_rank: number;
  national_total: number;
  peer_rank: number;
  peer_size: number;
  overdose_rank: number | null;
  overdose_total: number;
}

function popBand(pop: number): string {
  if (pop < 10_000) return "<10k";
  if (pop < 50_000) return "10k-50k";
  if (pop < 250_000) return "50k-250k";
  if (pop < 1_000_000) return "250k-1m";
  return "1m+";
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
 * Read parquet rows from an on-disk file. Returns [] for missing/empty files
 * (so a fresh checkout without pipeline output still builds), but propagates
 * any other read/parse error — we previously swallowed those, which silently
 * produced a ranks file full of nulls (see commit history for C1).
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
  const shipments = await readParquet<CountyShipmentRow>(
    path.join(root, "county-shipments-by-year.parquet"),
  );
  const overdose = await readParquet<CDCRow>(
    path.join(root, "cdc-overdose-by-county-year.parquet"),
  );

  const totalsByFips = new Map<string, number>();
  for (const r of shipments) {
    totalsByFips.set(r.fips, (totalsByFips.get(r.fips) ?? 0) + r.pills);
  }

  const nationalSorted = meta
    .map((m) => ({ ...m, total: totalsByFips.get(m.fips) ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const nationalRank = new Map<string, number>();
  nationalSorted.forEach((r, i) => {
    nationalRank.set(r.fips, i + 1);
  });

  const peerBands = new Map<string, Array<{ fips: string; total: number }>>();
  for (const m of meta) {
    const band = popBand(m.pop);
    const arr = peerBands.get(band) ?? [];
    arr.push({ fips: m.fips, total: totalsByFips.get(m.fips) ?? 0 });
    peerBands.set(band, arr);
  }
  const peerRank = new Map<string, { rank: number; size: number }>();
  for (const [, arr] of peerBands) {
    arr.sort((a, b) => b.total - a.total);
    arr.forEach((r, i) => {
      peerRank.set(r.fips, { rank: i + 1, size: arr.length });
    });
  }

  const deathsByFips = new Map<string, number>();
  for (const r of overdose) {
    if (r.deaths === null) continue;
    deathsByFips.set(r.fips, (deathsByFips.get(r.fips) ?? 0) + r.deaths);
  }
  const overdosePerCapita: Array<{ fips: string; rate: number }> = [];
  for (const m of meta) {
    const d = deathsByFips.get(m.fips);
    if (d !== undefined && m.pop > 0) {
      overdosePerCapita.push({ fips: m.fips, rate: d / m.pop });
    }
  }
  overdosePerCapita.sort((a, b) => b.rate - a.rate);
  const overdoseRank = new Map<string, number>();
  overdosePerCapita.forEach((r, i) => {
    overdoseRank.set(r.fips, i + 1);
  });

  const out: CountyRankRow[] = meta.map((m) => ({
    fips: m.fips,
    national_rank: nationalRank.get(m.fips) ?? 0,
    national_total: nationalSorted.length,
    peer_rank: peerRank.get(m.fips)?.rank ?? 0,
    peer_size: peerRank.get(m.fips)?.size ?? 0,
    overdose_rank: overdoseRank.get(m.fips) ?? null,
    overdose_total: overdosePerCapita.length,
  }));

  await fs.writeFile(path.join(root, "county-ranks.json"), JSON.stringify(out));
  console.log(`wrote ${out.length} county ranks`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
