"use client";

import type { MapMetric } from "@/components/map/layers/countyLayer";
import styles from "./Filters.module.css";

export interface FiltersState {
  metric?: MapMetric;
}

export interface FiltersProps {
  metric: MapMetric;
  onChange: (next: FiltersState) => void;
}

const METRIC_LABELS: Record<MapMetric, string> = {
  pills: "Pills shipped",
  pills_per_capita: "Pills per capita",
  deaths: "Overdose deaths",
};

export function Filters({ metric, onChange }: FiltersProps) {
  return (
    <fieldset className={styles.root} aria-label="Filters">
      <legend className={styles.label}>Metric</legend>
      <div className={styles.options}>
        {(Object.keys(METRIC_LABELS) as MapMetric[]).map((m) => (
          <button
            key={m}
            type="button"
            className={styles.option}
            aria-pressed={metric === m}
            onClick={() => onChange({ metric: m })}
          >
            <span>{METRIC_LABELS[m]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
