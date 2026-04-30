import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--mock-font", className: "mock" }),
}));

vi.mock("@/lib/data/loadCountyMeta", () => ({
  loadCountyMeta: async () => [{ fips: "54059", name: "Mingo County", state: "WV", pop: 26839 }],
  loadAllFips: async () => ["54059"],
  loadCountyMetaByFips: async () => null,
  resetCountyMetaCache: () => {},
}));

import Explorer from "@/app/explorer/page";

describe("/explorer stub", () => {
  it("renders county list with links", async () => {
    const ui = await Explorer();
    render(ui);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    const countyLink = screen.getByText(/Mingo County/i);
    expect(countyLink.closest("a")?.getAttribute("href")).toBe("/county/54059");
  });

  it("announces launching soon", async () => {
    const ui = await Explorer();
    render(ui);
    expect(screen.getByText(/launching/i)).toBeTruthy();
  });
});
