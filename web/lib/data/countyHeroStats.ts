import type { CountyMetadata, CountyShipmentsByYear } from "@/lib/data/schemas";

export interface CountyHeroStats {
  totalPills: number;
  peakYear: number | null;
  peakPerCapita: number | null;
  years: number[];
}

export function computeCountyHeroStats(
  _meta: CountyMetadata,
  shipments: CountyShipmentsByYear[],
): CountyHeroStats {
  if (shipments.length === 0) {
    return { totalPills: 0, peakYear: null, peakPerCapita: null, years: [] };
  }
  const total = shipments.reduce((s, r) => s + r.pills, 0);
  let peak = shipments[0];
  if (!peak) return { totalPills: total, peakYear: null, peakPerCapita: null, years: [] };
  for (const r of shipments) {
    if (r.pills_per_capita > peak.pills_per_capita) peak = r;
  }
  return {
    totalPills: total,
    peakYear: peak.year,
    peakPerCapita: peak.pills_per_capita,
    years: shipments.map((r) => r.year).sort((a, b) => a - b),
  };
}
