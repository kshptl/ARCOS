"use client";

import type { DEAEnforcementAction } from "@/lib/data/schemas";
import { formatFull } from "@/lib/format/number";
import { useScrollyProgress } from "../progressContext";
import styles from "./scenes.module.css";

export interface Act3EnforcementProps {
  actions: DEAEnforcementAction[];
}

export function Act3Enforcement({ actions }: Act3EnforcementProps) {
  const progress = useScrollyProgress();
  const showInflection = progress > 0.5;
  const sorted = [...actions].sort((a, b) => a.year - b.year);
  const years = sorted.map((a) => a.year);
  const maxCount = Math.max(...sorted.map((a) => a.action_count), 1);

  return (
    <div className={styles.act}>
      <svg viewBox="0 0 400 220" className={styles.bars} aria-hidden="true">
        <line x1={20} y1={180} x2={380} y2={180} stroke="var(--text-muted)" />
        {sorted.map((a, i) => {
          const x = 20 + (i / Math.max(1, sorted.length - 1)) * 360;
          const tickHeight = (a.action_count / maxCount) * 140;
          const inflection = a.year >= 2012;
          return (
            <g key={a.year}>
              <line
                data-testid="timeline-tick"
                x1={x}
                y1={180}
                x2={x}
                y2={180 - tickHeight}
                stroke={inflection ? "var(--accent-hot)" : "var(--accent-cool)"}
                strokeWidth={inflection ? 3 : 1.5}
              />
              <text x={x} y={200} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                {a.year}
              </text>
            </g>
          );
        })}
        {showInflection && (
          <rect
            data-testid="inflection-zoom"
            x={20 + ((years.indexOf(2012) + 0) / Math.max(1, sorted.length - 1)) * 360 - 10}
            y={30}
            width={Math.max(120, 50)}
            height={150}
            fill="var(--accent-hot)"
            opacity={0.08}
          />
        )}
      </svg>
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
          {sorted.map((a) => (
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
