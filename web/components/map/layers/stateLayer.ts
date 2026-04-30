import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { PolygonLayerProps } from "./countyLayer";

export interface BuildStateLayerPropsArgs {
  featureCollection: FeatureCollection<Geometry, { name?: string }>;
}

export function buildStateLayerProps(args: BuildStateLayerPropsArgs): PolygonLayerProps {
  return {
    id: "states",
    data: args.featureCollection.features,
    pickable: false,
    stroked: true,
    filled: false,
    extruded: false,
    getPolygon: (f: Feature) => {
      const g = f.geometry;
      if (g.type === "Polygon") return g.coordinates;
      if (g.type === "MultiPolygon") return g.coordinates[0]!;
      return [];
    },
    getFillColor: () => [0, 0, 0, 0],
    getLineColor: [26, 26, 26, 200],
    getLineWidth: 1.2,
    lineWidthMinPixels: 1,
    updateTriggers: { getFillColor: [] },
  };
}
