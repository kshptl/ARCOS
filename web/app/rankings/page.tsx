import type { Metadata } from "next";
import { Tabs } from "./Tabs";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Top distributors and top pharmacies by prescription opioid pills shipped (2006–2014).",
};

export default function RankingsPage() {
  return (
    <div className={`${styles.root} container`}>
      <header className={styles.header}>
        <p className="eyebrow">2006–2014</p>
        <h1 className={styles.title}>Rankings</h1>
        <p className={styles.lede}>
          Who shipped the most prescription opioids, and to whom. Based on Washington Post
          ARCOS aggregates.
        </p>
      </header>
      <Tabs
        tabs={[
          {
            key: "distributors",
            label: "Distributors",
            panel: <p>(populated in Task 41)</p>,
          },
          {
            key: "pharmacies",
            label: "Pharmacies",
            panel: <p>(populated in Task 42)</p>,
          },
        ]}
      />
    </div>
  );
}
