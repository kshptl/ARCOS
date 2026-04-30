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
  const path = toPath(values, width, height);
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
      {path && <path d={path} />}
    </svg>
  );
}

function toPath(values: number[], width: number, height: number): string | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const y = (v: number) => height - ((v - min) / span) * (height - 2) - 1;
  const pts = values.map(
    (v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`,
  );
  return pts.join(" ");
}
