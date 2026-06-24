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
const COUNTY_MME_AVAILABLE_YEARS = [2006, 2007, 2008, 2009, 2010, 2011, 2012];
const STATE_MME_AVAILABLE_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const MME_AVAILABLE_YEARS = [...COUNTY_MME_AVAILABLE_YEARS, ...STATE_MME_AVAILABLE_YEARS];
const OPEN_MAP_GAP = 12;
const WORLD_TILE_SIZE = 512;

const MAP_MIN_WIDTH = 280;
const MAP_MIN_HEIGHT = 260;
const DEFAULT_MAP_SIZE = {
  width: 720,
  height: 420,
};
const AUTOCOMPLETE_LIMIT = 12;
const COUNTY_DETAIL_ZOOM = 5.15;
const MAP_ZOOM_ANIMATION_MS = 700;
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
    domainMax: number;
    legendBreaks: number[];
  }
> = {
  pills_per_capita: {
    label: "Pills per capita",
    shortLabel: "Per capita",
    unit: "pills per person",
    valueDigits: 1,
    compact: false,
    domainMax: 200,
    legendBreaks: [200, 100, 50, 20],
  },
  deaths_per_100k: {
    label: "Overdose deaths per 100k",
    shortLabel: "Deaths/100k",
    unit: "deaths per 100,000 people",
    valueDigits: 1,
    compact: false,
    domainMax: 100,
    legendBreaks: [100, 50, 25, 10],
  },
  mme_per_capita: {
    label: "MME per capita",
    shortLabel: "MME/capita",
    unit: "MME per person",
    valueDigits: 1,
    compact: false,
    domainMax: 1000,
    legendBreaks: [1000, 500, 250, 100],
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

type StateWithValue = {
  fips: string;
  code: string;
  name: string;
  value: number;
  population: number;
};

type MapViewState = typeof DEFAULT_MAP_VIEW_STATE;
type ValuesByMetricYear = Map<MapMetric, Map<number, Map<string, number>>>;
type MapCenterOffset = { x: number; y: number };
type MapRectLike = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
type OpenMapOverlays = {
  leftPanel?: MapRectLike | null;
  topBar?: MapRectLike | null;
  rightPanel?: MapRectLike | null;
  bottomBar?: MapRectLike | null;
};
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

function easeMapProgress(progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function yearsForMetric(metric: MapMetric): number[] {
  return metric === "mme_per_capita" ? MME_AVAILABLE_YEARS : AVAILABLE_YEARS;
}

function coerceYearForMetric(year: number, metric: MapMetric): number {
  const years = yearsForMetric(metric);
  if (years.includes(year)) return year;
  return years[years.length - 1] ?? year;
}

function longitudeToWorldX(longitude: number, zoom: number): number {
  const worldSize = WORLD_TILE_SIZE * 2 ** zoom;
  return ((longitude + 180) / 360) * worldSize;
}

function latitudeToWorldY(latitude: number, zoom: number): number {
  const worldSize = WORLD_TILE_SIZE * 2 ** zoom;
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize;
}

function worldXToLongitude(x: number, zoom: number): number {
  const worldSize = WORLD_TILE_SIZE * 2 ** zoom;
  return (x / worldSize) * 360 - 180;
}

function worldYToLatitude(y: number, zoom: number): number {
  const worldSize = WORLD_TILE_SIZE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / worldSize;
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

export function computeOpenMapOffset(
  map: MapRectLike,
  overlays: OpenMapOverlays,
  gap = OPEN_MAP_GAP,
): MapCenterOffset {
  let openLeft = 0;
  let openTop = 0;
  let openRight = map.width;
  let openBottom = map.height;

  if (overlays.leftPanel) {
    openLeft = Math.max(openLeft, overlays.leftPanel.right - map.left + gap);
  }
  if (overlays.topBar) {
    openTop = Math.max(openTop, overlays.topBar.bottom - map.top + gap);
  }
  if (overlays.rightPanel) {
    openRight = Math.min(openRight, overlays.rightPanel.left - map.left - gap);
  }
  if (overlays.bottomBar) {
    openBottom = Math.min(openBottom, overlays.bottomBar.top - map.top - gap);
  }

  if (openRight <= openLeft || openBottom <= openTop) return { x: 0, y: 0 };

  return {
    x: (openLeft + openRight) / 2 - map.width / 2,
    y: (openTop + openBottom) / 2 - map.height / 2,
  };
}

export function centerViewStateInOpenArea(
  viewState: MapViewState,
  offset: MapCenterOffset | null,
): MapViewState {
  if (!offset || (Math.abs(offset.x) < 0.5 && Math.abs(offset.y) < 0.5)) return viewState;
  const centerX = longitudeToWorldX(viewState.longitude, viewState.zoom);
  const centerY = latitudeToWorldY(viewState.latitude, viewState.zoom);
  return {
    ...viewState,
    longitude: worldXToLongitude(centerX - offset.x, viewState.zoom),
    latitude: worldYToLatitude(centerY - offset.y, viewState.zoom),
  };
}

export function interpolateMapViewState(
  start: MapViewState,
  target: MapViewState,
  progress: number,
): MapViewState {
  const t = easeMapProgress(progress);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    longitude: lerp(start.longitude, target.longitude),
    latitude: lerp(start.latitude, target.latitude),
    zoom: lerp(start.zoom, target.zoom),
    pitch: lerp(start.pitch, target.pitch),
    bearing: lerp(start.bearing, target.bearing),
  };
}

function countySearchLabel(county: CountyMetadata): string {
  return `${county.name}, ${county.state}`;
}

function stateSearchLabel(state: StateWithValue): string {
  return `${state.name}, ${state.code}`;
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

function formatLegendValue(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  });
}

function isPopulationNormalizedMetric(metric: MapMetric): boolean {
  return (
    metric === "pills_per_capita" || metric === "deaths_per_100k" || metric === "mme_per_capita"
  );
}

export function buildSparklinePoints(points: Array<{ year: number; value: number }>): string {
  if (points.length === 0) return "";
  const width = 220;
  const height = 88;
  const yPad = 12;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  return points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * width;
      const y = height - yPad - ((p.value - min) / range) * (height - yPad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildLegendLabels(metric: MapMetric): string[] {
  const breaks = METRIC_DETAILS[metric].legendBreaks;
  const [highest, ...rest] = breaks;
  if (highest === undefined) return [];
  const labels = [`> ${formatLegendValue(highest)}`];
  for (let i = 0; i < rest.length; i += 1) {
    const low = rest[i];
    const high = breaks[i];
    if (low === undefined || high === undefined) continue;
    labels.push(`${formatLegendValue(low)} - ${formatLegendValue(high)}`);
  }
  const lowest = breaks[breaks.length - 1];
  if (lowest !== undefined) labels.push(`< ${formatLegendValue(lowest)}`);
  return labels;
}

function buildLegendSampleValues(metric: MapMetric): number[] {
  const breaks = METRIC_DETAILS[metric].legendBreaks;
  const [highest, ...rest] = breaks;
  if (highest === undefined) return [];
  const values = [highest];
  for (let i = 0; i < rest.length; i += 1) {
    const low = rest[i];
    const high = breaks[i];
    if (low === undefined || high === undefined) continue;
    values.push((low + high) / 2);
  }
  const lowest = breaks[breaks.length - 1];
  if (lowest !== undefined) values.push(lowest / 2);
  return values;
}

export function Explorer({ counties }: ExplorerProps) {
  const [urlState, setURLState] = useURLState(DEFAULT_URL_STATE);
  const [topology, setTopology] = useState<{
    counties: FeatureCollection<Geometry, { name?: string }> | null;
    states: FeatureCollection<Geometry, { name?: string }> | null;
  }>({ counties: null, states: null });
  const [valuesByMetricYear, setValuesByMetricYear] = useState<ValuesByMetricYear>(new Map());
  const [stateValuesByMetricYear, setStateValuesByMetricYear] = useState<ValuesByMetricYear>(
    new Map(),
  );
  const [statePopulationsByYear, setStatePopulationsByYear] = useState<
    Map<number, Map<string, number>>
  >(new Map());
  const [selectedFips, setSelectedFips] = useState<string | null>(null);
  const [focusedStateFips, setFocusedStateFips] = useState<string | null>(null);
  const [countyQuery, setCountyQuery] = useState("");
  const [topologyError, setTopologyError] = useState<string | null>(null);
  const [mapViewState, setMapViewState] = useState<MapViewState>(DEFAULT_MAP_VIEW_STATE);
  const [mapHover, setMapHover] = useState<MapHoverState | null>(null);
  const webgl = useWebGLSupport();

  const mapAreaRef = useRef<HTMLDivElement | null>(null);
  const controlBarRef = useRef<HTMLElement | null>(null);
  const statsRef = useRef<HTMLElement | null>(null);
  const yearSliderRef = useRef<HTMLElement | null>(null);
  const legendRef = useRef<HTMLElement | null>(null);
  const detailPanelRef = useRef<HTMLElement | null>(null);
  const mapAnimationRef = useRef<number | null>(null);
  const [mapSize, setMapSize] = useState(DEFAULT_MAP_SIZE);
  const [openMapOffset, setOpenMapOffset] = useState<MapCenterOffset | null>(null);
  const [controlPanelHeight, setControlPanelHeight] = useState(58);
  const [statsPanelHeight, setStatsPanelHeight] = useState(73);

  const cancelMapAnimation = useCallback(() => {
    if (mapAnimationRef.current === null || typeof window === "undefined") return;
    window.cancelAnimationFrame(mapAnimationRef.current);
    mapAnimationRef.current = null;
  }, []);

  useEffect(() => cancelMapAnimation, [cancelMapAnimation]);

  const measureOpenMapOffset = useCallback(() => {
    const map = mapAreaRef.current?.getBoundingClientRect();
    if (!map || map.width <= 0 || map.height <= 0) return;
    const next = computeOpenMapOffset(map, {
      leftPanel: legendRef.current?.getBoundingClientRect() ?? null,
      topBar: controlBarRef.current?.getBoundingClientRect() ?? null,
      rightPanel: detailPanelRef.current?.getBoundingClientRect() ?? null,
      bottomBar:
        yearSliderRef.current?.getBoundingClientRect() ??
        statsRef.current?.getBoundingClientRect() ??
        null,
    });
    setOpenMapOffset((prev) => {
      if (prev && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5) return prev;
      return next;
    });
  }, []);

  const measureOverlayHeights = useCallback(() => {
    const nextControlHeight = controlBarRef.current?.getBoundingClientRect().height ?? 0;
    const nextStatsHeight = statsRef.current?.getBoundingClientRect().height ?? 0;
    if (nextControlHeight > 0) {
      setControlPanelHeight((prev) =>
        Math.abs(prev - nextControlHeight) < 0.5 ? prev : Math.ceil(nextControlHeight),
      );
    }
    if (nextStatsHeight > 0) {
      setStatsPanelHeight((prev) =>
        Math.abs(prev - nextStatsHeight) < 0.5 ? prev : Math.ceil(nextStatsHeight),
      );
    }
  }, []);

  useEffect(() => {
    const el = mapAreaRef.current;
    if (!el) return;
    let lastApplied = "";
    const update = (rawWidth: number, rawHeight: number) => {
      const availableWidth = rawWidth || DEFAULT_MAP_SIZE.width;
      const availableHeight = rawHeight || DEFAULT_MAP_SIZE.height;
      const width = Math.round(Math.max(MAP_MIN_WIDTH, availableWidth));
      const height = Math.round(Math.max(MAP_MIN_HEIGHT, availableHeight));
      const nextKey = `${width}:${height}`;
      if (nextKey === lastApplied) return;
      lastApplied = nextKey;
      setMapSize({ width, height });
      window.requestAnimationFrame(measureOpenMapOffset);
    };
    const rect = el.getBoundingClientRect();
    update(el.clientWidth || rect.width, el.clientHeight || rect.height);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0) update(w, h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureOpenMapOffset]);

  useEffect(() => {
    measureOverlayHeights();
    measureOpenMapOffset();
    if (typeof window === "undefined") return;
    const onResize = () => {
      measureOverlayHeights();
      measureOpenMapOffset();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measureOpenMapOffset, measureOverlayHeights]);

  useEffect(() => {
    if (!openMapOffset || focusedStateFips || selectedFips) return;
    setMapViewState((prev) => {
      const isDefault =
        Math.abs(prev.longitude - DEFAULT_MAP_VIEW_STATE.longitude) < 0.001 &&
        Math.abs(prev.latitude - DEFAULT_MAP_VIEW_STATE.latitude) < 0.001 &&
        Math.abs(prev.zoom - DEFAULT_MAP_VIEW_STATE.zoom) < 0.001;
      return isDefault ? centerViewStateInOpenArea(DEFAULT_MAP_VIEW_STATE, openMapOffset) : prev;
    });
  }, [focusedStateFips, openMapOffset, selectedFips]);

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
  const currentStateValuesByYear = stateValuesByMetricYear.get(urlState.metric);
  const currentStateValues = useMemo(
    () => currentStateValuesByYear?.get(urlState.year) ?? EMPTY_VALUES,
    [currentStateValuesByYear, urlState.year],
  );
  const currentStatePopulations = useMemo(
    () => statePopulationsByYear.get(urlState.year) ?? EMPTY_VALUES,
    [statePopulationsByYear, urlState.year],
  );
  const isStateOnlyMetricYear =
    urlState.metric === "mme_per_capita" &&
    currentStateValues.size > 0 &&
    !currentValuesByYear?.has(urlState.year);
  const metricDetails = METRIC_DETAILS[urlState.metric];
  const availableYears = yearsForMetric(urlState.metric);

  useEffect(() => {
    const coercedYear = coerceYearForMetric(urlState.year, urlState.metric);
    if (coercedYear === urlState.year) return;
    setMapHover(null);
    setURLState({ ...urlState, year: coercedYear });
  }, [setURLState, urlState]);

  const domain = useMemo(
    () => ({ domainMin: 0, domainMax: metricDetails.domainMax }),
    [metricDetails.domainMax],
  );

  const stateSummaryByFips = useMemo(() => {
    if (isStateOnlyMetricYear) {
      const summaries = new Map<string, StateAccumulator>();
      for (const [stateFips, value] of currentStateValues) {
        const code = FIPS_STATE_MAP[stateFips] ?? stateFips;
        const population = currentStatePopulations.get(stateFips) ?? 0;
        summaries.set(stateFips, {
          code,
          count: 1,
          population,
          value,
          weightedValue: value * population,
        });
      }
      return summaries;
    }

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
    if (!isPopulationNormalizedMetric(urlState.metric)) return summaries;
    const perCapitaSummaries = new Map<string, StateAccumulator>();
    for (const [stateFips, summary] of summaries) {
      perCapitaSummaries.set(stateFips, {
        ...summary,
        value: summary.population > 0 ? summary.weightedValue / summary.population : 0,
      });
    }
    return perCapitaSummaries;
  }, [
    counties,
    currentStatePopulations,
    currentStateValues,
    currentValues,
    isStateOnlyMetricYear,
    urlState.metric,
  ]);

  const stateValueByFips = useMemo(() => {
    return new Map(
      [...stateSummaryByFips].map(([stateFips, summary]) => [stateFips, summary.value]),
    );
  }, [stateSummaryByFips]);

  const stateNameByFips = useMemo(() => {
    return new Map(
      topology.states?.features.map((feature) => [
        String(feature.id ?? "").padStart(2, "0"),
        feature.properties?.name ?? "",
      ]) ?? [],
    );
  }, [topology.states]);

  const stateDomain = domain;

  const showCountyLayer = !isStateOnlyMetricYear;
  const activeDomain = showCountyLayer ? domain : stateDomain;

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

  const rankedStates = useMemo<StateWithValue[]>(() => {
    return [...stateSummaryByFips]
      .map(([fips, summary]) => ({
        fips,
        code: summary.code,
        name: stateNameByFips.get(fips) || summary.code,
        value: summary.value,
        population: summary.population,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [stateNameByFips, stateSummaryByFips]);

  const highestState = rankedStates[0] ?? null;

  const rankByFips = useMemo(() => {
    return new Map(rankedCounties.map((county, index) => [county.meta.fips, index + 1]));
  }, [rankedCounties]);

  const nationalAverage = useMemo(() => {
    if (isStateOnlyMetricYear) {
      let weightedTotal = 0;
      let population = 0;
      for (const summary of stateSummaryByFips.values()) {
        if (summary.population <= 0) continue;
        weightedTotal += summary.value * summary.population;
        population += summary.population;
      }
      return population > 0 ? weightedTotal / population : 0;
    }
    if (isPopulationNormalizedMetric(urlState.metric)) {
      let weightedTotal = 0;
      let population = 0;
      for (const county of sortedCounties) {
        const value = currentValues.get(county.fips);
        if (value == null) continue;
        weightedTotal += value * county.pop;
        population += county.pop;
      }
      return population > 0 ? weightedTotal / population : 0;
    }
    let total = 0;
    let count = 0;
    for (const value of currentValues.values()) {
      total += value;
      count += 1;
    }
    return count ? total / count : 0;
  }, [currentValues, isStateOnlyMetricYear, sortedCounties, stateSummaryByFips, urlState.metric]);

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

  const selectedState =
    (focusedStateFips && rankedStates.find((state) => state.fips === focusedStateFips)) ||
    highestState ||
    null;

  const selectedStateIndex = selectedState
    ? rankedStates.findIndex((state) => state.fips === selectedState.fips)
    : -1;
  const selectedStateRankOverall = selectedStateIndex >= 0 ? selectedStateIndex + 1 : null;

  const selectedTrend = useMemo(() => {
    if (isStateOnlyMetricYear) {
      if (!selectedState) return [];
      return STATE_MME_AVAILABLE_YEARS.map((year) => ({
        year,
        value:
          stateValuesByMetricYear.get(urlState.metric)?.get(year)?.get(selectedState.fips) ?? 0,
      }));
    }
    if (!selectedFipsResolved) return [];
    const metricValuesByYear = valuesByMetricYear.get(urlState.metric);
    const years =
      urlState.metric === "mme_per_capita"
        ? COUNTY_MME_AVAILABLE_YEARS
        : yearsForMetric(urlState.metric);
    return years.map((year) => ({
      year,
      value: metricValuesByYear?.get(year)?.get(selectedFipsResolved) ?? 0,
    }));
  }, [
    isStateOnlyMetricYear,
    selectedFipsResolved,
    selectedState,
    stateValuesByMetricYear,
    valuesByMetricYear,
    urlState.metric,
  ]);

  const selectedTrendPoints = useMemo(() => buildSparklinePoints(selectedTrend), [selectedTrend]);
  const trendYearLabels = useMemo(() => {
    const first = selectedTrend[0]?.year ?? availableYears[0];
    const middle = selectedTrend[Math.floor(selectedTrend.length / 2)]?.year ?? first;
    const last = selectedTrend.at(-1)?.year ?? first;
    return { first, middle, last };
  }, [availableYears, selectedTrend]);

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
  const filteredStates = useMemo(() => {
    const query = countyQuery.trim().toLowerCase();
    if (!query || !isStateOnlyMetricYear) return [];
    return rankedStates.filter((state) => {
      const label = `${stateSearchLabel(state)} ${state.fips}`.toLowerCase();
      return label.includes(query);
    });
  }, [countyQuery, isStateOnlyMetricYear, rankedStates]);

  const autocompleteStates = useMemo(
    () => filteredStates.slice(0, AUTOCOMPLETE_LIMIT),
    [filteredStates],
  );

  const selectedCountyName = selectedCounty?.meta
    ? `${selectedCounty.meta.name}, ${selectedCounty.meta.state}`
    : "No county selected";
  const selectedName = isStateOnlyMetricYear
    ? (selectedState?.name ?? "No state selected")
    : selectedCountyName;
  const mapPanelLabel = isStateOnlyMetricYear ? "State map panel" : "County map panel";
  const mapAriaLabel = `${isStateOnlyMetricYear ? "State" : "County"} map of ${
    metricDetails.label
  }, ${urlState.year}`;
  const searchLabel = isStateOnlyMetricYear ? "Search states" : "Search counties";
  const searchPlaceholder = isStateOnlyMetricYear ? "Type a state..." : "Type a county or state...";
  const legendColors = useMemo(() => {
    const scale = urlState.metric === "deaths_per_100k" ? deathsColorScale : pillsColorScale;
    return buildLegendSampleValues(urlState.metric).map((value) =>
      rgbToCss(scale(value, activeDomain)),
    );
  }, [activeDomain, urlState.metric]);

  const legendLabels = useMemo(() => buildLegendLabels(urlState.metric), [urlState.metric]);

  const handleFilterChange = useCallback(
    (next: FiltersState) => {
      const metric = next.metric ?? urlState.metric;
      setMapHover(null);
      setURLState({ ...urlState, ...next, year: coerceYearForMetric(urlState.year, metric) });
    },
    [setURLState, urlState],
  );

  const handleYearChange = useCallback(
    (year: number) => {
      setMapHover(null);
      setURLState({ ...urlState, year: coerceYearForMetric(year, urlState.metric) });
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

  const handleStateData = useCallback(
    (year: number, values: Map<string, number>, populations: Map<string, number>) => {
      setStateValuesByMetricYear((prev) => {
        const metricValues = prev.get(urlState.metric);
        if (metricValues?.get(year) === values) return prev;
        const next = new Map(prev);
        const nextMetricValues = new Map(metricValues);
        nextMetricValues.set(year, values);
        next.set(urlState.metric, nextMetricValues);
        return next;
      });
      setStatePopulationsByYear((prev) => {
        if (prev.get(year) === populations) return prev;
        const next = new Map(prev);
        next.set(year, populations);
        return next;
      });
    },
    [urlState.metric],
  );

  const handleDataError = useCallback((err: Error) => {
    setTopologyError(err.message);
  }, []);

  const animateMapToViewState = useCallback(
    (target: MapViewState) => {
      if (typeof window === "undefined") {
        setMapViewState(centerViewStateInOpenArea(target, openMapOffset));
        return;
      }

      cancelMapAnimation();
      const start = mapViewState;
      const visibleTarget = centerViewStateInOpenArea(target, openMapOffset);
      const startedAt = performance.now();

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / MAP_ZOOM_ANIMATION_MS);
        setMapViewState(interpolateMapViewState(start, visibleTarget, progress));
        if (progress < 1) {
          mapAnimationRef.current = window.requestAnimationFrame(tick);
          return;
        }
        mapAnimationRef.current = null;
      };

      mapAnimationRef.current = window.requestAnimationFrame(tick);
    },
    [cancelMapAnimation, mapViewState, openMapOffset],
  );

  const focusMapOnFeature = useCallback(
    (feature: Feature<Geometry> | null, options: { minZoom?: number; maxZoom?: number } = {}) => {
      if (!feature) return;
      const nextView = viewStateForFeature(feature, options);
      if (nextView) animateMapToViewState(nextView);
    },
    [animateMapToViewState],
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

  const handleMapViewStateChange = useCallback(
    (next: MapViewport) => {
      cancelMapAnimation();
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
    },
    [cancelMapAnimation],
  );

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

  const findStateFromSearchValue = useCallback(
    (value: string) => {
      const query = value.trim().toLowerCase();
      if (!query) return null;
      return (
        rankedStates.find((state) => stateSearchLabel(state).toLowerCase() === query) ??
        rankedStates.find((state) => state.name.toLowerCase() === query) ??
        rankedStates.find((state) => state.code.toLowerCase() === query) ??
        rankedStates.find((state) => state.fips === query.padStart(2, "0")) ??
        null
      );
    },
    [rankedStates],
  );

  const handleCountySearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextQuery = event.target.value;
      setCountyQuery(nextQuery);
      if (isStateOnlyMetricYear) {
        const state = findStateFromSearchValue(nextQuery);
        if (state) {
          setFocusedStateFips(state.fips);
          focusMapOnFeature(findStateFeature(state.fips), {
            minZoom: COUNTY_DETAIL_ZOOM + 0.25,
            maxZoom: 6.7,
          });
        }
        return;
      }
      const county = findCountyFromSearchValue(nextQuery);
      if (county) selectCounty(county.fips);
    },
    [
      findCountyFromSearchValue,
      findStateFeature,
      findStateFromSearchValue,
      focusMapOnFeature,
      isStateOnlyMetricYear,
      selectCounty,
    ],
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

  const rootStyle = useMemo(
    () =>
      ({
        "--control-panel-height": `${controlPanelHeight}px`,
        "--stats-panel-height": `${statsPanelHeight}px`,
      }) as CSSProperties,
    [controlPanelHeight, statsPanelHeight],
  );

  return (
    <section className={styles.root} style={rootStyle} aria-label="Explorer">
      <h1 className={styles.srOnly}>Explorer</h1>
      <main className={styles.main}>
        <section ref={controlBarRef} className={styles.controlBar} aria-label="Explorer controls">
          <div className={styles.controlGroup}>
            <Filters metric={urlState.metric} onChange={handleFilterChange} />
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.searchLabel} htmlFor="explorer-county-search">
              {searchLabel}
            </label>
            <div className={styles.countySearch}>
              <span aria-hidden="true">⌕</span>
              <input
                id="explorer-county-search"
                type="search"
                list="explorer-county-options"
                aria-autocomplete="list"
                value={countyQuery}
                placeholder={searchPlaceholder}
                onChange={handleCountySearchChange}
              />
              <datalist id="explorer-county-options">
                {isStateOnlyMetricYear
                  ? autocompleteStates.map((state) => (
                      <option key={state.fips} value={stateSearchLabel(state)} />
                    ))
                  : autocompleteCounties.map((county) => (
                      <option key={county.fips} value={countySearchLabel(county)} />
                    ))}
              </datalist>
            </div>
          </div>
        </section>

        <section ref={statsRef} className={styles.stats} aria-label="Explorer summary">
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
              !
            </div>
            <div>
              <p>
                {isStateOnlyMetricYear ? "Highest state" : "Highest county"} ({urlState.year})
              </p>
              <strong>
                {formatMetricValue(
                  isStateOnlyMetricYear ? (highestState?.value ?? 0) : (highestCounty?.value ?? 0),
                  urlState.metric,
                )}
              </strong>
              <span>
                {isStateOnlyMetricYear
                  ? (highestState?.name ?? "Loading")
                  : `${highestCounty?.meta.name ?? "Loading"}, ${highestCounty?.meta.state ?? ""}`}
              </span>
            </div>
          </article>
          <article className={styles.stat}>
            <div className={`${styles.statIcon} ${styles.statIconCream}`} aria-hidden="true">
              ●
            </div>
            <div>
              <p>
                {isStateOnlyMetricYear ? "Selected state" : "Selected county"} ({urlState.year})
              </p>
              <strong>
                {formatMetricValue(
                  isStateOnlyMetricYear
                    ? (selectedState?.value ?? 0)
                    : (selectedCounty?.value ?? 0),
                  urlState.metric,
                )}
              </strong>
              <span>{selectedName}</span>
            </div>
          </article>
        </section>

        <section className={styles.mapShell} aria-label={mapPanelLabel}>
          <aside
            ref={legendRef}
            className={styles.legend}
            aria-label={`${metricDetails.label} legend`}
          >
            <h2>{metricDetails.label}</h2>
            {isStateOnlyMetricYear && (
              <p>
                State-level estimate · {STATE_MME_AVAILABLE_YEARS[0]}–
                {STATE_MME_AVAILABLE_YEARS[STATE_MME_AVAILABLE_YEARS.length - 1]}
              </p>
            )}
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

          <section ref={yearSliderRef} className={styles.yearOverlay} aria-label="Year slider">
            <TimeSlider years={availableYears} value={urlState.year} onChange={handleYearChange} />
          </section>

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
                width={mapSize.width}
                height={mapSize.height}
                year={urlState.year}
                ariaLabel={mapAriaLabel}
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
        </section>
      </main>

      <aside
        ref={detailPanelRef}
        className={styles.detailPanel}
        aria-label={isStateOnlyMetricYear ? "Selected state details" : "Selected county details"}
      >
        {isStateOnlyMetricYear && selectedState ? (
          <>
            <div className={styles.detailHeader}>
              <div>
                <h2>{selectedState.name}</h2>
                <p>{selectedState.code}</p>
              </div>
            </div>

            <div className={styles.detailMetric}>
              <p>
                {metricDetails.label} ({urlState.year})
              </p>
              <strong>{formatMetricValue(selectedState.value, urlState.metric)}</strong>
            </div>

            <div className={styles.detailGrid}>
              <div>
                <p>Population</p>
                <strong>{selectedState.population.toLocaleString("en-US")}</strong>
              </div>
            </div>

            <section className={styles.trendBlock} aria-label={`${metricDetails.label} trend`}>
              <h3>
                Trend: {metricDetails.label}{" "}
                <span>
                  ({trendYearLabels.first}-{trendYearLabels.last})
                </span>
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
                <span>{trendYearLabels.first}</span>
                <span>{trendYearLabels.middle}</span>
                <span>{trendYearLabels.last}</span>
              </div>
            </section>

            <div className={styles.rankGrid}>
              <div>
                <p>{urlState.year} rank</p>
                <strong>
                  {selectedStateRankOverall ?? "—"}{" "}
                  <span>of {rankedStates.length.toLocaleString("en-US")}</span>
                </strong>
              </div>
            </div>
          </>
        ) : selectedCounty?.meta ? (
          <>
            <div className={styles.detailHeader}>
              <div>
                <h2>{selectedCounty.meta.name}</h2>
                <p>{selectedCounty.meta.state}</p>
              </div>
            </div>

            <div className={styles.detailMetric}>
              <p>
                {metricDetails.label} ({urlState.year})
              </p>
              <strong>{formatMetricValue(selectedCounty.value, urlState.metric)}</strong>
            </div>

            <div className={styles.detailGrid}>
              <div>
                <p>Population</p>
                <strong>{selectedCounty.meta.pop.toLocaleString("en-US")}</strong>
              </div>
            </div>

            <section className={styles.trendBlock} aria-label={`${metricDetails.label} trend`}>
              <h3>
                Trend: {metricDetails.label}{" "}
                <span>
                  ({trendYearLabels.first}-{trendYearLabels.last})
                </span>
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
                <span>{trendYearLabels.first}</span>
                <span>{trendYearLabels.middle}</span>
                <span>{trendYearLabels.last}</span>
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
        onStateData={handleStateData}
        year={urlState.year}
        metric={urlState.metric}
        onError={handleDataError}
      />
    </section>
  );
}
