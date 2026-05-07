"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { ScrollyProgressContext } from "./progressContext";
import styles from "./ScrollyStage.module.css";
import { useReducedMotion } from "./useReducedMotion";
import { useScrollProgress } from "./useScrollProgress";

export interface ScrollyStageProps {
  canvas: ReactNode;
  children: ReactNode;
  ariaLabel: string;
  stepLayout?: "sticky" | "stacked";
}

export function ScrollyStage({
  canvas,
  children,
  ariaLabel,
  stepLayout = "sticky",
}: ScrollyStageProps) {
  const { progress, ref } = useScrollProgress();
  const stepsRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const effective = reduced ? 1 : progress;

  useEffect(() => {
    if (stepLayout !== "stacked") return;
    const steps = stepsRef.current;
    if (!steps) return;

    const getArticles = () => Array.from(steps.querySelectorAll<HTMLElement>("article"));
    const setOffsets = () => {
      let top = Math.round(window.innerHeight * 0.1);
      for (const article of getArticles()) {
        article.style.setProperty("--stacked-step-top", `${top}px`);
        top += article.getBoundingClientRect().height + 8;
      }
    };

    const ResizeObserverCtor = globalThis.ResizeObserver;
    const resizeObserver = ResizeObserverCtor ? new ResizeObserverCtor(setOffsets) : null;
    resizeObserver?.observe(steps);
    for (const article of getArticles()) resizeObserver?.observe(article);
    window.addEventListener("resize", setOffsets);
    setOffsets();

    return () => {
      window.removeEventListener("resize", setOffsets);
      resizeObserver?.disconnect();
      for (const article of getArticles()) article.style.removeProperty("--stacked-step-top");
    };
  }, [stepLayout]);

  return (
    <section
      ref={ref as unknown as React.Ref<HTMLElement>}
      aria-label={ariaLabel}
      className={styles.stage}
      data-reduced={reduced ? "true" : "false"}
      data-step-layout={stepLayout}
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
        <div ref={stepsRef} className={styles.steps}>
          {children}
        </div>
      </ScrollyProgressContext.Provider>
    </section>
  );
}
