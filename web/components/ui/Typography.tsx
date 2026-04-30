import type { ReactNode } from "react";
import styles from "./Typography.module.css";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export function Display({ children }: { children: ReactNode }) {
  return <h1 className={styles.display}>{children}</h1>;
}

export function Lede({ children }: { children: ReactNode }) {
  return <p className={styles.lede}>{children}</p>;
}

export function Caption({ children }: { children: ReactNode }) {
  return <p className={styles.caption}>{children}</p>;
}
