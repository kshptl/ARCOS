import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetSearchIndexCache,
  useSearchIndex,
} from "@/components/search/useSearchIndex";

const FIXTURE = [
  {
    type: "county",
    id: "54059",
    label: "Mingo County",
    sublabel: "WV",
    fips: "54059",
    state: "WV",
    total_pills: 123456,
  },
  {
    type: "city",
    id: "city:54:williamson",
    label: "Williamson",
    sublabel: "WV",
    fips: "54059",
    state: "WV",
    total_pills: 0,
  },
  {
    type: "distributor",
    id: "distributor:mckesson",
    label: "McKesson",
    sublabel: "distributor",
    total_pills: 999,
  },
  {
    type: "pharmacy",
    id: "pharmacy:1",
    label: "Tug Valley Pharmacy",
    sublabel: "Williamson, WV",
    fips: "54059",
    state: "WV",
    total_pills: 5000,
  },
  {
    type: "zip",
    id: "zip:25661",
    label: "25661",
    sublabel: "Williamson, WV",
    fips: "54059",
    state: "WV",
    total_pills: 0,
  },
];

beforeEach(() => {
  resetSearchIndexCache();
  globalThis.sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(FIXTURE), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSearchIndex", () => {
  it("starts idle, loads on load(), exposes MiniSearch", async () => {
    const { result } = renderHook(() => useSearchIndex());
    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.entries).toHaveLength(5);
    const hits = result.current.search("mingo");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.id).toBe("54059");
  });

  it("caches in sessionStorage and skips fetch on second hook instance", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const { result: r1 } = renderHook(() => useSearchIndex());
    await act(async () => {
      await r1.current.load();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resetSearchIndexCache(); // in-memory only; sessionStorage survives
    const { result: r2 } = renderHook(() => useSearchIndex());
    await act(async () => {
      await r2.current.load();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // not called again
    expect(r2.current.entries).toHaveLength(5);
  });

  it("returns status=error on fetch failure and exposes a retry via load()", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useSearchIndex());
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toContain("network down");

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(FIXTURE), { status: 200 }),
    );
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });
});
