"use client";

import type { FeatureCollection, Geometry } from "geojson";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChoroplethMapProps } from "@/components/map/ChoroplethMap";
import { deathsColorScale, pillsColorScale, rgbToCss } from "@/components/map/colorScales";
import type { MapMetric } from "@/components/map/layers/countyLayer";
import { TimeSlider } from "@/components/map/TimeSlider";
import { useWebGLSupport } from "@/components/map/useWebGLSupport";
import type { CountyMetadata } from "@/lib/data/schemas";
import { loadCountyTopology, loadStateTopology } from "@/lib/geo/topology";
import { DataLoader } from "./DataLoader";
import styles from "./Explorer.module.css";
import { Filters, type FiltersState } from "./Filters";
import { useURLState } from "./useURLState";
import { WebGLFallback } from "./WebGLFallback";

const AVAILABLE_YEARS = [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014];

const MAP_ASPECT_RATIO = 720 / 420; // ≈1.714
const MAP_MAX_WIDTH = 1200;
const MAP_MIN_WIDTH = 280;
const BROWSE_BATCH_SIZE = 120;
const DEFAULT_URL_STATE = {
  year: 2012,
  metric: "pills_per_capita" as const,
};

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
  const [valuesByYear, setValuesByYear] = useState<Map<number, Map<string, number>>>(new Map());
  const [selectedFips, setSelectedFips] = useState<string | null>(null);
  const [countyQuery, setCountyQuery] = useState("");
  const [topologyError, setTopologyError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [savedCountyFips, setSavedCountyFips] = useState<Set<string>>(() => new Set());
  const [browseLimit, setBrowseLimit] = useState(BROWSE_BATCH_SIZE);
  const webgl = useWebGLSupport();

  const mapAreaRef = useRef<HTMLDivElement | null>(null);
  const previousMetric = useRef<MapMetric>(urlState.metric);
  const shareResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapWidth, setMapWidth] = useState<number>(720);

  useEffect(() => {
    return () => {
      if (shareResetTimer.current) clearTimeout(shareResetTimer.current);
    };
  }, []);

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

  useEffect(() => {
    if (previousMetric.current === urlState.metric) return;
    previousMetric.current = urlState.metric;
    setValuesByYear(new Map());
  }, [urlState.metric]);

  const currentValues = useMemo(
    () => valuesByYear.get(urlState.year) ?? EMPTY_VALUES,
    [valuesByYear, urlState.year],
  );

  const domain = useMemo(() => {
    let max = 0;
    for (const v of currentValues.values()) if (v > max) max = v;
    return { domainMin: 0, domainMax: Math.max(max, 1) };
  }, [currentValues]);

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
    return AVAILABLE_YEARS.map((year) => ({
      year,
      value: valuesByYear.get(year)?.get(selectedFipsResolved) ?? 0,
    }));
  }, [selectedFipsResolved, valuesByYear]);

  const selectedTrendPoints = useMemo(() => buildSparklinePoints(selectedTrend), [selectedTrend]);

  const filteredCounties = useMemo(() => {
    const query = countyQuery.trim().toLowerCase();
    if (!query) return sortedCounties;
    return sortedCounties.filter((county) => {
      const label = `${county.name} ${county.state} ${county.fips}`.toLowerCase();
      return label.includes(query);
    });
  }, [countyQuery, sortedCounties]);

  const visibleCounties = useMemo(
    () => filteredCounties.slice(0, browseLimit),
    [browseLimit, filteredCounties],
  );

  const canShowMoreCounties = visibleCounties.length < filteredCounties.length;

  const metricDetails = METRIC_DETAILS[urlState.metric];
  const selectedName = selectedCounty?.meta
    ? `${selectedCounty.meta.name}, ${selectedCounty.meta.state}`
    : "No county selected";
  const selectedCountyFips = selectedCounty?.meta?.fips ?? null;
  const isSelectedCountySaved = selectedCountyFips
    ? savedCountyFips.has(selectedCountyFips)
    : false;
  const shareLabel =
    shareStatus === "copied" ? "Copied" : shareStatus === "failed" ? "Copy failed" : "Share";

  const legendColors = useMemo(() => {
    const scale = urlState.metric === "deaths" ? deathsColorScale : pillsColorScale;
    return [0.96, 0.78, 0.6, 0.42, 0.24, 0.08].map((stop) =>
      rgbToCss(scale(domain.domainMax * stop, domain)),
    );
  }, [domain, urlState.metric]);

  const legendLabels = useMemo(
    () => buildLegendLabels(domain.domainMax, urlState.metric),
    [domain.domainMax, urlState.metric],
  );

  const handleFilterChange = useCallback(
    (next: FiltersState) => setURLState({ ...urlState, ...next }),
    [setURLState, urlState],
  );

  const handleYearChange = useCallback(
    (year: number) => setURLState({ ...urlState, year }),
    [setURLState, urlState],
  );

  const handleData = useCallback((year: number, values: Map<string, number>) => {
    setValuesByYear((prev) => {
      if (prev.get(year) === values) return prev;
      const next = new Map(prev);
      next.set(year, values);
      return next;
    });
  }, []);

  const handleDataError = useCallback((err: Error) => {
    setTopologyError(err.message);
  }, []);

  const handleCountyClick = useCallback(
    (fips: string | null) => {
      if (!fips || !countyByFips.has(fips)) return;
      setSelectedFips(fips);
    },
    [countyByFips],
  );

  const finishShare = useCallback((status: "copied" | "failed") => {
    setShareStatus(status);
    if (shareResetTimer.current) clearTimeout(shareResetTimer.current);
    shareResetTimer.current = setTimeout(() => {
      setShareStatus("idle");
      shareResetTimer.current = null;
    }, 1800);
  }, []);

  const handleShare = useCallback(() => {
    if (!navigator.clipboard?.writeText) {
      finishShare("failed");
      return;
    }
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => finishShare("copied"))
      .catch(() => finishShare("failed"));
  }, [finishShare]);

  const handleToggleSavedCounty = useCallback(() => {
    if (!selectedCountyFips) return;
    setSavedCountyFips((prev) => {
      const next = new Set(prev);
      if (next.has(selectedCountyFips)) next.delete(selectedCountyFips);
      else next.add(selectedCountyFips);
      return next;
    });
  }, [selectedCountyFips]);

  const handleShowMoreCounties = useCallback(() => {
    setBrowseLimit((prev) => Math.min(prev + BROWSE_BATCH_SIZE, filteredCounties.length));
  }, [filteredCounties.length]);

  return (
    <section className={styles.root} aria-labelledby="explorer-heading">
      <aside className={styles.rail} aria-label="Explorer controls">
        <div className={styles.railSection}>
          <Filters metric={urlState.metric} onChange={handleFilterChange} />
        </div>

        <div className={styles.railSection}>
          <TimeSlider years={AVAILABLE_YEARS} value={urlState.year} onChange={handleYearChange} />
        </div>

        <div className={styles.railSection}>
          <label className={styles.searchLabel} htmlFor="explorer-county-search">
            Search counties
          </label>
          <div className={styles.countySearch}>
            <span aria-hidden="true">⌕</span>
            <input
              id="explorer-county-search"
              type="search"
              value={countyQuery}
              placeholder="Type a county or state..."
              onChange={(event) => {
                setCountyQuery(event.target.value);
                setBrowseLimit(BROWSE_BATCH_SIZE);
              }}
            />
          </div>
        </div>

        <aside className={styles.browse} aria-label="Browse counties">
          <h2>
            Browse counties <span>({filteredCounties.length.toLocaleString("en-US")})</span>
          </h2>
          <ul className={styles.browseList}>
            {visibleCounties.map((county) => {
              const isSelected = county.fips === selectedFipsResolved;
              return (
                <li key={county.fips}>
                  <button
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => setSelectedFips(county.fips)}
                  >
                    <span>
                      {county.name}, {county.state}
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {canShowMoreCounties ? (
            <button
              type="button"
              className={styles.browseMoreButton}
              onClick={handleShowMoreCounties}
            >
              Show more counties{" "}
              <span>
                {visibleCounties.length.toLocaleString("en-US")} /{" "}
                {filteredCounties.length.toLocaleString("en-US")}
              </span>
            </button>
          ) : null}
        </aside>

        <a className={styles.downloadButton} href="/data/county-shipments-by-year.parquet" download>
          <span aria-hidden="true">↓</span>
          Download data
        </a>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 id="explorer-heading">US counties, 2006–2014</h1>
            <p className={styles.lede}>
              Shipments, per-capita rates, and overdose deaths across 3,100+ counties.
            </p>
          </div>
          <button
            type="button"
            className={styles.shareButton}
            onClick={handleShare}
            aria-live="polite"
          >
            <span aria-hidden="true">{shareStatus === "copied" ? "✓" : "↥"}</span>
            {shareLabel}
          </button>
        </header>

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
                metric={urlState.metric}
                domain={domain}
                width={mapWidth}
                height={mapHeight}
                year={urlState.year}
                onCountyClick={handleCountyClick}
              />
            ) : (
              <div role="status" className={styles.loading}>
                Loading map…
              </div>
            )}
          </div>

          <footer className={styles.mapStatus}>
            <span aria-hidden="true">i</span>
            Showing {metricDetails.shortLabel.toLowerCase()} in {urlState.year} for{" "}
            {currentValues.size.toLocaleString("en-US")} counties.
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
