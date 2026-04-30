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
    expect(screen.getByText(/Mingo, WV/)).toBeInTheDocument();
    expect(screen.getByText(/Kanawha, WV/)).toBeInTheDocument();
  });
});
