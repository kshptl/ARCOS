"use client";

import type { Feature, FeatureCollection, Geometry } from "geojson";
import dynamic from "next/dynamic";
import type { ChangeEvent, CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChoroplethMapProps,
  MapPointerPosition,
  MapViewport,
} from "@/components/map/ChoroplethMap";
import { deathsColorScale, pillsColorScale, rgbToCss } from "@/components/map/colorScales";
import type { MapMetric } from "@/components/map/layers/countyLayer";
import { TimeSlider } from "@/components/map/TimeSlider";
import { useWebGLSupport } from "@/components/map/useWebGLSupport";
import type { CountyMetadata } from "@/lib/data/schemas";
import { FIPS_STATE_MAP } from "@/lib/geo/fips";
import { loadCountyTopology, loadStateTopology } from "@/lib/geo/topology";
import { DataLoader } from "./DataLoader";
import styles from "./Explorer.module.css";
import { Filters, type FiltersState } from "./Filters";
import { MapTooltip } from "./Tooltip";
import { useURLState } from "./useURLState";
import { WebGLFallback } from "./WebGLFallback";

const AVAILABLE_YEARS = [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014];

const MAP_ASPECT_RATIO = 720 / 420; // ≈1.714
const MAP_MAX_WIDTH = 1200;
const MAP_MIN_WIDTH = 280;
const AUTOCOMPLETE_LIMIT = 12;
const COUNTY_DETAIL_ZOOM = 5.15;
const DEFAULT_URL_STATE = {
  year: 2012,
  metric: "pills_per_capita" as const,
};
const DEFAULT_MAP_VIEW_STATE = {
  longitude: -98,
  latitude: 39,
  zoom: 3.2,
  pitch: 0,
  bearing: 0,
};
const STATE_FIPS_BY_CODE = Object.fromEntries(
  Object.entries(FIPS_STATE_MAP).map(([fips, code]) => [code, fips]),
) as Record<string, string>;

const METRIC_DETAILS: Record<
  MapMetric,
  {
    label: string;
    shortLabel: string;
    unit: string;
    valueDigits: number;
    compact: boolean;
  }
> = {
  pills: {
    label: "Pills shipped",
    shortLabel: "Pills",
    unit: "pills",
    valueDigits: 0,
    compact: true,
  },
  pills_per_capita: {
    label: "Pills per capita",
    shortLabel: "Per capita",
    unit: "pills per person",
    valueDigits: 1,
    compact: false,
  },
  deaths: {
    label: "Overdose deaths",
    shortLabel: "Deaths",
    unit: "deaths",
    valueDigits: 0,
    compact: false,
  },
};

const LazyChoroplethMap = dynamic<ChoroplethMapProps>(
  () => import("@/components/map/ChoroplethMap").then((mod) => mod.ChoroplethMap),
  {
    ssr: false,
    loading: () => (
      <div role="status" className={styles.loading}>
        Preparing map…
      </div>
    ),
  },
);

// Shared empty map reused across renders so that currentValues keeps a
// stable identity while data is loading.
const EMPTY_VALUES: Map<string, number> = new Map();

interface ExplorerProps {
  counties: CountyMetadata[];
}

type CountyWithValue = {
  meta: CountyMetadata;
  value: number;
};

type MapViewState = typeof DEFAULT_MAP_VIEW_STATE;
type ValuesByMetricYear = Map<MapMetric, Map<number, Map<string, number>>>;
type MapHoverState = {
  title: string;
  value: number | null;
  x: number;
  y: number;
};

type StateAccumulator = {
  code: string;
  count: number;
  population: number;
  value: number;
  weightedValue: number;
};

function countySearchLabel(county: CountyMetadata): string {
  return `${county.name}, ${county.state}`;
}

function addCoordinatesToBounds(value: unknown, bounds: number[]) {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    const lon = value[0];
    const lat = value[1];
    bounds[0] = Math.min(bounds[0] ?? lon, lon);
    bounds[1] = Math.min(bounds[1] ?? lat, lat);
    bounds[2] = Math.max(bounds[2] ?? lon, lon);
    bounds[3] = Math.max(bounds[3] ?? lat, lat);
    return;
  }
  for (const child of value) addCoordinatesToBounds(child, bounds);
}

