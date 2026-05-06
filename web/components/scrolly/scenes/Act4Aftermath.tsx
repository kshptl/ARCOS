"use client";

import { useScrollyProgress } from "../progressContext";
import { useReducedMotion } from "../useReducedMotion";
import styles from "./scenes.module.css";

export interface Act4County {
  fips: string;
  name: string;
  state: string;
  deaths?: number[];
  points?: { year: number; deaths: number | null; suppressed: boolean; unreliable: boolean }[];
}

export interface Act4AftermathProps {
  counties: Act4County[];
}

interface SparkGeom {
  segments: SparkSegment[];
  peakX: number;
  peakY: number;
  peakIndex: number;
  firstX: number;
  firstY: number;
  lastX: number;
  lastY: number;
  firstLabel: string;
  lastLabel: string;
  length: number;
  min: number;
  max: number;
  width: number;
  height: number;
  suppressed: Array<{ x: number; y: number; year: number }>;
  numericCount: number;
}

interface SparkSegment {
  path: string;
  length: number;
  start: number;
}

interface SparkPoint {
  year: number;
  deaths: number | null;
  suppressed: boolean;
  unreliable: boolean;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

function isDrawable(point: SparkPoint): boolean {
  return !point.suppressed && point.deaths !== null;
}

function pointLabel(point: SparkPoint): string {
  return isDrawable(point) ? String(point.deaths) : "<10";
}

function buildSpark(
  points: SparkPoint[],
  width: number,
  height: number,
  globalMax: number,
): SparkGeom | null {
  if (points.length === 0) return null;
  const values = points.flatMap((point) => (isDrawable(point) ? [point.deaths as number] : []));
  const min = values.length === 0 ? 0 : Math.min(...values);
  const max = values.length === 0 ? 0 : Math.max(...values);
  // Use shared global y-scale so bars are comparable across counties.
  const yMax = Math.max(globalMax, 1);
  const y = (v: number) => height - (v / yMax) * (height - 4) - 2;
  const suppressed = points.flatMap((point, i) => {
    if (isDrawable(point)) return [];
    const x = points.length === 1 ? width / 2 : (i * width) / (points.length - 1);
    return [{ x, y: height - 6, year: point.year }];
  });

  if (points.length === 1) {
    const point = points[0] as SparkPoint;
    const cx = width / 2;
    const cy = isDrawable(point) ? y(point.deaths as number) : height - 6;
    return {
      segments: isDrawable(point) ? [{ path: `M${cx},${cy}`, length: 0, start: 0 }] : [],
      peakX: cx,
      peakY: cy,
      peakIndex: 0,
      firstX: cx,
      firstY: cy,
      lastX: cx,
      lastY: cy,
      firstLabel: pointLabel(point),
      lastLabel: pointLabel(point),
      length: 0,
      min,
      max,
      width,
      height,
      suppressed,
      numericCount: values.length,
    };
  }
  const step = width / (points.length - 1);
  let peakIndex = points.findIndex(isDrawable);
  if (peakIndex === -1) peakIndex = 0;
  for (let i = peakIndex + 1; i < points.length; i++) {
    const point = points[i] as SparkPoint;
    const peakDeaths = (points[peakIndex] as SparkPoint).deaths as number;
    if (isDrawable(point) && (point.deaths as number) > peakDeaths) {
      peakIndex = i;
    }
  }
  // Compute points + total polyline length.
  const drawablePoints: Array<[number, number] | null> = points.map((point, i) =>
    isDrawable(point) ? ([i * step, y(point.deaths as number)] as [number, number]) : null,
  );
  let length = 0;
  const path: string[] = [];
  let previousPoint: [number, number] | null = null;
  for (const point of drawablePoints) {
    if (!point) continue;
    const [px, py] = point;
    if (path.length === 0) {
      path.push(`M${px.toFixed(1)},${py.toFixed(1)}`);
      previousPoint = point;
      continue;
    }
    if (previousPoint) {
      length += Math.hypot(px - previousPoint[0], py - previousPoint[1]);
    }
    path.push(`L${px.toFixed(1)},${py.toFixed(1)}`);
    previousPoint = point;
  }
  const segments: SparkSegment[] =
    path.length > 0 ? [{ path: path.join(" "), length, start: 0 }] : [];
  const firstPoint = points[0] as SparkPoint;
  const lastIdx = points.length - 1;
  const lastPoint = points[lastIdx] as SparkPoint;
  const firstY = isDrawable(firstPoint) ? y(firstPoint.deaths as number) : height - 6;
  const lastY = isDrawable(lastPoint) ? y(lastPoint.deaths as number) : height - 6;
  const peakPoint = points[peakIndex] as SparkPoint;
  const peakY = isDrawable(peakPoint) ? y(peakPoint.deaths as number) : height - 6;
  return {
    segments,
    peakX: peakIndex * step,
    peakY,
    peakIndex,
    firstX: 0,
    firstY,
    lastX: lastIdx * step,
    lastY,
    firstLabel: pointLabel(firstPoint),
    lastLabel: pointLabel(lastPoint),
    length,
    min,
    max,
    width,
    height,
    suppressed,
    numericCount: values.length,
  };
}

function getPoints(county: Act4County): SparkPoint[] {
  if (county.points && county.points.length > 0) {
    return [...county.points].sort((a, b) => a.year - b.year);
  }
  return (
    county.deaths?.map((deaths, year) => ({
      year,
      deaths,
      suppressed: false,
      unreliable: false,
    })) ?? []
  );
}

function getDeaths(county: Act4County): number[] {
  return getPoints(county).flatMap((point) => (isDrawable(point) ? [point.deaths as number] : []));
}

const SPARK_W = 160;
const SPARK_H = 36;

// Reveal timing constants. With 6 cards:
//   - card i fades in over [i*CARD_STAGGER, i*CARD_STAGGER + CARD_DUR]
//   - CARD_STAGGER=0.05, CARD_DUR=0.25 → all cards fully visible by p=0.5
//   - line i starts drawing LINE_DELAY after card i's fade-in starts, ends
//     when the remapped schedule reaches p=1
// Note: the inputs are a remapped progress `p` (see below), not raw
// scroll progress.
const CARD_STAGGER = 0.05;
const CARD_DUR = 0.25;
const LINE_DELAY = 0.1;
// Act 4 is the last ScrollyStage on the page, so users never reach
// raw scroll progress = 1.0 while its sticky canvas is on screen — the
// document ends before then. Empirically the achievable max is ~0.82.
// We remap raw progress so the schedule hits p=1 at scroll progress
// 0.75, giving the reader time to see the fully-drawn lines before the
// canvas scrolls away.
const PROGRESS_COMPLETE_AT = 0.75;

export function Act4Aftermath({ counties }: Act4AftermathProps) {
  const progress = useScrollyProgress();
  const reducedMotion = useReducedMotion();

  // Shared x-axis: find the longest series length. Synthetic fixtures may have
  // 0, 1, or many points; we scale each county into a shared year span.
  const globalMax = Math.max(
    1,
    ...counties.flatMap((c) => {
      const deaths = getDeaths(c);
      return deaths.length > 0 ? [Math.max(...deaths)] : [];
    }),
  );

  // Remap raw scroll progress onto the animation's [0..1] timeline so all
  // stagger + line-draw animations complete by PROGRESS_COMPLETE_AT.
  const p = Math.min(progress / PROGRESS_COMPLETE_AT, 1);

  return (
    <div className={styles.act}>
      <div className={styles.actInner}>
        <div className={styles.gridMultiples}>
          {counties.map((c, i) => {
            const points = getPoints(c);
            const hasData = points.length > 0;
            const spark = hasData ? buildSpark(points, SPARK_W, SPARK_H, globalMax) : null;

            // Per-card reveal progress (0..1), keyed off the remapped p.
            const cardT = reducedMotion ? 1 : clamp01((p - i * CARD_STAGGER) / CARD_DUR);
            // Per-line draw progress (0..1). Line starts LINE_DELAY after its
            // card begins fading in; completes when p reaches 1 (which
            // corresponds to actual scroll progress = PROGRESS_COMPLETE_AT).
            const lineStart = i * CARD_STAGGER + LINE_DELAY;
            const lineT = reducedMotion ? 1 : clamp01((p - lineStart) / (1 - lineStart));

            const lineLen = spark?.length ?? 0;
            const totalDrawnLength = lineLen * lineT;

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
                    {spark?.segments.map((segment) => {
                      const visible = clamp(totalDrawnLength - segment.start, 0, segment.length);
                      const dashOffset = segment.length - visible;
                      return (
                        <path
                          key={segment.path}
                          data-testid="spark-line"
                          d={segment.path}
                          style={{
                            strokeDasharray: segment.length,
                            strokeDashoffset: dashOffset,
                          }}
                        />
                      );
                    })}
                    {spark?.suppressed.map((point) => (
                      <g
                        key={`${point.year}-${point.x}`}
                        data-testid="spark-suppressed"
                        aria-label={`${c.name} ${point.year} count suppressed under 10 deaths`}
                      >
                        <circle cx={point.x} cy={point.y} r={2} style={{ fill: "var(--ink-40)" }} />
                      </g>
                    ))}
                    {/* Peak marker */}
                    {spark && spark.numericCount > 1 && (
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
                          {spark.firstLabel}
                        </text>
                        <text
                          data-testid="spark-endpoint"
                          className={styles.multipleEndpoint}
                          x={Math.max(spark.lastX - 2, 2)}
                          y={Math.max(spark.lastY - 3, 8)}
                          textAnchor="end"
                        >
                          {spark.lastLabel}
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
