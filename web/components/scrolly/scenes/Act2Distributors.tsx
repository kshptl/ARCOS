"use client";

import type { Act2Data } from "@/lib/data/loadScrollyData";
import { formatPercent } from "@/lib/format/percent";
import { useScrollyProgress } from "../progressContext";
import { formatTickValue, niceTicks } from "./axes";
import styles from "./scenes.module.css";

export interface Act2DistributorsProps {
  data: Act2Data;
}

const VIEW_W = 720;
const VIEW_H = 440;
const PAD_LEFT = 64;
const PAD_RIGHT = 200;
const PAD_TOP = 40;
const PAD_BOTTOM = 56;

/**
 * Shorten long distributor names for the right-side callout label without
 * losing recognition (e.g. "AMERISOURCEBERGEN DRUG CORPORATION" → "AmerisourceBergen").
 */
function shortenName(name: string): string {
  const lower = name
    .toLowerCase()
    .replace(/\b(corporation|corp|company|co|inc|incorporated|drug|wholesale)\b\.?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Act2Distributors({ data }: Act2DistributorsProps) {
  const progress = useScrollyProgress();
  const { years, series, otherAggregate } = data;

  const allValues = [...series.flatMap((s) => s.sharesByYear), ...otherAggregate.sharesByYear];
  const dataMax = Math.max(...allValues, 1);
  const yTicks = niceTicks(0, dataMax, 4);
  const yMax = yTicks[yTicks.length - 1] ?? dataMax;

  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const xLeft = PAD_LEFT;
  const xRight = PAD_LEFT + plotW;
  const xScale = (i: number) =>
    years.length <= 1 ? xLeft : xLeft + (i / (years.length - 1)) * plotW;
  const yScale = (v: number) => PAD_TOP + plotH - (v / yMax) * plotH;

  // Progressive reveal: at progress=0 show the first year only, at progress=1
  // show all years. Always show ≥ 2 points for line continuity where possible.
  const revealIdx = Math.max(1, Math.ceil(years.length * Math.max(0.1, progress)));
  const visibleYears = years.slice(0, revealIdx);

  const pointsFor = (sharesByYear: number[]) =>
    visibleYears.map((_, i) => `${xScale(i)},${yScale(sharesByYear[i] ?? 0)}`).join(" ");

  return (
    <div className={styles.act}>
      <div className={styles.actInner}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.chart} aria-hidden="true">
          {/* y-axis title */}
          <text
            className={styles.axisTitle}
            transform={`translate(16 ${PAD_TOP + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            Share of pills shipped
          </text>

          {/* y-axis grid + tick labels */}
          {yTicks.map((t) => {
            const y = yScale(t);
            return (
              <g key={t}>
                <line
                  x1={xLeft}
                  x2={xRight}
                  y1={y}
                  y2={y}
                  stroke="var(--ink-40)"
                  strokeDasharray={t === 0 ? "" : "2 3"}
                  strokeWidth={t === 0 ? 1 : 0.6}
                />
                <text
                  className={`${styles.axisLabel} ${styles.act2YTick}`}
                  x={xLeft - 10}
                  y={y + 3}
                  textAnchor="end"
                >
                  {formatTickValue(t, "percent")}
                </text>
              </g>
            );
          })}

          {/* left y-axis rule */}
          <line
            x1={xLeft}
            x2={xLeft}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="var(--ink)"
            strokeWidth={1}
          />

          {/* x-axis tick labels (one per year) */}
          {years.map((year, i) => (
            <text
              key={year}
              className={styles.axisLabel}
              x={xScale(i)}
              y={PAD_TOP + plotH + 18}
              textAnchor="middle"
            >
              {year}
            </text>
          ))}
          <text
            className={styles.axisTitle}
            x={xLeft + plotW / 2}
            y={PAD_TOP + plotH + 40}
            textAnchor="middle"
          >
            Year
          </text>

          {/* Other aggregate line (drawn first so it sits behind emphasized). */}
          {otherAggregate.sharesByYear.length > 0 && (
            <g>
              <polyline
                data-testid="act2-other"
                id="act2-other"
                points={pointsFor(otherAggregate.sharesByYear)}
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth={1.5}
                opacity={0.4}
              />
              {visibleYears.length > 0 && (
                <text
                  className={styles.act2OtherLabel}
                  x={xScale(visibleYears.length - 1) + 10}
                  y={yScale(otherAggregate.sharesByYear[visibleYears.length - 1] ?? 0) + 4}
                  textAnchor="start"
                >
                  Other
                </text>
              )}
            </g>
          )}

          {/* Top-3 emphasized series: polyline + per-year dots + right-side label. */}
          {series.map((s) => {
            const lastShare = s.sharesByYear[visibleYears.length - 1] ?? 0;
            const labelX = xScale(visibleYears.length - 1) + 10;
            const labelY = yScale(lastShare);
            return (
              <g key={s.distributor}>
                <polyline
                  data-testid="act2-series-line"
                  points={pointsFor(s.sharesByYear)}
                  fill="none"
                  stroke="var(--accent-hot)"
                  strokeWidth={2.5}
                />
                {visibleYears.map((year, i) => (
                  <circle
                    key={year}
                    data-testid="act2-series-dot"
                    cx={xScale(i)}
                    cy={yScale(s.sharesByYear[i] ?? 0)}
                    r={3}
                    fill="var(--accent-hot)"
                  />
                ))}
                {/* End-of-line value + name label */}
                <text className={styles.slopeValue} x={labelX} y={labelY - 4} textAnchor="start">
                  {formatPercent(lastShare)}
                </text>
                <text className={styles.slopeLabel} x={labelX} y={labelY + 12} textAnchor="start">
                  {shortenName(s.distributor)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <table data-testid="act2-table" className={styles.dataTable}>
        <caption>Act 2 — top distributors market share by year</caption>
        <thead>
          <tr>
            <th>Distributor</th>
            {years.map((y) => (
              <th key={y}>{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.distributor}>
              <td>{s.distributor}</td>
              {s.sharesByYear.map((v, i) => (
                <td key={years[i] ?? i}>{formatPercent(v)}</td>
              ))}
            </tr>
          ))}
          <tr>
            <td>Other (aggregate)</td>
            {otherAggregate.sharesByYear.map((v, i) => (
              <td key={years[i] ?? i}>{formatPercent(v)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
