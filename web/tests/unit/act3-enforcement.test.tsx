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

  it("Act 3 step articles do not carry legacy monotonic-scale-up prose", () => {
    // The Act 3 <Step>s live in app/page.tsx. We assert at the file-content
    // level that legacy monotonic scale-up prose has been removed.
    const pagePath = resolve(__dirname, "../../app/page.tsx");
    const src = readFileSync(pagePath, "utf8");
    // Locate all Act 3 <Step id="act3..."> ... </Step> blocks.
    const matches = src.match(/<Step id="act3[^"]*">[\s\S]*?<\/Step>/g);
    expect(matches, "Act 3 <Step> blocks not found").toBeTruthy();
    const combined = (matches ?? []).join("\n");
    // Prose that implies a monotonic scale-up or the old synthetic narrative
    // must no longer appear anywhere in the Act 3 step articles.
    expect(combined).not.toMatch(/Diversion Control Division/);
    expect(combined).not.toMatch(/impossible to ignore/);
    expect(combined).not.toMatch(/scale of the problem/);
    expect(combined).not.toMatch(/regulators catch up/i);
    expect(combined).not.toMatch(/federal enforcement scaled up/i);
    expect(combined).not.toMatch(/scaling up/i);
    expect(combined).not.toMatch(/clustering around 2012/i);
    expect(combined).not.toMatch(/early 2010s/i);
  });

  it("Act 3 step articles tell the peak-then-retreat story", () => {
    // Assert at file-content level that the four new step captions are
    // present in app/page.tsx. We pick an anchor phrase from each caption.
    const pagePath = resolve(__dirname, "../../app/page.tsx");
    const src = readFileSync(pagePath, "utf8");
    const matches = src.match(/<Step id="act3[^"]*">[\s\S]*?<\/Step>/g);
    expect(matches, "Act 3 <Step> blocks not found").toBeTruthy();
    const combined = (matches ?? []).join("\n");

    // Step A — low baseline, late 2000s.
    expect(combined).toMatch(/low baseline/i);
    expect(combined).toMatch(/20 to 40/);
    // Step B — 2011 peak.
    expect(combined).toMatch(/69/);
    expect(combined).toMatch(/pharmacy-chain/i);
    // Step C — 2012-2013 shift: landmark settlements, fewer total actions.
    expect(combined).toMatch(/\$34M/);
    expect(combined).toMatch(/\$80M/);
    expect(combined).toMatch(/\$22M/);
    expect(combined).toMatch(/Cardinal Health/);
    expect(combined).toMatch(/Walgreens/);
    expect(combined).toMatch(/CVS/);
    // Step D — 2014 decline + 2016 law.
    expect(combined).toMatch(/Ensuring Patient Access/);
    expect(combined).toMatch(/2016/);
  });

  it("data-table caption reflects the Federal Register publication metric", () => {
    // The data-table caption is the user-visible label for the chart (the
    // on-canvas title band was removed earlier). It must describe the real
    // metric — Federal Register final orders / registrant actions published
    // — not the vague prior wording "enforcement actions per year".
    render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    const table = screen.getByTestId("act3-table");
    const caption = table.querySelector("caption");
    expect(caption?.textContent ?? "").toMatch(/Final Orders.*Registrant Actions.*Published/i);
  });

  it("does not render the residual 'Federal enforcement scaled up' subCaption inside the canvas", () => {
    // A <p class="subCaption"> beneath the SVG was surviving in the Act 3
    // scene after the step caption was removed. User asked for the canvas
    // to be title/caption/callout-free; assert there are no paragraphs
    // rendered inside the Act 3 scene, and none of the old caption text is
    // present.
    const { container } = render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    // No <p> element anywhere in the Act 3 scene.
    expect(container.querySelectorAll("p").length).toBe(0);
    // No class name containing "subCaption" on any element.
    expect(container.querySelectorAll('[class*="subCaption"]').length).toBe(0);
    // Canvas-level caption prose must be gone.
    expect(container.textContent ?? "").not.toMatch(/Federal enforcement/);
    expect(container.textContent ?? "").not.toMatch(/clustering around 2012/);
  });
});
