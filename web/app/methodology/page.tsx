import type { Metadata } from "next";
import Link from "next/link";
import { MethodologyFooter } from "@/components/layout/MethodologyFooter";
import { Eyebrow } from "@/components/ui/Typography";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Sources, joins, caveats, and licenses for the openARCOS opioid distribution analysis.",
};

const DATASET_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "openARCOS county-year opioid distribution",
  description:
    "Merged, schema-validated aggregates of DEA ARCOS county shipments, post-2014 DEA retail summary state MME, DEA enforcement actions, and CDC WONDER overdose deaths.",
  url: "https://openarcos.org/methodology",
  license: "https://www.apache.org/licenses/LICENSE-2.0",
  creator: { "@type": "Organization", name: "openARCOS" },
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
    {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: "https://openarcos.org/data/state-opioid-mme-by-year.json",
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
            openARCOS is a static site assembled from public opioid distribution, overdose,
            population, and enforcement datasets. Everything below — sources, cleaning, joins,
            caveats — is reproducible from the repo at{" "}
            <a href="https://github.com/anomalyco/opencode">GitHub</a>.
          </p>
        </header>

        <section id="sources">
          <h2>Sources</h2>
          <dl className={styles.sourceList}>
            <dt>ARCOS county shipments</dt>
            <dd>
              County-year opioid shipment aggregates 2006–2014 from the Griffith et al. Data in
              Brief ARCOS dataset.{" "}
              <a href="https://data.mendeley.com/datasets/dwfgxrh7tn/9">View at Mendeley Data</a>.
              Released under CC BY 4.0.
            </dd>
            <dt>DEA ARCOS retail summary PDFs</dt>
            <dd>
              State-year opioid MME estimates for 2015-2024 are extracted from DEA Diversion Control
              ARCOS Retail Drug Summary Report 4 PDFs. Those PDFs publish grams by state and drug
              code, not county rows, so post-2014 MME appears as state-level data only.{" "}
              <a href="https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/arcos-drug-summary-reports.html">
                View at deadiversion.usdoj.gov
              </a>
              .
            </dd>
            <dt>DEA Diversion Control</dt>
            <dd>
              Annual counts of <strong>DEA enforcement actions</strong> are pulled from the{" "}
              <a href="https://www.federalregister.gov/api">Federal Register API</a> — specifically,
              NOTICE documents published by the DEA whose titles match a registrant-action
              disposition: Final Orders, Revocations of Registration, Immediate Suspension Orders,
              Orders to Show Cause, Settlements, and Admonitions. Classification is regex-based on
              notice titles; post-2011 the Federal Register switched to an umbrella "Decision and
              Order" title convention, which means later-year type breakdowns are coarser than
              earlier years. Counts reflect the year of Federal Register publication, not the year
              of the underlying conduct. Criminal prosecutions (which proceed through DOJ, not DEA's
              administrative track) are not included. Source:{" "}
              <a href="https://www.federalregister.gov/api">federalregister.gov/api</a>. Public
              domain (17 USC §105).
            </dd>
            <dt>CDC WONDER</dt>
            <dd>
              Overdose deaths by county-year from a CDC WONDER Underlying Cause of Death 1999-2020
              interactive UI scrape.{" "}
              <a href="https://wonder.cdc.gov/ucd-icd10.html">View at wonder.cdc.gov</a>. The scrape
              runs one state/DC query at a time for 2006-2014, using the WONDER Drug/Alcohol Induced
              Causes D1-D4 macro and ICD-10 codes X40-X44, X60-X64, X85, Y10-Y14. Counts of 9 or
              fewer are suppressed under 42 USC 242m(d) and rendered &lt;10, never zero. Counts of
              10-20 are publishable as raw deaths, but CDC flags their rates as statistically
              unreliable.
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
            <li>
              County ARCOS shipments cover 2006-2014. The public DEA post-2014 retail summary PDFs
              add state-level MME for 2015-2024, but they do not provide county-level rows.
            </li>
            <li>
              CDC suppression hides counts of 9 or fewer deaths in a county-year — the map renders
              these as &lt;10, never zero. Rates based on 10-20 deaths are flagged by CDC as
              statistically unreliable even though the raw death counts are publishable.
            </li>
            <li>
              Pill counts are in DEA "dosage units," not individual pills; a 100mg tablet counts as
              one unit regardless of strength.
            </li>
            <li>
              DEA enforcement totals reflect Federal Register <em>publication dates</em>, not the
              dates of the underlying conduct. Final orders routinely lag the initiating Immediate
              Suspension Orders by 6–24 months.
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
