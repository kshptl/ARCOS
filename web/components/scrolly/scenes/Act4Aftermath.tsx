"use client";

import { useScrollyProgress } from "../progressContext";
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
  min: number;
  max: number;
  width: number;
  height: number;
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
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  return {
    path,
    peakX: peakIndex * step,
    peakY: y(values[peakIndex] as number),
    peakIndex,
    min,
    max,
    width,
    height,
  };
}

const SPARK_W = 160;
const SPARK_H = 36;

export function Act4Aftermath({ counties }: Act4AftermathProps) {
  const progress = useScrollyProgress();
  const opacity = Math.min(1, progress * 2);

  // Shared x-axis: find the longest series length. Synthetic fixtures may have
  // 0, 1, or many points; we scale each county into a shared year span.
  const globalMax = Math.max(
    1,
    ...counties.flatMap((c) => (c.deaths.length > 0 ? [Math.max(...c.deaths)] : [])),
  );
  // The underlying CDC death series runs 2003–2022; the first year in the
  // array is the earliest year present. We don't have year metadata per
  // county here, so we only show the peak-year offset ("yr +N") as a hint.

  return (
    <div className={styles.act}>
      <div className={styles.actInner}>
        <div className={styles.titleBand}>
          Six heavily shipped counties — overdose deaths per year
        </div>

        <div className={styles.gridMultiples} style={{ opacity }}>
          {counties.map((c) => {
            const hasData = c.deaths.length > 0;
            const spark = hasData ? buildSpark(c.deaths, SPARK_W, SPARK_H, globalMax) : null;
            return (
              <figure key={c.fips} data-testid="small-multiple" className={styles.multiple}>
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
                    {spark && <path d={spark.path} />}
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
