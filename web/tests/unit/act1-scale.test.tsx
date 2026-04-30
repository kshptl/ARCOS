import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollyProgressContext } from "@/components/scrolly/progressContext";
import { Act1Scale } from "@/components/scrolly/scenes/Act1Scale";

const YEARLY = [
  { year: 2006, pills: 7_000_000_000 },
  { year: 2007, pills: 8_000_000_000 },
  { year: 2008, pills: 8_500_000_000 },
  { year: 2009, pills: 9_000_000_000 },
  { year: 2010, pills: 9_600_000_000 },
  { year: 2011, pills: 9_200_000_000 },
  { year: 2012, pills: 8_800_000_000 },
  { year: 2013, pills: 8_200_000_000 },
  { year: 2014, pills: 7_700_000_000 },
];
const TOTAL = YEARLY.reduce((s, d) => s + d.pills, 0);

function renderWithProgress(p: number, yearly = YEARLY, total = TOTAL) {
  return render(
    <ScrollyProgressContext.Provider value={p}>
      <Act1Scale totalPills={total} yearly={yearly} />
    </ScrollyProgressContext.Provider>,
  );
}

function barHeights() {
  return Array.from(document.querySelectorAll('[data-testid="act1-bar"]')).map((el) => {
    const h = el.getAttribute("height") ?? "0";
    return Number.parseFloat(h);
  });
}

function countText() {
  return screen.getByTestId("act1-count").textContent ?? "";
}

