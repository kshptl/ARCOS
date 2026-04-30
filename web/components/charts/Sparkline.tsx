import type { ReactElement } from "react";
import styles from "./charts.module.css";

export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  ariaLabel: string;
}

export function Sparkline(props: SparklineProps): ReactElement {
  const { values, width = 100, height = 24, ariaLabel } = props;
  return (
    <svg
      className={styles.sparkline}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      {renderMarks(values, width, height)}
    </svg>
  );
}

function renderMarks(values: number[], width: number, height: number): ReactElement | null {
  if (values.length === 0) return null;
  if (values.length === 1) {
    // Single-point data (e.g. one year of distributor share): draw a centered
    // dot so the cell isn't visually empty. Without this, short/sparse data
    // from the pipeline renders as a blank SVG.
    const cx = width / 2;
    const cy = height / 2;
    return <circle cx={cx} cy={cy} r={1.5} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const y = (v: number) => height - ((v - min) / span) * (height - 2) - 1;
  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  return <path d={d} />;
}
