import type { ReactNode } from "react";
import styles from "./Pill.module.css";

type Props = {
  tone?: "neutral" | "hot" | "cool";
  children: ReactNode;
};

export function Pill({ tone = "neutral", children }: Props) {
  return <span className={`${styles.root} ${styles[tone]}`}>{children}</span>;
}
