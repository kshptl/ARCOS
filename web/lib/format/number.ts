const COMPACT_FMT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const FULL_FMT = new Intl.NumberFormat("en-US");

export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return COMPACT_FMT.format(n);
}

export function formatFull(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return FULL_FMT.format(n);
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
