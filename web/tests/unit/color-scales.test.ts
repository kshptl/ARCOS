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

  it("pillsColorScale moves from warm cream to dark maroon", () => {
    const low = pillsColorScale(0, { domainMin: 0, domainMax: 100 });
    const high = pillsColorScale(100, { domainMin: 0, domainMax: 100 });
    expect(low.slice(0, 3)).toEqual([244, 237, 217]);
    expect(high.slice(0, 3)).toEqual([93, 24, 28]);
  });

  it("deathsColorScale returns a warm palette color", () => {
    const c = deathsColorScale(5, { domainMin: 0, domainMax: 10 });
    expect(c[3]).toBe(220);
    expect(c[0]!).toBeGreaterThan(c[2]!);
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
    expect(n.slice(0, 3)).toEqual([222, 214, 200]);
  });

  it("rgbToCss formats for CSS", () => {
    const arr: RGBA = [10, 20, 30, 255];
    expect(rgbToCss(arr)).toBe("rgba(10, 20, 30, 1)");
    expect(rgbToCss([10, 20, 30, 128] as RGBA)).toMatch(/rgba\(10, 20, 30, 0\.5/);
  });
});
