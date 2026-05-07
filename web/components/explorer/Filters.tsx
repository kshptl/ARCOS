"use client";

import { useId } from "react";
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
  unavailable?: boolean;
};

const METRIC_OPTIONS: MetricOption[] = [
  { metric: "pills_per_capita", label: "Pills per capita" },
  { metric: "deaths_per_100k", label: "Overdose deaths per 100k" },
  { metric: "mme_per_capita", label: "MME per capita", unavailable: true },
];

export function Filters({ metric, onChange }: FiltersProps) {
  const metricTooltipId = useId();
  const mmeTooltipId = useId();

  return (
    <fieldset className={styles.root} aria-label="Filters">
      <legend className={styles.label}>
        <span>Metric</span>
        <button
          type="button"
          className={styles.infoButton}
          aria-label="About explorer metrics"
          aria-describedby={metricTooltipId}
        >
          i
        </button>
      </legend>
      <div className={styles.options}>
        {METRIC_OPTIONS.map((option) => (
          <button
            key={option.metric}
            type="button"
            className={styles.option}
            aria-pressed={metric === option.metric}
            aria-disabled={option.unavailable ? "true" : undefined}
            aria-describedby={option.unavailable ? mmeTooltipId : undefined}
            onClick={() => {
              if (option.metric !== "mme_per_capita") onChange({ metric: option.metric });
            }}
          >
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      <p id={metricTooltipId} role="tooltip" className={styles.metricTooltip}>
        Metrics are normalized so counties and states can be compared fairly instead of only showing
        where more people live.
      </p>
      <p id={mmeTooltipId} role="tooltip" className={styles.tooltip}>
        MME means morphine milligram equivalent. It requires drug strength and opioid conversion
        data, which are not in the current county shipment file.
      </p>
    </fieldset>
  );
}
