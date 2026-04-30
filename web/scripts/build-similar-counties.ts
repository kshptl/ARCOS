import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readParquetRows } from "@/lib/data/parquet";

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

async function main() {
  const root = path.resolve(process.cwd(), "public/data");
  const metaRaw = await fs.readFile(path.join(root, "county-metadata.json"), "utf-8");
  const meta: CountyMetaRow[] = JSON.parse(metaRaw);
  let totals: Map<string, number> = new Map();
  try {
    const buf = await fs.readFile(path.join(root, "county-shipments-by-year.parquet"));
    if (buf.byteLength > 0) {
      const shipments = await readParquetRows<ShipmentRow>(buf);
      for (const r of shipments) {
        totals.set(r.fips, (totals.get(r.fips) ?? 0) + r.pills);
      }
    }
  } catch {
    totals = new Map();
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
