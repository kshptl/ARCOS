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
    const countyProps = buildCountyLayerProps({
      featureCollection: counties,
      valueByFips,
      metric,
      domain,
      onHover: (info) =>
        onCountyHover?.(String(info.object?.id ?? "") || null, info.object ?? null),
      onClick: (info) =>
        onCountyClick?.(String(info.object?.id ?? "") || null, info.object ?? null),
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
    return layersOut;
  }, [counties, states, valueByFips, metric, domain, onCountyHover, onCountyClick]);

  const label = ariaLabel ?? `County map of ${metric}${year ? `, ${year}` : ""}`;

  return (
    <figure role="figure" aria-label={label} className={styles.root} style={{ width, height }}>
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
