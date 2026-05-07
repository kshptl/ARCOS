import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const deathArtifact = {
  records: [
    {
      county_fips: "54059",
      year: 2012,
      deaths: 42,
      population: 26000,
      crude_rate: 161.5,
      suppressed: false,
      unreliable: false,
    },
    {
      county_fips: "54047",
      year: 2012,
      deaths: null,
      population: 18000,
      crude_rate: null,
      suppressed: true,
      unreliable: false,
    },
    {
      county_fips: "54059",
      year: 2011,
      deaths: 35,
      population: 25000,
      crude_rate: null,
      suppressed: false,
      unreliable: false,
    },
  ],
};

describe("DataLoader", () => {
  beforeEach(() => {
    vi.mocked(fetchParquetRows).mockReset();
    vi.mocked(fetchParquetRows).mockResolvedValue(rows);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("groups rows by year and calls onData once per year", async () => {
    const onData = vi.fn();
    render(<DataLoader year={2012} onData={onData} />);
    await waitFor(() => expect(onData).toHaveBeenCalled());
    expect(fetchParquetRows).toHaveBeenCalledWith(
      expect.stringMatching(/^\/data\/county-shipments-by-year\.parquet\?v=.+/),
      expect.any(Object),
    );
    const years = onData.mock.calls.map((c: unknown[]) => c[0]);
    expect(years).toContain(2012);
    expect(years).toContain(2011);
    const values2012 = onData.mock.calls.find((c: unknown[]) => c[0] === 2012)?.[1] as Map<
      string,
      number
    >;
    expect(values2012.get("54059")).toBe(38);
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

  it("keeps shipment parquet cached after visiting the CDC metric", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => deathArtifact,
      }),
    );

    const onData = vi.fn();
    const { rerender } = render(
      <DataLoader year={2012} metric="pills_per_capita" onData={onData} />,
    );

    await waitFor(() => expect(onData).toHaveBeenCalled());
    expect(fetchParquetRows).toHaveBeenCalledTimes(1);

    onData.mockClear();
    rerender(<DataLoader year={2012} metric="deaths_per_100k" onData={onData} />);
    await waitFor(() => expect(onData).toHaveBeenCalled());

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

  it("loads overdose deaths per 100k from the rich CDC JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => deathArtifact,
      }),
    );

    const onData = vi.fn();
    render(<DataLoader year={2012} metric="deaths_per_100k" onData={onData} />);

    await waitFor(() => expect(onData).toHaveBeenCalled());
    const values2012 = onData.mock.calls.find((c: unknown[]) => c[0] === 2012)?.[1] as Map<
      string,
      number
    >;
    const values2011 = onData.mock.calls.find((c: unknown[]) => c[0] === 2011)?.[1] as Map<
      string,
      number
    >;
    expect(values2012.get("54059")).toBe(161.5);
    expect(values2012.get("54047")).toBe(0);
    expect(values2011.get("54059")).toBe(140);
    expect(fetchParquetRows).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/data\/cdc_county_overdose\.json\?v=.+/),
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
