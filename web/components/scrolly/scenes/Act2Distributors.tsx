"use client";

import { formatPercent } from "@/lib/format/percent";
import { useScrollyProgress } from "../progressContext";
import { formatTickValue, niceTicks } from "./axes";
import styles from "./scenes.module.css";

export interface DistributorSlopeRow {
  distributor: string;
  start: number;
  end: number;
  emphasized: boolean;
}

export interface Act2DistributorsProps {
  rows: DistributorSlopeRow[];
}

const VIEW_W = 520;
const VIEW_H = 320;
const PAD_LEFT = 56;
const PAD_RIGHT = 170;
const PAD_TOP = 48;
const PAD_BOTTOM = 48;

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
  // Title-case each word
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Act2Distributors({ rows }: Act2DistributorsProps) {
  const progress = useScrollyProgress();
  const allValues = rows.flatMap((r) => [r.start, r.end]);
  const dataMax = Math.max(...allValues, 1);
  const yTicks = niceTicks(0, dataMax, 4);
  const yMax = yTicks[yTicks.length - 1] ?? dataMax;

  const sortedByRank = [...rows].sort((a, b) => b.end - a.end);
  const visibleCount = Math.max(1, Math.ceil(sortedByRank.length * progress));

  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const xLeft = PAD_LEFT;
  const xRight = PAD_LEFT + plotW;
  const yScale = (v: number) => PAD_TOP + plotH - (v / yMax) * plotH;

  return (
    <div className={styles.act}>
      <div className={styles.actInner}>
        <div className={styles.titleBand}>Oxy + hydro market share, 2006 → 2014</div>

        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.chart} aria-hidden="true">
          {/* y-axis title */}
          <text
            className={styles.axisTitle}
            transform={`translate(12 ${PAD_TOP + plotH / 2}) rotate(-90)`}
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
                <text className={styles.axisLabel} x={xLeft - 6} y={y + 3} textAnchor="end">
                  {formatTickValue(t, "percent")}
                </text>
              </g>
            );
          })}

          {/* vertical anchors for 2006 / 2014 */}
          <line
            x1={xLeft}
            x2={xLeft}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="var(--ink)"
            strokeWidth={1}
          />
          <line
            x1={xRight}
            x2={xRight}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="var(--ink)"
            strokeWidth={1}
          />

          {/* x-axis labels */}
          <text className={styles.axisTitle} x={xLeft} y={PAD_TOP + plotH + 22} textAnchor="middle">
            2006 share
          </text>
          <text
            className={styles.axisTitle}
            x={xRight}
            y={PAD_TOP + plotH + 22}
            textAnchor="middle"
          >
            2014 share
          </text>

          {/* Render in sortedByRank order so that top-3 emphasized lines
              (highest end share) appear first in the DOM. Non-emphasized
              rows are drawn muted to recede visually. */}
          {sortedByRank.slice(0, visibleCount).map((r) => {
            const y1 = yScale(r.start);
            const y2 = yScale(r.end);
            if (!r.emphasized) {
              return (
                <g key={r.distributor}>
                  <line
                    data-testid="slope-line"
                    x1={xLeft}
                    y1={y1}
                    x2={xRight}
                    y2={y2}
                    stroke="var(--text-muted)"
                    strokeWidth={1}
                    opacity={0.35}
                  />
                  <circle cx={xLeft} cy={y1} r={2} fill="var(--text-muted)" opacity={0.4} />
                  <circle cx={xRight} cy={y2} r={2} fill="var(--text-muted)" opacity={0.4} />
                </g>
              );
            }
            return (
              <g key={r.distributor}>
                <line
                  data-testid="slope-line"
                  x1={xLeft}
                  y1={y1}
                  x2={xRight}
                  y2={y2}
                  stroke="var(--accent-hot)"
                  strokeWidth={2.5}
                />
                <circle cx={xLeft} cy={y1} r={3.5} fill="var(--accent-hot)" />
                <circle cx={xRight} cy={y2} r={3.5} fill="var(--accent-hot)" />
                {/* Left value label */}
                <text className={styles.slopeValue} x={xLeft - 6} y={y1 - 6} textAnchor="end">
                  {formatPercent(r.start)}
                </text>
                {/* Right value label */}
                <text className={styles.slopeValue} x={xRight + 8} y={y2 - 4} textAnchor="start">
                  {formatPercent(r.end)}
                </text>
                {/* Right company label */}
                <text className={styles.slopeLabel} x={xRight + 8} y={y2 + 10} textAnchor="start">
                  {shortenName(r.distributor)}
                </text>
              </g>
            );
          })}
        </svg>

        <p className={styles.subCaption}>
          Three distributors — McKesson, Cardinal Health, and AmerisourceBergen — shipped the bulk
          of opioid pain pills.
        </p>
      </div>

      <table data-testid="act2-table" className={styles.dataTable}>
        <caption>Act 2 — top distributors market share 2006 → 2014</caption>
        <thead>
          <tr>
            <th>Distributor</th>
            <th>2006</th>
            <th>2014</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.distributor}>
              <td>{r.distributor}</td>
              <td>{formatPercent(r.start)}</td>
              <td>{formatPercent(r.end)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