function addGeometryToBounds(geometry: Geometry | null, bounds: number[]) {
  if (!geometry) return;
  if (geometry.type === "GeometryCollection") {
    for (const child of geometry.geometries) addGeometryToBounds(child, bounds);
    return;
  }
  addCoordinatesToBounds(geometry.coordinates, bounds);
}

function viewStateForFeature(
  feature: Feature<Geometry>,
  options: { minZoom?: number; maxZoom?: number } = {},
): MapViewState | null {
  const bounds: number[] = [];
  addGeometryToBounds(feature.geometry, bounds);
  const [minLon, minLat, maxLon, maxLat] = bounds;
  if (
    minLon === undefined ||
    minLat === undefined ||
    maxLon === undefined ||
    maxLat === undefined
  ) {
    return null;
  }
  const lonSpan = Math.max(maxLon - minLon, 0.05);
  const latSpan = Math.max(maxLat - minLat, 0.05);
  const span = Math.max(lonSpan, latSpan);
  const minZoom = options.minZoom ?? DEFAULT_MAP_VIEW_STATE.zoom + 1;
  const maxZoom = options.maxZoom ?? 8.4;
  return {
    longitude: (minLon + maxLon) / 2,
    latitude: (minLat + maxLat) / 2,
    zoom: Math.min(maxZoom, Math.max(minZoom, Math.log2(360 / span) - 1)),
    pitch: 0,
    bearing: 0,
  };
}

