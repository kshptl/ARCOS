import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SimilarCounties } from "@/components/county/SimilarCounties";

describe("SimilarCounties", () => {
  it("renders a link per similar county", () => {
    render(
      <SimilarCounties
        current={{ fips: "54059", name: "Mingo", state: "WV", pop: 22999 }}
        similar={[
          {
            fips: "54099",
            name: "Logan",
            state: "WV",
            pop: 33000,
            pills_total: 500_000,
          },
          {
            fips: "54005",
            name: "Boone",
            state: "WV",
            pop: 22000,
            pills_total: 400_000,
          },
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/county/54099");
  });

  it("shows a placeholder when no peers", () => {
    render(
      <SimilarCounties
        current={{ fips: "54059", name: "Mingo", state: "WV", pop: 22999 }}
        similar={[]}
      />,
    );
    expect(screen.getByText(/no similar-county comparisons/i)).toBeInTheDocument();
  });
});
