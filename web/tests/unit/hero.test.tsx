import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hero } from "@/components/county/Hero";

describe("Hero", () => {
  it("renders county name, state, and stats", () => {
    const meta = { fips: "54059", name: "Mingo County", state: "WV", pop: 22999 };
    const bundle = {
      meta,
      shipments: [
        { fips: "54059", year: 2010, pills: 10_000_000, pills_per_capita: 435 },
        { fips: "54059", year: 2012, pills: 15_000_000, pills_per_capita: 652 },
      ],
      pharmacies: [],
      overdose: [],
    };
    render(<Hero meta={meta} bundle={bundle} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mingo County");
    expect(screen.getByText(/WV/)).toBeInTheDocument();
    expect(screen.getByText(/per person in 2012/i)).toBeInTheDocument();
  });

  it("renders em-dash and hides peak per-capita when all shipments are zero (suppressed)", () => {
    const meta = { fips: "21119", name: "Knott County", state: "KY", pop: 16232 };
    const bundle = {
      meta,
      shipments: [
        { fips: "21119", year: 2011, pills: 0, pills_per_capita: 0 },
        { fips: "21119", year: 2012, pills: 0, pills_per_capita: 0 },
        { fips: "21119", year: 2013, pills: 0, pills_per_capita: 0 },
      ],
      pharmacies: [],
      overdose: [],
    };
    render(<Hero meta={meta} bundle={bundle} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/per person in /i)).toBeNull();
    expect(screen.queryByText(/^0 pills$/)).toBeNull();
  });

  it("renders em-dash when shipments is an empty array", () => {
    const meta = { fips: "99999", name: "Nowhere County", state: "XX", pop: 1000 };
    const bundle = {
      meta,
      shipments: [],
      pharmacies: [],
      overdose: [],
    };
    render(<Hero meta={meta} bundle={bundle} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
