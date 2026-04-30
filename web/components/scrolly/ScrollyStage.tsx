'use client';

import type { ReactNode } from 'react';
import styles from './ScrollyStage.module.css';
import { useScrollProgress } from './useScrollProgress';
import { ScrollyProgressContext } from './progressContext';

export interface ScrollyStageProps {
  canvas: ReactNode;
  children: ReactNode;
  ariaLabel: string;
  dataSummary?: ReactNode;
}

export function ScrollyStage({ canvas, children, ariaLabel, dataSummary }: ScrollyStageProps) {
  const { progress, ref } = useScrollProgress();

  return (
    <section
      ref={ref as unknown as React.Ref<HTMLElement>}
      role="region"
      aria-label={ariaLabel}
      className={styles.stage}
    >
      <ScrollyProgressContext.Provider value={progress}>
        <div className={styles.sticky} aria-hidden="true">
          {canvas}
        </div>
        <div className={styles.steps}>{children}</div>
        {dataSummary && (
          <details className={styles.details}>
            <summary>Show data</summary>
            {dataSummary}
          </details>
        )}
      </ScrollyProgressContext.Provider>
    </section>
  );
}
