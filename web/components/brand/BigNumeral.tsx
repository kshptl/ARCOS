import type { ReactNode } from "react";
import styles from "./BigNumeral.module.css";

export type BigNumeralTone = "default" | "hot" | "cool";

type Props = {
  value: number;
  unit: ReactNode;
  compact?: boolean;
  tone?: BigNumeralTone;
  ariaLabel?: string;
};

const COMPACT_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const FULL_FORMATTER = new Intl.NumberFormat("en-US");

export function BigNumeral({ value, unit, compact = false, tone = "default", ariaLabel }: Props) {
  const display = compact ? COMPACT_FORMATTER.format(value) : FULL_FORMATTER.format(value);
  const toneClass =
    tone === "hot" ? styles.accentHot : tone === "cool" ? styles.accentCool : "";
  return (
    <figure
      className={`${styles.root} ${toneClass}`}
      aria-label={ariaLabel ?? `${display} ${typeof unit === "string" ? unit : ""}`}
    >
      <span className={`${styles.value} ${styles.numeric}`}>{display}</span>
      <span className={styles.unit}>{unit}</span>
    </figure>
  );
}
