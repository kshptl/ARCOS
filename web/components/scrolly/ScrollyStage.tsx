"use client";

import { Children, type ReactNode, useEffect, useRef, useState } from "react";
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
  const [stackedActiveStep, setStackedActiveStep] = useState(0);
  const reduced = useReducedMotion();
  const effective = reduced ? 1 : progress;
  const stepCount = Children.count(children);
  const activeStep =
    stepLayout === "stacked" && stepCount > 0
      ? Math.min(stepCount - 1, stackedActiveStep)
      : undefined;

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
    const updateActiveStep = () => {
      let nextActive = 0;
      for (const [index, article] of getArticles().entries()) {
        const stickyTop = Number.parseFloat(article.style.getPropertyValue("--stacked-step-top"));
        const stopLine = Number.isFinite(stickyTop)
          ? stickyTop
          : Math.round(window.innerHeight * 0.1);
        if (article.getBoundingClientRect().top <= stopLine + 1) nextActive = index;
      }
      setStackedActiveStep((current) => (current === nextActive ? current : nextActive));
    };
    const refreshLayout = () => {
      setOffsets();
      updateActiveStep();
    };

    let rafId = 0;
    const requestActiveUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateActiveStep);
    };

    const ResizeObserverCtor = globalThis.ResizeObserver;
    const resizeObserver = ResizeObserverCtor ? new ResizeObserverCtor(refreshLayout) : null;
    resizeObserver?.observe(steps);
    for (const article of getArticles()) resizeObserver?.observe(article);
    window.addEventListener("resize", refreshLayout);
    window.addEventListener("scroll", requestActiveUpdate, { passive: true });
    refreshLayout();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", refreshLayout);
      window.removeEventListener("scroll", requestActiveUpdate);
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
      data-active-step={activeStep}
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
