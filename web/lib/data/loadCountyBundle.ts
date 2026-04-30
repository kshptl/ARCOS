import { loadCountyMetaByFips } from "@/lib/data/loadCountyMeta";
import { loadCountyShipmentsByFips } from "@/lib/data/loadCountyShipments";
import { loadTopPharmaciesByFips } from "@/lib/data/loadTopPharmacies";
import { loadCDCOverdoseByFips } from "@/lib/data/loadCDCOverdose";
import type {
  CountyMetadata,
  CountyShipmentsByYear,
  TopPharmacy,
  CDCOverdoseByCountyYear,
} from "@/lib/data/schemas";

export interface CountyBundle {
  meta: CountyMetadata;
  shipments: CountyShipmentsByYear[];
  pharmacies: TopPharmacy[];
  overdose: CDCOverdoseByCountyYear[];
}

export interface CountyBundleOptions {
  /** For unit tests: inject known data without touching disk. */
  overrides?: Partial<CountyBundle>;
}

export async function loadCountyBundle(
  fips: string,
  opts: CountyBundleOptions = {},
): Promise<CountyBundle> {
  if (opts.overrides?.meta) {
    return {
      meta: opts.overrides.meta,
      shipments: opts.overrides.shipments ?? [],
      pharmacies: opts.overrides.pharmacies ?? [],
      overdose: opts.overrides.overdose ?? [],
    };
  }
  const meta = await loadCountyMetaByFips(fips);
  if (!meta) throw new Error(`county not found: ${fips}`);
  const [shipments, pharmacies, overdose] = await Promise.all([
    loadCountyShipmentsByFips(fips),
    loadTopPharmaciesByFips(fips),
    loadCDCOverdoseByFips(fips),
  ]);
  return { meta, shipments, pharmacies, overdose };
}
