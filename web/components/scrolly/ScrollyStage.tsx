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
      aria-label={ariaLabel}
      className={styles.stage}
      data-reduced={reduced ? "true" : "false"}
    >
      <ScrollyProgressContext.Provider value={effective}>
        {/*
         * When motion is enabled, the sticky canvas is a purely visual layer:
         * Act 4 duplicates its county links into the <details> data summary
         * below, and the Explorer + Rankings pages list every county. Mark
         * it both aria-hidden (for AT) and inert (to remove its focusable
         * descendants from the tab order) so axe's aria-hidden-focus rule is
         * satisfied. When reduced motion is on, the canvas is the only view,
         * so it must remain both visible to AT and focusable.
         *
         * The .details block is rendered INSIDE the sticky wrapper (not its
         * inert canvas child) so the "Show data" toggle remains visible and
         * operable at every scroll position within the act. The wrapper uses
         * overflow: visible so the expanded panel can spill past the canvas
         * bounds without being clipped. The inner .canvas div preserves the
         * original overflow: hidden behaviour the scenes rely on.
         */}
        <div className={styles.sticky}>
          <div
            className={styles.canvas}
            aria-hidden={reduced ? "false" : "true"}
            inert={reduced ? undefined : true}
          >
            {canvas}
          </div>
          {dataSummary ? (
            <details className={styles.details}>
              <summary className={styles.summary}>Show data</summary>
              <div className={styles.detailsPanel}>{dataSummary}</div>
            </details>
          ) : null}
        </div>
        <div className={styles.steps}>{children}</div>
      </ScrollyProgressContext.Provider>
    </section>
  );
}
