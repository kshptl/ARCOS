'use client';

import type { MapMetric } from '@/components/map/layers/countyLayer';

export interface FiltersState {
  year?: number;
  metric?: MapMetric;
}

export interface FiltersProps {
  year: number;
  metric: MapMetric;
  years: number[];
  onChange: (next: FiltersState) => void;
}

// Placeholder — real impl in Task 14.
export function Filters(_props: FiltersProps) {
  return <div role="group" aria-label="Filters" />;
}
