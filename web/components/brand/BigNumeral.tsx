import type { ReactNode } from "react";
import styles from "./BigNumeral.module.css";

export type BigNumeralTone = "default" | "hot" | "cool";

type Props = {
  value: number;
  unit: ReactNode;
  compact?: boolean;
  tone?: BigNumeralTone;
  ariaLabel?: string;
  /**
   * Wrapping element. Defaults to `figure` (block-level, with implicit
   * `role="figure"`). Use `span` when the numeral must be rendered inline
   * inside a paragraph or other phrasing-content parent, because `<figure>`
   * cannot be nested in `<p>` and will trigger hydration mismatches.
   */
  as?: "figure" | "span";
};

const COMPACT_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const FULL_FORMATTER = new Intl.NumberFormat("en-US");

export function BigNumeral({
  value,
  unit,
  compact = false,
  tone = "default",
  ariaLabel,
  as = "figure",
}: Props) {
  const display = compact ? COMPACT_FORMATTER.format(value) : FULL_FORMATTER.format(value);
  const toneClass = tone === "hot" ? styles.accentHot : tone === "cool" ? styles.accentCool : "";
  const label = ariaLabel ?? `${display} ${typeof unit === "string" ? unit : ""}`;
  const children = (
    <>
      <span className={`${styles.value} ${styles.numeric}`}>{display}</span>
      <span className={styles.unit}>{unit}</span>
    </>
  );
  if (as === "span") {
    return (
      // biome-ignore lint/a11y/useSemanticElements: <figure> cannot nest inside <p>; using span with role preserves inline phrasing content.
      <span className={`${styles.root} ${toneClass}`} role="figure" aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <figure className={`${styles.root} ${toneClass}`} aria-label={label}>
      {children}
    </figure>
  );
}
