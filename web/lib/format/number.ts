// Number formatting helpers.

const FULL_FORMATTER = new Intl.NumberFormat("en-US");

export function formatFull(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return FULL_FORMATTER.format(value);
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return FULL_FORMATTER.format(value);
}
