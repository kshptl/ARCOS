"use client";

import { formatCompact, formatFull } from "@/lib/format/number";
import { useScrollyProgress } from "../progressContext";
import { formatTickValue, niceTicks } from "./axes";
import styles from "./scenes.module.css";

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
  // 0–0.55: count-up.  0.55–1: bars reveal.
  const countT = Math.min(1, progress / 0.55);
  const currentCount = Math.round(totalPills * countT);
  const barsT = Math.max(0, Math.min(1, (progress - 0.5) / 0.5));

  const sorted = [...yearly].sort((a, b) => a.year - b.year);
  const peak = sorted.reduce<YearlyTotal | null>(
    (best, d) => (best === null || d.pills > best.pills ? d : best),
    null,
  );

  const maxPills = Math.max(...sorted.map((d) => d.pills), 1);
  const yTicks = niceTicks(0, maxPills, 4);
  const yMax = yTicks[yTicks.length - 1] ?? maxPills;

  const plotW = VIEW_W - PLOT_LEFT - PLOT_RIGHT;
  const plotH = VIEW_H - PLOT_TOP - PLOT_BOTTOM;
  const n = Math.max(1, sorted.length);
  const slotW = plotW / n;
  const barWidth = Math.min(52, slotW * 0.55);

  const yScale = (v: number) => PLOT_TOP + plotH - (v / yMax) * plotH;

  // Progressive ticker entries during count-up. Reveal one per year as countT
  // advances, so the viewer sees the scale accumulate year-by-year.
  const tickerRevealed = Math.min(sorted.length, Math.ceil(countT * sorted.length));
  const tickerEntries = sorted.slice(0, tickerRevealed);

  return (
    <div className={styles.act}>
      <div className={styles.actInner}>
        <div className={styles.titleBand}>US pharmaceutical shipments, 2006–2014</div>

        <div className={styles.bigStat}>
          <span className={styles.eyebrow}>Total pills shipped</span>
          <span data-testid="act1-count" className={`${styles.count} numeric`} aria-live="polite">
            {progress >= 1 ? formatFull(totalPills) : formatCompact(currentCount)}
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
          style={{ opacity: Math.max(0.15, barsT) }}
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
            const h = fullH * barsT;
            const y = PLOT_TOP + plotH - h;
            const isPeak = peak !== null && d.year === peak.year;
            return (
              <g key={d.year}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  fill={isPeak ? "var(--accent-hot)" : "var(--ink-60)"}
                />
                {/* value label above bar */}
                {barsT > 0.25 && (
                  <text
                    className={styles.barLabel}
                    x={cx}
                    y={y - 6}
                    textAnchor="middle"
                    opacity={Math.min(1, (barsT - 0.25) / 0.25)}
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

          {/* Peak annotation */}
          {peak && barsT > 0.6 && (
            <g data-testid="act1-peak-callout" opacity={Math.min(1, (barsT - 0.6) / 0.4)}>
              {(() => {
                const i = sorted.findIndex((d) => d.year === peak.year);
                if (i < 0) return null;
                const cx = PLOT_LEFT + slotW * (i + 0.5);
                const barTopY = PLOT_TOP + plotH - (peak.pills / yMax) * plotH;
                const labelY = Math.max(PLOT_TOP - 6, barTopY - 28);
                return (
                  <>
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
                  </>
                );
              })()}
            </g>
          )}

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
