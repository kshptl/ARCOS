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

  it("does not render a chart title band above the svg", () => {
    const { container } = render(
      <ScrollyProgressContext.Provider value={1}>
        <Act2Distributors data={DATA} />
      </ScrollyProgressContext.Provider>,
    );
    // Visible title band ("Oxy + hydro market share, 2006 → 2014") should not
    // exist — the chart headline lives in the scrollytelling step text instead.
    const titleBands = container.querySelectorAll('[class*="titleBand"]');
    expect(titleBands.length).toBe(0);
    // Also assert no <text> inside the svg reads like the old title.
    const svgText = Array.from(container.querySelectorAll("svg text")).map(
      (t) => t.textContent ?? "",
    );
    for (const s of svgText) {
      expect(s).not.toMatch(/market share/i);
      expect(s).not.toMatch(/oxy \+ hydro/i);
    }
  });

  it("does not render a sub-caption paragraph under the chart", () => {
    const { container } = render(
      <ScrollyProgressContext.Provider value={1}>
        <Act2Distributors data={DATA} />
      </ScrollyProgressContext.Provider>,
    );
    const subCaptions = container.querySelectorAll('[class*="subCaption"]');
    expect(subCaptions.length).toBe(0);
  });

  it("series labels do not overlap y-axis tick labels (>= 8px horizontal gap)", () => {
    const { container } = render(
      <ScrollyProgressContext.Provider value={1}>
        <Act2Distributors data={DATA} />
      </ScrollyProgressContext.Provider>,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // Y-axis tick labels are anchored "end" — their right edge is at x.
    const yTickLabels = Array.from(svg!.querySelectorAll("text")).filter((t) => {
      const content = t.textContent ?? "";
      return /^[\d.]+%$/.test(content) && t.getAttribute("text-anchor") === "end";
    });
    expect(yTickLabels.length).toBeGreaterThan(0);
    const yTickRightMax = Math.max(...yTickLabels.map((t) => Number(t.getAttribute("x") ?? "0")));
    // Any start-anchored series label (value or distributor name) must sit
    // at least 8px to the right of the y-axis tick column.
    const startLabels = Array.from(svg!.querySelectorAll("text")).filter(
      (t) => t.getAttribute("text-anchor") === "start",
    );
    for (const l of startLabels) {
      const x = Number(l.getAttribute("x") ?? "0");
      expect(x).toBeGreaterThanOrEqual(yTickRightMax + 8);
    }
  });

  it("uses an enlarged chart viewBox (>= 640 x >= 400)", () => {
    const { container } = render(
      <ScrollyProgressContext.Provider value={1}>
        <Act2Distributors data={DATA} />
      </ScrollyProgressContext.Provider>,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const viewBox = svg!.getAttribute("viewBox") ?? "0 0 0 0";
    const [, , wStr, hStr] = viewBox.split(" ");
    expect(Number(wStr)).toBeGreaterThanOrEqual(640);
    expect(Number(hStr)).toBeGreaterThanOrEqual(400);
  });
});
