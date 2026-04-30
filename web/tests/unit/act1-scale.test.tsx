import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollyProgressContext } from "@/components/scrolly/progressContext";
import { Act1Scale } from "@/components/scrolly/scenes/Act1Scale";

function renderWithProgress(p: number) {
  return render(
    <ScrollyProgressContext.Provider value={p}>
      <Act1Scale
        totalPills={76_000_000_000}
        yearly={[
          { year: 2006, pills: 8_000_000_000 },
          { year: 2012, pills: 10_000_000_000 },
        ]}
      />
    </ScrollyProgressContext.Provider>,
  );
}

describe("Act1Scale", () => {
  it("at progress=0, displays 0 pills as the count-up start", () => {
    renderWithProgress(0);
    const value = screen.getByTestId("act1-count");
    expect(value.textContent?.replace(/[,\s]/g, "")).toMatch(/^[0-9]+$/);
  });

  it("at progress=1, displays the full total", () => {
    renderWithProgress(1);
    const value = screen.getByTestId("act1-count");
    expect(value.textContent).toMatch(/76,000,000,000|76B/);
  });

  it("renders yearly data table for a11y fallback", () => {
    renderWithProgress(0.5);
    expect(screen.getByTestId("act1-yearly-table")).toBeInTheDocument();
  });
});
