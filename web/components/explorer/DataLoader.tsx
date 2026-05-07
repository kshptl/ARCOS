"use client";

import { useEffect, useRef, useState } from "react";
import type { MapMetric } from "@/components/map/layers/countyLayer";
import { fetchParquetRows } from "@/lib/data/parquet";
import type { CountyShipmentsByYear } from "@/lib/data/schemas";

export interface DataLoaderProps {
  year: number;
  onData: (year: number, values: Map<string, number>) => void;
  onError?: (err: Error) => void;
  onProgress?: (received: number, total: number | null) => void;
  metric?: MapMetric;
  parquetUrl?: string;
}

const DEFAULT_URL = "/data/county-shipments-by-year.parquet";
type ValuesByYear = Map<number, Map<string, number>>;
type ShipmentMetricCache = {
  pills: ValuesByYear;
  pills_per_capita: ValuesByYear;
};

function valueMapForYear(cache: ValuesByYear, year: number): Map<string, number> {
  let values = cache.get(year);
  if (!values) {
    values = new Map();
    cache.set(year, values);
  }
  return values;
}

function buildShipmentMetricCache(rows: CountyShipmentsByYear[]): ShipmentMetricCache {
  const cache: ShipmentMetricCache = {
    pills: new Map(),
    pills_per_capita: new Map(),
  };
  for (const row of rows) {
    valueMapForYear(cache.pills, row.year).set(row.fips, row.pills ?? 0);
    valueMapForYear(cache.pills_per_capita, row.year).set(row.fips, row.pills_per_capita ?? 0);
  }
  return cache;
}

function valuesForMetric(cache: ShipmentMetricCache, metric: MapMetric): ValuesByYear {
  if (metric === "pills_per_capita") return cache.pills_per_capita;
  // Deaths are still loaded by a separate future artifact. This keeps the old
  // no-crash behavior while avoiding a second big client load during startup.
  return cache.pills;
}

export function DataLoader(props: DataLoaderProps) {
  const { onData, onError, onProgress, parquetUrl = DEFAULT_URL, metric = "pills" } = props;
  const latestCallbacks = useRef({ onData, onError, onProgress });
  const [cache, setCache] = useState<ShipmentMetricCache | null>(null);

  // Keep the newest callbacks without restarting the large Parquet load.
  latestCallbacks.current = { onData, onError, onProgress };

  useEffect(() => {
    let cancelled = false;
    setCache(null);
    const progress = (received: number, total: number) => {
      latestCallbacks.current.onProgress?.(received, total);
    };
    const t0 =
      process.env.NODE_ENV === "development" && typeof performance !== "undefined"
        ? performance.now()
        : 0;
    fetchParquetRows<CountyShipmentsByYear>(parquetUrl, { onProgress: progress })
      .then((rows) => {
        if (cancelled) return;
        const nextCache = buildShipmentMetricCache(rows);
        if (process.env.NODE_ENV === "development" && typeof performance !== "undefined") {
          const dt = performance.now() - t0;
          // eslint-disable-next-line no-console
          console.debug(
            `[DataLoader] loaded and grouped ${rows.length} shipment rows in ${dt.toFixed(1)}ms`,
          );
        }
        setCache(nextCache);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        latestCallbacks.current.onError?.(err);
      });
    return () => {
      cancelled = true;
    };
  }, [parquetUrl]);

  useEffect(() => {
    if (!cache) return;
    const byYear = valuesForMetric(cache, metric);
    for (const [year, values] of byYear) latestCallbacks.current.onData(year, values);
  }, [cache, metric]);

  return null;
}
