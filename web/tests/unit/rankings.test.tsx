import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs } from "@/app/rankings/Tabs";

describe("Tabs", () => {
  it("renders tabs with correct aria and switches panels on click", async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        tabs={[
          { key: "a", label: "Alpha", panel: <p>alpha-panel</p> },
          { key: "b", label: "Beta", panel: <p>beta-panel</p> },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("alpha-panel")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Beta" }));
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("beta-panel")).toBeInTheDocument();
  });
});
