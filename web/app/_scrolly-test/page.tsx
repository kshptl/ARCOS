// NOTE: temporary spike route. Delete in Task 4. Not linked from anywhere.
'use client';

import { useEffect, useRef, useState } from 'react';
import { interpolate } from 'd3-interpolate';
import styles from './scrolly-test.module.css';

const VIEW_A = { longitude: -98, latitude: 39, zoom: 3.2, pitch: 0, bearing: 0 };
const VIEW_B = { longitude: -82, latitude: 37.7, zoom: 6.5, pitch: 20, bearing: -12 };

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export default function ScrollyTestPage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onScroll = () => {
      const rect = stage.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) {
        setProgress(0);
        return;
      }
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      setProgress(scrolled / total);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const t = reducedMotion ? (progress < 0.5 ? 0 : 1) : progress;
  const view = interpolate(VIEW_A, VIEW_B)(t);

  return (
    <div ref={stageRef} className={styles.stage}>
      <div className={styles.sticky}>
        <div
          className={styles.canvas}
          data-testid="scrolly-canvas"
          style={{
            transform: `translate3d(${-view.longitude * 2}px, ${view.latitude * 2}px, 0) scale(${view.zoom / 3})`,
          }}
        >
          <div className={styles.marker} aria-hidden="true">
            {t.toFixed(2)}
          </div>
        </div>
      </div>
      <section className={styles.step} aria-label="Step 1">
        <h2>Step 1 — National view</h2>
        <p>Scroll to zoom in on Appalachia.</p>
      </section>
      <section className={styles.step} aria-label="Step 2">
        <h2>Step 2 — Appalachia</h2>
        <p>Reduced motion snaps instead of tweening.</p>
      </section>
    </div>
  );
}
