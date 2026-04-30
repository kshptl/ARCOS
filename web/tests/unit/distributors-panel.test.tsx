import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DistributorsPanel } from "@/app/rankings/DistributorsPanel";

describe("DistributorsPanel", () => {
  it("renders a row per distributor with rank and a target anchor id", () => {
    const rows = [
      {
        distributor: "McKesson",
        slug: "mckesson",
        total_pills: 10_000_000_000,
        mean_rank: 1,
        share_pct_by_year: [
          { year: 2006, share_pct: 22.1, pills: 1 },
          { year: 2014, share_pct: 23.4, pills: 1 },
        ],
      },
    ];
    render(<DistributorsPanel rows={rows} />);
    expect(screen.getByText("McKesson")).toBeInTheDocument();
    const row = document.getElementById("distributor-mckesson");
    expect(row).not.toBeNull();
  });

  it("shows a placeholder when empty", () => {
    render(<DistributorsPanel rows={[]} />);
    expect(screen.getByText(/no distributor data/i)).toBeInTheDocument();
  });
});
