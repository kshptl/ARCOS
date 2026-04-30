/**
 * Format a percentage. Input is 0-100 (not 0-1) to match spec §4 share_pct.
 */
export function formatPercent(n: number | null | undefined, fractionDigits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(fractionDigits)}%`;
}
