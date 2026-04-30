"use client";

import { formatPercent } from "@/lib/format/percent";
import { useScrollyProgress } from "../progressContext";
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

export function Act2Distributors({ rows }: Act2DistributorsProps) {
  const progress = useScrollyProgress();
  const allValues = rows.flatMap((r) => [r.start, r.end]);
  const max = Math.max(...allValues, 1);
  const sortedByRank = [...rows].sort((a, b) => b.end - a.end);
  const visibleCount = Math.max(1, Math.ceil(sortedByRank.length * progress));

  return (
    <div className={styles.act}>
      <svg viewBox="0 0 400 260" className={styles.bars} aria-hidden="true">
        <text x="60" y="16" fontSize="10" fill="var(--text-muted)">
          2006
        </text>
        <text x="340" y="16" fontSize="10" fill="var(--text-muted)" textAnchor="end">
          2014
        </text>
        {sortedByRank.slice(0, visibleCount).map((r) => {
          const y1 = 30 + (1 - r.start / max) * 200;
          const y2 = 30 + (1 - r.end / max) * 200;
          const color = r.emphasized ? "var(--accent-hot)" : "var(--text-muted)";
          const width = r.emphasized ? 2.5 : 1;
          return (
            <g key={r.distributor}>
              <line
                data-testid="slope-line"
                x1={70}
                y1={y1}
                x2={330}
                y2={y2}
                stroke={color}
                strokeWidth={width}
                opacity={r.emphasized ? 1 : 0.6}
              />
              {r.emphasized && (
                <text x={340} y={y2 + 4} fontSize="10" fill="var(--text)">
                  {r.distributor}
                </text>
              )}
            </g>
          );
        })}
      </svg>
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
