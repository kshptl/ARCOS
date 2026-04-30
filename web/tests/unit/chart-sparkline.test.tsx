import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "@/components/charts/Sparkline";

describe("Sparkline", () => {
  it("renders inline svg of default size", () => {
    const { container } = render(
      <Sparkline values={[1, 2, 3, 4, 5]} ariaLabel="rising" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("width")).toBe("100");
    expect(svg?.getAttribute("height")).toBe("24");
  });

  it("exposes aria-label", () => {
    const { container } = render(<Sparkline values={[1, 2]} ariaLabel="trend" />);
    expect(container.firstElementChild?.getAttribute("aria-label")).toBe("trend");
  });

  it("renders nothing visible for < 2 points but is not null", () => {
    const { container } = render(<Sparkline values={[]} ariaLabel="empty" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
