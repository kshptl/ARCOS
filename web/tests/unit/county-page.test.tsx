import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--mock-font", className: "mock" }),
}));

vi.mock("@/lib/data/loadCountyMeta", () => ({
  loadAllFips: vi.fn(async () => ["54059"]),
  loadCountyMetaByFips: vi.fn(async () => ({
    fips: "54059",
    name: "Mingo County",
    state: "WV",
    pop: 22999,
  })),
  resetCountyMetaCache: vi.fn(),
}));
vi.mock("@/lib/data/loadCountyBundle", () => ({
  loadCountyBundle: vi.fn(async () => ({
    meta: { fips: "54059", name: "Mingo County", state: "WV", pop: 22999 },
    shipments: [{ fips: "54059", year: 2012, pills: 15_000_000, pills_per_capita: 652 }],
    pharmacies: [],
    overdose: [],
  })),
}));
vi.mock("@/lib/data/loadCountyRanks", () => ({
  loadCountyRanks: vi.fn(async () => ({
    fips: "54059",
    national_rank: 12,
    national_total: 3143,
    peer_rank: 3,
    peer_size: 210,
    overdose_rank: 8,
    overdose_total: 2400,
  })),
  resetCountyRanksCache: vi.fn(),
}));
vi.mock("@/lib/data/loadCountyDistributors", () => ({
  loadCountyDistributors: vi.fn(async () => []),
  resetCountyDistributorsCache: vi.fn(),
}));
vi.mock("@/lib/data/loadStateShipments", () => ({
  loadStateShipments: vi.fn(async () => []),
  loadStateShipmentsByState: vi.fn(async () => new Map()),
  resetStateShipmentsCache: vi.fn(),
}));
vi.mock("@/lib/geo/similar", () => ({
  loadSimilarCounties: vi.fn(async () => []),
  resetSimilarCache: vi.fn(),
}));

import CountyPage, { generateMetadata, generateStaticParams } from "@/app/county/[fips]/page";

describe("CountyPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generateStaticParams returns all fips", async () => {
    await expect(generateStaticParams()).resolves.toEqual([{ fips: "54059" }]);
  });

  it("generateMetadata uses meta", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ fips: "54059" }) }),
    ).resolves.toMatchObject({
      title: "Mingo County, WV",
    });
  });

  it("renders the page for a known FIPS", async () => {
    const ui = await CountyPage({ params: Promise.resolve({ fips: "54059" }) });
    render(ui);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Mingo County/);
  });
});
