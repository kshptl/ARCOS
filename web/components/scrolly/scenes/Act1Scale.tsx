'use client';

import { useScrollyProgress } from '../progressContext';
import { formatCompact, formatFull } from '@/lib/format/number';
import styles from './scenes.module.css';

export interface YearlyTotal {
  year: number;
  pills: number;
}

export interface Act1ScaleProps {
  totalPills: number;
  yearly: YearlyTotal[];
}

export function Act1Scale({ totalPills, yearly }: Act1ScaleProps) {
  const progress = useScrollyProgress();
  const countT = Math.min(1, progress / 0.6);
  const currentCount = Math.round(totalPills * countT);
  const barsT = Math.max(0, (progress - 0.5) / 0.5);

  const maxPills = Math.max(...yearly.map((d) => d.pills), 1);

  return (
    <div className={styles.act}>
      <div className={styles.bigStat}>
        <span className={styles.eyebrow}>2006–2014</span>
        <span
          data-testid="act1-count"
          className={`${styles.count} numeric`}
          aria-live="polite"
        >
          {progress >= 1 ? formatFull(totalPills) : formatCompact(currentCount)}
        </span>
        <span className={styles.unit}>pills</span>
      </div>
      <svg
        viewBox="0 0 400 220"
        className={styles.bars}
        style={{ opacity: barsT }}
        aria-hidden="true"
      >
        {yearly.map((d, i) => {
          const barHeight = (d.pills / maxPills) * 160 * barsT;
          const x = 20 + i * 40;
          return (
            <g key={d.year}>
              <rect x={x} y={200 - barHeight} width={28} height={barHeight} fill="var(--accent-cool)" />
              <text x={x + 14} y={215} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                {d.year}
              </text>
            </g>
          );
        })}
      </svg>
      <table data-testid="act1-yearly-table" className={styles.dataTable}>
        <caption>Act 1 — pills shipped per year</caption>
        <thead>
          <tr><th>Year</th><th>Pills</th></tr>
        </thead>
        <tbody>
          {yearly.map((d) => (
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
