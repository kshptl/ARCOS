import type { Metadata } from "next";
import { loadCountyMeta } from "@/lib/data/loadCountyMeta";
import { loadDistributorsAggregated } from "@/lib/data/loadTopDistributors";
import { DistributorsPanel } from "./DistributorsPanel";
import { PharmaciesPanel } from "./PharmaciesPanel";
import styles from "./page.module.css";
import { Tabs } from "./Tabs";

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Top distributors and top pharmacies by prescription opioid pills shipped (2006–2014).",
};

export default async function RankingsPage() {
  const distributors = await loadDistributorsAggregated();
  const counties = await loadCountyMeta();
  // Flatten the county metadata into a plain object so it can cross the
  // server/client boundary — Maps aren't serializable as Next props. Only
  // the fields the pharmacies table renders (name, state) are carried.
  const countyLabels: Record<string, { name: string; state: string }> = {};
  for (const c of counties) countyLabels[c.fips] = { name: c.name, state: c.state };
  return (
    <div className={`${styles.root} container`}>
      <header className={styles.header}>
        <p className="eyebrow">2006–2014</p>
        <h1 className={styles.title}>Rankings</h1>
        <p className={styles.lede}>
          Who shipped the most prescription opioids, and to whom. Based on Washington Post ARCOS
          aggregates.
        </p>
      </header>
      <Tabs
        tabs={[
          {
            key: "distributors",
            label: "Distributors",
            panel: <DistributorsPanel rows={distributors} />,
          },
          {
            key: "pharmacies",
            label: "Pharmacies",
            panel: <PharmaciesPanel countyLabels={countyLabels} />,
          },
        ]}
      />
    </div>
  );
}
