import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollyProgressContext } from "@/components/scrolly/progressContext";
import { Act3Enforcement } from "@/components/scrolly/scenes/Act3Enforcement";

const ACTIONS = [
  {
    year: 2008,
    action_count: 120,
    notable_actions: [{ title: "Operation X", url: "", target: null }],
  },
  { year: 2010, action_count: 180, notable_actions: [] },
  {
    year: 2012,
    action_count: 300,
    notable_actions: [{ title: "Operation Y", url: "", target: null }],
  },
  { year: 2013, action_count: 420, notable_actions: [] },
  { year: 2014, action_count: 520, notable_actions: [] },
];

describe("Act3Enforcement", () => {
  it("renders timeline ticks across a continuous 2006–2014 year axis", () => {
    render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    // Act 3 now renders a dense year axis (2006–2014 = 9 years) with a
    // bar-or-placeholder per year, not just per supplied data point.
    const ticks = screen.getAllByTestId("timeline-tick");
    expect(ticks.length).toBeGreaterThanOrEqual(9);
  });

  it("highlights 2012-14 inflection when progress > 0.5", () => {
    render(
      <ScrollyProgressContext.Provider value={0.8}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    expect(screen.getByTestId("inflection-zoom")).toBeInTheDocument();
  });

  it("renders notable-actions ticker table", () => {
    render(
      <ScrollyProgressContext.Provider value={1}>
        <Act3Enforcement actions={ACTIONS} />
      </ScrollyProgressContext.Provider>,
    );
    expect(screen.getByTestId("act3-table")).toBeInTheDocument();
  });
});
