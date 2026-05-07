import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readParquetRows } from "@/lib/data/parquet";
import type { CountyMetadata, CountyShipmentsByYear } from "@/lib/data/schemas";

const DATA_DIR = path.join(__dirname, "..", "..", "public", "data");

describe("explorer county coverage", () => {
  it("ships enough county metadata for the full US county map", async () => {
    const raw = await readFile(path.join(DATA_DIR, "county-metadata.json"), "utf8");
    const counties = JSON.parse(raw) as CountyMetadata[];

    expect(counties.length).toBeGreaterThanOrEqual(3_000);
  });

  it("ships one county-year row for nearly every county and explorer year", async () => {
    const raw = await readFile(path.join(DATA_DIR, "county-shipments-by-year.parquet"));
    const rows = await readParquetRows<CountyShipmentsByYear>(raw, {
      columns: ["fips", "year", "pills", "pills_per_capita"],
    });

    const fips = new Set(rows.map((row) => row.fips));
    const years = new Set(rows.map((row) => row.year));

    expect(fips.size).toBeGreaterThanOrEqual(3_000);
    expect(years).toEqual(new Set([2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014]));
    expect(rows.length).toBeGreaterThanOrEqual(27_000);
  });
});
