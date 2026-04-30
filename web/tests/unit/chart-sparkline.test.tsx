import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "@/components/charts/Sparkline";

describe("Sparkline", () => {
  it("renders inline svg of default size", () => {
    const { container } = render(<Sparkline values={[1, 2, 3, 4, 5]} ariaLabel="rising" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("width")).toBe("100");
    expect(svg?.getAttribute("height")).toBe("24");
  });

  it("exposes aria-label", () => {
    const { container } = render(<Sparkline values={[1, 2]} ariaLabel="trend" />);
    expect(container.firstElementChild?.getAttribute("aria-label")).toBe("trend");
  });

  it("renders nothing visible for empty values but SVG is present", () => {
    const { container } = render(<Sparkline values={[]} ariaLabel="empty" />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("path")).toBeFalsy();
    expect(container.querySelector("circle")).toBeFalsy();
  });

  it("renders a visible dot for a single data point", () => {
    // Real pipeline data currently only covers one year for some distributors;
    // a single point should still render something visible, not an empty box.
    const { container } = render(<Sparkline values={[42]} ariaLabel="one" />);
    const marker = container.querySelector("circle");
    expect(marker).toBeTruthy();
  });

  it("renders a line for two data points", () => {
    const { container } = render(<Sparkline values={[10, 20]} ariaLabel="two" />);
    const path = container.querySelector("path");
    expect(path).toBeTruthy();
    // Path has a move + line command
    expect(path?.getAttribute("d")).toMatch(/^M.*L/);
  });
});
