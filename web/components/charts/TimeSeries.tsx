"use client";

import * as Plot from "@observablehq/plot";
import { type ReactElement, useEffect, useRef } from "react";
import styles from "./charts.module.css";
import { rowsToTable, summarizeTrend } from "./helpers";

export interface TimeSeriesProps<T extends Record<string, unknown>> {
  data: T[];
  x: keyof T & string;
  y: keyof T & string;
  /** Optional series key — each unique value becomes its own line */
  series?: keyof T & string;
  /** Width in CSS pixels; defaults to responsive 640 */
  width?: number;
  /** Height in CSS pixels; defaults to 280 */
  height?: number;
  /** Color override for single-series charts */
  color?: string;
  /** Short description for aria-label */
  ariaLabel: string;
  /** Human-readable x-axis label (defaults to the x key name) */
  xLabel?: string;
  /** Human-readable y-axis label (defaults to the y key name) */
  yLabel?: string;
}

export function TimeSeries<T extends Record<string, unknown>>(
  props: TimeSeriesProps<T>,
): ReactElement {
  const { data, x, y, series, width = 640, height = 280, color, ariaLabel, xLabel, yLabel } = props;
  const columns = series ? [x, series, y] : [x, y];

  const summary =
    data.length > 0
      ? summarizeTrend(
          data
            .filter((d): d is T & Record<string, number> => typeof d[x] === "number")
            .map((d) => ({
              year: d[x] as number,
              value: typeof d[y] === "number" ? (d[y] as number) : null,
            })),
        )
      : "";

  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;
    const chart = Plot.plot({
      width,
      height,
      marginLeft: 56,
      marginBottom: 36,
      x: { label: xLabel ?? String(x), tickFormat: "d", grid: false },
      y: {
        label: yLabel ?? String(y),
        grid: true,
        nice: true,
      },
      marks: [
        series
          ? Plot.line(data, { x, y, stroke: series, strokeWidth: 1.8 })
          : Plot.line(data, {
              x,
              y,
              stroke: color ?? "var(--accent-cool)",
              strokeWidth: 2,
            }),
        Plot.dot(data, { x, y, fill: "currentColor", r: 2.5 }),
      ],
    });
    const node = chartRef.current;
    node.replaceChildren(chart);
    return () => {
      chart.remove();
    };
  }, [data, x, y, series, width, height, color, xLabel, yLabel]);

  return (
    <figure aria-label={`${ariaLabel}. ${summary}`} className={styles.root}>
      <div ref={chartRef} aria-hidden="true" style={{ minHeight: height }} />
      <details className={styles.details}>
        <summary>Show data</summary>
        <DataTable rows={data} columns={columns} />
      </details>
    </figure>
  );
}

function DataTable<T extends Record<string, unknown>>({
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
        <tr>
          {header?.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: data table rows have no stable id beyond position
          <tr key={i}>
            {row.map((cell, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: table cells within a row are positional
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
