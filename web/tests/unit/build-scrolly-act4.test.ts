import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAct4, readCdcRows } from "@/scripts/build-scrolly-data.mts";

describe("buildAct4", () => {
  it("resolves names and states from county metadata", () => {
    const meta = [
      { fips: "54059", name: "Mingo County", state: "WV", pop: 25764 },
      { fips: "21195", name: "Pike County", state: "KY", pop: 58947 },
    ];
    const { counties } = buildAct4(meta, []);
    const mingo = counties.find((c) => c.fips === "54059");
    const pike = counties.find((c) => c.fips === "21195");
    expect(mingo).toEqual({ fips: "54059", name: "Mingo County", state: "WV", points: [] });
    expect(pike).toEqual({ fips: "21195", name: "Pike County", state: "KY", points: [] });
  });

  it("uses built-in labels for epicenter FIPS missing from county metadata", () => {
    const { counties } = buildAct4([], []);
    expect(counties).toEqual([
      { fips: "54059", name: "Mingo County", state: "WV", points: [] },
      { fips: "21195", name: "Pike County", state: "KY", points: [] },
      { fips: "21119", name: "Knott County", state: "KY", points: [] },
      { fips: "54047", name: "McDowell County", state: "WV", points: [] },
      { fips: "54011", name: "Cabell County", state: "WV", points: [] },
      { fips: "39145", name: "Scioto County", state: "OH", points: [] },
    ]);
  });

  it("builds per-year points sorted ascending without converting suppressed deaths to zero", () => {
    const cdc = [
      { fips: "54059", year: 2013, deaths: 21, suppressed: false, unreliable: false },
      { fips: "54059", year: 2011, deaths: null, suppressed: true, unreliable: false },
      { fips: "54059", year: 2012, deaths: null, suppressed: true, unreliable: false },
    ];
    const { counties } = buildAct4(null, cdc);
    const mingo = counties.find((c) => c.fips === "54059");
    expect(mingo?.points).toEqual([
      { year: 2011, deaths: null, suppressed: true, unreliable: false },
      { year: 2012, deaths: null, suppressed: true, unreliable: false },
      { year: 2013, deaths: 21, suppressed: false, unreliable: false },
    ]);
  });

  it("treats publishable count-20 points as unreliable", () => {
    const cdc = [{ fips: "54059", year: 2013, deaths: 20, suppressed: false, unreliable: false }];

    const { counties } = buildAct4(null, cdc);

    expect(counties.find((c) => c.fips === "54059")?.points).toEqual([
      { year: 2013, deaths: 20, suppressed: false, unreliable: true },
    ]);
  });

  it("deduplicates repeated county-year rows by keeping the highest numeric deaths", () => {
    // The CDC parquet sometimes contains both a suppressed-null row and a
    // later revised row for the same county-year. Keep the real value.
    const cdc = [
      { fips: "54059", year: 2013, deaths: null, suppressed: true, unreliable: false },
      { fips: "54059", year: 2013, deaths: null, suppressed: true, unreliable: false },
      { fips: "54059", year: 2013, deaths: 15, suppressed: false, unreliable: false },
    ];
    const { counties } = buildAct4(null, cdc);
    const mingo = counties.find((c) => c.fips === "54059");
    expect(mingo?.points).toEqual([
      { year: 2013, deaths: 15, suppressed: false, unreliable: true },
    ]);
  });

  it("emits all six epicenter FIPS in a stable order", () => {
    const { counties } = buildAct4([], []);
    expect(counties.map((c) => c.fips)).toEqual([
      "54059",
      "21195",
      "21119",
      "54047",
      "54011",
      "39145",
    ]);
  });

  it("prefers public CDC JSON rows before falling back to legacy parquet", async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), "scrolly-cdc-"));
    try {
      await writeFile(
        path.join(dataDir, "cdc_county_overdose.json"),
        JSON.stringify([
          { fips: "54059", year: 2013, deaths: null, suppressed: true, unreliable: false },
        ]),
      );
      await writeFile(path.join(dataDir, "cdc-overdose-by-county-year.parquet"), "not parquet");

      await expect(readCdcRows(dataDir)).resolves.toEqual([
        { fips: "54059", year: 2013, deaths: null, suppressed: true, unreliable: false },
      ]);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
