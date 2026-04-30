import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountyTimeSeries, dedupeCountyShipments } from "@/components/county/CountyTimeSeries";

describe("dedupeCountyShipments", () => {
  it("sums duplicate rows for the same (fips, year) and recomputes per-capita", () => {
    const rows = [
      { fips: "54059", year: 2011, pills: 1000, pills_per_capita: 40 },
      { fips: "54059", year: 2011, pills: 2000, pills_per_capita: 80 },
      { fips: "54059", year: 2012, pills: 1500, pills_per_capita: 60 },
    ];
    const out = dedupeCountyShipments(rows, 100);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      fips: "54059",
      year: 2011,
      pills: 3000,
      pills_per_capita: 30,
    });
    expect(out[1]).toEqual({
      fips: "54059",
      year: 2012,
      pills: 1500,
      pills_per_capita: 15,
    });
  });

  it("passes a single-row-per-year input through sorted by year", () => {
    const rows = [
      { fips: "21195", year: 2013, pills: 5000, pills_per_capita: 77 },
      { fips: "21195", year: 2011, pills: 5900, pills_per_capita: 92 },
    ];
    const out = dedupeCountyShipments(rows, 100);
    expect(out.map((r) => r.year)).toEqual([2011, 2013]);
  });

  it("yields pills_per_capita = 0 when pop is 0", () => {
    const rows = [{ fips: "21119", year: 2011, pills: 100, pills_per_capita: 0 }];
    const out = dedupeCountyShipments(rows, 0);
    expect(out[0]?.pills_per_capita).toBe(0);
  });
});

describe("CountyTimeSeries", () => {
  it("renders a figure with aria label referencing the county", () => {
    const meta = { fips: "54059", name: "Mingo", state: "WV", pop: 22999 };
    const bundle = {
      meta,
      shipments: [
        { fips: "54059", year: 2010, pills: 1, pills_per_capita: 400 },
        { fips: "54059", year: 2011, pills: 1, pills_per_capita: 500 },
      ],
      pharmacies: [],
      overdose: [],
    };
    render(
      <CountyTimeSeries
        fips="54059"
        meta={meta}
        bundle={bundle}
        stateSeries={[
          { state: "WV", year: 2010, pills: 1, pills_per_capita: 200 },
          { state: "WV", year: 2011, pills: 1, pills_per_capita: 250 },
          { state: "VA", year: 2010, pills: 1, pills_per_capita: 100 },
          { state: "VA", year: 2011, pills: 1, pills_per_capita: 120 },
        ]}
      />,
    );
    const fig = screen.getByRole("figure");
    expect(fig.getAttribute("aria-label")).toMatch(/Mingo/);
  });

  it("omits the US median legend item when fewer than 5 states are available", () => {
    const meta = { fips: "54059", name: "Mingo", state: "WV", pop: 22999 };
    const bundle = {
      meta,
      shipments: [{ fips: "54059", year: 2011, pills: 1, pills_per_capita: 500 }],
      pharmacies: [],
      overdose: [],
    };
    const { container } = render(
      <CountyTimeSeries
        fips="54059"
        meta={meta}
        bundle={bundle}
        stateSeries={[
          { state: "WV", year: 2011, pills: 1, pills_per_capita: 200 },
          { state: "VA", year: 2011, pills: 1, pills_per_capita: 100 },
          { state: "KY", year: 2011, pills: 1, pills_per_capita: 120 },
        ]}
      />,
    );
    const legend = container.querySelector('[data-testid="county-timeseries-legend"]');
    expect(legend?.textContent ?? "").not.toContain("US median");
  });

  it("shows the US median legend when 5+ states are present", () => {
    const meta = { fips: "54059", name: "Mingo", state: "WV", pop: 22999 };
    const bundle = {
      meta,
      shipments: [{ fips: "54059", year: 2011, pills: 1, pills_per_capita: 500 }],
      pharmacies: [],
      overdose: [],
    };
    const states = ["WV", "VA", "KY", "TN", "OH"] as const;
    const { container } = render(
      <CountyTimeSeries
        fips="54059"
        meta={meta}
        bundle={bundle}
        stateSeries={states.map((s, i) => ({
          state: s,
          year: 2011,
          pills: 1,
          pills_per_capita: 100 + i * 10,
        }))}
      />,
    );
    const legend = container.querySelector('[data-testid="county-timeseries-legend"]');
    expect(legend?.textContent ?? "").toContain("US median");
  });
});
