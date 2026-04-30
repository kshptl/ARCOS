import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Step } from "@/components/scrolly/Step";

describe("Step", () => {
  it("renders its children", () => {
    render(
      <Step>
        <h3>Act 1</h3>
        <p>Scale</p>
      </Step>,
    );
    expect(screen.getByRole("heading", { name: "Act 1" })).toBeInTheDocument();
  });

  it("renders with data-step attribute when id provided", () => {
    render(
      <Step id="act-1-scale">
        <p>x</p>
      </Step>,
    );
    expect(screen.getByText("x").closest("[data-step]")).toHaveAttribute(
      "data-step",
      "act-1-scale",
    );
  });
});
