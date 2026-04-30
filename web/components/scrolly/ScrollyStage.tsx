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
}

export function ScrollyStage({ canvas, children, ariaLabel }: ScrollyStageProps) {
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
         * When motion is enabled, the sticky canvas is a purely visual layer.
         * We mark it both aria-hidden (for AT) and inert (to remove its
         * focusable descendants from the tab order) so axe's aria-hidden-focus
         * rule is satisfied. When reduced motion is on, the canvas is the only
         * view, so it must remain both visible to AT and focusable.
         */}
        <div className={styles.sticky}>
          <div
            className={styles.canvas}
            aria-hidden={reduced ? "false" : "true"}
            inert={reduced ? undefined : true}
          >
            {canvas}
          </div>
        </div>
        <div className={styles.steps}>{children}</div>
      </ScrollyProgressContext.Provider>
    </section>
  );
}
