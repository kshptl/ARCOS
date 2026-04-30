import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/format/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("McKesson Corporation")).toBe("mckesson-corporation");
  });
  it("strips punctuation", () => {
    expect(slugify("AmerisourceBergen, Inc.")).toBe("amerisourcebergen-inc");
  });
});
