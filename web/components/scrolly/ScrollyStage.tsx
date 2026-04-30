"use client";

import type { ReactNode } from "react";
import { ScrollyProgressContext } from "./progressContext";
import styles from "./ScrollyStage.module.css";
import { useReducedMotion } from "./useReducedMotion";
import { useScrollProgress } from "./useScrollProgress";

export interface ScrollyStageProps {
  canvas: ReactNode;
  children: ReactNode;
  ariaLabel: string;
  dataSummary?: ReactNode;
}

export function ScrollyStage({ canvas, children, ariaLabel, dataSummary }: ScrollyStageProps) {
  const { progress, ref } = useScrollProgress();
  const reduced = useReducedMotion();
  const effective = reduced ? 1 : progress;

  return (
    <section
      ref={ref as unknown as React.Ref<HTMLElement>}
      role="region"
      aria-label={ariaLabel}
      className={styles.stage}
      data-reduced={reduced ? "true" : "false"}
    >
      <ScrollyProgressContext.Provider value={effective}>
        <div className={styles.sticky} aria-hidden={reduced ? "false" : "true"}>
          {canvas}
        </div>
        <div className={styles.steps}>{children}</div>
        {dataSummary ? (
          <details className={styles.details}>
            <summary>Show data</summary>
            {dataSummary}
          </details>
        ) : null}
      </ScrollyProgressContext.Provider>
    </section>
  );
}
