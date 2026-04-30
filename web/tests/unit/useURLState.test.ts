import { describe, expect, it } from "vitest";
import { parseQuery, serializeQuery } from "@/components/explorer/useURLState";

describe("useURLState helpers", () => {
  it("parseQuery extracts year + metric with defaults", () => {
    const s = parseQuery("?year=2010&metric=deaths", { year: 2012, metric: "pills" });
    expect(s.year).toBe(2010);
    expect(s.metric).toBe("deaths");
  });

  it("parseQuery falls back to defaults on missing keys", () => {
    const s = parseQuery("?metric=pills", { year: 2012, metric: "pills" });
    expect(s.year).toBe(2012);
  });

  it("parseQuery ignores invalid numeric year", () => {
    const s = parseQuery("?year=abc", { year: 2012, metric: "pills" });
    expect(s.year).toBe(2012);
  });

  it("parseQuery ignores invalid metric", () => {
    const s = parseQuery("?metric=explode", { year: 2012, metric: "pills" });
    expect(s.metric).toBe("pills");
  });

  it("serializeQuery emits year + metric keys", () => {
    expect(serializeQuery({ year: 2010, metric: "deaths" })).toBe("?year=2010&metric=deaths");
  });

  it("serializeQuery omits default values for shorter URLs", () => {
    expect(serializeQuery({ year: 2012, metric: "pills" }, { year: 2012, metric: "pills" })).toBe(
      "",
    );
  });
});
