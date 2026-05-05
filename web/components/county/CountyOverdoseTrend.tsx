import type { CDCOverdoseByCountyYear } from "@/lib/data/schemas";
import styles from "./CountyOverdoseTrend.module.css";

export function CountyOverdoseTrend({
  countyName,
  rows,
}: {
  countyName: string;
  rows: CDCOverdoseByCountyYear[];
}) {
  if (rows.length === 0) {
    return (
      <p className={styles.empty}>No CDC overdose death records available for {countyName}.</p>
    );
  }

  const sortedRows = [...rows].sort((a, b) => a.year - b.year);
  const hasUnreliableRate = sortedRows.some(
    (r) => r.unreliable && !r.suppressed && r.deaths !== null,
  );

  return (
    <div className={styles.root}>
      <table className={styles.table}>
        <caption className={styles.caption}>CDC WONDER overdose deaths in {countyName}</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col" className={styles.num}>
              Deaths
            </th>
            <th scope="col" className={styles.num}>
              Crude rate
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r) => (
            <tr key={r.year}>
              <td data-testid="overdose-year">{r.year}</td>
              <td className={styles.num} data-testid="overdose-deaths">
                {formatDeaths(r)}
              </td>
              <td className={styles.num}>{formatRate(r.crude_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasUnreliableRate ? (
        <p className={styles.caveat}>
          Counts of 10-20 are publishable, but CDC rates are flagged unreliable.
        </p>
      ) : null}
    </div>
  );
}

function formatDeaths(row: CDCOverdoseByCountyYear): string {
  if (row.suppressed || row.deaths == null) return "<10";
  return row.deaths.toLocaleString("en-US");
}

function formatRate(rate: number | null | undefined): string {
  if (rate == null) return "-";
  return rate.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
