import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataLoader } from "@/components/explorer/DataLoader";

vi.mock("@/lib/data/parquet", () => ({
  fetchParquetRows: vi.fn().mockResolvedValue([
    { fips: "54059", year: 2012, pills: 1000, pills_per_capita: 38 },
    { fips: "54047", year: 2012, pills: 500, pills_per_capita: 18 },
    { fips: "54059", year: 2011, pills: 800, pills_per_capita: 30 },
  ]),
  readParquetRows: vi.fn(),
}));

describe("DataLoader", () => {
  it("groups rows by year and calls onData once per year", async () => {
    const onData = vi.fn();
    render(<DataLoader year={2012} onData={onData} />);
    await waitFor(() => expect(onData).toHaveBeenCalled());
    const years = onData.mock.calls.map((c: unknown[]) => c[0]);
    expect(years).toContain(2012);
    expect(years).toContain(2011);
    const values2012 = onData.mock.calls.find((c: unknown[]) => c[0] === 2012)?.[1] as Map<
      string,
      number
    >;
    expect(values2012.get("54059")).toBe(1000);
  });

  it("falls back gracefully when parquet fetch throws", async () => {
    const { fetchParquetRows } = await import("@/lib/data/parquet");
    vi.mocked(fetchParquetRows).mockRejectedValueOnce(new Error("boom"));
    const onData = vi.fn();
    const onError = vi.fn();
    render(<DataLoader year={2012} onData={onData} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
});
