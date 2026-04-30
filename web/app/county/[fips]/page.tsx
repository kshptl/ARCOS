import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CountyTimeSeries } from "@/components/county/CountyTimeSeries";
import { Hero } from "@/components/county/Hero";
import { RankCallouts } from "@/components/county/RankCallouts";
import { SimilarCounties } from "@/components/county/SimilarCounties";
import { TopDistributors } from "@/components/county/TopDistributors";
import { TopPharmacies } from "@/components/county/TopPharmacies";
import { MethodologyFooter } from "@/components/layout/MethodologyFooter";
import { computeCountyHeroStats } from "@/lib/data/countyHeroStats";
import { loadCountyBundle } from "@/lib/data/loadCountyBundle";
import { loadCountyDistributors } from "@/lib/data/loadCountyDistributors";
import { loadAllFips, loadCountyMetaByFips } from "@/lib/data/loadCountyMeta";
import { loadCountyRanks } from "@/lib/data/loadCountyRanks";
import { loadStateShipments } from "@/lib/data/loadStateShipments";
import { loadSimilarCounties } from "@/lib/geo/similar";
import styles from "./page.module.css";

export const dynamic = "error";
export const dynamicParams = false;

export async function generateStaticParams() {
  const fips = await loadAllFips();
  return fips.map((f) => ({ fips: f }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ fips: string }>;
}): Promise<Metadata> {
  const { fips } = await params;
  const meta = await loadCountyMetaByFips(fips);
  if (!meta) return { title: "Unknown county" };
  return {
    title: `${meta.name}, ${meta.state}`,
    description: `Prescription opioid shipments into ${meta.name}, ${meta.state} (2006–2014). Pills, distributors, pharmacies, overdose deaths, and peer-county comparisons.`,
  };
}

export default async function CountyPage({ params }: { params: Promise<{ fips: string }> }) {
  const { fips } = await params;
  const meta = await loadCountyMetaByFips(fips);
  if (!meta) notFound();
  const bundle = await loadCountyBundle(fips);
  const ranks = await loadCountyRanks(fips);
  const topDistributors = await loadCountyDistributors(fips);
  const stateSeries = await loadStateShipments();
  const similar = await loadSimilarCounties(fips);
  // Compute suppression once so Hero and RankCallouts agree. A county is
  // suppressed when it has no shipment rows or the total pills is 0 —
  // rendering "0 pills shipped" / "3rd of 4 by pills" for these counties
  // misleads readers about the underlying ARCOS/CDC data being unavailable.
  const heroStats = computeCountyHeroStats(meta, bundle.shipments);

  return (
    <div className={`${styles.root} container`}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <a href="/">openarcos</a> / <a href={`/?state=${meta.state}`}>{meta.state}</a> /{" "}
        <span aria-current="page">{meta.name}</span>
      </nav>

      <div className={styles.heroGrid}>
        <Hero meta={meta} bundle={bundle} />
        <RankCallouts meta={meta} ranks={ranks} suppressed={heroStats.suppressed} />
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pills shipped, year by year</h2>
        <CountyTimeSeries fips={fips} meta={meta} bundle={bundle} stateSeries={stateSeries} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Top distributors into {meta.name}</h2>
        <TopDistributors rows={topDistributors} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Top pharmacies in {meta.name}</h2>
        <TopPharmacies rows={bundle.pharmacies} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Similar counties</h2>
        <SimilarCounties current={meta} similar={similar} />
      </section>

      <MethodologyFooter />
    </div>
  );
}
