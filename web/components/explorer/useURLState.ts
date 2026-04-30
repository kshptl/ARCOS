'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MapMetric } from '@/components/map/layers/countyLayer';

export interface URLState {
  year: number;
  metric: MapMetric;
}

const VALID_METRICS: MapMetric[] = ['pills', 'pills_per_capita', 'deaths'];

export function parseQuery(search: string, defaults: URLState): URLState {
  const params = new URLSearchParams(search);
  const yearStr = params.get('year');
  const metricStr = params.get('metric');
  const yearNum = yearStr != null ? Number(yearStr) : NaN;
  const year = Number.isFinite(yearNum) ? yearNum : defaults.year;
  const metric =
    metricStr && VALID_METRICS.includes(metricStr as MapMetric)
      ? (metricStr as MapMetric)
      : defaults.metric;
  return { year, metric };
}

export function serializeQuery(state: URLState, defaults?: URLState): string {
  const params = new URLSearchParams();
  if (!defaults || state.year !== defaults.year) params.set('year', String(state.year));
  if (!defaults || state.metric !== defaults.metric) params.set('metric', state.metric);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function useURLState(defaults: URLState): [URLState, (next: URLState) => void] {
  const [state, setLocalState] = useState<URLState>(() => {
    if (typeof window === 'undefined') return defaults;
    return parseQuery(window.location.search, defaults);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => setLocalState(parseQuery(window.location.search, defaults));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // defaults should be stable; do not add to deps
  }, [defaults]);

  const setState = useCallback(
    (next: URLState) => {
      setLocalState(next);
      if (typeof window === 'undefined') return;
      const qs = serializeQuery(next, defaults);
      const url = `${window.location.pathname}${qs}${window.location.hash}`;
      window.history.replaceState(null, '', url);
    },
    [defaults],
  );

  return [state, setState];
}
