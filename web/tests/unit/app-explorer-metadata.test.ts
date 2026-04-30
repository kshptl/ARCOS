import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--mock-font", className: "mock" }),
}));

vi.mock("@/lib/data/loadCountyMeta", () => ({
  loadCountyMeta: vi.fn().mockResolvedValue([]),
}));

import { metadata } from "@/app/explorer/page";

describe("app/explorer metadata", () => {
  it("has plain 'Explorer' title so layout template does not double-append ' — openarcos'", () => {
    // The root layout's `title.template` is "%s — openarcos"; this page's
    // title must be the short form. Using "Explorer — openarcos" here causes
    // Next to render "Explorer — openarcos — openarcos" in <title>.
    expect(metadata.title).toBe("Explorer");
  });
});
