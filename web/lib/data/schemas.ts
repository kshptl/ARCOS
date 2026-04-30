// TypeScript mirrors of /pipeline/schemas/*.schema.json
// Single source of truth for data contracts between pipeline and web.

export interface CountyMetadata {
  fips: string;
  name: string;
  state: string;
  pop?: number;
  pop_2010?: number;
}

export interface CountyShipmentsByYear {
  fips: string;
  year: number;
  pills: number;
  pills_per_capita?: number;
  transactions?: number;
}

export interface StateShipmentsByYear {
  state: string;
  year: number;
  pills: number;
  pills_per_capita?: number;
}

export interface TopDistributorsByYear {
  distributor: string;
  year: number;
  pills: number;
  share_pct: number;
}

export interface CDCOverdoseByCountyYear {
  fips: string;
  year: number;
  deaths: number | null;
  suppressed: boolean;
}

export interface DEAEnforcementAction {
  year: number;
  action_count: number;
  notable_actions: Array<{
    title: string;
    url?: string;
    target?: string | null;
  }>;
}

export type SearchIndexEntry =
  | { kind: "county"; fips: string; name: string; state: string }
  | { kind: "distributor"; distributor: string }
  | { kind: "state"; state: string };
