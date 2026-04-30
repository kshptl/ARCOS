import { formatCompact, formatFull } from "@/lib/format/number";

export interface BigNumeralProps {
  value: number;
  unit?: string;
  compact?: boolean;
}

export function BigNumeral({ value, unit, compact = false }: BigNumeralProps) {
  const formatted = compact ? formatCompact(value) : formatFull(value);
  return (
    <span
      className="numeric"
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "inherit",
        color: "var(--accent-hot)",
      }}
    >
      {formatted}
      {unit ? <span style={{ marginInlineStart: "0.35em" }}>{unit}</span> : null}
    </span>
  );
}
