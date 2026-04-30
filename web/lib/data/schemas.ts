/**
 * TypeScript mirror of pipeline JSON Schemas.
 *
 * The authoritative contract lives in `/pipeline/schemas/*.schema.json`.
 * This file is a convenience mirror. Drift is caught in CI by
 * `scripts/validate-data.ts` which runs ajv validation on every file
 * in `public/data/` against the pipeline schemas.
 *
 * If you change a shape here, also change the JSON Schema — or the build
 * will fail at `prebuild`.
 */

export interface CountyMetadata {
  /** 5-digit zero-padded FIPS code */
  fips: string;
  /** County name, e.g. "Mingo County" */
  name: string;
  /** 2-letter USPS state abbreviation */
  state: string;
  /** 2012 population estimate (Census PEP) */
  pop: number;
}

export interface StateShipmentsByYear {
  /** 2-letter USPS abbreviation */
  state: string;
  /** Calendar year, 2006–2014 inclusive */
  year: number;
  /** Total dosage units shipped */
  pills: number;
  /** Pills per capita using state population estimate */
  pills_per_capita: number;
}

export interface CountyShipmentsByYear {
  fips: string;
  year: number;
  pills: number;
  pills_per_capita: number;
}

export interface TopDistributorsByYear {
  distributor: string;
  year: number;
  pills: number;
  /** Market share 0–100 */
  share_pct: number;
}

export interface TopPharmacy {
  pharmacy_id: string;
  name: string;
  address: string;
  fips: string;
  total_pills: number;
  /** v2 addition (per-year pills), undefined today */
  yearly?: number[];
}

export interface DEANotableAction {
  title: string;
  /**
   * DOJ press release URL if known. `null` (or omitted) when the underlying
   * DEA source didn't include a stable link — we do NOT fabricate one.
   * See pipeline/schemas/dea-enforcement-actions.schema.json.
   */
  url?: string | null;
  /** Target of action; null if not identifiable */
  target: string | null;
}

export interface DEAEnforcementAction {
  year: number;
  action_count: number;
  notable_actions: DEANotableAction[];
}

/**
 * CDC WONDER D76 overdose deaths by county-year.
 *
 * When `suppressed` is true, `deaths` is null (CDC suppresses cells <10
 * for privacy). When `suppressed` is false, `deaths` is >= 10.
 */
export interface CDCOverdoseByCountyYear {
  fips: string;
  year: number;
  deaths: number | null;
  suppressed: boolean;
}

/** Common fields across all search-index entry types */
interface SearchIndexBase {
  id: string;
  name: string;
}

export interface SearchIndexCounty extends SearchIndexBase {
  type: "county";
  fips: string;
  state?: string;
}

export interface SearchIndexCity extends SearchIndexBase {
  type: "city";
  fips: string;
  state?: string;
}

export interface SearchIndexZip extends SearchIndexBase {
  type: "zip";
  /** ZIP code, matches id */
  fips: string;
  state?: string;
}

export interface SearchIndexDistributor extends SearchIndexBase {
  type: "distributor";
}

export interface SearchIndexPharmacy extends SearchIndexBase {
  type: "pharmacy";
  address?: string;
  fips: string;
}

export type SearchIndexEntry =
  | SearchIndexCounty
  | SearchIndexCity
  | SearchIndexZip
  | SearchIndexDistributor
  | SearchIndexPharmacy;

/** Names of emitted artifacts, mirroring spec §4 */
export const ARTIFACT_NAMES = [
  "state-shipments-by-year",
  "county-shipments-by-year",
  "county-metadata",
  "top-distributors-by-year",
  "top-pharmacies",
  "dea-enforcement-actions",
  "cdc-overdose-by-county-year",
  "search-index",
] as const;

export type ArtifactName = (typeof ARTIFACT_NAMES)[number];
