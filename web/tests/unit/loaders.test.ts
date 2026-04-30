import { describe, it, expect, vi, beforeEach } from "vitest";

const readFileMock = vi.fn();

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("node:fs/promises");
  return {
    ...actual,
    default: {
      ...actual,
      readFile: (...args: unknown[]) => readFileMock(...args),
    },
    readFile: (...args: unknown[]) => readFileMock(...args),
  };
});

import {
  loadStateShipments,
  resetStateShipmentsCache,
} from "@/lib/data/loadStateShipments";
import {
  loadTopDistributors,
  loadTopDistributorsByYear,
  resetTopDistributorsCache,
} from "@/lib/data/loadTopDistributors";
import { loadCountyBundle } from "@/lib/data/loadCountyBundle";

describe("loadStateShipments", () => {
  beforeEach(() => {
    resetStateShipmentsCache();
    readFileMock.mockReset();
  });

  it("reads and caches state shipments JSON", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify([
        { state: "WV", year: 2012, pills: 1e9, pills_per_capita: 100 },
        { state: "VA", year: 2012, pills: 5e8, pills_per_capita: 50 },
      ]),
    );
    const rows = await loadStateShipments();
    expect(rows).toHaveLength(2);
  });
});

describe("loadTopDistributors", () => {
  beforeEach(() => {
    resetTopDistributorsCache();
    readFileMock.mockReset();
  });

  it("groups by year", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify([
        { distributor: "McKesson", year: 2012, pills: 5e9, share_pct: 40 },
        { distributor: "Cardinal", year: 2012, pills: 4e9, share_pct: 32 },
        { distributor: "McKesson", year: 2013, pills: 6e9, share_pct: 42 },
      ]),
    );
    const byYear = await loadTopDistributorsByYear();
    expect(byYear.get(2012)).toHaveLength(2);
    expect(byYear.get(2013)).toHaveLength(1);
  });

  it("returns full array via loadTopDistributors", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify([
        { distributor: "McKesson", year: 2012, pills: 5e9, share_pct: 40 },
      ]),
    );
    const rows = await loadTopDistributors();
    expect(rows).toHaveLength(1);
  });
});

describe("loadCountyBundle", () => {
  it("returns a structured bundle for one fips", async () => {
    const bundle = await loadCountyBundle("54059", {
      overrides: {
        meta: { fips: "54059", name: "Mingo County", state: "WV", pop: 26839 },
        shipments: [
          { fips: "54059", year: 2012, pills: 5_000_000, pills_per_capita: 186.3 },
        ],
        overdose: [{ fips: "54059", year: 2012, deaths: 42, suppressed: false }],
        pharmacies: [],
      },
    });
    expect(bundle.meta.fips).toBe("54059");
    expect(bundle.shipments).toHaveLength(1);
    expect(bundle.overdose[0]?.deaths).toBe(42);
  });

  it("throws for unknown fips when no override provided", async () => {
    // county-metadata.json is an empty array, so lookup returns null
    readFileMock.mockResolvedValueOnce(JSON.stringify([]));
    await expect(loadCountyBundle("99999")).rejects.toThrow(/not found/);
  });
});
