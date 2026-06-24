import type { Metadata } from "next";
import Link from "next/link";
import { BigNumeral } from "@/components/brand/BigNumeral";
import { ScrollyErrorBoundary } from "@/components/errors/ScrollyErrorBoundary";
import { ScrollyStage } from "@/components/scrolly/ScrollyStage";
import { Step } from "@/components/scrolly/Step";
import { Act1Scale } from "@/components/scrolly/scenes/Act1Scale";
import { Act2Distributors } from "@/components/scrolly/scenes/Act2Distributors";
import { Act3Enforcement } from "@/components/scrolly/scenes/Act3Enforcement";
import { Act4Aftermath } from "@/components/scrolly/scenes/Act4Aftermath";
import { loadScrollyData } from "@/lib/data/loadScrollyData";
import styles from "./page.module.css";

const pageTitle = {
  default: "openARCOS — where the pills went, who sent them, who paid",
  absolute: "openARCOS — where the pills went, who sent them, who paid",
} satisfies Metadata["title"];

// Turn the exact pill count into sentence text like "98.1 billion".
function formatPillScale(totalPills: number): string {
  return `${(totalPills / 1_000_000_000).toFixed(1)} billion`;
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await loadScrollyData();
  const totalPillScale = formatPillScale(data.act1.totalPills);

  return {
    title: pageTitle,
    description: `${totalPillScale} oxycodone and hydrocodone pills shipped across the US from 2006 to 2014. Trace the distributors, the enforcement, and the counties left behind.`,
  };
}

export default async function HomePage() {
  const data = await loadScrollyData();
  const totalPills = data.act1.totalPills;
  const totalPillScale = formatPillScale(totalPills);
  const act1Peak =
    data.act1.yearly.length > 0
      ? data.act1.yearly.reduce((best, row) => (row.pills > best.pills ? row : best))
      : null;

  return (
    <>
      <header className={`container ${styles.hero}`}>
        <p className="eyebrow">2006–2014</p>
        <h1 className={styles.h1}>Where the pills went, who sent them, and who paid.</h1>
        <p className={styles.lede}>
          <BigNumeral value={totalPills} unit="pills" as="span" /> shipped across the United States
          in nine years. This site follows the pill through the distribution system — and counts
          what came after.
        </p>
        <div className={styles.cta}>
          <Link href="/explorer" className={styles.buttonLink}>
            Open the explorer
          </Link>
        </div>
      </header>

      <ScrollyErrorBoundary label="act-1">
        <ScrollyStage
          canvas={<Act1Scale totalPills={data.act1.totalPills} yearly={data.act1.yearly} />}
          ariaLabel={`Act 1: the scale of shipments from 2006 to 2014${
            act1Peak
              ? `, peaking at about ${formatPillScale(act1Peak.pills)} pills in ${act1Peak.year}.`
              : "."
          }`}
        >
          <Step id="act1">
            <p className="eyebrow">Act 1 — Scale</p>
            <h2>{totalPillScale} pills.</h2>
            <p>
              Between 2006 and 2014, pharmaceutical distributors reported {totalPillScale} doses of
              oxycodone and hydrocodone to the DEA. The curve rises through 2010 and then turns.
            </p>
          </Step>
        </ScrollyStage>
      </ScrollyErrorBoundary>

      <ScrollyErrorBoundary label="act-2">
        <ScrollyStage
          canvas={<Act2Distributors data={data.act2} />}
          ariaLabel="Act 2: three distributors handled more than 80 percent of shipments across the period."
        >
          <Step id="act2">
            <p className="eyebrow">Act 2 — Distributors</p>
            <h2>Three companies.</h2>
            <p>
              McKesson, Cardinal Health, and AmerisourceBergen carried roughly four out of every
              five pills in this dataset. The lines compare each company with everyone else
              combined, showing how concentrated the supply chain already was.
            </p>
          </Step>
        </ScrollyStage>
      </ScrollyErrorBoundary>

      <ScrollyErrorBoundary label="act-3">
        <ScrollyStage
          canvas={<Act3Enforcement actions={data.act3.actions} />}
          ariaLabel="Act 3: DEA Final Orders and registrant administrative actions published in the Federal Register, 2006 through 2014."
          stepLayout="stacked"
        >
          <Step id="act3-baseline">
            <p className="eyebrow">Act 3 — Enforcement</p>
            <h2>A quiet baseline.</h2>
            <p>
              Through the late 2000s, DEA administrative enforcement against opioid registrants ran
              at a low baseline — about 20 to 40 federal registrant actions per year, published in
              the Federal Register and aimed mostly at individual rogue prescribers.
            </p>
          </Step>
          <Step id="act3-peak">
            <h2>2011: the agency spikes.</h2>
            <p>
              By 2011, with {totalPillScale} pills moving through the distribution system, DEA
              registrant actions nearly tripled — 69 Federal Register dispositions in a single year
              — marking the start of the pharmacy-chain crackdowns.
            </p>
          </Step>
          <Step id="act3-settlements">
            <h2>Headlines over headcount.</h2>
            <p>
              The agency shifted tactics. Landmark settlements — Cardinal Health $34M, Walgreens
              $80M, CVS $22M — produced headlines but fewer total actions. The numbers drop; the
              dollar stakes rise.
            </p>
          </Step>
          <Step id="act3-retreat">
            <h2>By 2014, the spike is gone.</h2>
            <p>
              After the 2011 high and the big settlement years, published registrant actions fell
              back below 2007 levels by the end of this dataset. This chart does not make a claim
              about what happened after 2014.
            </p>
          </Step>
        </ScrollyStage>
      </ScrollyErrorBoundary>

      <ScrollyErrorBoundary label="act-4">
        <ScrollyStage
          canvas={<Act4Aftermath counties={data.act4.counties} />}
          ariaLabel="Act 4: six hard-hit counties where overdose death counts climbed through the ARCOS window."
        >
          <Step id="act4">
            <p className="eyebrow">Act 4 — Aftermath</p>
            <h2>The counties left behind.</h2>
            <p style={{ marginBlockStart: "var(--space-md)" }}>
              <Link href="/explorer" className={styles.buttonLink}>
                See your county →
              </Link>
            </p>
          </Step>
        </ScrollyStage>
      </ScrollyErrorBoundary>
    </>
  );
}
