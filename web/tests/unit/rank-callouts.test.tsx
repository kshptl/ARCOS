import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RankCallouts } from "@/components/county/RankCallouts";

describe("RankCallouts", () => {
  it("renders ordinal ranks and counts", () => {
    render(
      <RankCallouts
        meta={{ fips: "54059", name: "Mingo", state: "WV", pop: 22999 }}
        ranks={{
          fips: "54059",
          national_rank: 12,
          national_total: 3143,
          peer_rank: 3,
          peer_size: 210,
          overdose_rank: 8,
          overdose_total: 2400,
        }}
      />,
    );
    expect(screen.getByText("12th")).toBeInTheDocument();
    expect(screen.getByText("3rd")).toBeInTheDocument();
    expect(screen.getByText("8th")).toBeInTheDocument();
  });

  it("shows an em-dash when ranks are missing", () => {
    render(
      <RankCallouts
        meta={{ fips: "54059", name: "Mingo", state: "WV", pop: 22999 }}
        ranks={{
          fips: "54059",
          national_rank: 0,
          national_total: 0,
          peer_rank: 0,
          peer_size: 0,
          overdose_rank: null,
          overdose_total: 0,
        }}
      />,
    );
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});
