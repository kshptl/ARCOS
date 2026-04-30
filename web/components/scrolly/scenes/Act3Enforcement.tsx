"use client";

import type { DEAEnforcementAction } from "@/lib/data/schemas";
import { formatFull } from "@/lib/format/number";
import { useScrollyProgress } from "../progressContext";
import { formatTickValue, niceTicks } from "./axes";
import styles from "./scenes.module.css";

export interface Act3EnforcementProps {
  actions: DEAEnforcementAction[];
}

const VIEW_W = 520;
const VIEW_H = 300;
const PAD_LEFT = 52;
const PAD_RIGHT = 24;
const PAD_TOP = 60;
const PAD_BOTTOM = 52;

const FULL_YEAR_RANGE: number[] = [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014];
const INFLECTION_START = 2012;
const INFLECTION_END = 2014;

/**
 * Trim a notable-action title to a single-line callout ≤ 30 chars to fit in
 * the margin. Preserves the most specific prefix.
 */
function shortTitle(title: string): string {
  const cleaned = title.replace(/^United States v\.\s*/i, "").trim();
  if (cleaned.length <= 30) return cleaned;
  return `${cleaned.slice(0, 28)}…`;
}

export function Act3Enforcement({ actions }: Act3EnforcementProps) {
  const progress = useScrollyProgress();
  const showInflection = progress > 0.5;

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
  const xFor = (year: number): number => {
    const idx = year - minYear;
    const denom = Math.max(1, years.length - 1);
    return PAD_LEFT + (idx / denom) * plotW;
  };
  const yScale = (v: number) => PAD_TOP + plotH - (v / yMax) * plotH;
  const barWidth = Math.min(28, plotW / Math.max(1, years.length) - 6);

  // Notable-action callout positions alternate up/down to avoid collisions.
  const callouts = actions
    .filter((a) => a.notable_actions.length > 0)
    .map((a, i) => ({
      year: a.year,
      title: shortTitle(a.notable_actions[0]?.title ?? ""),
      above: i % 2 === 0,
    }));

  return (
    <div className={styles.act}>
      <div className={styles.actInner}>
        <div className={styles.titleBand}>DEA enforcement actions per year</div>

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
                <text className={styles.axisLabel} x={PAD_LEFT - 6} y={y + 3} textAnchor="end">
                  {formatTickValue(t, "integer")}
                </text>
              </g>
            );
          })}

          {/* Inflection rectangle (behind bars) */}
          {showInflection && (
            <g data-testid="inflection-zoom" opacity={Math.min(1, (progress - 0.5) / 0.3)}>
              {(() => {
                const x0 = xFor(INFLECTION_START) - barWidth / 2 - 4;
                const x1 = xFor(INFLECTION_END) + barWidth / 2 + 4;
                return (
                  <>
                    <rect
                      x={x0}
                      y={PAD_TOP - 18}
                      width={x1 - x0}
                      height={plotH + 18}
                      fill="var(--accent-hot)"
                      opacity={0.1}
                    />
                    <text
                      className={styles.inflectionLabel}
                      x={(x0 + x1) / 2}
                      y={PAD_TOP - 24}
                      textAnchor="middle"
                    >
                      Inflection
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* Bars */}
          {years.map((year) => {
            const a = byYear.get(year);
            const count = a?.action_count ?? 0;
            const cx = xFor(year);
            const x = cx - barWidth / 2;
            const h = (count / yMax) * plotH;
            const y = PAD_TOP + plotH - h;
            const inflection = year >= INFLECTION_START && year <= INFLECTION_END && count > 0;
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
                    fill={inflection ? "var(--accent-hot)" : "var(--ink-60)"}
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

          {/* Notable-action callouts with leader lines */}
          {callouts.map((c) => {
            const a = byYear.get(c.year);
            if (!a) return null;
            const cx = xFor(c.year);
            const barTopY = PAD_TOP + plotH - (a.action_count / yMax) * plotH;
            // Leader line + label
            const labelY = c.above ? Math.max(PAD_TOP - 4, barTopY - 22) : PAD_TOP + plotH + 30;
            const anchorY = c.above ? barTopY - 3 : PAD_TOP + plotH + 3;
            return (
              <g key={`callout-${c.year}`} opacity={progress > 0.3 ? 1 : 0}>
                <line
                  x1={cx}
                  y1={anchorY}
                  x2={cx}
                  y2={labelY + (c.above ? 3 : -8)}
                  stroke="var(--accent-hot)"
                  strokeWidth={0.8}
                />
                <text className={styles.notableCallout} x={cx} y={labelY} textAnchor="middle">
                  {c.year}: {c.title}
                </text>
              </g>
            );
          })}
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
