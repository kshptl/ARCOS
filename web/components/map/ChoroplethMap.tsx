"use client";

import { PolygonLayer, TextLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useMemo } from "react";
import styles from "./ChoroplethMap.module.css";
import type { ScaleDomain } from "./colorScales";
import { buildCityLabelLayerProps } from "./layers/cityLayer";
import { buildCountyLayerProps, type MapMetric } from "./layers/countyLayer";
import { buildStateLayerProps } from "./layers/stateLayer";

export interface MapViewport {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export interface MapPointerPosition {
  x: number;
  y: number;
}

export interface ChoroplethMapProps {
  counties: FeatureCollection<Geometry, { name?: string }>;
  states?: FeatureCollection<Geometry, { name?: string }>;
  valueByFips: Map<string, number>;
  stateValueByFips?: Map<string, number>;
  metric: MapMetric;
  domain: ScaleDomain;
  stateDomain?: ScaleDomain;
  width: number;
  height: number;
  year?: number;
  ariaLabel?: string;
  focusedStateFips?: string | null;
  showCountyLayer?: boolean;
  onCountyHover?: (
    fips: string | null,
    feature: Feature | null,
    position: MapPointerPosition,
  ) => void;
  onCountyClick?: (fips: string | null, feature: Feature | null) => void;
  onStateHover?: (
    fips: string | null,
    feature: Feature | null,
    position: MapPointerPosition,
  ) => void;
  onStateClick?: (fips: string | null, feature: Feature | null) => void;
  onViewStateChange?: (viewState: MapViewport) => void;
  initialViewState?: MapViewport;
  viewState?: MapViewport;
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
    stateValueByFips,
    metric,
    domain,
    stateDomain,
    width,
    height,
    year,
    ariaLabel,
    focusedStateFips,
    showCountyLayer,
    onCountyHover,
    onCountyClick,
    onStateHover,
    onStateClick,
    onViewStateChange,
    initialViewState = DEFAULT_VIEW_STATE,
    viewState,
  } = props;

  const currentViewState = viewState ?? initialViewState;

  const layers = useMemo(() => {
    const t0 =
      process.env.NODE_ENV === "development" && typeof performance !== "undefined"
        ? performance.now()
        : 0;

    const layersOut: Array<PolygonLayer | TextLayer> = [];
    const useCountyLayer = showCountyLayer ?? !states;
    if (states) {
      const stateProps = buildStateLayerProps({
        featureCollection: states,
        valueByStateFips: useCountyLayer ? undefined : stateValueByFips,
        metric,
        domain: useCountyLayer ? undefined : (stateDomain ?? domain),
        colorKey: `${metric}-${year ?? ""}-${stateDomain?.domainMin ?? domain.domainMin}-${
          stateDomain?.domainMax ?? domain.domainMax
        }`,
        onHover:
          onStateHover && !useCountyLayer
            ? (info) => {
                const stateId = info.object?.id == null ? "" : String(info.object.id);
                onStateHover(stateId ? stateId.padStart(2, "0") : null, info.object ?? null, {
                  x: info.x ?? 0,
                  y: info.y ?? 0,
                });
              }
            : undefined,
        onClick: onStateClick
          ? (info) => {
              const stateId = info.object?.id == null ? "" : String(info.object.id);
              onStateClick(stateId ? stateId.padStart(2, "0") : null, info.object ?? null);
            }
          : undefined,
      });
      layersOut.push(
        new PolygonLayer(stateProps as unknown as ConstructorParameters<typeof PolygonLayer>[0]),
      );
    }

    if (useCountyLayer || !states) {
      const countyProps = buildCountyLayerProps({
        featureCollection: counties,
        valueByFips,
        metric,
        domain,
        // Primitive key that uniquely identifies the current value slice.
        // Used as the sole data-mutation signal for Deck.gl's
        // updateTriggers.getFillColor; avoids passing Map references that
        // churn identity on every parent render.
        colorKey: `${metric}-${year ?? ""}-${domain.domainMin}-${domain.domainMax}-${focusedStateFips ?? "all"}`,
        // Only wire picking handlers when the parent actually listens, so
        // countyLayer can keep pickable=false and skip gl.readPixels.
        onHover: onCountyHover
          ? (info) =>
              onCountyHover(String(info.object?.id ?? "") || null, info.object ?? null, {
                x: info.x ?? 0,
                y: info.y ?? 0,
              })
          : undefined,
        onClick: onCountyClick
          ? (info) => onCountyClick(String(info.object?.id ?? "") || null, info.object ?? null)
          : undefined,
      });
      layersOut.push(
        new PolygonLayer(countyProps as unknown as ConstructorParameters<typeof PolygonLayer>[0]),
      );
    }

    if (states && useCountyLayer) {
      const outlineProps = buildStateLayerProps({
        id: "state-outlines",
        featureCollection: states,
      });
      layersOut.push(
        new PolygonLayer(outlineProps as unknown as ConstructorParameters<typeof PolygonLayer>[0]),
      );
    }

    const cityLabelProps = buildCityLabelLayerProps({ zoom: currentViewState.zoom });
    if (cityLabelProps) {
      layersOut.push(
        new TextLayer(cityLabelProps as unknown as ConstructorParameters<typeof TextLayer>[0]),
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
  }, [
    counties,
    states,
    valueByFips,
    stateValueByFips,
    metric,
    domain,
    stateDomain,
    year,
    focusedStateFips,
    showCountyLayer,
    onCountyHover,
    onCountyClick,
    onStateHover,
    onStateClick,
    currentViewState.zoom,
  ]);

  const geographyLabel = showCountyLayer === false ? "State" : "County";
  const label = ariaLabel ?? `${geographyLabel} map of ${metric}${year ? `, ${year}` : ""}`;
  const uncontrolledKey = [
    initialViewState.longitude,
    initialViewState.latitude,
    initialViewState.zoom,
    initialViewState.pitch ?? 0,
    initialViewState.bearing ?? 0,
  ].join(":");

  return (
    <figure aria-label={label} className={styles.root} style={{ width, height }}>
      <DeckGL
        key={viewState ? "controlled" : uncontrolledKey}
        {...(viewState ? { viewState } : { initialViewState })}
        controller={true}
        layers={layers}
        width={width}
        height={height}
        onViewStateChange={(event) => {
          if (!onViewStateChange) return;
          const next = event.viewState as Partial<MapViewport>;
          onViewStateChange({
            longitude: next.longitude ?? currentViewState.longitude,
            latitude: next.latitude ?? currentViewState.latitude,
            zoom: next.zoom ?? currentViewState.zoom,
            pitch: next.pitch ?? currentViewState.pitch ?? 0,
            bearing: next.bearing ?? currentViewState.bearing ?? 0,
          });
        }}
      />
    </figure>
  );
}
