import { describe, expect, it } from "vitest";
import { parseQuery, serializeQuery } from "@/components/explorer/useURLState";

describe("useURLState helpers", () => {
  it("parseQuery extracts year + metric with defaults", () => {
    const s = parseQuery("?year=2010&metric=deaths_per_100k", {
      year: 2012,
      metric: "pills_per_capita",
    });
    expect(s.year).toBe(2010);
    expect(s.metric).toBe("deaths_per_100k");
  });

  it("parseQuery falls back to defaults on missing keys", () => {
    const s = parseQuery("?metric=pills_per_capita", {
      year: 2012,
      metric: "pills_per_capita",
    });
    expect(s.year).toBe(2012);
  });

  it("parseQuery ignores invalid numeric year", () => {
    const s = parseQuery("?year=abc", { year: 2012, metric: "pills_per_capita" });
    expect(s.year).toBe(2012);
  });

  it("parseQuery ignores invalid metric", () => {
    const s = parseQuery("?metric=explode", { year: 2012, metric: "pills_per_capita" });
    expect(s.metric).toBe("pills_per_capita");
  });

  it("parseQuery upgrades the old deaths metric URL to deaths per 100k", () => {
    const s = parseQuery("?metric=deaths", { year: 2012, metric: "pills_per_capita" });
    expect(s.metric).toBe("deaths_per_100k");
  });

  it("serializeQuery emits year + metric keys", () => {
    expect(serializeQuery({ year: 2010, metric: "deaths_per_100k" })).toBe(
      "?year=2010&metric=deaths_per_100k",
    );
  });

  it("serializeQuery omits default values for shorter URLs", () => {
    expect(
      serializeQuery(
        { year: 2012, metric: "pills_per_capita" },
        { year: 2012, metric: "pills_per_capita" },
      ),
    ).toBe("");
  });
});
