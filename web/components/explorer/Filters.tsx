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
  metric: MapMetric;
  label: string;
};

const METRIC_OPTIONS: MetricOption[] = [
  { metric: "pills_per_capita", label: "Pills per capita" },
  { metric: "deaths_per_100k", label: "Overdose deaths per 100k" },
  { metric: "mme_per_capita", label: "MME per capita" },
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
            data-metric={option.metric}
            aria-pressed={metric === option.metric}
            aria-describedby={option.metric === "mme_per_capita" ? mmeTooltipId : undefined}
            onClick={() => {
              onChange({ metric: option.metric });
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
        MME means morphine milligram equivalent. It converts each opioid shipment into a common
        opioid amount so stronger drugs count more than weaker drugs. County MME is available for
        2006-2012, and state MME is available for 2015-2024.
      </p>
    </fieldset>
  );
}