describe("Act1Scale", () => {
  it("at progress=0, displays 0 pills as the count-up start", () => {
    renderWithProgress(0);
    const value = screen.getByTestId("act1-count");
    // Count starts at 0 but the compact formatter forces one decimal so it
    // reads "0.0" rather than "0" — see A1.1 requirement.
    expect(value.textContent?.replace(/[,\s]/g, "")).toMatch(/^0(\.0)?$/);
  });

  it("at progress=1, displays the full total", () => {
    renderWithProgress(1);
    expect(countText()).toMatch(/76B|76,000,000,000|74,000,000,000/);
  });

  it("renders yearly data table for a11y fallback", () => {
    renderWithProgress(0.5);
    expect(screen.getByTestId("act1-yearly-table")).toBeInTheDocument();
  });

  it("shows a peak callout at the peak year when bars are fully revealed", () => {
    renderWithProgress(1);
    expect(screen.getByTestId("act1-peak-callout")).toBeInTheDocument();
  });

  it("shows the sub-caption about distributors", () => {
    renderWithProgress(0.5);
    expect(screen.getByText(/distributors to pharmacies/i)).toBeInTheDocument();
  });

  it("at progress=0.4 mid-build, approximately half the bars are fully raised", () => {
    renderWithProgress(0.4);
    const heights = barHeights();
    // With 9 years and buildT = 0.4/0.8 = 0.5, ~4-5 bars should be at full
    // height (i.e., height > 50% of the plot height which is ~170).
    const fullBars = heights.filter((h) => h > 60).length;
    expect(fullBars).toBeGreaterThanOrEqual(3);
    expect(fullBars).toBeLessThanOrEqual(6);
    // And at least one bar should still be at 0 (not yet reached).
    expect(heights.some((h) => h < 1)).toBe(true);
  });

  it("at progress=0.4 mid-build, the count is roughly half of total", () => {
    renderWithProgress(0.4);
    // Extract digits from compact/full formats. Roughly 40-60% of total.
    const text = countText();
    // Remove all non-digit chars to parse a numeric magnitude if formatFull
    // is used. If formatCompact (e.g. "40B"), parse prefix then scale.
    const m = text.match(/([\d.]+)\s*([KMB]?)/);
    expect(m).not.toBeNull();
    const n = Number.parseFloat(m![1] ?? "0");
    const scale = m![2] === "B" ? 1e9 : m![2] === "M" ? 1e6 : m![2] === "K" ? 1e3 : 1;
    const asNum = n * scale;
    // Expect between 30% and 70% of the total (some slop for the integrator)
    expect(asNum).toBeGreaterThan(TOTAL * 0.3);
    expect(asNum).toBeLessThan(TOTAL * 0.7);
  });

  it("at progress=0.8 (start of settled), all bars are at full height", () => {
    renderWithProgress(0.8);
    const heights = barHeights();
    // All bars should be fully raised.
    expect(heights.every((h) => h > 60)).toBe(true);
    // Count should be at the full total.
    expect(countText()).toMatch(/76B|76,000,000,000|74,000,000,000/);
  });

  it("at progress=0.95, nothing has moved since 0.8 (settled phase)", () => {
    const { unmount } = renderWithProgress(0.8);
    const heightsAt80 = barHeights();
    unmount();
    renderWithProgress(0.95);
    const heightsAt95 = barHeights();
    expect(heightsAt95).toEqual(heightsAt80);
  });

  it("peak annotation is not visible until bars settle", () => {
    // A1.3: during the build phase (progress < 0.8), neither the peak bar
    // highlight nor the peak annotation should be shown — the reader is
    // still taking in the rising bars.
    renderWithProgress(0.5);
    expect(screen.queryByTestId("act1-peak-callout")).not.toBeInTheDocument();
    const bars = Array.from(document.querySelectorAll('[data-testid="act1-bar"]'));
    for (const bar of bars) {
      const fill = bar.getAttribute("fill") ?? "";
      expect(fill).not.toMatch(/accent-hot/);
    }
  });

  it("peak bar becomes accent-hot and callout appears exactly at progress=0.8", () => {
    renderWithProgress(0.8);
    expect(screen.getByTestId("act1-peak-callout")).toBeInTheDocument();
    const bars = Array.from(document.querySelectorAll('[data-testid="act1-bar"]'));
    const hotBars = bars.filter((b) => (b.getAttribute("fill") ?? "").includes("accent-hot"));
    // Exactly one bar — the peak bar — should be highlighted.
    expect(hotBars).toHaveLength(1);
  });

  it("peak bar stays highlighted at progress=0.95", () => {
    renderWithProgress(0.95);
    expect(screen.getByTestId("act1-peak-callout")).toBeInTheDocument();
    const bars = Array.from(document.querySelectorAll('[data-testid="act1-bar"]'));
    const hotBars = bars.filter((b) => (b.getAttribute("fill") ?? "").includes("accent-hot"));
    expect(hotBars).toHaveLength(1);
  });

  it("peak annotation text sits at least 16px above the peak bar's value label", () => {
    // Single-year fixture keeps geometry trivial: the only bar is the peak
    // bar, and its value label is drawn directly above it.
    const yearly = [{ year: 2010, pills: 10_000_000_000 }];
    renderWithProgress(1, yearly, 10_000_000_000);

    // The peak callout <g> contains a <text> for the "Peak: ..." label.
    const callout = screen.getByTestId("act1-peak-callout");
    const peakText = callout.querySelector("text");
    expect(peakText).not.toBeNull();
    const peakY = Number.parseFloat(peakText!.getAttribute("y") ?? "NaN");

    // The value-above-bar label is the <text> drawn with the barLabel class
    // for the peak bar. With only one bar, find the first <text> whose y
    // sits just above the bar rectangle.
    const bar = document.querySelector('[data-testid="act1-bar"]');
    expect(bar).not.toBeNull();
    const barY = Number.parseFloat(bar!.getAttribute("y") ?? "NaN");
    // The bar value label is rendered at bar.y - 6 in the component.
    const valueLabelY = barY - 6;

    // SVG y grows downward, so "above" means smaller y. Peak label should
    // be at least 16px higher than the value label.
    expect(valueLabelY - peakY).toBeGreaterThanOrEqual(16);
  });

  describe("count-up numeral always shows one decimal", () => {
    const DECIMAL_RE = /^\d+\.\d[KMB]?$/;
    const cases: Array<[string, number]> = [
      ["1 pill", 1],
      ["25M", 25_000_000],
      ["228.6M", 228_623_838],
      ["76B", 76_000_000_000],
    ];
    for (const [label, total] of cases) {
      it(`renders a decimal for ${label}`, () => {
        // Single-year fixture so we can jump straight to the full total at
        // progress=1 and inspect the formatted numeral.
        const yearly = [{ year: 2010, pills: total }];
        renderWithProgress(1, yearly, total);
        const text = screen.getByTestId("act1-count").textContent ?? "";
        // Strip thousands separators (formatFull uses commas).
        const stripped = text.replace(/,/g, "");
        // Either compact with a decimal (e.g., "25.0M") or full with a
        // decimal (rare for round integers). The requirement is that the
        // compact display — which is what we show during the build phase —
        // always has at least one fractional digit.
        if (/[KMB]$/.test(stripped)) {
          expect(stripped).toMatch(DECIMAL_RE);
        }
      });
    }

    it("compact display mid-count has a decimal for a value that would otherwise be integer", () => {
      // Construct yearly data whose cumulative at progress=0.4 is exactly an
      // integer multiple of 1B so the compact formatter would drop the
      // decimal without the fix.
      const yearly = [
        { year: 2010, pills: 20_000_000_000 },
        { year: 2011, pills: 20_000_000_000 },
      ];
      // At progress=0.8, currentCount = full total (40B), but we want to
      // catch a mid-build integer. buildT=0.5 -> first bar fully up (20B),
      // second bar at 0 -> currentCount = 20B exactly.
      renderWithProgress(0.4, yearly, 40_000_000_000);
      const text = screen.getByTestId("act1-count").textContent ?? "";
      // Expect "20.0B" not "20B".
      expect(text).toMatch(/^\d+\.\d[KMB]$/);
    });
  });
});
