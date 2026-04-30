import { describe, expect, it } from "vitest";
import { buildAct2 } from "@/scripts/build-scrolly-data.mts";

type TopDist = { distributor: string; year: number; pills: number; share_pct: number };

// Simplified 3-year, 4-distributor fixture for arithmetic clarity.
function fixture(): TopDist[] {
  const rows: TopDist[] = [];
  const years = [2006, 2007, 2008];
  // Top-3 shares: A(40,42,45), B(25,24,23), C(15,16,17); Other D(20,18,15).
  const A = [40, 42, 45];
  const B = [25, 24, 23];
  const C = [15, 16, 17];
  const D = [20, 18, 15];
  for (let i = 0; i < years.length; i++) {
    rows.push({ distributor: "A CORP", year: years[i]!, pills: 1, share_pct: A[i]! });
    rows.push({ distributor: "B CORP", year: years[i]!, pills: 1, share_pct: B[i]! });
    rows.push({ distributor: "C CORP", year: years[i]!, pills: 1, share_pct: C[i]! });
    rows.push({ distributor: "D CORP", year: years[i]!, pills: 1, share_pct: D[i]! });
  }
  return rows;
}

describe("buildAct2", () => {
  it("emits ascending years list covering the full span", () => {
    const out = buildAct2(fixture());
    expect(out.years).toEqual([2006, 2007, 2008]);
  });

  it("emits one series per top-3 distributor (by last-year share), marked emphasized", () => {
    const out = buildAct2(fixture());
    expect(out.series).toHaveLength(3);
    const names = out.series.map((s) => s.distributor);
    // Last-year shares: A=45, B=23, C=17, D=15. Top-3 = A, B, C.
    expect(names).toEqual(["A CORP", "B CORP", "C CORP"]);
    for (const s of out.series) {
      expect(s.emphasized).toBe(true);
      expect(s.sharesByYear).toHaveLength(3);
    }
  });

  it("series sharesByYear align to the years array", () => {
    const out = buildAct2(fixture());
    const a = out.series.find((s) => s.distributor === "A CORP");
    expect(a?.sharesByYear).toEqual([40, 42, 45]);
    const b = out.series.find((s) => s.distributor === "B CORP");
    expect(b?.sharesByYear).toEqual([25, 24, 23]);
  });

  it("otherAggregate is the sum of all non-top-3 distributors per year", () => {
    const out = buildAct2(fixture());
    // Only D is outside top-3; expect its shares verbatim.
    expect(out.otherAggregate.sharesByYear).toEqual([20, 18, 15]);
  });

  it("returns empty-shape when input is empty", () => {
    const out = buildAct2([]);
    expect(out).toEqual({
      years: [],
      series: [],
      otherAggregate: { sharesByYear: [] },
    });
  });
});
