import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimeSeries } from "@/components/charts/TimeSeries";

const DATA = [
  { year: 2006, value: 100 },
  { year: 2010, value: 300 },
  { year: 2014, value: 200 },
];

describe("TimeSeries", () => {
  it("renders an svg", () => {
    const { container } = render(
      <TimeSeries data={DATA} x="year" y="value" ariaLabel="Test trend" />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("exposes an aria-label summary", () => {
    const { container } = render(
      <TimeSeries data={DATA} x="year" y="value" ariaLabel="pills per year" />,
    );
    const root = container.firstElementChild;
    expect(root?.getAttribute("aria-label")).toMatch(/pills per year/);
  });

  it("renders a <details> fallback table with all points", () => {
    render(<TimeSeries data={DATA} x="year" y="value" ariaLabel="t" />);
    const summary = screen.getByText(/show data/i);
    expect(summary).toBeTruthy();
    expect(screen.getByText("2,006")).toBeTruthy();
    expect(screen.getByText("2,014")).toBeTruthy();
  });

  it("handles empty data without crashing", () => {
    const { container } = render(
      <TimeSeries data={[]} x="year" y="value" ariaLabel="t" />,
    );
    expect(container.querySelector("figure")).toBeTruthy();
  });
});
