"use client";

import type { FeatureCollection, Geometry } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChoroplethMap } from "@/components/map/ChoroplethMap";
import { TimeSlider } from "@/components/map/TimeSlider";
import { useWebGLSupport } from "@/components/map/useWebGLSupport";
import type { CountyMetadata } from "@/lib/data/schemas";
import { loadCountyTopology, loadStateTopology } from "@/lib/geo/topology";
import { DataLoader } from "./DataLoader";
import styles from "./Explorer.module.css";
import { Filters } from "./Filters";
import { useURLState } from "./useURLState";
import { WebGLFallback } from "./WebGLFallback";

const AVAILABLE_YEARS = [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014];

const MAP_ASPECT_RATIO = 720 / 420; // ≈1.714
const MAP_MAX_WIDTH = 1200;
const MAP_MIN_WIDTH = 280;

interface ExplorerProps {
  counties: CountyMetadata[];
}

export function Explorer({ counties }: ExplorerProps) {
  const [urlState, setURLState] = useURLState({
    year: 2012,
    metric: "pills",
  });
  const [topology, setTopology] = useState<{
    counties: FeatureCollection<Geometry, { name?: string }> | null;
    states: FeatureCollection<Geometry, { name?: string }> | null;
  }>({ counties: null, states: null });
  const [valuesByYear, setValuesByYear] = useState<Map<number, Map<string, number>>>(new Map());
  const [topologyError, setTopologyError] = useState<string | null>(null);
  const webgl = useWebGLSupport();

  const mapAreaRef = useRef<HTMLDivElement | null>(null);
  const [mapWidth, setMapWidth] = useState<number>(720);

  useEffect(() => {
    const el = mapAreaRef.current;
    if (!el) return;
    const update = (rawWidth: number) => {
      const clamped = Math.max(MAP_MIN_WIDTH, Math.min(MAP_MAX_WIDTH, rawWidth));
      setMapWidth(clamped);
    };
    // Initial measure.
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

  const currentValues = useMemo(
    () => valuesByYear.get(urlState.year) ?? new Map<string, number>(),
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

  return (
    <section className={styles.root} aria-labelledby="explorer-heading">
      <header className={styles.header}>
        <p className="eyebrow">Explorer</p>
        <h1 id="explorer-heading">US counties, 2006–2014</h1>
        <p className={styles.lede}>
          Shipments, per-capita rates, and overdose deaths across 3,100+ counties.
        </p>
      </header>

      <div className={styles.controls}>
        <Filters
          year={urlState.year}
          metric={urlState.metric}
          years={AVAILABLE_YEARS}
          onChange={(next) => setURLState({ ...urlState, ...next })}
        />
      </div>

      <div className={styles.slider}>
        <TimeSlider
          years={AVAILABLE_YEARS}
          value={urlState.year}
          onChange={(y) => setURLState({ ...urlState, year: y })}
        />
      </div>

      <div className={styles.mapArea} ref={mapAreaRef}>
        {topologyError ? (
          <WebGLFallback
            counties={sortedCounties}
            reason={`Topology load failed: ${topologyError}`}
          />
        ) : webgl === false ? (
          <WebGLFallback counties={sortedCounties} reason="WebGL unavailable in this browser." />
        ) : topology.counties && topology.states ? (
          <ChoroplethMap
            counties={topology.counties}
            states={topology.states}
            valueByFips={currentValues}
            metric={urlState.metric}
            domain={domain}
            width={mapWidth}
            height={mapHeight}
            year={urlState.year}
          />
        ) : (
          <div role="status" className={styles.loading}>
            Loading map…
          </div>
        )}
      </div>

      <aside className={styles.browse} aria-label="Browse counties">
        <h2>Browse counties</h2>
        <ul className={styles.browseList}>
          {sortedCounties.map((c) => (
            <li key={c.fips}>
              <a href={`/county/${c.fips}`}>
                {c.name}, {c.state}
              </a>
            </li>
          ))}
        </ul>
      </aside>

      <DataLoader
        onData={(year, values) =>
          setValuesByYear((prev) => {
            const next = new Map(prev);
            next.set(year, values);
            return next;
          })
        }
        year={urlState.year}
        metric={urlState.metric}
        onError={(err) => setTopologyError(err.message)}
      />
    </section>
  );
}
