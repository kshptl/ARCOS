import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Filters } from "@/components/explorer/Filters";

describe("Filters", () => {
  it("renders normalized metric buttons without the raw pills metric", () => {
    render(<Filters metric="pills_per_capita" onChange={() => {}} />);
    expect(screen.queryByLabelText(/Year/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Metric/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pills shipped" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pills per capita" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Overdose deaths per 100k" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows MME per capita as an explained unavailable metric", () => {
    render(<Filters metric="pills_per_capita" onChange={() => {}} />);
    const button = screen.getByRole("button", { name: "MME per capita" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-describedby");
    expect(screen.getByRole("tooltip")).toHaveTextContent(/morphine milligram equivalent/i);
    expect(screen.getByRole("tooltip")).toHaveTextContent(/requires drug strength/i);
  });

  it("fires onChange with the new metric", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Filters metric="pills_per_capita" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Overdose deaths per 100k" }));
    expect(onChange).toHaveBeenCalledWith({ metric: "deaths_per_100k" });
  });
});
