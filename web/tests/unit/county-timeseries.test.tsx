import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountyTimeSeries } from "@/components/county/CountyTimeSeries";

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
});
