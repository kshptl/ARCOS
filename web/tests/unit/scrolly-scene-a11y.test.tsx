import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  act1Summary,
  act2Summary,
  act3Summary,
  act4Summary,
} from "@/components/scrolly/sceneDataSummaries";

describe("scene data summaries", () => {
  it("act1 summary renders a data table of yearly pills", () => {
    render(
      <details open>
        <summary>Show data</summary>
        {act1Summary({
          totalPills: 76_000_000_000,
          yearly: [
            { year: 2006, pills: 8_000_000_000 },
            { year: 2014, pills: 9_000_000_000 },
          ],
        })}
      </details>,
    );
    const table = screen.getByRole("table");
    expect(table.textContent).toMatch(/2006/);
    expect(table.textContent).toMatch(/2014/);
  });

  it("act2 summary renders distributor share table", () => {
    render(
      <details open>
        <summary>Show data</summary>
        {act2Summary({ rows: [{ distributor: "McKesson", start: 40, end: 35, emphasized: true }] })}
      </details>,
    );
    expect(screen.getByRole("table").textContent).toContain("McKesson");
  });

  it("act3 summary renders enforcement actions table", () => {
    render(
      <details open>
        <summary>Show data</summary>
        {act3Summary({ actions: [{ year: 2012, action_count: 40, notable_actions: [] }] })}
      </details>,
    );
    expect(screen.getByRole("table").textContent).toContain("2012");
  });

  it("act4 summary renders counties table", () => {
    render(
      <details open>
        <summary>Show data</summary>
        {act4Summary({
          counties: [{ fips: "54059", name: "Mingo", state: "WV", deaths: [3, 5, 8] }],
        })}
      </details>,
    );
    expect(screen.getByRole("table").textContent).toContain("Mingo");
  });

  it("<details> is keyboard-operable", async () => {
    const user = userEvent.setup();
    render(
      <details>
        <summary>Show data</summary>
        {act1Summary({ totalPills: 1, yearly: [] })}
      </details>,
    );
    const summary = screen.getByText("Show data");
    await user.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
  });
});
