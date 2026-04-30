import type { CountyMetadata, CountyShipmentsByYear } from "@/lib/data/schemas";

export interface CountyHeroStats {
  totalPills: number;
  peakYear: number | null;
  peakPerCapita: number | null;
  years: number[];
  /**
   * True when the county has no meaningful shipment data to display —
   * either no rows at all, or every row reports zero pills (CDC or
   * ARCOS suppression for small-population counties). Callers render
   * em-dashes instead of a literal 0 so the page doesn't claim the
   * county received zero pills.
   */
  suppressed: boolean;
}

export function computeCountyHeroStats(
  _meta: CountyMetadata,
  shipments: CountyShipmentsByYear[],
): CountyHeroStats {
  if (shipments.length === 0) {
    return { totalPills: 0, peakYear: null, peakPerCapita: null, years: [], suppressed: true };
  }
  const total = shipments.reduce((s, r) => s + r.pills, 0);
  if (total === 0) {
    return {
      totalPills: 0,
      peakYear: null,
      peakPerCapita: null,
      years: shipments.map((r) => r.year).sort((a, b) => a - b),
      suppressed: true,
    };
  }
  let peak = shipments[0];
  if (!peak)
    return {
      totalPills: total,
      peakYear: null,
      peakPerCapita: null,
      years: [],
      suppressed: false,
    };
  for (const r of shipments) {
    if (r.pills_per_capita > peak.pills_per_capita) peak = r;
  }
  return {
    totalPills: total,
    peakYear: peak.year,
    peakPerCapita: peak.pills_per_capita,
    years: shipments.map((r) => r.year).sort((a, b) => a - b),
    suppressed: false,
  };
}
