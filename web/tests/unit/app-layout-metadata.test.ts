import { describe, it, expect, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--mock-font", className: "mock" }),
}));

import { metadata } from "@/app/layout";

describe("app/layout metadata", () => {
  it("has title default + template", () => {
    expect(metadata.title).toEqual({
      default: "openarcos — prescription opioid distribution in the US",
      template: "%s — openarcos",
    });
  });
  it("has a non-trivial description", () => {
    expect(typeof metadata.description).toBe("string");
    expect(String(metadata.description).length).toBeGreaterThan(40);
  });
  it("opts into metadata.openGraph with siteName", () => {
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.siteName).toBe("openarcos");
  });
});
