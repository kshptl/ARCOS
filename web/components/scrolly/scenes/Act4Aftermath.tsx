"use client";

import { useScrollyProgress } from "../progressContext";
import { useReducedMotion } from "../useReducedMotion";
import styles from "./scenes.module.css";

export interface Act4County {
  fips: string;
  name: string;
  state: string;
  deaths: number[];
}

export interface Act4AftermathProps {
  counties: Act4County[];
}

interface SparkGeom {
  path: string;
  peakX: number;
  peakY: number;
  peakIndex: number;
  firstX: number;
  firstY: number;
  lastX: number;
  lastY: number;
  firstValue: number;
  lastValue: number;
  length: number;
  min: number;
  max: number;
  width: number;
  height: number;
}

function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function buildSpark(
  values: number[],
  width: number,
  height: number,
  globalMax: number,
): SparkGeom | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Use shared global y-scale so bars are comparable across counties.
  const yMax = Math.max(globalMax, 1);
  const y = (v: number) => height - (v / yMax) * (height - 4) - 2;
  if (values.length === 1) {
    const cx = width / 2;
    const cy = y(values[0] as number);
    return {
      path: `M${cx},${cy}`,
      peakX: cx,
      peakY: cy,
      peakIndex: 0,
      firstX: cx,
      firstY: cy,
      lastX: cx,
      lastY: cy,
      firstValue: values[0] as number,
      lastValue: values[0] as number,
      length: 0,
      min,
      max,
      width,
      height,
    };
  }
  const step = width / (values.length - 1);
  let peakIndex = 0;
  for (let i = 1; i < values.length; i++) {
    if ((values[i] as number) > (values[peakIndex] as number)) peakIndex = i;
  }
  // Compute points + total polyline length.
  const points: Array<[number, number]> = values.map(
    (v, i) => [i * step, y(v)] as [number, number],
  );
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1] as [number, number];
    const [bx, by] = points[i] as [number, number];
    length += Math.hypot(bx - ax, by - ay);
  }
  const path = points
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(" ");
  const lastIdx = values.length - 1;
  return {
    path,
    peakX: peakIndex * step,
    peakY: y(values[peakIndex] as number),
    peakIndex,
    firstX: 0,
    firstY: y(values[0] as number),
    lastX: lastIdx * step,
    lastY: y(values[lastIdx] as number),
    firstValue: values[0] as number,
    lastValue: values[lastIdx] as number,
    length,
    min,
    max,
    width,
    height,
  };
}

const SPARK_W = 160;
const SPARK_H = 36;

// Reveal timing constants. With 6 cards:
//   - card i fades in over [i*CARD_STAGGER, i*CARD_STAGGER + CARD_DUR]
//   - CARD_STAGGER=0.05, CARD_DUR=0.25 → all cards fully visible by progress=0.5
//   - line i starts drawing LINE_DELAY after card i's fade-in starts, ends at progress=1
const CARD_STAGGER = 0.05;
const CARD_DUR = 0.25;
const LINE_DELAY = 0.1;

export function Act4Aftermath({ counties }: Act4AftermathProps) {
  const progress = useScrollyProgress();
  const reducedMotion = useReducedMotion();

  // Shared x-axis: find the longest series length. Synthetic fixtures may have
  // 0, 1, or many points; we scale each county into a shared year span.
  const globalMax = Math.max(
    1,
    ...counties.flatMap((c) => (c.deaths.length > 0 ? [Math.max(...c.deaths)] : [])),
  );

  return (
    <div className={styles.act}>
      <div className={styles.actInner}>
        <div className={styles.gridMultiples}>
          {counties.map((c, i) => {
            const hasData = c.deaths.length > 0;
            const spark = hasData ? buildSpark(c.deaths, SPARK_W, SPARK_H, globalMax) : null;

            // Per-card reveal progress (0..1).
            const cardT = reducedMotion ? 1 : clamp01((progress - i * CARD_STAGGER) / CARD_DUR);
            // Per-line draw progress (0..1). Line starts LINE_DELAY after its
            // card begins fading in; completes at progress=1.
            const lineStart = i * CARD_STAGGER + LINE_DELAY;
            const lineT = reducedMotion ? 1 : clamp01((progress - lineStart) / (1 - lineStart));

            const lineLen = spark?.length ?? 0;
            const dashOffset = lineLen * (1 - lineT);

            return (
              <figure
                key={c.fips}
                data-testid="small-multiple"
                className={styles.multiple}
                style={{ opacity: cardT }}
              >
                <a href={`/county/${c.fips}`} className={styles.multipleLink}>
                  <figcaption className={styles.multipleName}>{c.name}</figcaption>
                  <span className={styles.multipleState}>{c.state || "—"}</span>
                  <svg
                    className={styles.multipleSpark}
                    viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`${c.name}${c.state ? `, ${c.state}` : ""} overdose deaths trend`}
                  >
                    <title>{`${c.name} overdose deaths trend`}</title>
                    {/* baseline */}
                    <line
                      x1={0}
                      x2={SPARK_W}
                      y1={SPARK_H - 1}
                      y2={SPARK_H - 1}
                      stroke="var(--ink-40)"
                      strokeWidth={0.5}
                    />
                    {spark && (
                      <path
                        data-testid="spark-line"
                        d={spark.path}
                        style={{
                          strokeDasharray: lineLen,
                          strokeDashoffset: dashOffset,
                        }}
                      />
                    )}
                    {/* Peak marker */}
                    {spark && c.deaths.length > 1 && (
                      <g data-testid="spark-peak">
                        <circle
                          cx={spark.peakX}
                          cy={spark.peakY}
                          r={2.5}
                          fill="var(--accent-hot)"
                        />
                      </g>
                    )}
                    {/* Endpoint value labels: first + last */}
                    {spark && (
                      <>
                        <text
                          data-testid="spark-endpoint"
                          className={styles.multipleEndpoint}
                          x={Math.min(spark.firstX + 2, SPARK_W - 2)}
                          y={Math.max(spark.firstY - 3, 8)}
                          textAnchor="start"
                        >
                          {spark.firstValue}
                        </text>
                        <text
                          data-testid="spark-endpoint"
                          className={styles.multipleEndpoint}
                          x={Math.max(spark.lastX - 2, 2)}
                          y={Math.max(spark.lastY - 3, 8)}
                          textAnchor="end"
                        >
                          {spark.lastValue}
                        </text>
                      </>
                    )}
                  </svg>
                </a>
              </figure>
            );
          })}
        </div>
      </div>
    </div>
  );
}
