import { Sparkline } from "@/components/charts/Sparkline";
import type { TopPharmacy } from "@/lib/data/schemas";
import { formatCompact } from "@/lib/format/number";
import styles from "./TopPharmacies.module.css";

export function TopPharmacies({ rows }: { rows: TopPharmacy[] }) {
  const displayRows = rows
    .slice()
    .sort((a, b) => b.total_pills - a.total_pills)
    .slice(0, 20);
  if (displayRows.length === 0) {
    return <p>No pharmacy-level data available for this county.</p>;
  }
  return (
    <table className={styles.table}>
      <caption className="visually-hidden">Top pharmacies by pills shipped 2006–2014</caption>
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Pharmacy</th>
          <th scope="col">Address</th>
          <th scope="col" className={styles.num}>
            Total pills
          </th>
          <th scope="col" className={styles.sparkCell}>
            Yearly trend
          </th>
        </tr>
      </thead>
      <tbody>
        {displayRows.map((r, i) => (
          <tr key={r.pharmacy_id}>
            <td className={styles.num}>{i + 1}</td>
            <td>{r.name}</td>
            <td>{r.address}</td>
            <td className={styles.num}>{formatCompact(r.total_pills)}</td>
            <td className={styles.sparkCell}>
              {r.yearly ? (
                <Sparkline values={r.yearly} ariaLabel={`${r.name} yearly trend`} />
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
