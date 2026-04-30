import type { ReactNode } from "react";
import styles from "./Accent.module.css";

type Props = {
  tone?: "hot" | "cool";
  children: ReactNode;
};

export function Accent({ tone = "hot", children }: Props) {
  return <span className={`${styles.root} ${styles[tone]}`}>{children}</span>;
}
