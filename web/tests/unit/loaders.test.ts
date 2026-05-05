import { beforeEach, describe, expect, it, vi } from "vitest";

const readFileMock = vi.fn();
const accessMock = vi.fn();
const readParquetRowsMock = vi.fn();

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("node:fs/promises");
  return {
    ...actual,
    default: {
      ...actual,
      access: (...args: unknown[]) => accessMock(...args),
      readFile: (...args: unknown[]) => readFileMock(...args),
    },
    access: (...args: unknown[]) => accessMock(...args),
    readFile: (...args: unknown[]) => readFileMock(...args),
  };
});

vi.mock("@/lib/data/parquet", () => ({
  readParquetRows: (...args: unknown[]) => readParquetRowsMock(...args),
}));

import { loadCountyBundle } from "@/lib/data/loadCountyBundle";
import {
  loadCDCOverdose,
  loadCDCOverdoseByFips,
  resetCDCOverdoseCache,
} from "@/lib/data/loadCDCOverdose";
import { loadStateShipments, resetStateShipmentsCache } from "@/lib/data/loadStateShipments";
import {
  loadTopDistributors,
  loadTopDistributorsByYear,
  resetTopDistributorsCache,
} from "@/lib/data/loadTopDistributors";

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
      JSON.stringify([{ distributor: "McKesson", year: 2012, pills: 5e9, share_pct: 40 }]),
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
        shipments: [{ fips: "54059", year: 2012, pills: 5_000_000, pills_per_capita: 186.3 }],
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

describe("loadCDCOverdose", () => {
  beforeEach(() => {
    resetCDCOverdoseCache();
    accessMock.mockReset();
    readFileMock.mockReset();
    readParquetRowsMock.mockReset();
  });

  it("normalizes rich CDC WONDER JSON records and preserves metadata", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        records: [
          {
            county_fips: "54059",
            county_name: "Mingo County",
            state_fips: "54",
            year: 2012,
            deaths: 42,
            suppressed: false,
            population: 26_839,
            crude_rate: 156.5,
            crude_rate_lower_ci: 112.8,
            crude_rate_upper_ci: 211.8,
            unreliable: false,
          },
          {
            county_fips: "54059",
            county_name: "Mingo County",
            state_fips: "54",
            year: 2011,
            deaths: null,
            suppressed: true,
            population: 27_000,
            crude_rate: null,
            unreliable: true,
          },
        ],
      }),
    );

    const rows = await loadCDCOverdose();

    expect(rows[0]).toMatchObject({
      fips: "54059",
      county_fips: "54059",
      county_name: "Mingo County",
      state_fips: "54",
      year: 2012,
      deaths: 42,
      suppressed: false,
      population: 26_839,
      crude_rate: 156.5,
      crude_rate_lower_ci: 112.8,
      crude_rate_upper_ci: 211.8,
      unreliable: false,
    });
    expect(rows[1]).toMatchObject({
      fips: "54059",
      deaths: null,
      suppressed: true,
      crude_rate: null,
      unreliable: true,
    });
  });

  it("normalizes preserved county_fips when rich JSON uses a short FIPS", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        records: [{ county_fips: "1059", year: 2012, deaths: 12, suppressed: false }],
      }),
    );

    const rows = await loadCDCOverdose();

    expect(rows[0]).toMatchObject({ fips: "01059", county_fips: "01059" });
  });

  it("groups rich CDC WONDER records by normalized FIPS sorted by year", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        records: [
          { county_fips: "54059", year: 2013, deaths: 44, suppressed: false },
          { county_fips: "54059", year: 2011, deaths: null, suppressed: true },
          { county_fips: "54001", year: 2012, deaths: 12, suppressed: false },
        ],
      }),
    );

    const rows = await loadCDCOverdoseByFips("54059");

    expect(rows).toEqual([
      { fips: "54059", county_fips: "54059", year: 2011, deaths: null, suppressed: true },
      { fips: "54059", county_fips: "54059", year: 2013, deaths: 44, suppressed: false },
    ]);
  });

  it("falls back to parquet when rich JSON is missing", async () => {
    readFileMock
      .mockRejectedValueOnce(Object.assign(new Error("missing json"), { code: "ENOENT" }))
      .mockResolvedValueOnce(Buffer.from("parquet bytes"));
    accessMock.mockResolvedValueOnce(undefined);
    readParquetRowsMock.mockResolvedValueOnce([
      { fips: "54059", year: 2012, deaths: 42, suppressed: false },
    ]);

    const rows = await loadCDCOverdose();

    expect(readParquetRowsMock).toHaveBeenCalledWith(Buffer.from("parquet bytes"));
    expect(rows).toEqual([{ fips: "54059", year: 2012, deaths: 42, suppressed: false }]);
  });

  it("returns empty rows when both rich JSON and parquet artifacts are missing", async () => {
    readFileMock.mockRejectedValueOnce(Object.assign(new Error("missing json"), { code: "ENOENT" }));
    accessMock.mockRejectedValueOnce(Object.assign(new Error("missing parquet"), { code: "ENOENT" }));

    const rows = await loadCDCOverdose();

    expect(rows).toEqual([]);
    expect(readParquetRowsMock).not.toHaveBeenCalled();
  });

  it("can skip rich JSON when preferJson is false", async () => {
    readFileMock.mockResolvedValueOnce(Buffer.from("parquet bytes"));
    accessMock.mockResolvedValueOnce(undefined);
    readParquetRowsMock.mockResolvedValueOnce([
      { fips: "54059", year: 2012, deaths: 42, suppressed: false },
    ]);

    const rows = await loadCDCOverdose({ preferJson: false });

    expect(readFileMock).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([{ fips: "54059", year: 2012, deaths: 42, suppressed: false }]);
  });

  it("uses separate caches for JSON-first and parquet-only loading", async () => {
    readFileMock
      .mockResolvedValueOnce(
        JSON.stringify({
          records: [{ county_fips: "54059", year: 2011, deaths: null, suppressed: true }],
        }),
      )
      .mockResolvedValueOnce(Buffer.from("parquet bytes"));
    accessMock.mockResolvedValueOnce(undefined);
    readParquetRowsMock.mockResolvedValueOnce([
      { fips: "54059", year: 2012, deaths: 42, suppressed: false },
    ]);

    const jsonRows = await loadCDCOverdoseByFips("54059");
    const parquetRows = await loadCDCOverdoseByFips("54059", { preferJson: false });

    expect(jsonRows).toEqual([
      { fips: "54059", county_fips: "54059", year: 2011, deaths: null, suppressed: true },
    ]);
    expect(parquetRows).toEqual([{ fips: "54059", year: 2012, deaths: 42, suppressed: false }]);
  });
});