function formatMetricValue(value: number, metric: MapMetric): string {
  const details = METRIC_DETAILS[metric];
  if (details.compact && Math.abs(value) >= 1_000_000) {
    return Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return value.toLocaleString("en-US", {
    maximumFractionDigits: details.valueDigits,
    minimumFractionDigits: details.valueDigits,
  });
}

function buildSparklinePoints(points: Array<{ year: number; value: number }>): string {
  if (points.length === 0) return "";
  const width = 220;
  const height = 88;
  const xPad = 10;
  const yPad = 12;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  return points
    .map((p, i) => {
      const x = xPad + (i / Math.max(points.length - 1, 1)) * (width - xPad * 2);
      const y = height - yPad - ((p.value - min) / range) * (height - yPad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildLegendLabels(domainMax: number, metric: MapMetric): string[] {
  const max = Math.max(domainMax, 1);
  const stops = [1, 0.8, 0.6, 0.4, 0.2, 0];
  return stops.slice(0, -1).map((stop, index) => {
    const nextStop = stops[index + 1] ?? 0;
    const low = max * nextStop;
    const high = max * stop;
    if (index === 0) return `${formatMetricValue(low, metric)} or more`;
    if (index === stops.length - 2) return `Less than ${formatMetricValue(high, metric)}`;
    return `${formatMetricValue(low, metric)} - ${formatMetricValue(high, metric)}`;
  });
}

export function Explorer({ counties }: ExplorerProps) {
  const [urlState, setURLState] = useURLState(DEFAULT_URL_STATE);
  const [topology, setTopology] = useState<{
    counties: FeatureCollection<Geometry, { name?: string }> | null;
    states: FeatureCollection<Geometry, { name?: string }> | null;
  }>({ counties: null, states: null });
  const [valuesByMetricYear, setValuesByMetricYear] = useState<ValuesByMetricYear>(new Map());
  const [selectedFips, setSelectedFips] = useState<string | null>(null);
  const [focusedStateFips, setFocusedStateFips] = useState<string | null>(null);
  const [countyQuery, setCountyQuery] = useState("");
  const [topologyError, setTopologyError] = useState<string | null>(null);
  const [savedCountyFips, setSavedCountyFips] = useState<Set<string>>(() => new Set());
  const [mapViewState, setMapViewState] = useState<MapViewState>(DEFAULT_MAP_VIEW_STATE);
  const [mapHover, setMapHover] = useState<MapHoverState | null>(null);
  const webgl = useWebGLSupport();

  const mapAreaRef = useRef<HTMLDivElement | null>(null);
  const [mapWidth, setMapWidth] = useState<number>(720);

  useEffect(() => {
    const el = mapAreaRef.current;
    if (!el) return;
    let lastApplied = -1;
    const update = (rawWidth: number) => {
      const clamped = Math.max(MAP_MIN_WIDTH, Math.min(MAP_MAX_WIDTH, rawWidth));
      if (clamped === lastApplied) return;
      lastApplied = clamped;
      setMapWidth(clamped);
    };
    update(el.clientWidth || el.getBoundingClientRect().width || 720);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) update(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mapHeight = useMemo(() => Math.round(mapWidth / MAP_ASPECT_RATIO), [mapWidth]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadCountyTopology(), loadStateTopology()])
      .then(([c, s]) => {
        if (cancelled) return;
        setTopology({ counties: c, states: s });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setTopologyError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentValuesByYear = valuesByMetricYear.get(urlState.metric);
  const currentValues = useMemo(
    () => currentValuesByYear?.get(urlState.year) ?? EMPTY_VALUES,
    [currentValuesByYear, urlState.year],
  );

  const domain = useMemo(() => {
    let max = 0;
    for (const v of currentValues.values()) if (v > max) max = v;
    return { domainMin: 0, domainMax: Math.max(max, 1) };
  }, [currentValues]);

  const stateSummaryByFips = useMemo(() => {
    const summaries = new Map<string, StateAccumulator>();
    for (const county of counties) {
      const stateFips = STATE_FIPS_BY_CODE[county.state];
      if (!stateFips) continue;
      const current =
        summaries.get(stateFips) ??
        ({
          code: county.state,
          count: 0,
          population: 0,
          value: 0,
          weightedValue: 0,
        } satisfies StateAccumulator);
      const value = currentValues.get(county.fips) ?? 0;
      current.count += 1;
      current.population += county.pop;
      current.value += value;
      current.weightedValue += value * county.pop;
      summaries.set(stateFips, current);
    }
    if (urlState.metric !== "pills_per_capita") return summaries;
    const perCapitaSummaries = new Map<string, StateAccumulator>();
    for (const [stateFips, summary] of summaries) {
      perCapitaSummaries.set(stateFips, {
        ...summary,
        value: summary.population > 0 ? summary.weightedValue / summary.population : 0,
      });
    }
    return perCapitaSummaries;
  }, [counties, currentValues, urlState.metric]);

  const stateValueByFips = useMemo(() => {
    return new Map(
      [...stateSummaryByFips].map(([stateFips, summary]) => [stateFips, summary.value]),
    );
  }, [stateSummaryByFips]);

  const stateDomain = useMemo(() => {
    let max = 0;
    for (const v of stateValueByFips.values()) if (v > max) max = v;
    return { domainMin: 0, domainMax: Math.max(max, 1) };
  }, [stateValueByFips]);

  const showCountyLayer = focusedStateFips !== null || mapViewState.zoom >= COUNTY_DETAIL_ZOOM;
  const activeDomain = showCountyLayer ? domain : stateDomain;
  const activeValueCount = showCountyLayer ? currentValues.size : stateValueByFips.size;
  const activeGeographyLabel = showCountyLayer ? "counties" : "states";

  const sortedCounties = useMemo(() => {
    return [...counties].sort((a, b) =>
      a.state === b.state ? a.name.localeCompare(b.name) : a.state.localeCompare(b.state),
    );
  }, [counties]);

  const countyByFips = useMemo(() => {
    return new Map(sortedCounties.map((county) => [county.fips, county]));
  }, [sortedCounties]);

  const rankedCounties = useMemo<CountyWithValue[]>(() => {
    return sortedCounties
      .map((meta) => ({ meta, value: currentValues.get(meta.fips) ?? 0 }))
      .sort((a, b) => b.value - a.value || a.meta.name.localeCompare(b.meta.name));
  }, [currentValues, sortedCounties]);

  const highestCounty = rankedCounties[0] ?? null;

  const rankByFips = useMemo(() => {
    return new Map(rankedCounties.map((county, index) => [county.meta.fips, index + 1]));
  }, [rankedCounties]);

  const nationalAverage = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const value of currentValues.values()) {
      total += value;
      count += 1;
    }
    return count ? total / count : 0;
  }, [currentValues]);

  const selectedFipsResolved =
    selectedFips && countyByFips.has(selectedFips)
      ? selectedFips
      : (highestCounty?.meta.fips ?? sortedCounties[0]?.fips ?? null);

  const selectedCounty = selectedFipsResolved
    ? {
        meta: countyByFips.get(selectedFipsResolved) ?? null,
        value: currentValues.get(selectedFipsResolved) ?? 0,
      }
    : null;

  const selectedRank = selectedFipsResolved ? (rankByFips.get(selectedFipsResolved) ?? null) : null;

  const selectedStateRank = useMemo(() => {
    if (!selectedCounty?.meta) return null;
    const stateRows = rankedCounties.filter(
      (county) => county.meta.state === selectedCounty.meta?.state,
    );
    const stateIndex = stateRows.findIndex(
      (county) => county.meta.fips === selectedCounty.meta?.fips,
    );
    return {
      rank: stateIndex >= 0 ? stateIndex + 1 : null,
      total: stateRows.length,
    };
  }, [rankedCounties, selectedCounty]);

  const selectedTrend = useMemo(() => {
    if (!selectedFipsResolved) return [];
    const metricValuesByYear = valuesByMetricYear.get(urlState.metric);
    return AVAILABLE_YEARS.map((year) => ({
      year,
      value: metricValuesByYear?.get(year)?.get(selectedFipsResolved) ?? 0,
    }));
  }, [selectedFipsResolved, valuesByMetricYear, urlState.metric]);

  const selectedTrendPoints = useMemo(() => buildSparklinePoints(selectedTrend), [selectedTrend]);

  const filteredCounties = useMemo(() => {
    const query = countyQuery.trim().toLowerCase();
    if (!query) return [];
    return sortedCounties.filter((county) => {
      const label = `${county.name} ${county.state} ${county.fips}`.toLowerCase();
      return label.includes(query);
    });
  }, [countyQuery, sortedCounties]);

  const autocompleteCounties = useMemo(
    () => filteredCounties.slice(0, AUTOCOMPLETE_LIMIT),
    [filteredCounties],
  );

  const metricDetails = METRIC_DETAILS[urlState.metric];
  const selectedName = selectedCounty?.meta
    ? `${selectedCounty.meta.name}, ${selectedCounty.meta.state}`
    : "No county selected";
  const selectedCountyFips = selectedCounty?.meta?.fips ?? null;
  const isSelectedCountySaved = selectedCountyFips
    ? savedCountyFips.has(selectedCountyFips)
    : false;

  const legendColors = useMemo(() => {
    const scale = urlState.metric === "deaths" ? deathsColorScale : pillsColorScale;
    return [0.96, 0.78, 0.6, 0.42, 0.24, 0.08].map((stop) =>
      rgbToCss(scale(activeDomain.domainMax * stop, activeDomain)),
    );
  }, [activeDomain, urlState.metric]);

  const legendLabels = useMemo(
    () => buildLegendLabels(activeDomain.domainMax, urlState.metric),
    [activeDomain.domainMax, urlState.metric],
  );

  const handleFilterChange = useCallback(
    (next: FiltersState) => {
      setMapHover(null);
      setURLState({ ...urlState, ...next });
    },
    [setURLState, urlState],
  );

  const handleYearChange = useCallback(
    (year: number) => {
      setMapHover(null);
      setURLState({ ...urlState, year });
    },
    [setURLState, urlState],
  );

  const handleData = useCallback(
    (year: number, values: Map<string, number>) => {
      setValuesByMetricYear((prev) => {
        const metricValues = prev.get(urlState.metric);
        if (metricValues?.get(year) === values) return prev;
        const next = new Map(prev);
        const nextMetricValues = new Map(metricValues);
        nextMetricValues.set(year, values);
        next.set(urlState.metric, nextMetricValues);
        return next;
      });
    },
    [urlState.metric],
  );

  const handleDataError = useCallback((err: Error) => {
    setTopologyError(err.message);
  }, []);

  const focusMapOnFeature = useCallback(
    (feature: Feature<Geometry> | null, options: { minZoom?: number; maxZoom?: number } = {}) => {
      if (!feature) return;
      const nextView = viewStateForFeature(feature, options);
      if (nextView) setMapViewState(nextView);
    },
    [],
  );

  const focusMapOnCounty = useCallback(
    (feature: Feature<Geometry> | null) => {
      if (!feature) return;
      focusMapOnFeature(feature, { minZoom: COUNTY_DETAIL_ZOOM + 0.7, maxZoom: 8.4 });
    },
    [focusMapOnFeature],
  );

  const findCountyFeature = useCallback(
    (fips: string) =>
      topology.counties?.features.find(
        (feature) => String(feature.id ?? "").padStart(5, "0") === fips,
      ) ?? null,
    [topology.counties],
  );

  const findStateFeature = useCallback(
    (stateFips: string) =>
      topology.states?.features.find(
        (feature) => String(feature.id ?? "").padStart(2, "0") === stateFips,
      ) ?? null,
    [topology.states],
  );

  const selectCounty = useCallback(
    (fips: string | null, feature?: Feature<Geometry> | null) => {
      if (!fips || !countyByFips.has(fips)) return;
      setSelectedFips(fips);
      setFocusedStateFips(fips.slice(0, 2));
      focusMapOnCounty(feature ?? findCountyFeature(fips));
    },
    [countyByFips, findCountyFeature, focusMapOnCounty],
  );

  const handleCountyClick = useCallback(
    (fips: string | null, feature: Feature<Geometry> | null) => {
      selectCounty(fips, feature);
    },
    [selectCounty],
  );

  const handleStateClick = useCallback(
    (fips: string | null, feature: Feature<Geometry> | null) => {
      if (!fips) return;
      const stateFips = fips.padStart(2, "0");
      setFocusedStateFips(stateFips);
      focusMapOnFeature(feature ?? findStateFeature(stateFips), {
        minZoom: COUNTY_DETAIL_ZOOM + 0.25,
        maxZoom: 6.7,
      });
    },
    [findStateFeature, focusMapOnFeature],
  );

  const handleMapViewStateChange = useCallback((next: MapViewport) => {
    setMapViewState((prev) => {
      const roundedPrev = `${prev.longitude.toFixed(4)}:${prev.latitude.toFixed(4)}:${prev.zoom.toFixed(3)}`;
      const roundedNext = `${next.longitude.toFixed(4)}:${next.latitude.toFixed(4)}:${next.zoom.toFixed(3)}`;
      if (roundedPrev === roundedNext) return prev;
      return {
        longitude: next.longitude,
        latitude: next.latitude,
        zoom: next.zoom,
        pitch: next.pitch ?? 0,
        bearing: next.bearing ?? 0,
      };
    });
    if (next.zoom < COUNTY_DETAIL_ZOOM - 0.25) setFocusedStateFips(null);
  }, []);

  const findCountyFromSearchValue = useCallback(
    (value: string) => {
      const query = value.trim().toLowerCase();
      if (!query) return null;
      return (
        sortedCounties.find((county) => countySearchLabel(county).toLowerCase() === query) ??
        sortedCounties.find((county) => county.fips === query) ??
        null
      );
    },
    [sortedCounties],
  );

  const handleCountySearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextQuery = event.target.value;
      setCountyQuery(nextQuery);
      const county = findCountyFromSearchValue(nextQuery);
      if (county) selectCounty(county.fips);
    },
    [findCountyFromSearchValue, selectCounty],
  );

  const handleCountyHover = useCallback(
    (fips: string | null, _feature: Feature | null, position: MapPointerPosition) => {
      if (!fips) {
        setMapHover(null);
        return;
      }
      const county = countyByFips.get(fips);
      if (!county) {
        setMapHover(null);
        return;
      }
      setMapHover({
        title: countySearchLabel(county),
        value: currentValues.get(fips) ?? null,
        x: position.x,
        y: position.y,
      });
    },
    [countyByFips, currentValues],
  );

  const handleStateHover = useCallback(
    (fips: string | null, feature: Feature | null, position: MapPointerPosition) => {
      if (!fips) {
        setMapHover(null);
        return;
      }
      const stateFips = fips.padStart(2, "0");
      setMapHover({
        title: feature?.properties?.name ?? FIPS_STATE_MAP[stateFips] ?? `State ${stateFips}`,
        value: stateValueByFips.get(stateFips) ?? null,
        x: position.x,
        y: position.y,
      });
    },
    [stateValueByFips],
  );

  const handleToggleSavedCounty = useCallback(() => {
    if (!selectedCountyFips) return;
    setSavedCountyFips((prev) => {
      const next = new Set(prev);
      if (next.has(selectedCountyFips)) next.delete(selectedCountyFips);
      else next.add(selectedCountyFips);
      return next;
    });
  }, [selectedCountyFips]);

  return (
    <section className={styles.root} aria-label="Explorer">
      <h1 className={styles.srOnly}>Explorer</h1>
      <main className={styles.main}>
        <section className={styles.controlBar} aria-label="Explorer controls">
          <div className={styles.controlGroup}>
            <Filters metric={urlState.metric} onChange={handleFilterChange} />
          </div>

          <div className={styles.controlGroup}>
            <TimeSlider years={AVAILABLE_YEARS} value={urlState.year} onChange={handleYearChange} />
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.searchLabel} htmlFor="explorer-county-search">
              Search counties
            </label>
            <div className={styles.countySearch}>
              <span aria-hidden="true">⌕</span>
              <input
                id="explorer-county-search"
                type="search"
                list="explorer-county-options"
                aria-autocomplete="list"
                value={countyQuery}
                placeholder="Type a county or state..."
                onChange={handleCountySearchChange}
              />
              <datalist id="explorer-county-options">
                {autocompleteCounties.map((county) => (
                  <option key={county.fips} value={countySearchLabel(county)} />
                ))}
              </datalist>
            </div>
          </div>

          <a
            className={styles.downloadButton}
            href="/data/county-shipments-by-year.parquet"
            download
          >
            <span aria-hidden="true">↓</span>
            Download data
          </a>
        </section>

        <section className={styles.stats} aria-label="Explorer summary">
          <article className={styles.stat}>
            <div className={`${styles.statIcon} ${styles.statIconSage}`} aria-hidden="true">
              ▥
            </div>
            <div>
              <p>National avg ({urlState.year})</p>
              <strong>{formatMetricValue(nationalAverage, urlState.metric)}</strong>
              <span>{metricDetails.unit}</span>
            </div>
          </article>
          <article className={styles.stat}>
            <div className={`${styles.statIcon} ${styles.statIconRust}`} aria-hidden="true">
              ☆
            </div>
            <div>
              <p>Highest county ({urlState.year})</p>
              <strong>{formatMetricValue(highestCounty?.value ?? 0, urlState.metric)}</strong>
              <span>
                {highestCounty?.meta.name ?? "Loading"}, {highestCounty?.meta.state ?? ""}
              </span>
            </div>
          </article>
          <article className={styles.stat}>
            <div className={`${styles.statIcon} ${styles.statIconCream}`} aria-hidden="true">
              ●
            </div>
            <div>
              <p>Selected county ({urlState.year})</p>
              <strong>{formatMetricValue(selectedCounty?.value ?? 0, urlState.metric)}</strong>
              <span>{selectedName}</span>
            </div>
          </article>
        </section>

        <section className={styles.mapShell} aria-label="County map panel">
          <aside className={styles.legend} aria-label={`${metricDetails.label} legend`}>
            <h2>{metricDetails.label}</h2>
            <p>({metricDetails.unit})</p>
            <ol>
              {legendLabels.map((label, index) => (
                <li key={label}>
                  <span
                    style={{ "--swatch": legendColors[index] } as CSSProperties}
                    aria-hidden="true"
                  />
                  {label}
                </li>
              ))}
              <li>
                <span className={styles.noDataSwatch} aria-hidden="true" />
                No data
              </li>
            </ol>
            <strong>US avg: {formatMetricValue(nationalAverage, urlState.metric)}</strong>
          </aside>

          <div className={styles.mapCanvas} ref={mapAreaRef}>
            {topologyError ? (
              <WebGLFallback
                counties={sortedCounties}
                reason={`Topology load failed: ${topologyError}`}
              />
            ) : webgl === false ? (
              <WebGLFallback
                counties={sortedCounties}
                reason="WebGL unavailable in this browser."
              />
            ) : topology.counties && topology.states ? (
              <LazyChoroplethMap
                counties={topology.counties}
                states={topology.states}
                valueByFips={currentValues}
                stateValueByFips={stateValueByFips}
                metric={urlState.metric}
                domain={activeDomain}
                stateDomain={stateDomain}
                width={mapWidth}
                height={mapHeight}
                year={urlState.year}
                initialViewState={mapViewState}
                viewState={mapViewState}
                focusedStateFips={focusedStateFips}
                showCountyLayer={showCountyLayer}
                onCountyHover={handleCountyHover}
                onCountyClick={handleCountyClick}
                onStateHover={handleStateHover}
                onStateClick={handleStateClick}
                onViewStateChange={handleMapViewStateChange}
              />
            ) : (
              <div role="status" className={styles.loading}>
                Loading map…
              </div>
            )}
          </div>

          <MapTooltip
            county={null}
            title={mapHover?.title ?? null}
            value={mapHover?.value ?? null}
            metricLabel={metricDetails.label}
            year={urlState.year}
            x={mapHover?.x ?? 0}
            y={mapHover?.y ?? 0}
          />

          <footer className={styles.mapStatus}>
            <span aria-hidden="true">i</span>
            Showing {metricDetails.shortLabel.toLowerCase()} in {urlState.year} for{" "}
            {activeValueCount.toLocaleString("en-US")} {activeGeographyLabel}.
          </footer>
        </section>
      </main>

      <aside className={styles.detailPanel} aria-label="Selected county details">
        {selectedCounty?.meta ? (
          <>
            <div className={styles.detailHeader}>
              <div>
                <h2>{selectedCounty.meta.name}</h2>
                <p>{selectedCounty.meta.state}</p>
              </div>
              <button
                type="button"
                className={styles.saveButton}
                aria-label={`${isSelectedCountySaved ? "Saved" : "Save"} ${
                  selectedCounty.meta.name
                }`}
                aria-pressed={isSelectedCountySaved}
                onClick={handleToggleSavedCounty}
              >
                {isSelectedCountySaved ? "★" : "☆"}
              </button>
            </div>

            <div className={styles.detailMetric}>
              <p>
                {metricDetails.label} ({urlState.year})
              </p>
              <strong>{formatMetricValue(selectedCounty.value, urlState.metric)}</strong>
              <span>{metricDetails.unit}</span>
            </div>

            <div className={styles.detailGrid}>
              <div>
                <p>Population</p>
                <strong>{selectedCounty.meta.pop.toLocaleString("en-US")}</strong>
              </div>
              <div>
                <p>FIPS</p>
                <strong>{selectedCounty.meta.fips}</strong>
              </div>
            </div>

            <section className={styles.trendBlock} aria-label={`${metricDetails.label} trend`}>
              <h3>
                Trend: {metricDetails.label} <span>(2006–2014)</span>
              </h3>
              <svg viewBox="0 0 220 88" role="img" aria-label={`${selectedName} trend`}>
                <polyline points={selectedTrendPoints} />
                {selectedTrend.map((point, index) => {
                  const coords = selectedTrendPoints.split(" ")[index]?.split(",") ?? ["0", "0"];
                  return (
                    <circle
                      key={point.year}
                      cx={coords[0]}
                      cy={coords[1]}
                      r={point.year === urlState.year ? 4 : 2.5}
                    />
                  );
                })}
              </svg>
              <div className={styles.trendYears}>
                <span>2006</span>
                <span>2010</span>
                <span>2014</span>
              </div>
            </section>

            <div className={styles.rankGrid}>
              <div>
                <p>{urlState.year} rank</p>
                <strong>
                  {selectedRank ?? "—"}{" "}
                  <span>of {rankedCounties.length.toLocaleString("en-US")}</span>
                </strong>
              </div>
              <div>
                <p>State rank</p>
                <strong>
                  {selectedStateRank?.rank ?? "—"} <span>of {selectedStateRank?.total ?? "—"}</span>
                </strong>
              </div>
            </div>

            <a className={styles.profileLink} href={`/county/${selectedCounty.meta.fips}`}>
              View full county profile <span aria-hidden="true">↗</span>
            </a>
          </>
        ) : (
          <div className={styles.emptyDetail}>Loading county details…</div>
        )}
      </aside>

      <DataLoader
        onData={handleData}
        year={urlState.year}
        metric={urlState.metric}
        onError={handleDataError}
      />
    </section>
  );
}
