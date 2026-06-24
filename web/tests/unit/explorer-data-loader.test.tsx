import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataLoader } from "@/components/explorer/DataLoader";
import { fetchParquetRows } from "@/lib/data/parquet";

vi.mock("@/lib/data/parquet", () => ({
  fetchParquetRows: vi.fn(),
  readParquetRows: vi.fn(),
}));

const rows = [
  { fips: "54059", year: 2012, pills: 1000, pills_per_capita: 38, mme_per_capita: 120.5 },
  { fips: "54047", year: 2012, pills: 500, pills_per_capita: 18, mme_per_capita: 42.25 },
  { fips: "54059", year: 2011, pills: 800, pills_per_capita: 30, mme_per_capita: 88 },
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

const stateMmeArtifact = [
  {
    state_fips: "54",
    state: "WV",
    year: 2024,
    geography_level: "state",
    population: 1793716,
    mme: 398984272.5,
    mme_per_capita: 222.43,
    mme_per_100k: 22243447.26,
    included_drug_codes: ["9143"],
    excluded_drug_codes: ["9250", "9801"],
    source_urls: [
      "https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/report_yr_2024.pdf",
    ],
  },
];

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
      expect.stringMatching(
        /^\/data\/county-shipments-by-year\.parquet\?v=2026-05-08-mme-refresh-v1$/,
      ),
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

  it("loads MME per capita from the shipment parquet without a second fetch", async () => {
    const onData = vi.fn();
    const { rerender } = render(
      <DataLoader year={2012} metric="pills_per_capita" onData={onData} />,
    );

    await waitFor(() => expect(onData).toHaveBeenCalled());
    expect(fetchParquetRows).toHaveBeenCalledTimes(1);

    onData.mockClear();
    rerender(<DataLoader year={2012} metric="mme_per_capita" onData={onData} />);

    await waitFor(() => expect(onData).toHaveBeenCalled());
    const values2012 = onData.mock.calls.find((c: unknown[]) => c[0] === 2012)?.[1] as Map<
      string,
      number
    >;
    expect(values2012.get("54059")).toBe(120.5);
    expect(values2012.get("54047")).toBe(42.25);
    expect(fetchParquetRows).toHaveBeenCalledTimes(1);
  });

  it("loads post-2014 state MME per capita from the DEA retail summary JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => stateMmeArtifact,
      }),
    );
    const onData = vi.fn();
    const onStateData = vi.fn();

    render(
      <DataLoader year={2024} metric="mme_per_capita" onData={onData} onStateData={onStateData} />,
    );

    await waitFor(() => expect(onStateData).toHaveBeenCalled());
    const values2024 = onStateData.mock.calls.find((c: unknown[]) => c[0] === 2024)?.[1] as Map<
      string,
      number
    >;
    expect(values2024.get("54")).toBe(222.43);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/data\/state-opioid-mme-by-year\.json\?v=.+/),
    );
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
