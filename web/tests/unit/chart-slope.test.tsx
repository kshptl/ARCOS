import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Slope } from "@/components/charts/Slope";

const DATA = [
  { name: "McKesson", start: 3_000_000_000, end: 6_000_000_000 },
  { name: "Cardinal", start: 2_500_000_000, end: 4_500_000_000 },
  { name: "Mom & Pop", start: 1_000_000, end: 800_000 },
];

describe("Slope", () => {
  it("renders labels for each row", () => {
    render(
      <Slope
        data={DATA}
        left={{ key: "start", label: "2006" }}
        right={{ key: "end", label: "2014" }}
        rowLabelKey="name"
        ariaLabel="top distributors 2006–2014"
      />,
    );
    expect(screen.getByText("McKesson")).toBeTruthy();
    expect(screen.getByText("Cardinal")).toBeTruthy();
  });

  it("applies featured emphasis via highlight", () => {
    const { container } = render(
      <Slope
        data={DATA}
        left={{ key: "start", label: "2006" }}
        right={{ key: "end", label: "2014" }}
        rowLabelKey="name"
        highlight={(d) => d.name === "McKesson"}
        ariaLabel="top"
      />,
    );
    const strokes = Array.from(container.querySelectorAll("line")).map((l) =>
      l.getAttribute("stroke"),
    );
    expect(strokes.some((s) => s?.includes("accent-hot"))).toBe(true);
  });

  it("has aria-label", () => {
    const { container } = render(
      <Slope
        data={DATA}
        left={{ key: "start", label: "2006" }}
        right={{ key: "end", label: "2014" }}
        rowLabelKey="name"
        ariaLabel="top distributors 2006–2014"
      />,
    );
    expect(container.querySelector("figure")?.getAttribute("aria-label")).toMatch(
      /top distributors/,
    );
  });
});
