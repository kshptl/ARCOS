import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow, Lede } from "@/components/ui/Typography";
import { MethodologyFooter } from "@/components/layout/MethodologyFooter";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "About",
  description: "Who built openarcos and why.",
};

export default function About() {
  return (
    <div data-theme="dark" className={styles.root}>
      <article className={styles.article}>
        <Eyebrow>About</Eyebrow>
        <h1>Why this site</h1>
        <Lede>
          Between 2006 and 2014, drug companies shipped 76 billion oxycodone and
          hydrocodone pills across the United States. In a handful of counties, the
          per-capita pill count exceeds every plausible medical need. The Washington Post
          won a 2019 fight to open the DEA's ARCOS database; this site asks what the
          numbers show.
        </Lede>

        <section>
          <h2>What it is</h2>
          <p>
            openarcos is a fully static portfolio site. It joins three public datasets
            into a single browsable map. Everything is reproducible from the repo.
          </p>
        </section>

        <section>
          <h2>What it is not</h2>
          <p>
            This is not an accusation against any single pharmacy, distributor, or
            county. Shipment volume is not proof of wrongdoing; correlation with overdose
            deaths is not causation. Read the <Link href="/methodology">methodology</Link>{" "}
            for caveats.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            <a href="https://github.com/anomalyco/opencode">GitHub</a> — open an issue or
            send a PR. Press inquiries welcome via GitHub discussions.
          </p>
        </section>
      </article>
      <MethodologyFooter />
    </div>
  );
}
