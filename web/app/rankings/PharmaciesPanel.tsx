"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { formatCompact } from "@/lib/format/number";
import styles from "./PharmaciesPanel.module.css";
import { usePharmacyPages } from "./usePharmacyPages";

export type CountyLabels = Record<string, { name: string; state: string }>;

/**
 * Render the pharmacy's county as "Name, ST" by resolving r.fips through
 * the countyLabels map (passed from the server-rendered page, built from
 * county-metadata.json at build time). Falls back to the bare FIPS if the
 * metadata map doesn't know the code — better than an em-dash because the
 * FIPS still points at a working county page.
 */
function countyLinkText(fips: string, labels: CountyLabels): string {
  const hit = labels[fips];
  return hit ? `${hit.name}, ${hit.state}` : fips;
}

export function PharmaciesPanel({ countyLabels = {} }: { countyLabels?: CountyLabels }) {
  const { status, error, rows, total, hasMore, loadMore } = usePharmacyPages();

  if (status === "error") {
    return (
      <p className={styles.status} role="alert">
        Failed to load pharmacy data: {error?.message}.{" "}
        <Button variant="ghost" onClick={() => void loadMore()}>
          Retry
        </Button>
      </p>
    );
  }
  if (status === "idle" || (status === "loading" && rows.length === 0)) {
    return <p className={styles.status}>Loading pharmacies…</p>;
  }

  return (
    <div>
      <table className={styles.table}>
        <caption className="visually-hidden">
          Top pharmacies by total pills shipped 2006–2014
        </caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Pharmacy</th>
            <th scope="col">Address</th>
            <th scope="col">County</th>
            <th scope="col" className={styles.num}>
              Total pills
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.pharmacy_id}>
              <td className={styles.num}>{i + 1}</td>
              <td>{r.name}</td>
              <td>{r.address}</td>
              <td>
                {r.fips ? (
                  <Link href={`/county/${r.fips}` as `/county/${string}`}>
                    {countyLinkText(r.fips, countyLabels)}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className={styles.num}>{formatCompact(r.total_pills)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.footer}>
        {hasMore ? (
          <Button variant="primary" onClick={() => void loadMore()} disabled={status === "loading"}>
            {status === "loading" ? "Loading…" : "Show more"}
          </Button>
        ) : (
          <span className={styles.status}>Showing all {total ?? rows.length} pharmacies</span>
        )}
      </div>
    </div>
  );
}
