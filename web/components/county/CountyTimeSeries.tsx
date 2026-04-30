import { TimeSeries } from "@/components/charts/TimeSeries";
import type { CountyBundle } from "@/lib/data/loadCountyBundle";
import type {
  CountyMetadata,
  CountyShipmentsByYear,
  StateShipmentsByYear,
} from "@/lib/data/schemas";
import styles from "./CountyTimeSeries.module.css";

/**
 * Dedupe county shipment rows that arrive with multiple records per
 * (fips, year). The upstream parquet has occasional duplicates for some
 * counties (e.g. Mingo 54059 has two rows per year from a join that
 * wasn't collapsed in the pipeline). We sum `pills` within each year
 * and recompute `pills_per_capita` from the aggregate using `pop` so
 * the chart shows one point per year instead of two.
 */
export function dedupeCountyShipments(
  rows: CountyShipmentsByYear[],
  pop: number,
): CountyShipmentsByYear[] {
  const byYear = new Map<number, { pills: number; fips: string }>();
  for (const r of rows) {
    const prev = byYear.get(r.year);
    if (prev) prev.pills += r.pills;
    else byYear.set(r.year, { pills: r.pills, fips: r.fips });
  }
  return [...byYear.entries()]
    .map(([year, v]) => ({
      fips: v.fips,
      year,
      pills: v.pills,
      pills_per_capita: pop > 0 ? v.pills / pop : 0,
    }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Compute per-year median across states. Returns an empty map when fewer
 * than 5 states are available — with 3 or 4 states the "median" is either
 * identical to a specific state's value or a meaningless mid-point, and
 * presenting it as a "US median" misleads readers. In that case we drop
 * the US series entirely at the call site rather than aliasing it to the
 * state average (which produced two identical lines on openarcos.org).
 */
function medianByYear(rows: StateShipmentsByYear[]): Map<number, number> {
  const byYear = new Map<number, number[]>();
  for (const r of rows) {
    const arr = byYear.get(r.year) ?? [];
    arr.push(r.pills_per_capita);
    byYear.set(r.year, arr);
  }
  const out = new Map<number, number>();
  for (const [year, arr] of byYear) {
    arr.sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    const value = arr.length % 2 ? (arr[mid] ?? 0) : ((arr[mid - 1] ?? 0) + (arr[mid] ?? 0)) / 2;
    out.set(year, value);
  }
  return out;
}

const MIN_STATES_FOR_US_MEDIAN = 5;

export function CountyTimeSeries({
  fips,
  meta,
  bundle,
  stateSeries,
}: {
  fips: string;
  meta: CountyMetadata;
  bundle: CountyBundle;
  stateSeries: StateShipmentsByYear[];
}) {
  const stateRows = stateSeries.filter((s) => s.state === meta.state);
  const distinctStates = new Set(stateSeries.map((s) => s.state));
  const showUSMedian = distinctStates.size >= MIN_STATES_FOR_US_MEDIAN;
  const medians = showUSMedian ? medianByYear(stateSeries) : new Map<number, number>();

  const dedupedShipments = dedupeCountyShipments(bundle.shipments, meta.pop);
  const countySeries = dedupedShipments.map((r) => ({
    year: r.year,
    value: r.pills_per_capita,
    series: meta.name,
  }));
  const stateSeriesRows = stateRows.map((r) => ({
    year: r.year,
    value: r.pills_per_capita,
    series: `${meta.state} state avg`,
  }));
  const medianRows = [...medians.entries()].map(([year, value]) => ({
    year,
    value,
    series: "US median",
  }));
  const rows = [...countySeries, ...stateSeriesRows, ...medianRows];

  return (
    <div className={styles.root} data-fips={fips}>
      <TimeSeries
        data={rows}
        x="year"
        y="value"
        series="series"
        xLabel="Year"
        yLabel="Pills per person"
        ariaLabel={`Pills per capita in ${meta.name}, ${meta.state}, compared with state${
          showUSMedian ? " and national medians" : ""
        }, 2006–2014.`}
      />
      <div className={styles.legend} aria-hidden="true" data-testid="county-timeseries-legend">
        <span>
          <span className={styles.swatch} style={{ background: "var(--accent-hot)" }} />
          {meta.name}
        </span>
        <span>
          <span className={styles.swatch} style={{ background: "var(--accent-cool)" }} />
          {meta.state} state avg
        </span>
        {showUSMedian ? (
          <span>
            <span className={styles.swatch} style={{ background: "var(--muted)" }} />
            US median
          </span>
        ) : null}
      </div>
    </div>
  );
}
