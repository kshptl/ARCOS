import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollyProgressContext } from "@/components/scrolly/progressContext";
import { Act4Aftermath } from "@/components/scrolly/scenes/Act4Aftermath";

const COUNTIES = [
  { fips: "54059", name: "Mingo", state: "WV", deaths: [10, 12, 15, 20, 25, 30] },
  { fips: "54047", name: "McDowell", state: "WV", deaths: [8, 10, 14, 18, 22, 28] },
  { fips: "51720", name: "Norton", state: "VA", deaths: [5, 6, 8, 10, 12, 15] },
  { fips: "21071", name: "Floyd", state: "KY", deaths: [6, 8, 10, 12, 14, 18] },
  { fips: "21195", name: "Pike", state: "KY", deaths: [7, 9, 11, 13, 15, 19] },
  { fips: "54039", name: "Kanawha", state: "WV", deaths: [20, 25, 30, 35, 40, 50] },
];

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Act4Aftermath", () => {
  it("renders 6 small-multiple sparklines", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    expect(screen.getAllByTestId("small-multiple")).toHaveLength(6);
  });

  it("does not render a /explorer CTA inside the canvas (it lives in the step)", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    // The canvas is marked inert during scroll, so the CTA must live in
    // the Step article (rendered separately in app/page.tsx), never inside
    // Act4Aftermath itself.
    const exploreLinks = screen
      .queryAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/explorer");
    expect(exploreLinks).toHaveLength(0);
    expect(screen.queryByText(/^See your county/i)).toBeNull();
  });

  it("includes county-label for each multiple", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    // Name and 2-letter state are now rendered in separate elements within
    // the card (display font + muted eyebrow, respectively).
    expect(screen.getByText(/^Mingo$/)).toBeInTheDocument();
    expect(screen.getByText(/^Kanawha$/)).toBeInTheDocument();
    const wvLabels = screen.getAllByText(/^WV$/);
    expect(wvLabels.length).toBeGreaterThan(0);
  });

  it("wraps each card in a link to /county/<fips>", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    const mingoLink = screen.getByRole("link", { name: /Mingo/i });
    expect(mingoLink).toHaveAttribute("href", "/county/54059");
  });

  it("marks peak point on each sparkline with ≥2 data points", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    expect(screen.getAllByTestId("spark-peak").length).toBe(6);
  });

  it("does not render sparkline / flatter-lines explanatory caption", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    expect(screen.queryByText(/flatter lines/i)).toBeNull();
    expect(screen.queryByText(/sparklines/i)).toBeNull();
    expect(screen.queryByText(/same y-scale/i)).toBeNull();
    expect(screen.queryByText(/suppressed death counts/i)).toBeNull();
  });

  it("does not render per-card captions beyond county name + state", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    // No range/peak/latest caption strings
    expect(screen.queryByText(/peak yr/i)).toBeNull();
    expect(screen.queryByText(/latest/i)).toBeNull();
    expect(screen.queryByText(/→/)).toBeNull();
    expect(screen.queryByText(/max /i)).toBeNull();
    // The only figcaption per figure should be the county name
    const figures = screen.getAllByTestId("small-multiple");
    for (const fig of figures) {
      const caps = fig.querySelectorAll("figcaption");
      expect(caps.length).toBeLessThanOrEqual(1);
    }
  });

  it("renders first + last death-count values on each sparkline as SVG text", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    const figures = screen.getAllByTestId("small-multiple");
    expect(figures).toHaveLength(6);
    for (let i = 0; i < figures.length; i++) {
      const fig = figures[i]!;
      const county = COUNTIES[i]!;
      const labels = fig.querySelectorAll('[data-testid="spark-endpoint"]');
      expect(labels.length).toBe(2);
      const first = labels[0] as SVGTextElement;
      const last = labels[1] as SVGTextElement;
      expect(first.textContent).toBe(String(county.deaths[0]));
      expect(last.textContent).toBe(String(county.deaths[county.deaths.length - 1]));
    }
  });

  it("at progress=0.1, first cards are visible and last cards are still hidden", () => {
    render(
      <ScrollyProgressContext.Provider value={0.1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    const figures = screen.getAllByTestId("small-multiple");
    const op = (el: Element) => Number((el as HTMLElement).style.opacity || "1");
    expect(op(figures[0]!)).toBeGreaterThan(0);
    expect(op(figures[1]!)).toBeGreaterThan(0);
    expect(op(figures[4]!)).toBeLessThanOrEqual(0.01);
    expect(op(figures[5]!)).toBeLessThanOrEqual(0.01);
  });

  it("at progress=0.5, all cards are fully visible and sparklines are partially drawn", () => {
    render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    const figures = screen.getAllByTestId("small-multiple");
    for (const fig of figures) {
      const opacity = Number((fig as HTMLElement).style.opacity || "1");
      expect(opacity).toBe(1);
    }
    // At least the last card's line should still be partially drawn.
    const lastPath = figures[5]!.querySelector("path[data-testid='spark-line']") as SVGPathElement;
    expect(lastPath).toBeTruthy();
    const offset = Number(lastPath.style.strokeDashoffset || "0");
    expect(offset).toBeGreaterThan(0);
  });

  it("at progress=1, all cards opacity=1 and all sparklines fully drawn (dashoffset=0)", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    const figures = screen.getAllByTestId("small-multiple");
    for (const fig of figures) {
      const opacity = Number((fig as HTMLElement).style.opacity || "1");
      expect(opacity).toBe(1);
      const path = fig.querySelector("path[data-testid='spark-line']") as SVGPathElement;
      const offset = Number(path.style.strokeDashoffset || "0");
      expect(offset).toBe(0);
    }
  });

  it("with prefers-reduced-motion, all cards opacity=1 and lines fully drawn regardless of progress", () => {
    stubMatchMedia(true);
    render(
      <ScrollyProgressContext.Provider value={0}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    const figures = screen.getAllByTestId("small-multiple");
    for (const fig of figures) {
      const opacity = Number((fig as HTMLElement).style.opacity || "1");
      expect(opacity).toBe(1);
      const path = fig.querySelector("path[data-testid='spark-line']") as SVGPathElement;
      const offset = Number(path.style.strokeDashoffset || "0");
      expect(offset).toBe(0);
    }
  });

  it("does not render a chart title / title band text", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    expect(screen.queryByText(/heavily shipped counties/i)).toBeNull();
    expect(screen.queryByText(/overdose deaths per year/i)).toBeNull();
    expect(screen.queryByText(/six heavily shipped/i)).toBeNull();
  });
});

describe("Act4 step caption (app/page.tsx)", () => {
  it("does not render the 'pills came in waves' caption prose", () => {
    const page = readFileSync(resolve(__dirname, "../../app/page.tsx"), "utf-8");
    expect(page).not.toMatch(/pills came in waves/i);
    expect(page).not.toMatch(/steepest casualties/i);
    expect(page).not.toMatch(/heaviest per-capita shipments/i);
  });
});
