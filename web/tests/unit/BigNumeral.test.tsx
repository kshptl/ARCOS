import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BigNumeral } from "@/components/brand/BigNumeral";

describe("<BigNumeral>", () => {
  it("renders the raw number with its unit", () => {
    render(<BigNumeral value={76_000_000_000} unit="pills" />);
    expect(screen.getByText("76,000,000,000")).toBeInTheDocument();
    expect(screen.getByText("pills")).toBeInTheDocument();
  });

  it("compacts when compact=true", () => {
    render(<BigNumeral value={76_000_000_000} unit="pills" compact />);
    expect(screen.getByText("76B")).toBeInTheDocument();
  });

  it("exposes an aria-label with compact + unit", () => {
    render(<BigNumeral value={76_000_000_000} unit="pills" compact ariaLabel="76 billion pills" />);
    expect(screen.getByRole("figure")).toHaveAttribute("aria-label", "76 billion pills");
  });

  it("uses tabular-nums", () => {
    render(<BigNumeral value={1234} unit="x" />);
    expect(screen.getByText("1,234").className).toMatch(/numeric/);
  });
});
