import { describe, expect, it } from "vitest";
import type {
  CDCOverdoseByCountyYear,
  CountyMetadata,
  CountyShipmentsByYear,
  DEAEnforcementAction,
  SearchIndexEntry,
  StateShipmentsByYear,
  TopDistributorsByYear,
  TopPharmacy,
} from "@/lib/data/schemas";
import { ARTIFACT_NAMES } from "@/lib/data/schemas";

describe("schemas mirror", () => {
  it("CountyMetadata shape matches pipeline schema", () => {
    const row: CountyMetadata = {
      fips: "54059",
      name: "Mingo County",
      state: "WV",
      pop: 26839,
    };
    expect(row.fips).toHaveLength(5);
  });

  it("StateShipmentsByYear shape", () => {
    const row: StateShipmentsByYear = {
      state: "WV",
      year: 2012,
      pills: 123456789,
      pills_per_capita: 66.3,
    };
    expect(row.year).toBeGreaterThanOrEqual(2006);
  });

  it("CountyShipmentsByYear shape", () => {
    const row: CountyShipmentsByYear = {
      fips: "54059",
      year: 2012,
      pills: 5000000,
      pills_per_capita: 200.1,
    };
    expect(row.fips).toHaveLength(5);
  });

  it("TopDistributorsByYear shape", () => {
    const row: TopDistributorsByYear = {
      distributor: "McKesson Corp",
      year: 2012,
      pills: 1_000_000_000,
      share_pct: 37.5,
    };
    expect(row.share_pct).toBeLessThanOrEqual(100);
  });

  it("TopPharmacy shape", () => {
    const row: TopPharmacy = {
      pharmacy_id: "BS1234567",
      name: "Sav-Rite Pharmacy",
      address: "123 Main St, Kermit, WV",
      fips: "54059",
      total_pills: 12_000_000,
    };
    expect(row.fips).toHaveLength(5);
  });

  it("DEAEnforcementAction shape", () => {
    const row: DEAEnforcementAction = {
      year: 2012,
      action_count: 42,
      notable_actions: [
        { title: "US v. Kermit Pharmacy", url: "https://example.com", target: null },
      ],
    };
    expect(row.notable_actions).toHaveLength(1);
  });

  it("DEANotableAction allows null url (citation pending)", () => {
    const row: DEAEnforcementAction = {
      year: 2012,
      action_count: 42,
      notable_actions: [{ title: "Unlinked case", url: null, target: null }],
    };
    expect(row.notable_actions[0]?.url).toBeNull();
  });

  it("CDCOverdoseByCountyYear shape with suppressed", () => {
    const suppressed: CDCOverdoseByCountyYear = {
      fips: "54059",
      year: 2012,
      deaths: null,
      suppressed: true,
    };
    const visible: CDCOverdoseByCountyYear = {
      fips: "54059",
      year: 2012,
      deaths: 42,
      suppressed: false,
    };
    expect(suppressed.deaths).toBeNull();
    expect(visible.deaths).toBe(42);
  });

  it("SearchIndexEntry discriminated union by type", () => {
    const county: SearchIndexEntry = {
      type: "county",
      id: "54059",
      name: "Mingo County",
      fips: "54059",
      state: "WV",
    };
    const distributor: SearchIndexEntry = {
      type: "distributor",
      id: "mckesson-corp",
      name: "McKesson Corp",
    };
    expect(county.type).toBe("county");
    expect(distributor.type).toBe("distributor");
  });

  it("exposes ARTIFACT_NAMES list", () => {
    expect(ARTIFACT_NAMES.length).toBeGreaterThan(0);
    expect(ARTIFACT_NAMES).toContain("county-metadata");
  });
});
