import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataLoader } from "@/components/explorer/DataLoader";
import { fetchParquetRows } from "@/lib/data/parquet";

vi.mock("@/lib/data/parquet", () => ({
  fetchParquetRows: vi.fn(),
  readParquetRows: vi.fn(),
}));

const rows = [
  { fips: "54059", year: 2012, pills: 1000, pills_per_capita: 38 },
  { fips: "54047", year: 2012, pills: 500, pills_per_capita: 18 },
  { fips: "54059", year: 2011, pills: 800, pills_per_capita: 30 },
];

const deathRows = [
  { fips: "54059", year: 2012, deaths: 42, suppressed: false },
  { fips: "54047", year: 2012, deaths: null, suppressed: true },
  { fips: "54059", year: 2011, deaths: 35, suppressed: false },
];

describe("DataLoader", () => {
  beforeEach(() => {
    vi.mocked(fetchParquetRows).mockReset();
    vi.mocked(fetchParquetRows).mockResolvedValue(rows);
  });

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

  it("does not refetch parquet when parent callbacks change during a render", async () => {
    let resolveRows: (value: typeof rows) => void = () => {};
    const rowsPromise = new Promise<typeof rows>((resolve) => {
      resolveRows = resolve;
    });
    vi.mocked(fetchParquetRows).mockReset();
    vi.mocked(fetchParquetRows).mockReturnValue(rowsPromise);

    const firstOnData = vi.fn();
    const secondOnData = vi.fn();
    const { rerender } = render(<DataLoader year={2012} onData={firstOnData} />);

    expect(fetchParquetRows).toHaveBeenCalledTimes(1);
    rerender(<DataLoader year={2012} onData={secondOnData} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchParquetRows).toHaveBeenCalledTimes(1);

    resolveRows(rows);
    await waitFor(() => expect(secondOnData).toHaveBeenCalled());
    expect(firstOnData).not.toHaveBeenCalled();
  });

  it("does not refetch parquet when changing the metric", async () => {
    const onData = vi.fn();
    const { rerender } = render(<DataLoader year={2012} metric="pills" onData={onData} />);

    await waitFor(() => expect(onData).toHaveBeenCalled());
    const firstValues2012 = onData.mock.calls.find((c: unknown[]) => c[0] === 2012)?.[1] as Map<
      string,
      number
    >;
    expect(firstValues2012.get("54059")).toBe(1000);
    expect(fetchParquetRows).toHaveBeenCalledTimes(1);

    onData.mockClear();
    rerender(<DataLoader year={2012} metric="pills_per_capita" onData={onData} />);

    await waitFor(() => expect(onData).toHaveBeenCalled());
    const secondValues2012 = onData.mock.calls.find((c: unknown[]) => c[0] === 2012)?.[1] as Map<
      string,
      number
    >;
    expect(secondValues2012.get("54059")).toBe(38);
    expect(fetchParquetRows).toHaveBeenCalledTimes(1);
  });

  it("loads overdose deaths from the CDC parquet instead of shipment pills", async () => {
    vi.mocked(fetchParquetRows).mockImplementation((url: string) => {
      if (url.includes("cdc-overdose")) return Promise.resolve(deathRows);
      return Promise.resolve(rows);
    });

    const onData = vi.fn();
    render(<DataLoader year={2012} metric="deaths" onData={onData} />);

    await waitFor(() => expect(onData).toHaveBeenCalled());
    const values2012 = onData.mock.calls.find((c: unknown[]) => c[0] === 2012)?.[1] as Map<
      string,
      number
    >;
    expect(values2012.get("54059")).toBe(42);
    expect(values2012.get("54047")).toBe(0);
    expect(fetchParquetRows).toHaveBeenCalledWith(
      "/data/cdc-overdose-by-county-year.parquet",
      expect.any(Object),
    );
  });

  it("falls back gracefully when parquet fetch throws", async () => {
    vi.mocked(fetchParquetRows).mockRejectedValueOnce(new Error("boom"));
    const onData = vi.fn();
    const onError = vi.fn();
    render(<DataLoader year={2012} onData={onData} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
});
