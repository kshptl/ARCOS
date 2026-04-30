import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { loadSimilarCounties, resetSimilarCache } from "@/lib/geo/similar";

beforeEach(() => {
  resetSimilarCache();
  readFileMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadSimilarCounties", () => {
  it("returns [] when file is absent", async () => {
    readFileMock.mockRejectedValueOnce(new Error("ENOENT"));
    await expect(loadSimilarCounties("00000")).resolves.toEqual([]);
  });

  it("returns ranked neighbors when file is present", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        "54059": [
          {
            fips: "54099",
            name: "Logan",
            state: "WV",
            pop: 33000,
            pills_total: 5,
          },
        ],
      }),
    );
    resetSimilarCache();
    const out = await loadSimilarCounties("54059");
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe("Logan");
  });
});
