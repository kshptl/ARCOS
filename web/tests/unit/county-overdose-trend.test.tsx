import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountyOverdoseTrend } from "@/components/county/CountyOverdoseTrend";
import type { CDCOverdoseByCountyYear } from "@/lib/data/schemas";

const row = (overrides: Partial<CDCOverdoseByCountyYear>): CDCOverdoseByCountyYear => ({
  fips: "54059",
  year: 2011,
  deaths: 12,
  suppressed: false,
  ...overrides,
});

describe("CountyOverdoseTrend", () => {
  it("renders county overdose deaths sorted by year", () => {
    render(
      <CountyOverdoseTrend
        countyName="Mingo County"
        rows={[
          row({ year: 2014, deaths: 25 }),
          row({ year: 2012, deaths: 18 }),
          row({ year: 2013, deaths: 20 }),
        ]}
      />,
    );

    const years = screen.getAllByTestId("overdose-year").map((cell) => cell.textContent);
    expect(years).toEqual(["2012", "2013", "2014"]);
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("renders suppressed and null rows as less than ten, never zero", () => {
    render(
      <CountyOverdoseTrend
        countyName="Mingo County"
        rows={[
          row({ year: 2011, deaths: null, suppressed: true }),
          row({ year: 2012, deaths: null, suppressed: false }),
        ]}
      />,
    );

    const deathCells = screen.getAllByTestId("overdose-deaths");
    expect(deathCells).toHaveLength(2);
    deathCells.forEach((cell) => expect(cell).toHaveTextContent("<10"));
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows the CDC unreliable-rate caveat when any row is unreliable", () => {
    render(
      <CountyOverdoseTrend
        countyName="Mingo County"
        rows={[row({ year: 2012, deaths: 12, unreliable: true })]}
      />,
    );

    expect(
      screen.getByText(/counts of 10-20 are publishable, but CDC rates are flagged unreliable/i),
    ).toBeInTheDocument();
  });

  it("does not show the unreliable-rate caveat for only suppressed unreliable rows", () => {
    render(
      <CountyOverdoseTrend
        countyName="Mingo County"
        rows={[
          row({ year: 2011, deaths: null, suppressed: true, unreliable: true }),
          row({ year: 2012, deaths: null, suppressed: true, unreliable: true }),
        ]}
      />,
    );

    expect(
      screen.queryByText(/counts of 10-20 are publishable, but CDC rates are flagged unreliable/i),
    ).not.toBeInTheDocument();
    screen.getAllByTestId("overdose-deaths").forEach((cell) => expect(cell).toHaveTextContent("<10"));
  });

  it("renders an empty message when no rows are available", () => {
    render(<CountyOverdoseTrend countyName="Mingo County" rows={[]} />);

    expect(screen.getByText(/no cdc overdose death records/i)).toBeInTheDocument();
    expect(screen.getByText(/Mingo County/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
