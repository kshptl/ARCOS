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

  it("hides shipment-derived ranks when the county is suppressed", () => {
    render(
      <RankCallouts
        meta={{ fips: "21119", name: "Knott", state: "KY", pop: 16232 }}
        ranks={{
          fips: "21119",
          national_rank: 3,
          national_total: 4,
          peer_rank: 2,
          peer_size: 2,
          overdose_rank: 5,
          overdose_total: 100,
        }}
        suppressed
      />,
    );
    // National + peer rank cards show em-dash, overdose-deaths rank still shows 5th.
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText("3rd")).toBeNull();
    expect(screen.queryByText("2nd")).toBeNull();
    expect(screen.getByText("5th")).toBeInTheDocument();
  });

  it("hides the peer-rank callout when there are no similar peers", () => {
    render(
      <RankCallouts
        meta={{ fips: "54059", name: "Mingo", state: "WV", pop: 22999 }}
        ranks={{
          fips: "54059",
          national_rank: 2,
          national_total: 4,
          peer_rank: 1,
          peer_size: 2,
          overdose_rank: 1,
          overdose_total: 10,
        }}
        hasSimilarPeers={false}
      />,
    );
    // National rank still rendered; peer-rank shows em-dash with "no comparable peers".
    expect(screen.getByText("2nd")).toBeInTheDocument();
    expect(screen.queryByText("1st")).not.toBeNull(); // overdose_rank 1 still rendered as 1st
    expect(screen.getByText(/no comparable peers/i)).toBeInTheDocument();
  });
});
