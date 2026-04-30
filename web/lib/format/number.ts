const COMPACT_FMT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const FULL_FMT = new Intl.NumberFormat("en-US");
const PER_CAPITA_FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return COMPACT_FMT.format(n);
}

export function formatFull(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return FULL_FMT.format(n);
}

/**
 * Format a per-capita rate (e.g. pills per person per year) with one decimal
 * place. Three decimals is overprecise for journalistic per-capita display
 * (e.g. "99.075 per person" becomes "99.1 per person").
 */
export function formatPerCapita(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return PER_CAPITA_FMT.format(n);
}

const ORDINAL_RULES = new Intl.PluralRules("en-US", { type: "ordinal" });
const ORDINAL_SUFFIXES: Record<Intl.LDMLPluralRule, string> = {
  one: "st",
  two: "nd",
  few: "rd",
  other: "th",
  zero: "th",
  many: "th",
};

export function formatOrdinal(n: number): string {
  const rule = ORDINAL_RULES.select(n);
  const suffix = ORDINAL_SUFFIXES[rule] ?? "th";
  return `${n}${suffix}`;
}
