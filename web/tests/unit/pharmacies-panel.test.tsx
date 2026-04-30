import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const makeRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    pharmacy_id: `p${i}`,
    name: `Pharmacy ${i}`,
    address: "123 Main St",
    fips: "54059",
    total_pills: 1000 - i,
  }));

vi.mock("@/lib/data/parquet", () => ({
  fetchParquetRows: vi.fn(async () => makeRows(150)),
  readParquetRows: vi.fn(async () => []),
}));

import { PharmaciesPanel } from "@/app/rankings/PharmaciesPanel";
import { resetPharmacyPagesCache } from "@/app/rankings/usePharmacyPages";

beforeEach(() => {
  resetPharmacyPagesCache();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PharmaciesPanel", () => {
  it("renders first 100 then adds more on click", async () => {
    const user = userEvent.setup();
    render(<PharmaciesPanel />);
    await waitFor(() => expect(screen.getByText("Pharmacy 0")).toBeInTheDocument());
    expect(screen.queryByText("Pharmacy 100")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(screen.getByText("Pharmacy 100")).toBeInTheDocument());
    expect(screen.getByText(/showing all 150 pharmacies/i)).toBeInTheDocument();
  });
});
