import type { Metadata } from "next";
import Link from "next/link";
import { MethodologyFooter } from "@/components/layout/MethodologyFooter";
import { Eyebrow } from "@/components/ui/Typography";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Sources, joins, caveats, and licenses for the openarcos opioid distribution analysis.",
};

const DATASET_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "openarcos county-year opioid distribution",
  description:
    "Merged, schema-validated aggregates of DEA ARCOS shipments, DEA enforcement actions, and CDC WONDER overdose deaths at the US county level.",
  url: "https://openarcos.org/methodology",
  license: "https://www.apache.org/licenses/LICENSE-2.0",
  creator: { "@type": "Organization", name: "openarcos" },
  distribution: [
    {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: "https://openarcos.org/data/county-metadata.json",
    },
    {
      "@type": "DataDownload",
      encodingFormat: "application/vnd.apache.parquet",
      contentUrl: "https://openarcos.org/data/county-shipments-by-year.parquet",
    },
  ],
};

export default function Methodology() {
  return (
    <div data-theme="dark" className={styles.root}>
      <article className={styles.article}>
        <header className={styles.header}>
          <Eyebrow>Methodology</Eyebrow>
          <h1>How this site is built</h1>
          <p className={styles.lede}>
            openarcos is a static site assembled from three public datasets. Everything below —
            sources, cleaning, joins, caveats — is reproducible from the repo at{" "}
            <a href="https://github.com/anomalyco/opencode">GitHub</a>.
          </p>
        </header>

        <section id="sources">
          <h2>Sources</h2>
          <dl className={styles.sourceList}>
            <dt>Washington Post ARCOS</dt>
            <dd>
              County-, pharmacy-, and distributor-level shipments 2006–2014.{" "}
              <a href="https://arcos-api.ext.nile.works/__swagger__/">
                View at arcos-api.ext.nile.works
              </a>
              . Released under the Post's investigative usage terms.
            </dd>
            <dt>DEA Diversion Control</dt>
            <dd>
              Annual enforcement summaries and notable actions.{" "}
              <a href="https://www.deadiversion.usdoj.gov/pubs/reports/index.html">
                View at deadiversion.usdoj.gov
              </a>
              . Public domain (17 USC §105).
            </dd>
            <dt>CDC WONDER</dt>
            <dd>
              Overdose deaths by county-year via the D76 multiple-cause-of-death dataset.{" "}
              <a href="https://wonder.cdc.gov/mcd.html">View at wonder.cdc.gov</a>. Cells with fewer
              than 10 deaths are suppressed per CDC rules; we preserve this as a boolean flag rather
              than a zero.
            </dd>
          </dl>
        </section>

        <section id="joins">
          <h2>Joins</h2>
          <p>
            The pipeline builds a canonical <code>FIPS × year</code> grid from Census PEP population
            estimates, then LEFT JOINs each cleaned source. The result lives at{" "}
            <code>data/joined/master.parquet</code> and is the input to every emitted artifact.
          </p>
        </section>

        <section id="caveats">
          <h2>Caveats</h2>
          <ul>
            <li>ARCOS covers 2006–2014 only. Later years are not in this dataset.</li>
            <li>
              CDC suppression hides cells with fewer than 10 deaths in a county-year — the map shows
              these as "suppressed," not zero.
            </li>
            <li>
              Pill counts are in DEA "dosage units," not individual pills; a 100mg tablet counts as
              one unit regardless of strength.
            </li>
            <li>
              DEA enforcement totals are scraped from annual PDFs; our counts are approximate and
              may diverge from DEA's internal tallies.
            </li>
          </ul>
        </section>

        <section id="licenses">
          <h2>Licenses</h2>
          <ul>
            <li>
              Code: Apache 2.0 — <Link href="/methodology">View license</Link>
            </li>
            <li>
              Fonts: SIL OFL 1.1 (Space Grotesk, Inter) —{" "}
              <a href="/fonts/LICENSE-OFL.txt">View license</a>
            </li>
            <li>Data: Each source's upstream license applies; see above.</li>
          </ul>
        </section>

        <section id="access-dates">
          <h2>Access dates</h2>
          <p>
            The data bundle is refreshed weekly by <code>.github/workflows/build-data.yml</code>.
            The build date is stamped in the site footer.
          </p>
        </section>

        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires literal text embedding
          dangerouslySetInnerHTML={{ __html: JSON.stringify(DATASET_JSONLD) }}
        />
      </article>
      <MethodologyFooter />
    </div>
  );
}
