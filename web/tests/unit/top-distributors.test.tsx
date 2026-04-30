import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopDistributors } from "@/components/county/TopDistributors";

describe("TopDistributors", () => {
  it("renders a Bar chart when data is present", () => {
    render(
      <TopDistributors
        rows={[{ distributor: "McKesson", pills: 500_000_000, share_pct: 30 }]}
      />,
    );
    expect(screen.getByRole("figure")).toBeInTheDocument();
  });

  it("shows a placeholder when empty", () => {
    render(<TopDistributors rows={[]} />);
    expect(screen.getByText(/no distributor-level data/i)).toBeInTheDocument();
  });
});
