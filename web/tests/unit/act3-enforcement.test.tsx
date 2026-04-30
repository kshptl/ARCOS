import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollyProgressContext } from "@/components/scrolly/progressContext";
import { Act3Enforcement } from "@/components/scrolly/scenes/Act3Enforcement";

const ACTIONS = [
  {
    year: 2008,
    action_count: 120,
    notable_actions: [{ title: "Operation X", url: "", target: null }],
  },
  { year: 2010, action_count: 180, notable_actions: [] },
  {
    year: 2012,
    action_count: 300,
    notable_actions: [{ title: "Operation Y", url: "", target: null }],
  },
  { year: 2013, action_count: 420, notable_actions: [] },
  { year: 2014, action_count: 520, notable_actions: [] },
];

describe("Act3Enforcement", () => {
  it("renders timeline ticks across a continuous 2006–2014 year axis", () => {
    render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    // Act 3 now renders a dense year axis (2006–2014 = 9 years) with a
    // bar-or-placeholder per year, not just per supplied data point.
    const ticks = screen.getAllByTestId("timeline-tick");
    expect(ticks.length).toBeGreaterThanOrEqual(9);
  });

  it("does not render a 2012-14 inflection band or label", () => {
    const { container } = render(
      <ScrollyProgressContext.Provider value={0.8}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    expect(container.querySelector('[data-testid="inflection-zoom"]')).toBeNull();
    const svgText = Array.from(container.querySelectorAll("svg text")).map(
      (t) => t.textContent ?? "",
    );
    for (const s of svgText) {
      expect(s).not.toMatch(/Inflection/i);
    }
  });

  it("renders notable-actions ticker table", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    expect(screen.getByTestId("act3-table")).toBeInTheDocument();
  });

  it("places leftmost bar clear of y-axis tick labels (>=12px gap)", () => {
    const { container } = render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // y-axis tick text elements are anchored at the end of the gridline (i.e.
    // their x attribute sits at the rightmost edge of the label column).
    const tickTexts = Array.from(svg!.querySelectorAll("text")).filter(
      (t) => t.getAttribute("text-anchor") === "end",
    );
    expect(tickTexts.length).toBeGreaterThan(0);
    const rightmostTickX = Math.max(...tickTexts.map((t) => Number(t.getAttribute("x") ?? 0)));
    // Check both bar rects AND placeholder line ticks — the 2006 year has no
    // data in the fixture and renders as a <line> at x = PAD_LEFT.
    const tickEls = Array.from(svg!.querySelectorAll('[data-testid="timeline-tick"]'));
    expect(tickEls.length).toBeGreaterThan(0);
    const leftmostTickX = Math.min(
      ...tickEls.map((el) => {
        if (el.tagName.toLowerCase() === "rect") {
          return Number(el.getAttribute("x") ?? 0);
        }
        // line: use x1 (== x2 for vertical placeholder)
        return Number(el.getAttribute("x1") ?? 0);
      }),
    );
    expect(leftmostTickX - rightmostTickX).toBeGreaterThanOrEqual(12);
  });

  it("keeps all bars and tick placeholders within the plot rectangle", () => {
    const { container } = render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const viewBox = svg!.getAttribute("viewBox") ?? "0 0 520 300";
    const [, , wStr] = viewBox.split(" ");
    const chartWidth = Number(wStr);
    // Inspect the x-axis baseline which spans (PAD_LEFT, PAD_LEFT + plotW)
    const baseline = Array.from(svg!.querySelectorAll("line")).find(
      (l) =>
        l.getAttribute("x1") &&
        l.getAttribute("x2") &&
        l.getAttribute("y1") === l.getAttribute("y2"),
    );
    expect(baseline).toBeTruthy();
    const plotLeft = Number(baseline!.getAttribute("x1"));
    const plotRight = Number(baseline!.getAttribute("x2"));
    expect(plotLeft).toBeGreaterThan(0);
    expect(plotRight).toBeLessThan(chartWidth);

    // All data-bar rects must be fully inside (plotLeft, plotRight).
    const bars = Array.from(svg!.querySelectorAll('rect[data-testid="timeline-tick"]'));
    for (const b of bars) {
      const x = Number(b.getAttribute("x"));
      const w = Number(b.getAttribute("width"));
      expect(x).toBeGreaterThanOrEqual(plotLeft);
      expect(x + w).toBeLessThanOrEqual(plotRight);
    }
    // Placeholder <line> ticks must also be inside [plotLeft, plotRight].
    const lineTicks = Array.from(svg!.querySelectorAll('line[data-testid="timeline-tick"]'));
    for (const l of lineTicks) {
      const x1 = Number(l.getAttribute("x1"));
      expect(x1).toBeGreaterThanOrEqual(plotLeft);
      expect(x1).toBeLessThanOrEqual(plotRight);
    }
  });

  it("does not render the standalone chart title", () => {
    const { container } = render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    // The on-chart title band used to read "DEA enforcement actions per year".
    // It should no longer exist as a visible heading above the chart. The
    // hidden data-table caption is allowed to retain its label.
    const titleBands = container.querySelectorAll('[class*="titleBand"]');
    expect(titleBands.length).toBe(0);
  });

  it("uses an enlarged chart viewBox (>=640 x >=360)", () => {
    const { container } = render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const viewBox = svg!.getAttribute("viewBox") ?? "0 0 0 0";
    const [, , wStr, hStr] = viewBox.split(" ");
    expect(Number(wStr)).toBeGreaterThanOrEqual(640);
    expect(Number(hStr)).toBeGreaterThanOrEqual(360);
  });

  it("does not render per-bar notable-action callout labels", () => {
    const { container } = render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const svgText = Array.from(svg!.querySelectorAll("text")).map((t) => t.textContent ?? "");
    for (const s of svgText) {
      expect(s).not.toMatch(/Operation X/);
      expect(s).not.toMatch(/Operation Y/);
    }
  });

  it("Act 3 step article has no caption paragraph beyond the headline", () => {
    // The Act 3 <Step> lives in app/page.tsx. We assert at the file-content
    // level that the legacy caption prose has been removed.
    const pagePath = resolve(__dirname, "../../app/page.tsx");
    const src = readFileSync(pagePath, "utf8");
    // Locate the Act 3 <Step id="act3"> ... </Step> block.
    const match = src.match(/<Step id="act3">[\s\S]*?<\/Step>/);
    expect(match, "Act 3 <Step> block not found").toBeTruthy();
    const block = match![0];
    // Caption prose like "Enforcement actions from the DEA Diversion Control
    // Division climbed..." must no longer be present.
    expect(block).not.toMatch(/Diversion Control Division/);
    expect(block).not.toMatch(/impossible to ignore/);
    expect(block).not.toMatch(/scale of the problem/);
  });
});
