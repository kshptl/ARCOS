'use client';

import { useEffect } from 'react';
import { fetchParquetRows } from '@/lib/data/parquet';
import type { CountyShipmentsByYear } from '@/lib/data/schemas';
import type { MapMetric } from '@/components/map/layers/countyLayer';

export interface DataLoaderProps {
  year: number;
  onData: (year: number, values: Map<string, number>) => void;
  onError?: (err: Error) => void;
  onProgress?: (received: number, total: number | null) => void;
  metric?: MapMetric;
  parquetUrl?: string;
}

const DEFAULT_URL = '/data/county-shipments-by-year.parquet';

function field(row: CountyShipmentsByYear, metric: MapMetric): number {
  if (metric === 'pills_per_capita') return row.pills_per_capita ?? 0;
  // Note: deaths come from a different artifact; this loader only covers shipments.
  return row.pills ?? 0;
}

export function DataLoader(props: DataLoaderProps) {
  const { onData, onError, onProgress, parquetUrl = DEFAULT_URL, metric = 'pills' } = props;

  useEffect(() => {
    let cancelled = false;
    fetchParquetRows<CountyShipmentsByYear>(parquetUrl, { onProgress })
      .then((rows) => {
        if (cancelled) return;
        const byYear = new Map<number, Map<string, number>>();
        for (const r of rows) {
          let m = byYear.get(r.year);
          if (!m) {
            m = new Map();
            byYear.set(r.year, m);
          }
          m.set(r.fips, field(r, metric));
        }
        for (const [year, values] of byYear) onData(year, values);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        onError?.(err);
      });
    return () => {
      cancelled = true;
    };
  }, [parquetUrl, metric, onData, onError, onProgress]);

  return null;
}
