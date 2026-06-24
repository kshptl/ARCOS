import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { RGBA, ScaleDomain } from "../colorScales";
import { deathsColorScale, pillsColorScale } from "../colorScales";

export type MapMetric = "pills_per_capita" | "deaths_per_100k" | "mme_per_capita";

// Stable, module-level polygon accessor. Geometry never changes once loaded,
// so this function must keep a fixed identity across renders — otherwise
// Deck.gl detects a new accessor and re-uploads the full polygon buffer to
// the GPU on every year-slider tick (~3100 counties × hundreds of vertices).
function polygonAccessor(f: Feature): number[][][] | number[][] {
  const g = f.geometry;
  if (g.type === "Polygon") return g.coordinates;
  if (g.type === "MultiPolygon") return g.coordinates[0] ?? [];
  return [];
}

function countyFeaturesForLayer(
  featureCollection: FeatureCollection<Geometry, { name?: string }>,
): Feature<Geometry, { name?: string }>[] {
  const hasMultiPartCounty = featureCollection.features.some(
    (feature) => feature.geometry.type === "MultiPolygon",
  );
  if (!hasMultiPartCounty) return featureCollection.features;

  // Deck's PolygonLayer draws one polygon per data row. Split counties with
  // islands into separate rows so the mainland and each island stay visible
  // and clickable while keeping the same county id.
  return featureCollection.features.flatMap((feature) => {
    if (feature.geometry.type !== "MultiPolygon") return [feature];

    return feature.geometry.coordinates.map((coordinates) => ({
      ...feature,
      geometry: {
        type: "Polygon" as const,
        coordinates,
      },
    }));
  });
}

export interface BuildCountyLayerPropsArgs {
  featureCollection: FeatureCollection<Geometry, { name?: string }>;
  valueByFips: Map<string, number>;
  metric: MapMetric;
  domain: ScaleDomain;
  /**
   * Primitive key that identifies the current value slice (e.g. `${metric}-${year}`).
   * Used as the updateTrigger for getFillColor so Deck.gl only re-runs the
   * color accessor when the underlying values actually change, not on every
   * Map reference churn from the parent.
   */
  colorKey?: string | number;
  onHover?: (info: { object?: Feature | null; x?: number; y?: number }) => void;
  onClick?: (info: { object?: Feature | null; x?: number; y?: number }) => void;
}

export interface PolygonLayerProps {
  id: string;
  data: Feature[];
  pickable: boolean;
  stroked: boolean;
  filled: boolean;
  extruded: boolean;
  getPolygon: (f: Feature) => number[][][] | number[][];
  getFillColor: (f: Feature) => number[];
  getLineColor: number[];
  getLineWidth: number;
  lineWidthMinPixels: number;
  onHover?: (info: { object?: Feature | null; x?: number; y?: number }) => void;
  onClick?: (info: { object?: Feature | null; x?: number; y?: number }) => void;
  updateTriggers: { getFillColor: unknown[] };
}

function scaleFor(metric: MapMetric): (v: number | null | undefined, d: ScaleDomain) => RGBA {
  return metric === "deaths_per_100k" ? deathsColorScale : pillsColorScale;
}

export function buildCountyLayerProps(args: BuildCountyLayerPropsArgs): PolygonLayerProps {
  const { featureCollection, valueByFips, metric, domain, colorKey, onHover, onClick } = args;
  const colorFn = scaleFor(metric);

  // Only enable picking when a consumer actually listens for hover/click.
  // Deck.gl picking performs a synchronous gl.readPixels on every mouse
  // move/tap (the "GPU stall due to ReadPixels" warning) — disabling it
  // by default removes that cost entirely for the common case where no
  // tooltip is wired up.
  const pickable = Boolean(onHover || onClick);

  return {
    id: `counties-${metric}`,
    data: countyFeaturesForLayer(featureCollection),
    pickable,
    stroked: true,
    filled: true,
    extruded: false,
    getPolygon: polygonAccessor,
    getFillColor: (f) => {
      const id = String(f.id ?? "").padStart(5, "0");
      const val = valueByFips.get(id);
      return colorFn(val ?? null, domain);
    },
    getLineColor: [255, 255, 255, 185],
    getLineWidth: 0.9,
    lineWidthMinPixels: 1,
    onHover,
    onClick,
    updateTriggers: {
      // Primitive keys only — Deck.gl shallow-compares this array.
      // Passing a Map reference here would invalidate on every parent
      // render even when the data has not actually changed.
      getFillColor: [metric, domain.domainMin, domain.domainMax, colorKey ?? ""],
    },
  };
}
