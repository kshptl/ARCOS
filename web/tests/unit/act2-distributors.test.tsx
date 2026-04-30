import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollyProgressContext } from "@/components/scrolly/progressContext";
import { Act2Distributors } from "@/components/scrolly/scenes/Act2Distributors";

const YEARS = [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014];

function shareSeries(start: number, end: number): number[] {
  const step = (end - start) / (YEARS.length - 1);
  return YEARS.map((_, i) => start + step * i);
}

const DATA = {
  years: YEARS,
  series: [
    {
      distributor: "MCKESSON CORPORATION",
      sharesByYear: shareSeries(38.9, 35),
      emphasized: true as const,
    },
    {
      distributor: "CARDINAL HEALTH",
      sharesByYear: shareSeries(25.5, 27.5),
      emphasized: true as const,
    },
    {
      distributor: "AMERISOURCEBERGEN DRUG CORPORATION",
      sharesByYear: shareSeries(20.1, 21.7),
      emphasized: true as const,
    },
  ],
  otherAggregate: { sharesByYear: shareSeries(15.5, 15.8) },
};

describe("Act2Distributors", () => {
  it("renders one polyline per emphasized series plus one 'Other' aggregate line", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act2Distributors data={DATA} />
      </ScrollyProgressContext.Provider>,
    );
    const lines = screen.getAllByTestId("act2-series-line");
    expect(lines).toHaveLength(3);
    const other = screen.getByTestId("act2-other");
    expect(other).toBeInTheDocument();
  });

  it("each emphasized series has one data point per year (>= 9)", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act2Distributors data={DATA} />
      </ScrollyProgressContext.Provider>,
    );
    const dots = screen.getAllByTestId("act2-series-dot");
    // 3 emphasized series × 9 years = 27 dots
    expect(dots.length).toBeGreaterThanOrEqual(3 * 9);
  });

  it("emphasized lines use accent-hot stroke; Other line is muted with reduced opacity", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act2Distributors data={DATA} />
      </ScrollyProgressContext.Provider>,
    );
    const emphasized = screen.getAllByTestId("act2-series-line");
    for (const line of emphasized) {
      expect(line.getAttribute("stroke")).toMatch(/accent-hot|#c23b20/);
    }
    const other = screen.getByTestId("act2-other");
    // Other line opacity ≤ 0.5 (rendered muted at ~40%)
    const opacity = Number(other.getAttribute("opacity") ?? "1");
    expect(opacity).toBeLessThanOrEqual(0.5);
    expect(other.getAttribute("stroke")).not.toMatch(/accent-hot|#c23b20/);
  });

  it("renders data table for a11y", () => {
    render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act2Distributors data={DATA} />
      </ScrollyProgressContext.Provider>,
    );
    expect(screen.getByTestId("act2-table")).toBeInTheDocument();
  });
});
