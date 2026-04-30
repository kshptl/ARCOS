'use client';

import type { MapMetric } from '@/components/map/layers/countyLayer';

export interface URLState {
  year: number;
  metric: MapMetric;
}

// Placeholder — real impl in Task 15.
export function useURLState(defaults: URLState): [URLState, (next: URLState) => void] {
  return [defaults, () => {}];
}

export function parseQuery(_search: string, defaults: URLState): URLState {
  return defaults;
}

export function serializeQuery(_state: URLState, _defaults?: URLState): string {
  return '';
}
