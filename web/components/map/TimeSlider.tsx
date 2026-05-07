"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useId,
  useRef,
} from "react";
import styles from "./TimeSlider.module.css";

export interface TimeSliderProps {
  years: number[];
  value: number;
  onChange: (year: number) => void;
  label?: string;
}

export function TimeSlider({ years, value, onChange, label = "Year" }: TimeSliderProps) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const latestYear = useRef(value);
  latestYear.current = value;
  const sortedYears = [...years].sort((a, b) => a - b);
  const min = sortedYears[0] ?? value;
  const max = sortedYears[sortedYears.length - 1] ?? value;
  const idx = sortedYears.indexOf(value);

  const yearFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || sortedYears.length === 0) return null;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const nextIdx = Math.round(pct * (sortedYears.length - 1));
      return sortedYears[nextIdx] ?? null;
    },
    [sortedYears],
  );

  const changeFromPointer = useCallback(
    (clientX: number) => {
      const nextYear = yearFromClientX(clientX);
      if (nextYear === null || nextYear === latestYear.current) return;
      latestYear.current = nextYear;
      onChange(nextYear);
    },
    [onChange, yearFromClientX],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      activePointerId.current = e.pointerId;
      e.currentTarget.focus();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      changeFromPointer(e.clientX);
    },
    [changeFromPointer],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== e.pointerId) return;
      changeFromPointer(e.clientX);
    },
    [changeFromPointer],
  );

  const onPointerEnd = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

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
      const nextYear = sortedYears[nextIdx];
      if (nextYear === undefined) return;
      e.preventDefault();
      onChange(nextYear);
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        ref={trackRef}
        className={styles.track}
      >
        <div className={styles.progress} style={{ width: `${pct}%` }} aria-hidden="true" />
        <div className={styles.thumb} style={{ left: `calc(${pct}% - 8px)` }} aria-hidden="true" />
      </div>
      <div
        className={styles.ticks}
        style={{ "--year-count": sortedYears.length } as CSSProperties}
        aria-hidden="true"
      >
        {sortedYears.map((y) => (
          <span key={y} className={`${styles.tick} ${y === value ? styles.tickActive : ""}`}>
            {y}
          </span>
        ))}
      </div>
    </div>
  );
}
