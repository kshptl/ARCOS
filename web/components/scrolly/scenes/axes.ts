import { formatCompact, formatFull } from "@/lib/format/number";

/**
 * Compute "nice" round tick values spanning [min, max] with approximately
 * `target` divisions. Uses the classic 1/2/5 × 10^k rounding so axis ticks
 * look editorial (0, 25, 50, 75, 100) rather than arbitrary (0, 23, 46, ...).
 */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (max <= min) return [min, min + 1];
  const range = max - min;
  const roughStep = range / Math.max(1, target);
  const pow10 = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / pow10;
  let niceNormalized: number;
  if (normalized < 1.5) niceNormalized = 1;
  else if (normalized < 3) niceNormalized = 2;
  else if (normalized < 7) niceNormalized = 5;
  else niceNormalized = 10;
  const step = niceNormalized * pow10;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    // Guard against floating-point drift
    ticks.push(Number(v.toFixed(12)));
  }
  return ticks;
}

export type TickFormat = "percent" | "compact" | "integer";

export function formatTickValue(v: number, format: TickFormat): string {
  switch (format) {
    case "percent":
      return `${Math.round(v * 10) / 10}%`;
    case "compact":
      return formatCompact(v);
    case "integer":
      return formatFull(v);
  }
}
