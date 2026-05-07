"use client";

import type { ChangeEvent } from "react";
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
      <label className={styles.field}>
        <span className={styles.label}>Metric</span>
        <select
          value={metric}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onChange({ metric: e.target.value as MapMetric })
          }
        >
          {(Object.keys(METRIC_LABELS) as MapMetric[]).map((m) => (
            <option key={m} value={m}>
              {METRIC_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
