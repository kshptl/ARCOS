import { describe, expect, it } from "vitest";
import { rowsToTable, summarizeTrend } from "@/components/charts/helpers";

describe("rowsToTable", () => {
  it("returns a clean 2D array with headers first", () => {
    const table = rowsToTable(
      [
        { year: 2012, pills: 1000 },
        { year: 2013, pills: 2000 },
      ],
      ["year", "pills"],
    );
    expect(table[0]).toEqual(["year", "pills"]);
    expect(table[1]).toEqual(["2,012", "1,000"]);
    expect(table[2]).toEqual(["2,013", "2,000"]);
  });

  it("formats numbers with full precision", () => {
    const [, row1] = rowsToTable([{ n: 1_234_567 }], ["n"]);
    expect(row1?.[0]).toBe("1,234,567");
  });
});

describe("summarizeTrend", () => {
  it("summarizes a monotonic rise", () => {
    const summary = summarizeTrend([
      { year: 2006, value: 100 },
      { year: 2012, value: 300 },
    ]);
    expect(summary).toMatch(/rose from 100 to 300/);
  });

  it("summarizes a fall", () => {
    const summary = summarizeTrend([
      { year: 2006, value: 500 },
      { year: 2014, value: 100 },
    ]);
    expect(summary).toMatch(/fell from 500 to 100/);
  });

  it("handles a single point gracefully", () => {
    const summary = summarizeTrend([{ year: 2012, value: 100 }]);
    expect(summary).toMatch(/100/);
  });

  it("returns empty string for zero rows", () => {
    expect(summarizeTrend([])).toBe("");
  });
});
