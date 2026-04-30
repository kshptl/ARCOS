import { describe, it, expect } from "vitest";
import { readParquetRows } from "@/lib/data/parquet";
import fs from "node:fs/promises";
import path from "node:path";

describe("parquet wrapper", () => {
  it("reads all rows from a tiny parquet file in Node", async () => {
    const p = path.join(__dirname, "..", "fixtures", "tiny.parquet");
    const buf = await fs.readFile(p);
    const rows = await readParquetRows<Record<string, unknown>>(buf);
    expect(rows).toHaveLength(3);
    const first = rows[0];
    expect(first).toBeDefined();
    expect(first?.fips).toBe("54059");
    expect(first?.year).toBe(2012);
  });

  it("reads a subset of columns", async () => {
    const p = path.join(__dirname, "..", "fixtures", "tiny.parquet");
    const buf = await fs.readFile(p);
    const rows = await readParquetRows<{ fips: string }>(buf, { columns: ["fips"] });
    expect(rows).toHaveLength(3);
    const first = rows[0];
    expect(Object.keys(first ?? {})).toEqual(["fips"]);
  });
});
