"use client";

import { useEffect, useRef, useState } from "react";
import type { MapMetric } from "@/components/map/layers/countyLayer";
import { fetchParquetRows } from "@/lib/data/parquet";
import type {
  CDCCountyOverdoseArtifact,
  CountyShipmentsByYear,
  StateOpioidMmeByYear,
} from "@/lib/data/schemas";

export interface DataLoaderProps {
  year: number;
  onData: (year: number, values: Map<string, number>) => void;
  onStateData?: (
    year: number,
    values: Map<string, number>,
    populations: Map<string, number>,
  ) => void;
  onError?: (err: Error) => void;
  onProgress?: (received: number, total: number | null) => void;
  metric?: MapMetric;
  parquetUrl?: string;
  cdcUrl?: string;
  stateMmeUrl?: string;
}

const DATA_VERSION = process.env.NEXT_PUBLIC_DATA_VERSION ?? "2026-05-08-mme-refresh-v1";
const DEFAULT_URL = versionDataUrl("/data/county-shipments-by-year.parquet");
const DEFAULT_CDC_URL = versionDataUrl("/data/cdc_county_overdose.json");
const DEFAULT_STATE_MME_URL = versionDataUrl("/data/state-opioid-mme-by-year.json");
type ValuesByYear = Map<number, Map<string, number>>;
type StateValuesByYear = Map<
  number,
  { values: Map<string, number>; populations: Map<string, number> }
>;
type ShipmentMetricCache = {
  pills_per_capita: ValuesByYear;
  mme_per_capita: ValuesByYear;
};
type CacheForUrl<T> = {
  url: string;
  data: T;
};

function valueMapForYear(cache: ValuesByYear, year: number): Map<string, number> {
  let values = cache.get(year);
  if (!values) {
    values = new Map();
    cache.set(year, values);
  }
  return values;
}

function versionDataUrl(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(DATA_VERSION)}`;
}

function buildShipmentMetricCache(rows: CountyShipmentsByYear[]): ShipmentMetricCache {
  const cache: ShipmentMetricCache = {
    pills_per_capita: new Map(),
    mme_per_capita: new Map(),
  };
  for (const row of rows) {
    valueMapForYear(cache.pills_per_capita, row.year).set(row.fips, row.pills_per_capita ?? 0);
    if (typeof row.mme_per_capita === "number" && Number.isFinite(row.mme_per_capita)) {
      valueMapForYear(cache.mme_per_capita, row.year).set(row.fips, row.mme_per_capita);
    }
  }
  return cache;
}

function buildDeathRateMetricCache(artifact: CDCCountyOverdoseArtifact): ValuesByYear {
  const cache: ValuesByYear = new Map();
  for (const row of artifact.records) {
    const rawFips = row.fips ?? row.county_fips;
    if (!rawFips) continue;
    const fips = String(rawFips).padStart(5, "0");
    const rate =
      typeof row.crude_rate === "number" && Number.isFinite(row.crude_rate)
        ? row.crude_rate
        : row.deaths != null && row.population != null && row.population > 0
          ? (row.deaths / row.population) * 100000
          : 0;
    valueMapForYear(cache, row.year).set(fips, rate);
  }
  return cache;
}

function buildStateMmeMetricCache(rows: StateOpioidMmeByYear[]): StateValuesByYear {
  const cache: StateValuesByYear = new Map();
  for (const row of rows) {
    let yearValues = cache.get(row.year);
    if (!yearValues) {
      yearValues = { values: new Map(), populations: new Map() };
      cache.set(row.year, yearValues);
    }
    yearValues.values.set(String(row.state_fips).padStart(2, "0"), row.mme_per_capita);
    yearValues.populations.set(String(row.state_fips).padStart(2, "0"), row.population);
  }
  return cache;
}

async function fetchCDCOverdoseArtifact(url: string): Promise<CDCCountyOverdoseArtifact> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchCDCOverdoseArtifact ${url} -> HTTP ${res.status}`);
  return res.json() as Promise<CDCCountyOverdoseArtifact>;
}

async function fetchStateMmeRows(url: string): Promise<StateOpioidMmeByYear[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchStateMmeRows ${url} -> HTTP ${res.status}`);
  return res.json() as Promise<StateOpioidMmeByYear[]>;
}

export function DataLoader(props: DataLoaderProps) {
  const {
    onData,
    onStateData,
    onError,
    onProgress,
    parquetUrl = DEFAULT_URL,
    cdcUrl = DEFAULT_CDC_URL,
    stateMmeUrl = DEFAULT_STATE_MME_URL,
    metric = "pills_per_capita",
  } = props;
  const latestCallbacks = useRef({ onData, onStateData, onError, onProgress });
  const [shipmentCache, setShipmentCache] = useState<CacheForUrl<ShipmentMetricCache> | null>(null);
  const [deathCache, setDeathCache] = useState<CacheForUrl<ValuesByYear> | null>(null);
  const [stateMmeCache, setStateMmeCache] = useState<CacheForUrl<StateValuesByYear> | null>(null);

  // Keep the newest callbacks without restarting the large Parquet load.
  latestCallbacks.current = { onData, onStateData, onError, onProgress };

  useEffect(() => {
    if (metric === "deaths_per_100k" || shipmentCache?.url === parquetUrl) return;
    let cancelled = false;
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
        setShipmentCache({ url: parquetUrl, data: nextCache });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        latestCallbacks.current.onError?.(err);
      });
    return () => {
      cancelled = true;
    };
  }, [metric, parquetUrl, shipmentCache]);

  useEffect(() => {
    if (metric !== "deaths_per_100k" || deathCache?.url === cdcUrl) return;
    let cancelled = false;
    fetchCDCOverdoseArtifact(cdcUrl)
      .then((artifact) => {
        if (cancelled) return;
        setDeathCache({ url: cdcUrl, data: buildDeathRateMetricCache(artifact) });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        latestCallbacks.current.onError?.(err);
      });
    return () => {
      cancelled = true;
    };
  }, [metric, cdcUrl, deathCache]);

  useEffect(() => {
    if (metric !== "mme_per_capita" || !onStateData || stateMmeCache?.url === stateMmeUrl) return;
    let cancelled = false;
    fetchStateMmeRows(stateMmeUrl)
      .then((rows) => {
        if (cancelled) return;
        setStateMmeCache({ url: stateMmeUrl, data: buildStateMmeMetricCache(rows) });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        latestCallbacks.current.onError?.(err);
      });
    return () => {
      cancelled = true;
    };
  }, [metric, onStateData, stateMmeCache, stateMmeUrl]);

  useEffect(() => {
    const byYear =
      metric === "deaths_per_100k"
        ? deathCache?.url === cdcUrl
          ? deathCache.data
          : null
        : shipmentCache?.url === parquetUrl
          ? shipmentCache.data[metric]
          : null;
    if (!byYear) return;
    for (const [year, values] of byYear) latestCallbacks.current.onData(year, values);
  }, [deathCache, shipmentCache, metric, cdcUrl, parquetUrl]);

  useEffect(() => {
    if (metric !== "mme_per_capita" || stateMmeCache?.url !== stateMmeUrl) return;
    for (const [year, stateValues] of stateMmeCache.data) {
      latestCallbacks.current.onStateData?.(year, stateValues.values, stateValues.populations);
    }
  }, [metric, stateMmeCache, stateMmeUrl]);

  return null;
}
