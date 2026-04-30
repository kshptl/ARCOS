import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bar } from "@/components/charts/Bar";

const DATA = [
  { label: "McKesson", value: 5_000_000_000 },
  { label: "Cardinal", value: 4_000_000_000 },
  { label: "AmerisourceBergen", value: 3_000_000_000 },
];

describe("Bar", () => {
  it("renders a bar per item", () => {
    const { container } = render(<Bar data={DATA} ariaLabel="top distributors" />);
    expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(3);
  });

  it("labels include tabular-figure-formatted numbers", () => {
    render(<Bar data={DATA} ariaLabel="top distributors" />);
    expect(screen.getByText(/5\.0B|5B/)).toBeTruthy();
  });

  it("exposes aria-label summary mentioning the top item", () => {
    const { container } = render(<Bar data={DATA} ariaLabel="top distributors" />);
    const figure = container.querySelector("figure");
    expect(figure?.getAttribute("aria-label")).toMatch(/top distributors/i);
    expect(figure?.getAttribute("aria-label")).toMatch(/McKesson/i);
  });
});
