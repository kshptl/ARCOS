import { describe, expect, it } from "vitest";
import {
  deathsColorScale,
  pillsColorScale,
  type RGBA,
  rgbToCss,
} from "@/components/map/colorScales";

describe("color scales", () => {
  it("pillsColorScale returns [r,g,b,a] for value inside domain", () => {
    const c = pillsColorScale(50, { domainMin: 0, domainMax: 100 });
    expect(c).toHaveLength(4);
    expect(c[0]).toBeGreaterThanOrEqual(0);
    expect(c[0]).toBeLessThanOrEqual(255);
    expect(c[3]).toBe(220);
  });

  it("pillsColorScale at min returns low-intensity color", () => {
    const low = pillsColorScale(0, { domainMin: 0, domainMax: 100 });
    const high = pillsColorScale(100, { domainMin: 0, domainMax: 100 });
    const lumLow = 0.2126 * low[0] + 0.7152 * low[1] + 0.0722 * low[2];
    const lumHigh = 0.2126 * high[0] + 0.7152 * high[1] + 0.0722 * high[2];
    expect(lumHigh).toBeGreaterThan(lumLow);
  });

  it("deathsColorScale returns cool-ramp color", () => {
    const c = deathsColorScale(5, { domainMin: 0, domainMax: 10 });
    expect(c[3]).toBe(220);
    expect(c[2]).toBeGreaterThan(50);
  });

  it("clamps out-of-range to domain endpoints", () => {
    const above = pillsColorScale(9999, { domainMin: 0, domainMax: 100 });
    const atMax = pillsColorScale(100, { domainMin: 0, domainMax: 100 });
    expect(above).toEqual(atMax);
    const below = pillsColorScale(-5, { domainMin: 0, domainMax: 100 });
    const atMin = pillsColorScale(0, { domainMin: 0, domainMax: 100 });
    expect(below).toEqual(atMin);
  });

  it("returns suppressed/null color for null value", () => {
    const n = pillsColorScale(null as unknown as number, { domainMin: 0, domainMax: 100 });
    expect(n[3]).toBeGreaterThan(0);
    expect(n[0]).toEqual(n[1]);
    expect(n[1]).toEqual(n[2]);
  });

  it("rgbToCss formats for CSS", () => {
    const arr: RGBA = [10, 20, 30, 255];
    expect(rgbToCss(arr)).toBe("rgba(10, 20, 30, 1)");
    expect(rgbToCss([10, 20, 30, 128] as RGBA)).toMatch(/rgba\(10, 20, 30, 0\.5/);
  });
});
