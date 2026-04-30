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
import { Button } from "@/components/ui/Button";
import { loadScrollyData } from "@/lib/data/loadScrollyData";

export const metadata: Metadata = {
  title: {
    default: "openarcos — where the pills went, who sent them, who paid",
    absolute: "openarcos — where the pills went, who sent them, who paid",
  },
  description:
    "76 billion oxycodone and hydrocodone pills shipped across the US from 2006 to 2014. Trace the distributors, the enforcement, and the counties left behind.",
};

export default async function HomePage() {
  const data = await loadScrollyData();

  return (
    <>
      <header className="container" style={{ paddingBlock: "var(--space-xl)" }}>
        <p className="eyebrow">2006–2014</p>
        <h1
          style={{
            fontSize: "var(--type-display-xl)",
            lineHeight: "var(--leading-tight)",
            maxWidth: "20ch",
          }}
        >
          Where the pills went, who sent them, and who paid.
        </h1>
        <p style={{ fontSize: "var(--type-lede)", color: "var(--text-muted)", maxWidth: "56ch" }}>
          <BigNumeral value={76_000_000_000} unit="pills" compact as="span" /> shipped across the
          United States in nine years. This site follows the pill through the distribution system —
          and counts what came after.
        </p>
        <div style={{ marginBlockStart: "var(--space-lg)" }}>
          <Link href="/explorer" style={{ textDecoration: "none" }}>
            <Button variant="primary">Open the explorer</Button>
          </Link>
        </div>
      </header>

      <ScrollyErrorBoundary label="act-1">
        <ScrollyStage
          canvas={<Act1Scale totalPills={data.act1.totalPills} yearly={data.act1.yearly} />}
          ariaLabel="Act 1: the scale of shipments from 2006 to 2014, peaking at about 9.6 billion pills in 2010."
        >
          <Step id="act1">
            <p className="eyebrow">Act 1 — Scale</p>
            <h2>76 billion pills.</h2>
            <p>
              Between 2006 and 2014, pharmaceutical distributors reported{" "}
              {Math.round(data.act1.totalPills / 1e9)} billion doses of oxycodone and hydrocodone to
              the DEA. The curve rises through 2010 and then turns.
            </p>
          </Step>
        </ScrollyStage>
      </ScrollyErrorBoundary>

      <ScrollyErrorBoundary label="act-2">
        <ScrollyStage
          canvas={<Act2Distributors rows={data.act2.rows} />}
          ariaLabel="Act 2: three distributors handled more than 80 percent of shipments across the period."
        >
          <Step id="act2">
            <p className="eyebrow">Act 2 — Distributors</p>
            <h2>Three companies.</h2>
            <p>
              McKesson, Cardinal Health, and AmerisourceBergen together moved most of the pills.
              Their share shifted, but the trio stayed on top.
            </p>
          </Step>
        </ScrollyStage>
      </ScrollyErrorBoundary>

      <ScrollyErrorBoundary label="act-3">
        <ScrollyStage
          canvas={<Act3Enforcement actions={data.act3.actions} />}
          ariaLabel="Act 3: enforcement actions from the DEA Diversion Control Division climb from 2010 to 2013."
        >
          <Step id="act3">
            <p className="eyebrow">Act 3 — Enforcement</p>
            <h2>The regulators catch up.</h2>
            <p>
              Enforcement actions from the DEA Diversion Control Division climbed through 2012–2013
              as the scale of the problem became impossible to ignore.
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
            <p>
              The pills came in waves; the deaths followed. These six counties carried some of the
              heaviest per-capita shipments — and some of the steepest casualties.
            </p>
            <p style={{ marginBlockStart: "var(--space-md)" }}>
              <Link href="/explorer" style={{ textDecoration: "none" }}>
                <Button variant="primary">See your county →</Button>
              </Link>
            </p>
          </Step>
        </ScrollyStage>
      </ScrollyErrorBoundary>
    </>
  );
}
