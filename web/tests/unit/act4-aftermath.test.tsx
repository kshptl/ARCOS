import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

describe("Act4Aftermath", () => {
  it("renders 6 small-multiple sparklines", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    expect(screen.getAllByTestId("small-multiple")).toHaveLength(6);
  });

  it("renders a CTA link to /explorer", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act4Aftermath counties={COUNTIES} />
      </ScrollyProgressContext.Provider>,
    );
    const cta = screen.getByRole("link", { name: /See your county/i });
    expect(cta).toHaveAttribute("href", "/explorer");
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
});
