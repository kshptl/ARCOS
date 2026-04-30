import { beforeEach, describe, expect, it, vi } from "vitest";

const readFileMock = vi.fn();

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("node:fs/promises");
  return {
    ...actual,
    default: {
      ...actual,
      readFile: (...args: unknown[]) => readFileMock(...args),
    },
    readFile: (...args: unknown[]) => readFileMock(...args),
  };
});

import {
  loadCountyMeta,
  loadCountyMetaByFips,
  resetCountyMetaCache,
} from "@/lib/data/loadCountyMeta";

describe("loadCountyMeta", () => {
  beforeEach(() => {
    resetCountyMetaCache();
    readFileMock.mockReset();
  });

  it("returns the full county-metadata array", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify([
        { fips: "54059", name: "Mingo County", state: "WV", pop: 26839 },
        { fips: "51720", name: "Norton", state: "VA", pop: 3867 },
      ]),
    );
    const rows = await loadCountyMeta();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.fips).toBe("54059");
  });

  it("caches across calls", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify([{ fips: "54059", name: "Mingo County", state: "WV", pop: 26839 }]),
    );
    await loadCountyMeta();
    await loadCountyMeta();
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });

  it("looks up one county by fips", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify([
        { fips: "54059", name: "Mingo County", state: "WV", pop: 26839 },
        { fips: "51720", name: "Norton", state: "VA", pop: 3867 },
      ]),
    );
    const row = await loadCountyMetaByFips("51720");
    expect(row?.name).toBe("Norton");
  });

  it("returns null for missing fips", async () => {
    readFileMock.mockResolvedValueOnce(JSON.stringify([]));
    const row = await loadCountyMetaByFips("99999");
    expect(row).toBeNull();
  });
});
