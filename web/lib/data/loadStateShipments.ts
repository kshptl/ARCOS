import fs from "node:fs/promises";
import path from "node:path";
import type { StateShipmentsByYear } from "@/lib/data/schemas";

const DATA_PATH = path.join(process.cwd(), "public", "data", "state-shipments-by-year.json");

let cache: StateShipmentsByYear[] | null = null;

export function resetStateShipmentsCache(): void {
  cache = null;
}

export async function loadStateShipments(): Promise<StateShipmentsByYear[]> {
  if (cache) return cache;
  const raw = await fs.readFile(DATA_PATH, "utf8");
  cache = JSON.parse(raw) as StateShipmentsByYear[];
  return cache;
}

export async function loadStateShipmentsByState(): Promise<Map<string, StateShipmentsByYear[]>> {
  const rows = await loadStateShipments();
  const grouped = new Map<string, StateShipmentsByYear[]>();
  for (const r of rows) {
    const bucket = grouped.get(r.state) ?? [];
    bucket.push(r);
    grouped.set(r.state, bucket);
  }
  for (const arr of grouped.values()) arr.sort((a, b) => a.year - b.year);
  return grouped;
}
