import { Sparkline } from "@/components/charts/Sparkline";
import type { DistributorAggregate } from "@/lib/data/loadTopDistributors";
import { formatCompact } from "@/lib/format/number";
import { formatPercent } from "@/lib/format/percent";
import styles from "./DistributorsPanel.module.css";

export function DistributorsPanel({ rows }: { rows: DistributorAggregate[] }) {
  if (rows.length === 0) {
    return (
      <p className="caption">
        No distributor data available. Run the pipeline to populate this panel.
      </p>
    );
  }
  return (
    <table className={styles.table}>
      <caption className="visually-hidden">
        Top distributors by total pills shipped 2006–2014
      </caption>
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Distributor</th>
          <th scope="col" className={styles.num}>
            Total pills
          </th>
          <th scope="col">Share 2006–2014</th>
          <th scope="col" className={styles.sparkCell}>
            Yearly share
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const avgShare =
            r.share_pct_by_year.reduce((s, y) => s + y.share_pct, 0) /
            Math.max(r.share_pct_by_year.length, 1);
          return (
            <tr key={r.slug} id={`distributor-${r.slug}`} className={styles.row}>
              <td className={styles.num}>{i + 1}</td>
              <td>{r.distributor}</td>
              <td className={styles.num}>{formatCompact(r.total_pills)}</td>
              <td className={styles.num}>{formatPercent(avgShare)}</td>
              <td className={styles.sparkCell}>
                <Sparkline
                  values={r.share_pct_by_year.map((y) => y.share_pct)}
                  ariaLabel={`${r.distributor} yearly share sparkline`}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
