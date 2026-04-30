"use client";

import { PolygonLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useMemo } from "react";
import styles from "./ChoroplethMap.module.css";
import type { ScaleDomain } from "./colorScales";
import { buildCountyLayerProps, type MapMetric } from "./layers/countyLayer";
import { buildStateLayerProps } from "./layers/stateLayer";
export interface ChoroplethMapProps {
  counties: FeatureCollection<Geometry, { name?: string }>;
  states?: FeatureCollection<Geometry, { name?: string }>;
  valueByFips: Map<string, number>;
  metric: MapMetric;
  domain: ScaleDomain;
  width: number;
  height: number;
  year?: number;
  ariaLabel?: string;
  onCountyHover?: (fips: string | null, feature: Feature | null) => void;
  onCountyClick?: (fips: string | null, feature: Feature | null) => void;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch?: number;
    bearing?: number;
  };
}

const DEFAULT_VIEW_STATE = {
  longitude: -98,
  latitude: 39,
  zoom: 3.2,
  pitch: 0,
  bearing: 0,
};

export function ChoroplethMap(props: ChoroplethMapProps) {
  const {
    counties,
    states,
    valueByFips,
    metric,
    domain,
    width,
    height,
    year,
    ariaLabel,
    onCountyHover,
    onCountyClick,
    initialViewState = DEFAULT_VIEW_STATE,
  } = props;

  const layers = useMemo(() => {
    const t0 =
      process.env.NODE_ENV === "development" && typeof performance !== "undefined"
        ? performance.now()
        : 0;

    const countyProps = buildCountyLayerProps({
      featureCollection: counties,
      valueByFips,
      metric,
      domain,
      // Primitive key that uniquely identifies the current value slice.
      // Used as the sole data-mutation signal for Deck.gl's
      // updateTriggers.getFillColor; avoids passing Map references that
      // churn identity on every parent render.
      colorKey: `${metric}-${year ?? ""}-${domain.domainMin}-${domain.domainMax}`,
      // Only wire picking handlers when the parent actually listens, so
      // countyLayer can keep pickable=false and skip gl.readPixels.
      onHover: onCountyHover
        ? (info) => onCountyHover(String(info.object?.id ?? "") || null, info.object ?? null)
        : undefined,
      onClick: onCountyClick
        ? (info) => onCountyClick(String(info.object?.id ?? "") || null, info.object ?? null)
        : undefined,
    });
    const layersOut: PolygonLayer[] = [
      new PolygonLayer(countyProps as unknown as ConstructorParameters<typeof PolygonLayer>[0]),
    ];
    if (states) {
      const stateProps = buildStateLayerProps({ featureCollection: states });
      layersOut.push(
        new PolygonLayer(stateProps as unknown as ConstructorParameters<typeof PolygonLayer>[0]),
      );
    }

    if (process.env.NODE_ENV === "development" && typeof performance !== "undefined") {
      const dt = performance.now() - t0;
      // Gate on a reasonable threshold so we do not spam the console on
      // no-op renders.
      if (dt > 1) {
        // eslint-disable-next-line no-console
        console.debug(
          `[ChoroplethMap] layers rebuilt in ${dt.toFixed(1)}ms ` +
            `(year=${year ?? "?"}, metric=${metric}, counties=${counties.features.length})`,
        );
      }
    }

    return layersOut;
  }, [counties, states, valueByFips, metric, domain, year, onCountyHover, onCountyClick]);

  const label = ariaLabel ?? `County map of ${metric}${year ? `, ${year}` : ""}`;

  return (
    <figure aria-label={label} className={styles.root} style={{ width, height }}>
      <DeckGL
        initialViewState={initialViewState}
        controller={true}
        layers={layers}
        width={width}
        height={height}
      />
    </figure>
  );
}
