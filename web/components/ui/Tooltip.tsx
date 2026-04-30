"use client";

import { type ReactNode, useId } from "react";
import styles from "./Tooltip.module.css";

type Props = {
  content: ReactNode;
  children: ReactNode;
};

export function Tooltip({ content, children }: Props) {
  const id = useId();
  return (
    <span className={styles.root}>
      <span
        className={styles.trigger}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: trigger must be keyboard-focusable to reveal tooltip
        tabIndex={0}
        aria-describedby={id}
      >
        {children}
      </span>
      <span id={id} role="tooltip" className={styles.content}>
        {content}
      </span>
    </span>
  );
}
