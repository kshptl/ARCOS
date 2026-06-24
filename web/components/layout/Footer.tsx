import Link from "next/link";
import styles from "./Footer.module.css";

type Props = {
  buildDate?: string;
};

export function Footer({ buildDate }: Props) {
  return (
    <footer className={styles.root}>
      <div className={styles.inner}>
        <section className={styles.group}>
          <h2>Sources</h2>
          <ul>
            <li>
              <a
                href="https://data.mendeley.com/datasets/dwfgxrh7tn/9"
                target="_blank"
                rel="noreferrer"
              >
                ARCOS county aggregates
              </a>
            </li>
            <li>
              <a
                href="https://www.deadiversion.usdoj.gov/pubs/reports/index.html"
                target="_blank"
                rel="noreferrer"
              >
                DEA Diversion Control reports
              </a>
            </li>
            <li>
              <a href="https://wonder.cdc.gov/" target="_blank" rel="noreferrer">
                CDC WONDER mortality
              </a>
            </li>
          </ul>
        </section>
        <section className={styles.group}>
          <h2>Site</h2>
          <ul>
            <li>
              <Link href="/methodology" prefetch={false}>
                Methodology
              </Link>
            </li>
            <li>
              <Link href="/about" prefetch={false}>
                About
              </Link>
            </li>
            <li>
              <a href="https://github.com/openarcos/openarcos" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </li>
          </ul>
        </section>
        <section className={styles.group}>
          <h2>About</h2>
          <p>
            openARCOS — a journalist-grade analysis of the DEA ARCOS dataset. Not a news outlet; not
            affiliated with any publisher. All data is public.
          </p>
        </section>
        <div className={styles.meta}>
          {buildDate ? <span>Last build: {buildDate}. </span> : null}
          <span>Code: Apache 2.0. Fonts: SIL OFL 1.1.</span>
        </div>
      </div>
    </footer>
  );
}
