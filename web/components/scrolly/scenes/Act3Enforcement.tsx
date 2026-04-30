"use client";

import type { DEAEnforcementAction } from "@/lib/data/schemas";
import { formatFull } from "@/lib/format/number";
import { formatTickValue, niceTicks } from "./axes";
import styles from "./scenes.module.css";

export interface Act3EnforcementProps {
  actions: DEAEnforcementAction[];
}

const VIEW_W = 720;
const VIEW_H = 420;
const PAD_LEFT = 64;
const PAD_RIGHT = 24;
const PAD_TOP = 60;
const PAD_BOTTOM = 52;
const AXIS_LABEL_OFFSET = 14;
const BAR_WIDTH = 28;
// Half a bar plus a couple of pixels of breathing room keeps the leftmost and
// rightmost bars fully inside the plot rectangle.
const BAR_PADDING = BAR_WIDTH / 2 + 2;

const FULL_YEAR_RANGE: number[] = [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014];

export function Act3Enforcement({ actions }: Act3EnforcementProps) {
  // Build a dense year series so the timeline reads 2006→2014 with equal
  // x-axis spacing even if the fixture only has data for some years.
  const byYear = new Map(actions.map((a) => [a.year, a]));
  const minYear = Math.min(...actions.map((a) => a.year), ...FULL_YEAR_RANGE);
  const maxYear = Math.max(...actions.map((a) => a.year), ...FULL_YEAR_RANGE);
  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  const maxCount = Math.max(...actions.map((a) => a.action_count), 1);
  const yTicks = niceTicks(0, maxCount, 4);
  const yMax = yTicks[yTicks.length - 1] ?? maxCount;

  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  // Band-scale pattern: place the first/last bars one BAR_PADDING inside the
  // plot rectangle so they never overflow the plotting area.
  const innerW = Math.max(0, plotW - 2 * BAR_PADDING);
  const denom = Math.max(1, years.length - 1);
  const step = innerW / denom;
  const xFor = (year: number): number => {
    const idx = year - minYear;
    return PAD_LEFT + BAR_PADDING + idx * step;
  };
  const yScale = (v: number) => PAD_TOP + plotH - (v / yMax) * plotH;
  const barWidth = Math.min(BAR_WIDTH, step - 6);

  return (
    <div className={styles.act}>
      <div className={styles.actInner}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.chart} aria-hidden="true">
          {/* y-axis title */}
          <text
            className={styles.axisTitle}
            transform={`translate(12 ${PAD_TOP + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            Actions
          </text>

          {/* y-axis grid + tick labels */}
          {yTicks.map((t) => {
            const y = yScale(t);
            return (
              <g key={t}>
                <line
                  x1={PAD_LEFT}
                  x2={PAD_LEFT + plotW}
                  y1={y}
                  y2={y}
                  stroke="var(--ink-40)"
                  strokeDasharray={t === 0 ? "" : "2 3"}
                  strokeWidth={t === 0 ? 1 : 0.6}
                />
                <text
                  className={styles.axisLabel}
                  x={PAD_LEFT - AXIS_LABEL_OFFSET}
                  y={y + 3}
                  textAnchor="end"
                >
                  {formatTickValue(t, "integer")}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {years.map((year) => {
            const a = byYear.get(year);
            const count = a?.action_count ?? 0;
            const cx = xFor(year);
            const x = cx - barWidth / 2;
            const h = (count / yMax) * plotH;
            const y = PAD_TOP + plotH - h;
            const hasCount = count > 0;
            return (
              <g key={year}>
                {hasCount && (
                  <rect
                    data-testid="timeline-tick"
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    fill="var(--ink-60)"
                  />
                )}
                {!hasCount && (
                  <line
                    data-testid="timeline-tick"
                    x1={cx}
                    x2={cx}
                    y1={PAD_TOP + plotH}
                    y2={PAD_TOP + plotH - 4}
                    stroke="var(--ink-40)"
                    strokeWidth={1}
                  />
                )}
                {/* value label atop bar */}
                {hasCount && (
                  <text className={styles.barLabel} x={cx} y={y - 5} textAnchor="middle">
                    {formatFull(count)}
                  </text>
                )}
                {/* year tick label */}
                <text
                  className={styles.axisLabel}
                  x={cx}
                  y={PAD_TOP + plotH + 14}
                  textAnchor="middle"
                >
                  {year}
                </text>
              </g>
            );
          })}

          {/* x-axis baseline */}
          <line
            x1={PAD_LEFT}
            x2={PAD_LEFT + plotW}
            y1={PAD_TOP + plotH}
            y2={PAD_TOP + plotH}
            stroke="var(--ink)"
            strokeWidth={1}
          />
        </svg>

        <p className={styles.subCaption}>
          Federal enforcement scaled up through the early 2010s, with DEA actions clustering around
          2012–2014.
        </p>
      </div>

      <table data-testid="act3-table" className={styles.dataTable}>
        <caption>Act 3 — DEA enforcement actions per year</caption>
        <thead>
          <tr>
            <th>Year</th>
            <th>Actions</th>
            <th>Notable</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a.year}>
              <td>{a.year}</td>
              <td>{formatFull(a.action_count)}</td>
              <td>{a.notable_actions.map((n) => n.title).join("; ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
