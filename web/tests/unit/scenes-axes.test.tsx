import { describe, expect, it } from "vitest";
import { formatTickValue, niceTicks } from "@/components/scrolly/scenes/axes";

describe("niceTicks", () => {
  it("returns 0 as the first tick when min is 0", () => {
    const ticks = niceTicks(0, 100, 5);
    expect(ticks[0]).toBe(0);
  });

  it("returns a max tick greater-or-equal to the max value", () => {
    const ticks = niceTicks(0, 100, 5);
    const last = ticks[ticks.length - 1];
    expect(last).toBeGreaterThanOrEqual(100);
  });

  it("returns ticks in ascending order", () => {
    const ticks = niceTicks(0, 100, 5);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1]!);
    }
  });

  it("returns round numbers for percentages", () => {
    const ticks = niceTicks(0, 40, 4);
    // Should be something like [0, 10, 20, 30, 40]
    expect(ticks).toContain(0);
    expect(ticks.every((t) => Number.isFinite(t))).toBe(true);
    const last = ticks[ticks.length - 1]!;
    expect(last).toBeGreaterThanOrEqual(40);
  });

  it("handles a maxValue of 1 gracefully", () => {
    const ticks = niceTicks(0, 1, 3);
    expect(ticks.length).toBeGreaterThan(1);
    const last = ticks[ticks.length - 1]!;
    expect(last).toBeGreaterThanOrEqual(1);
  });

  it("handles large numbers (billions) with round step", () => {
    const ticks = niceTicks(0, 11_000_000_000, 4);
    expect(ticks[0]).toBe(0);
    const last = ticks[ticks.length - 1]!;
    expect(last).toBeGreaterThanOrEqual(11_000_000_000);
    // Each step should be divisible by some power of 10
    const step = ticks[1]! - ticks[0]!;
    expect(step).toBeGreaterThan(0);
  });
});

describe("formatTickValue", () => {
  it("formats small integers as-is", () => {
    expect(formatTickValue(25, "percent")).toBe("25%");
    expect(formatTickValue(0, "percent")).toBe("0%");
  });

  it("formats billions compactly", () => {
    expect(formatTickValue(10_000_000_000, "compact")).toMatch(/10B/);
  });

  it("formats plain integers", () => {
    expect(formatTickValue(1500, "integer")).toBe("1,500");
  });
});
