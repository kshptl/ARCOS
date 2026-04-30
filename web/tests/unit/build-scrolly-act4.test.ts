import { describe, expect, it } from "vitest";
import { buildAct4 } from "@/scripts/build-scrolly-data.mts";

describe("buildAct4", () => {
  it("resolves names and states from county metadata", () => {
    const meta = [
      { fips: "54059", name: "Mingo County", state: "WV", pop: 25764 },
      { fips: "51720", name: "Norton city", state: "VA", pop: 3892 },
    ];
    const { counties } = buildAct4(meta, []);
    const mingo = counties.find((c) => c.fips === "54059");
    const norton = counties.find((c) => c.fips === "51720");
    expect(mingo).toEqual({ fips: "54059", name: "Mingo County", state: "WV", deaths: [] });
    expect(norton).toEqual({ fips: "51720", name: "Norton city", state: "VA", deaths: [] });
  });

  it("falls back to {name: fips, state: ''} for unknown FIPS", () => {
    const { counties } = buildAct4([], []);
    const missing = counties.find((c) => c.fips === "54011");
    expect(missing).toEqual({ fips: "54011", name: "54011", state: "", deaths: [] });
  });

  it("builds a per-year deaths array sorted ascending, treating suppressed as 0", () => {
    const cdc = [
      { fips: "54059", year: 2013, deaths: 15, suppressed: false },
      { fips: "54059", year: 2011, deaths: null, suppressed: true },
      { fips: "54059", year: 2012, deaths: null, suppressed: true },
    ];
    const { counties } = buildAct4(null, cdc);
    const mingo = counties.find((c) => c.fips === "54059");
    expect(mingo?.deaths).toEqual([0, 0, 15]);
  });

  it("deduplicates repeated county-year rows by taking the max", () => {
    // The CDC parquet sometimes contains both a suppressed-null row and a
    // later revised row for the same county-year. Keep the real value.
    const cdc = [
      { fips: "54059", year: 2013, deaths: null, suppressed: true },
      { fips: "54059", year: 2013, deaths: 15, suppressed: false },
    ];
    const { counties } = buildAct4(null, cdc);
    const mingo = counties.find((c) => c.fips === "54059");
    expect(mingo?.deaths).toEqual([15]);
  });

  it("emits all six aftermath FIPS in a stable order", () => {
    const { counties } = buildAct4([], []);
    expect(counties.map((c) => c.fips)).toEqual([
      "54059",
      "51720",
      "54011",
      "54045",
      "21071",
      "21195",
    ]);
  });
});
