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

type MetricOption = {
  metric: MapMetric | "mme_per_capita";
  label: string;
  disabled?: boolean;
};

const METRIC_OPTIONS: MetricOption[] = [
  { metric: "pills_per_capita", label: "Pills per capita" },
  { metric: "deaths_per_100k", label: "Overdose deaths per 100k" },
  { metric: "mme_per_capita", label: "MME per capita", disabled: true },
];

export function Filters({ metric, onChange }: FiltersProps) {
  return (
    <fieldset className={styles.root} aria-label="Filters">
      <legend className={styles.label}>Metric</legend>
      <div className={styles.options}>
        {METRIC_OPTIONS.map((option) => (
          <button
            key={option.metric}
            type="button"
            className={styles.option}
            aria-pressed={metric === option.metric}
            aria-describedby={option.disabled ? "mme-per-capita-tooltip" : undefined}
            disabled={option.disabled}
            onClick={() => {
              if (option.metric !== "mme_per_capita") onChange({ metric: option.metric });
            }}
          >
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      <p id="mme-per-capita-tooltip" role="tooltip" className={styles.tooltip}>
        MME means morphine milligram equivalent. It requires drug strength and opioid conversion
        data, which are not in the current county shipment file.
      </p>
    </fieldset>
  );
}
