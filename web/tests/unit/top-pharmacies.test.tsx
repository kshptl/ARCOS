import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopPharmacies } from "@/components/county/TopPharmacies";

describe("TopPharmacies", () => {
  it("renders rows sorted desc by total_pills", () => {
    render(
      <TopPharmacies
        rows={[
          {
            pharmacy_id: "a",
            name: "Small",
            address: "1",
            fips: "54059",
            total_pills: 10,
          },
          {
            pharmacy_id: "b",
            name: "Big",
            address: "2",
            fips: "54059",
            total_pills: 999,
          },
        ]}
      />,
    );
    const rows = screen.getAllByRole("row").slice(1); // skip header
    expect(rows[0]).toHaveTextContent("Big");
  });

  it("shows a placeholder when empty", () => {
    render(<TopPharmacies rows={[]} />);
    expect(screen.getByText(/no pharmacy-level data/i)).toBeInTheDocument();
  });
});
