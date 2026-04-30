'use client';

import type { ChangeEvent } from 'react';
import type { MapMetric } from '@/components/map/layers/countyLayer';
import styles from './Filters.module.css';

export interface FiltersState {
  year?: number;
  metric?: MapMetric;
}

export interface FiltersProps {
  year: number;
  metric: MapMetric;
  years: number[];
  onChange: (next: FiltersState) => void;
}

const METRIC_LABELS: Record<MapMetric, string> = {
  pills: 'Pills shipped',
  pills_per_capita: 'Pills per capita',
  deaths: 'Overdose deaths',
};

export function Filters({ year, metric, years, onChange }: FiltersProps) {
  return (
    <div className={styles.root} role="group" aria-label="Filters">
      <label className={styles.field}>
        <span className={styles.label}>Year</span>
        <select
          value={String(year)}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange({ year: Number(e.target.value) })}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Metric</span>
        <select
          value={metric}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange({ metric: e.target.value as MapMetric })}
        >
          {(Object.keys(METRIC_LABELS) as MapMetric[]).map((m) => (
            <option key={m} value={m}>
              {METRIC_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
