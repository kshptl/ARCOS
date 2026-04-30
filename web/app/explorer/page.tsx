import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow, Lede } from "@/components/ui/Typography";
import { loadCountyMeta } from "@/lib/data/loadCountyMeta";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Explorer",
  description: "Browse all US counties by per-capita prescription opioid shipments, 2006–2014.",
};

export default async function Explorer() {
  const counties = await loadCountyMeta();

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <Eyebrow>Explorer</Eyebrow>
        <h1>Every county, every year</h1>
        <Lede>
          The interactive map is launching with the full site narrative. In the meantime, every
          county has its own page with total shipments, peak per-capita year, top distributors, and
          overdose-death trend.
        </Lede>
      </section>

      <section className={styles.list}>
        <h2 className={styles.h2}>All counties ({counties.length})</h2>
        <ul className={styles.countyList}>
          {counties.map((c) => (
            <li key={c.fips}>
              <Link href={`/county/${c.fips}` as `/county/${string}`}>
                {c.name}, {c.state}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
