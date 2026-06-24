import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { RGBA, ScaleDomain } from "../colorScales";
import { deathsColorScale, pillsColorScale } from "../colorScales";
import type { MapMetric, PolygonLayerProps } from "./countyLayer";

export interface BuildStateLayerPropsArgs {
  id?: string;
  featureCollection: FeatureCollection<Geometry, { name?: string }>;
  valueByStateFips?: Map<string, number>;
  metric?: MapMetric;
  domain?: ScaleDomain;
  colorKey?: string | number;
  onHover?: (info: { object?: Feature | null; x?: number; y?: number }) => void;
  onClick?: (info: { object?: Feature | null; x?: number; y?: number }) => void;
}

function polygonAccessor(f: Feature): number[][][] | number[][] {
  const g = f.geometry;
  if (g.type === "Polygon") return g.coordinates;
  if (g.type === "MultiPolygon") return g.coordinates[0] ?? [];
  return [];
}

function stateFeaturesForLayer(
  featureCollection: FeatureCollection<Geometry, { name?: string }>,
): Feature<Geometry, { name?: string }>[] {
  return featureCollection.features.flatMap((feature) => {
    if (feature.geometry.type !== "MultiPolygon") return [feature];

    // Deck's PolygonLayer draws one polygon per row, so each island or
    // detached state piece gets its own row while keeping the same state id.
    return feature.geometry.coordinates.map((coordinates) => ({
      ...feature,
      geometry: {
        type: "Polygon" as const,
        coordinates,
      },
    }));
  });
}

function scaleFor(metric: MapMetric): (v: number | null | undefined, d: ScaleDomain) => RGBA {
  return metric === "deaths_per_100k" ? deathsColorScale : pillsColorScale;
}

export function buildStateLayerProps(args: BuildStateLayerPropsArgs): PolygonLayerProps {
  const hasValues = Boolean(args.valueByStateFips && args.metric && args.domain);
  const pickable = Boolean(args.onHover || args.onClick);
  const metric = args.metric ?? "pills_per_capita";
  const domain = args.domain ?? { domainMin: 0, domainMax: 1 };
  const colorFn = scaleFor(metric);

  return {
    id: args.id ?? (hasValues ? `states-${metric}` : "states"),
    data: stateFeaturesForLayer(args.featureCollection),
    pickable,
    stroked: true,
    filled: hasValues || pickable,
    extruded: false,
    getPolygon: polygonAccessor,
    getFillColor: (f) => {
      if (!hasValues) return [0, 0, 0, 0];
      const id = String(f.id ?? "").padStart(2, "0");
      return colorFn(args.valueByStateFips?.get(id) ?? null, domain);
    },
    getLineColor: [0, 0, 0, 235],
    getLineWidth: 1.2,
    lineWidthMinPixels: 0.9,
    onHover: args.onHover,
    onClick: args.onClick,
    updateTriggers: {
      getFillColor: [metric, domain.domainMin, domain.domainMax, args.colorKey ?? ""],
    },
  };
}
