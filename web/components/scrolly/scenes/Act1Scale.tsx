"use client";

import { formatCompact, formatFull } from "@/lib/format/number";
import { useScrollyProgress } from "../progressContext";
import { formatTickValue, niceTicks } from "./axes";
import styles from "./scenes.module.css";

// Act 1 shows a live count-up numeral during the build phase. We want it to
// always display a fractional digit (e.g. "25.0M", not "25M") so the number
// reads as a precise, ticking measurement rather than a round marketing
// figure. `formatCompact` from the shared module uses maximumFractionDigits
// only, which drops the decimal on exact round values, so we use a local
// formatter with minimumFractionDigits forced to 1.
const ACT1_COUNT_FMT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
function formatAct1Count(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return ACT1_COUNT_FMT.format(n);
}

export interface YearlyTotal {
  year: number;
  pills: number;
}

export interface Act1ScaleProps {
  totalPills: number;
  yearly: YearlyTotal[];
}

const VIEW_W = 480;
const VIEW_H = 260;
const PLOT_LEFT = 48;
const PLOT_RIGHT = 24;
const PLOT_TOP = 44;
const PLOT_BOTTOM = 46;

export function Act1Scale({ totalPills, yearly }: Act1ScaleProps) {
  const progress = useScrollyProgress();

  const sorted = [...yearly].sort((a, b) => a.year - b.year);
  const peak = sorted.reduce<YearlyTotal | null>(
    (best, d) => (best === null || d.pills > best.pills ? d : best),
    null,
  );

  // Phase 1 (0.0 – 0.8): build phase. Both the numeral and the bars advance
  // on a single shared timeline. Year k's bar starts rising when buildT
  // crosses (k-1)/N and completes at k/N. The numeral counts up to the
  // running cumulative total using the same schedule, so the two feel tied.
  // Phase 2 (0.8 – 1.0): settled phase. Everything is at full value and
  // nothing animates, giving the reader time to take in the whole graphic.
  const buildT = Math.min(1, Math.max(0, progress / 0.8));
  const n = Math.max(1, sorted.length);

  // Per-bar fractional height progress, from the shared schedule.
  const barProgress = sorted.map((_, i) => {
    const start = i / n;
    const end = (i + 1) / n;
    if (buildT >= end) return 1;
    if (buildT <= start) return 0;
    return (buildT - start) / (end - start);
  });

  // Cumulative count driven by the same schedule so the numeral reaches
  // full total exactly when the last bar tops out.
  const currentCount = sorted.reduce((acc, d, i) => acc + d.pills * (barProgress[i] ?? 0), 0);

  const maxPills = Math.max(...sorted.map((d) => d.pills), 1);
  const yTicks = niceTicks(0, maxPills, 4);
  const yMax = yTicks[yTicks.length - 1] ?? maxPills;

  const plotW = VIEW_W - PLOT_LEFT - PLOT_RIGHT;
  const plotH = VIEW_H - PLOT_TOP - PLOT_BOTTOM;
  const slotW = plotW / n;
  const barWidth = Math.min(52, slotW * 0.55);

  const yScale = (v: number) => PLOT_TOP + plotH - (v / yMax) * plotH;

  // Ticker entries reveal one per year, in step with the bars.
  const tickerRevealed = Math.min(sorted.length, Math.ceil(buildT * sorted.length));
  const tickerEntries = sorted.slice(0, tickerRevealed);

  return (
    <div className={styles.act}>
      <div className={styles.actInner}>
        <div className={styles.titleBand}>US pharmaceutical shipments, 2006–2014</div>

        <div className={styles.bigStat}>
          <span className={styles.eyebrow}>Total pills shipped</span>
          <span data-testid="act1-count" className={`${styles.count} numeric`} aria-live="polite">
            {buildT >= 1 ? formatFull(totalPills) : formatAct1Count(currentCount)}
          </span>
          <span className={styles.unit}>pills</span>
          <p className={styles.subCaption}>Shipped from distributors to pharmacies nationwide</p>
        </div>

        {/* Count-up per-year ticker */}
        <div className={styles.tickerLine} aria-hidden="true">
          {tickerEntries.map((d) => (
            <span key={d.year} className={styles.tickerEntry}>
              {d.year} <strong>+{formatCompact(d.pills)}</strong>
            </span>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className={styles.chart}
          style={{ opacity: Math.max(0.15, Math.min(1, buildT * 2)) }}
          aria-hidden="true"
        >
          {/* y-axis title */}
          <text
            className={styles.axisTitle}
            transform={`translate(12 ${PLOT_TOP + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            Pills shipped
          </text>

          {/* y-axis grid + labels */}
          {yTicks.map((t) => {
            const y = yScale(t);
            return (
              <g key={t}>
                <line
                  x1={PLOT_LEFT}
                  x2={VIEW_W - PLOT_RIGHT}
                  y1={y}
                  y2={y}
                  stroke="var(--ink-40)"
                  strokeDasharray={t === 0 ? "" : "2 3"}
                  strokeWidth={t === 0 ? 1 : 0.6}
                />
                <text className={styles.axisLabel} x={PLOT_LEFT - 6} y={y + 3} textAnchor="end">
                  {formatTickValue(t, "compact")}
                </text>
              </g>
            );
          })}

          {/* bars */}
          {sorted.map((d, i) => {
            const cx = PLOT_LEFT + slotW * (i + 0.5);
            const x = cx - barWidth / 2;
            const fullH = (d.pills / yMax) * plotH;
            const bp = barProgress[i] ?? 0;
            const h = fullH * bp;
            const y = PLOT_TOP + plotH - h;
            const isPeak = peak !== null && d.year === peak.year;
            return (
              <g key={d.year}>
                <rect
                  data-testid="act1-bar"
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  fill={isPeak ? "var(--accent-hot)" : "var(--ink-60)"}
                />
                {/* value label above bar — fades in once the bar is mostly up */}
                {bp > 0.5 && (
                  <text
                    className={styles.barLabel}
                    x={cx}
                    y={y - 6}
                    textAnchor="middle"
                    opacity={Math.min(1, (bp - 0.5) / 0.5)}
                  >
                    {formatCompact(d.pills)}
                  </text>
                )}
                {/* year label beneath bar */}
                <text
                  className={styles.yearLabel}
                  x={cx}
                  y={PLOT_TOP + plotH + 20}
                  textAnchor="middle"
                >
                  {d.year}
                </text>
              </g>
            );
          })}

          {/* Peak annotation — appears once the peak bar itself is mostly up. */}
          {peak &&
            (() => {
              const peakIdx = sorted.findIndex((d) => d.year === peak.year);
              if (peakIdx < 0) return null;
              const peakBp = barProgress[peakIdx] ?? 0;
              if (peakBp < 0.6) return null;
              const cx = PLOT_LEFT + slotW * (peakIdx + 0.5);
              const barTopY = PLOT_TOP + plotH - (peak.pills / yMax) * plotH;
              // Offset the callout high enough to clear the per-bar value
              // label (which sits at barTopY - 6 with ~11px glyphs). 44px
              // gives a full line of air between the two, even when the
              // peak bar tops out near the plot ceiling.
              const labelY = barTopY - 44;
              const opacity = Math.min(1, (peakBp - 0.6) / 0.4);
              return (
                <g data-testid="act1-peak-callout" opacity={opacity}>
                  <line
                    x1={cx}
                    y1={labelY + 4}
                    x2={cx}
                    y2={barTopY - 4}
                    stroke="var(--accent-hot)"
                    strokeWidth={1.5}
                  />
                  <polygon
                    points={`${cx - 4},${barTopY - 8} ${cx + 4},${barTopY - 8} ${cx},${barTopY - 2}`}
                    fill="var(--accent-hot)"
                  />
                  <text className={styles.calloutLabel} x={cx} y={labelY} textAnchor="middle">
                    Peak: {formatCompact(peak.pills)}
                  </text>
                </g>
              );
            })()}

          {/* baseline axis line (on top of bars so it crisps the bottom edge) */}
          <line
            x1={PLOT_LEFT}
            x2={VIEW_W - PLOT_RIGHT}
            y1={PLOT_TOP + plotH}
            y2={PLOT_TOP + plotH}
            stroke="var(--ink)"
            strokeWidth={1}
          />
        </svg>
      </div>

      <table data-testid="act1-yearly-table" className={styles.dataTable}>
        <caption>Act 1 — pills shipped per year</caption>
        <thead>
          <tr>
            <th>Year</th>
            <th>Pills</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={d.year}>
              <td>{d.year}</td>
              <td>{formatFull(d.pills)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
