import { TimeSeries } from "@/components/charts/TimeSeries";
import type { CountyBundle } from "@/lib/data/loadCountyBundle";
import type { CountyMetadata, StateShipmentsByYear } from "@/lib/data/schemas";
import styles from "./CountyTimeSeries.module.css";

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
  const medians = medianByYear(stateSeries);
  const countySeries = bundle.shipments.map((r) => ({
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
        ariaLabel={`Pills per capita in ${meta.name}, ${meta.state}, compared with state and national medians, 2006–2014.`}
      />
      <div className={styles.legend} aria-hidden="true">
        <span>
          <span className={styles.swatch} style={{ background: "var(--accent-hot)" }} />
          {meta.name}
        </span>
        <span>
          <span className={styles.swatch} style={{ background: "var(--accent-cool)" }} />
          {meta.state} state avg
        </span>
        <span>
          <span className={styles.swatch} style={{ background: "var(--muted)" }} />
          US median
        </span>
      </div>
    </div>
  );
}
