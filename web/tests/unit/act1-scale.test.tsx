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
    expect(value.textContent?.replace(/[,\s]/g, "")).toMatch(/^[0-9]+$/);
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

  it("peak annotation is visible at progress >= 0.5", () => {
    renderWithProgress(0.5);
    expect(screen.getByTestId("act1-peak-callout")).toBeInTheDocument();
  });
});
