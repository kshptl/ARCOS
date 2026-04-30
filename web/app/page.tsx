import Link from "next/link";
import { BigNumeral } from "@/components/brand/BigNumeral";
import { Eyebrow, Lede } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import styles from "./page.module.css";

export default function Home() {
  return (
    <section className={styles.root}>
      <div className={styles.hero}>
        <Eyebrow>2006–2014</Eyebrow>
        <h1 className={styles.h1}>
          Where the pills went, who sent them,
          <br />
          and who paid.
        </h1>
        <Lede>
          The DEA's ARCOS database tracks every prescription opioid shipped across the
          United States. This site lets you walk through what it shows — from the 76
          billion pills that flowed between 2006 and 2014 to the counties that buried
          their neighbors.
        </Lede>

        <div className={styles.numeral}>
          <BigNumeral value={76_000_000_000} unit="pills" compact />
        </div>

        <div className={styles.cta}>
          <Link href="/explorer" className={styles.ctaLink}>
            <Button variant="primary">Open the explorer →</Button>
          </Link>
          <p className={styles.ctaNote}>
            The full scrollytelling narrative is coming in the next release. In the
            meantime, explore the data directly.
          </p>
        </div>
      </div>
    </section>
  );
}
