import { describe, expect, it } from 'vitest';
import { clampProgress, computeProgress } from '@/components/scrolly/useScrollProgress';

describe('scroll progress helpers', () => {
  it('clampProgress clamps to [0,1]', () => {
    expect(clampProgress(-1)).toBe(0);
    expect(clampProgress(2)).toBe(1);
    expect(clampProgress(0.5)).toBe(0.5);
  });

  it('computeProgress returns 0 when element is below viewport', () => {
    const rect = { top: 1000, height: 500 } as DOMRect;
    expect(computeProgress(rect, 800)).toBe(0);
  });

  it('computeProgress returns 1 when element has scrolled past viewport', () => {
    const rect = { top: -2000, height: 500 } as DOMRect;
    expect(computeProgress(rect, 800)).toBe(1);
  });

  it('computeProgress returns 0..1 while element is in view', () => {
    const p1 = computeProgress({ top: 0, height: 2000 } as DOMRect, 800);
    expect(p1).toBeGreaterThanOrEqual(0);
    expect(p1).toBeLessThan(0.5);
    const p2 = computeProgress({ top: -1000, height: 2000 } as DOMRect, 800);
    expect(p2).toBeGreaterThan(0.4);
    expect(p2).toBeLessThan(0.8);
  });
});
