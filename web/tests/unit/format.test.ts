import { describe, it, expect } from "vitest";
import { formatCompact, formatFull, formatOrdinal } from "@/lib/format/number";
import { formatPercent } from "@/lib/format/percent";
import { formatYearRange, formatISODate } from "@/lib/format/date";

describe("formatCompact", () => {
  it("formats thousands", () => {
    expect(formatCompact(12_345)).toBe("12.3K");
  });
  it("formats millions", () => {
    expect(formatCompact(5_600_000)).toBe("5.6M");
  });
  it("formats billions", () => {
    expect(formatCompact(76_000_000_000)).toBe("76B");
  });
  it("formats small numbers untouched", () => {
    expect(formatCompact(42)).toBe("42");
  });
  it("handles null/undefined", () => {
    expect(formatCompact(null)).toBe("—");
    expect(formatCompact(undefined)).toBe("—");
  });
});

describe("formatFull", () => {
  it("formats with thousands separators", () => {
    expect(formatFull(1_234_567)).toBe("1,234,567");
  });
  it("handles null/undefined", () => {
    expect(formatFull(null)).toBe("—");
  });
});

describe("formatOrdinal", () => {
  it("1 -> 1st", () => {
    expect(formatOrdinal(1)).toBe("1st");
  });
  it("2 -> 2nd", () => {
    expect(formatOrdinal(2)).toBe("2nd");
  });
  it("3 -> 3rd", () => {
    expect(formatOrdinal(3)).toBe("3rd");
  });
  it("4 -> 4th", () => {
    expect(formatOrdinal(4)).toBe("4th");
  });
  it("11 -> 11th", () => {
    expect(formatOrdinal(11)).toBe("11th");
  });
  it("21 -> 21st", () => {
    expect(formatOrdinal(21)).toBe("21st");
  });
  it("102 -> 102nd", () => {
    expect(formatOrdinal(102)).toBe("102nd");
  });
});

describe("formatPercent", () => {
  it("formats 0-100 input", () => {
    expect(formatPercent(37.5)).toBe("37.5%");
  });
  it("floors to one decimal by default", () => {
    expect(formatPercent(12.3456)).toBe("12.3%");
  });
  it("handles null", () => {
    expect(formatPercent(null)).toBe("—");
  });
});

describe("date formatters", () => {
  it("formats ISO date", () => {
    expect(formatISODate("2026-04-29")).toBe("Apr 29, 2026");
  });
  it("formats year range", () => {
    expect(formatYearRange(2006, 2014)).toBe("2006\u20132014");
  });
});
