import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Filters } from "@/components/explorer/Filters";

describe("Filters", () => {
  it("renders metric buttons without a year dropdown", () => {
    render(<Filters metric="pills" onChange={() => {}} />);
    expect(screen.queryByLabelText(/Year/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Metric/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pills shipped" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("fires onChange with the new metric", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Filters metric="pills" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Overdose deaths" }));
    expect(onChange).toHaveBeenCalledWith({ metric: "deaths" });
  });
});
