'use client';

import type { MapMetric } from '@/components/map/layers/countyLayer';

export interface DataLoaderProps {
  year: number;
  onData: (year: number, values: Map<string, number>) => void;
  onError?: (err: Error) => void;
  metric?: MapMetric;
  parquetUrl?: string;
}

// Placeholder — real implementation lands in Task 16.
export function DataLoader(_props: DataLoaderProps) {
  return null;
}
