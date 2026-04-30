import type { ReactElement } from "react";
import { formatCompact, formatFull } from "@/lib/format/number";
import { rowsToTable } from "./helpers";
import styles from "./charts.module.css";

export interface BarProps<T extends Record<string, unknown>> {
  data: T[];
  label?: keyof T & string;
  value?: keyof T & string;
  width?: number;
  /** Row height in px; total height = rows * rowHeight */
  rowHeight?: number;
  /** Optional highlight selector */
  highlight?: (row: T) => boolean;
  ariaLabel: string;
}

export function Bar<T extends Record<string, unknown>>(props: BarProps<T>): ReactElement {
  const {
    data,
    label = "label" as keyof T & string,
    value = "value" as keyof T & string,
    width = 560,
    rowHeight = 28,
    highlight,
    ariaLabel,
  } = props;

  const rows = [...data].sort(
    (a, b) => (Number(b[value]) ?? 0) - (Number(a[value]) ?? 0),
  );
  const max = rows.reduce((m, r) => Math.max(m, Number(r[value]) ?? 0), 0);
  const labelWidth = 160;
  const valueWidth = 72;
  const barWidth = width - labelWidth - valueWidth - 16;
  const height = rows.length * rowHeight;
  const top = rows[0];
  const summary = top
    ? `${ariaLabel}. Top: ${String(top[label])} at ${formatFull(Number(top[value]))}.`
    : ariaLabel;

  return (
    <figure aria-label={summary} className={styles.root}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      >
        <title>{summary}</title>
        {rows.map((row, i) => {
          const v = Number(row[value]) ?? 0;
          const w = max > 0 ? (v / max) * barWidth : 0;
          const y = i * rowHeight;
          const isHi = highlight ? highlight(row) : false;
          return (
            <g key={String(row[label])} transform={`translate(0, ${y})`}>
              <text
                x={0}
                y={rowHeight / 2}
                dominantBaseline="middle"
                fontSize="13"
                fill="currentColor"
              >
                {String(row[label])}
              </text>
              <rect
                x={labelWidth}
                y={rowHeight * 0.2}
                width={w}
                height={rowHeight * 0.6}
                fill={isHi ? "var(--accent-hot)" : "var(--accent-cool)"}
                rx={2}
              />
              <text
                x={labelWidth + w + 6}
                y={rowHeight / 2}
                dominantBaseline="middle"
                fontSize="13"
                fill="currentColor"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatCompact(v)}
              </text>
            </g>
          );
        })}
      </svg>
      <details className={styles.details}>
        <summary>Show data</summary>
        <Table rows={rows} columns={[label, value]} />
      </details>
    </figure>
  );
}

function Table<T extends Record<string, unknown>>({
  rows,
  columns,
}: {
  rows: T[];
  columns: Array<keyof T & string>;
}): ReactElement {
  const table = rowsToTable(rows, columns);
  const [header, ...body] = table;
  return (
    <table>
      <thead>
        <tr>{header?.map((h) => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {body.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
