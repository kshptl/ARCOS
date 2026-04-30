"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

export function clampProgress(p: number): number {
  if (Number.isNaN(p)) return 0;
  return Math.min(1, Math.max(0, p));
}

export function computeProgress(rect: DOMRect, viewportHeight: number): number {
  // Element must scroll by its full height before it's considered done.
  // If rect.top >= viewportHeight, element is still below viewport → 0.
  // If rect.top + rect.height <= 0, element is past viewport → 1.
  if (rect.top >= viewportHeight) return 0;
  if (rect.top + rect.height <= 0) return 1;
  // Use total = rect.height (not height - viewport) so that p ramps linearly
  // through the scroll span.
  const total = rect.height;
  if (total <= 0) return 0;
  const scrolled = -rect.top;
  return clampProgress(scrolled / total);
}

export interface UseScrollProgressOptions {
  ref?: RefObject<HTMLElement | null>;
}

export function useScrollProgress(options: UseScrollProgressOptions = {}): {
  progress: number;
  ref: RefObject<HTMLElement | null>;
} {
  const localRef = useRef<HTMLElement | null>(null);
  const targetRef = options.ref ?? localRef;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    let rafId = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setProgress(computeProgress(rect, window.innerHeight));
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [targetRef]);

  return { progress, ref: targetRef };
}
