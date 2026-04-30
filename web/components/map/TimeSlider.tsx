"use client";

import { type KeyboardEvent, useCallback, useId } from "react";
import styles from "./TimeSlider.module.css";

export interface TimeSliderProps {
  years: number[];
  value: number;
  onChange: (year: number) => void;
  label?: string;
}

export function TimeSlider({ years, value, onChange, label = "Year" }: TimeSliderProps) {
  const labelId = useId();
  const sortedYears = [...years].sort((a, b) => a - b);
  const min = sortedYears[0] ?? value;
  const max = sortedYears[sortedYears.length - 1] ?? value;
  const idx = sortedYears.indexOf(value);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (sortedYears.length === 0) return;
      let nextIdx = idx;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          nextIdx = idx + 1;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          nextIdx = idx - 1;
          break;
        case "Home":
          nextIdx = 0;
          break;
        case "End":
          nextIdx = sortedYears.length - 1;
          break;
        case "PageUp":
          nextIdx = Math.min(sortedYears.length - 1, idx + 3);
          break;
        case "PageDown":
          nextIdx = Math.max(0, idx - 3);
          break;
        default:
          return;
      }
      if (nextIdx < 0 || nextIdx >= sortedYears.length || nextIdx === idx) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      onChange(sortedYears[nextIdx]!);
    },
    [idx, sortedYears, onChange],
  );

  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className={styles.wrap}>
      <span id={labelId} className={styles.label}>
        {label}: <span className={styles.valueText}>{value}</span>
      </span>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${label} ${value}`}
        onKeyDown={onKeyDown}
        className={styles.track}
      >
        <div className={styles.progress} style={{ width: `${pct}%` }} aria-hidden="true" />
        <div className={styles.thumb} style={{ left: `calc(${pct}% - 10px)` }} aria-hidden="true" />
      </div>
      <div className={styles.ticks} aria-hidden="true">
        {sortedYears.map((y) => (
          <span key={y} className={`${styles.tick} ${y === value ? styles.tickActive : ""}`}>
            {y}
          </span>
        ))}
      </div>
    </div>
  );
}
