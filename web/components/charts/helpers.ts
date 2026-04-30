import { formatFull } from "@/lib/format/number";

/**
 * Convert a row-oriented dataset into a 2D array suitable for a
 * `<details><table>` a11y fallback. Numbers are formatted with thousands
 * separators; other values are stringified.
 */
export function rowsToTable<T extends Record<string, unknown>>(
  rows: T[],
  columns: ReadonlyArray<keyof T & string>,
): string[][] {
  const header: string[] = [...columns];
  const body = rows.map((row) =>
    columns.map((col) => {
      const v = row[col];
      if (typeof v === "number") return formatFull(v);
      if (v === null || v === undefined) return "—";
      return String(v);
    }),
  );
  return [header, ...body];
}

/**
 * One-line English summary of a time series for screen readers.
 */
export function summarizeTrend(points: Array<{ year: number; value: number | null }>): string {
  const present = points.filter((p): p is { year: number; value: number } => p.value !== null);
  if (present.length === 0) return "";
  const first = present[0];
  const last = present[present.length - 1];
  if (!first || !last) return "";
  if (present.length === 1) return `${formatFull(first.value)} in ${first.year}.`;
  const verb = last.value > first.value ? "rose" : last.value < first.value ? "fell" : "held";
  return `${verb} from ${formatFull(first.value)} to ${formatFull(last.value)} (${first.year}-${last.year}).`;
}
