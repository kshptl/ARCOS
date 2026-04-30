import type { ReactElement } from "react";
import styles from "./charts.module.css";

export interface SlopeProps<T extends Record<string, unknown>> {
  data: T[];
  left: { key: keyof T & string; label: string };
  right: { key: keyof T & string; label: string };
  rowLabelKey: keyof T & string;
  highlight?: (row: T) => boolean;
  width?: number;
  height?: number;
  ariaLabel: string;
}

export function Slope<T extends Record<string, unknown>>(
  props: SlopeProps<T>,
): ReactElement {
  const {
    data,
    left,
    right,
    rowLabelKey,
    highlight,
    width = 480,
    height = 320,
    ariaLabel,
  } = props;

  const xLeft = 140;
  const xRight = width - 140;
  const values = data.flatMap((d) => [
    Number(d[left.key]) ?? 0,
    Number(d[right.key]) ?? 0,
  ]);
  const max = Math.max(...values, 1);
  const y = (v: number) => height - (v / max) * (height - 40) - 20;

  return (
    <figure aria-label={ariaLabel} className={styles.root}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      >
        <title>{ariaLabel}</title>
        <text x={xLeft} y={12} textAnchor="middle" fontSize="12" fill="currentColor">
          {left.label}
        </text>
        <text x={xRight} y={12} textAnchor="middle" fontSize="12" fill="currentColor">
          {right.label}
        </text>
        {data.map((row, i) => {
          const a = Number(row[left.key]) ?? 0;
          const b = Number(row[right.key]) ?? 0;
          const isHi = highlight ? highlight(row) : false;
          const stroke = isHi ? "var(--accent-hot)" : "var(--text-muted)";
          const strokeOpacity = isHi ? 1 : 0.35;
          return (
            <g key={i}>
              <line
                x1={xLeft}
                y1={y(a)}
                x2={xRight}
                y2={y(b)}
                stroke={stroke}
                strokeOpacity={strokeOpacity}
                strokeWidth={isHi ? 2 : 1}
              />
              <text
                x={xLeft - 8}
                y={y(a)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="12"
                fill={isHi ? "var(--text)" : "var(--text-muted)"}
              >
                {String(row[rowLabelKey])}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
