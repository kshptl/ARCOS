import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { RGBA, ScaleDomain } from '../colorScales';
import { deathsColorScale, pillsColorScale } from '../colorScales';

export type MapMetric = 'pills' | 'pills_per_capita' | 'deaths';

export interface BuildCountyLayerPropsArgs {
  featureCollection: FeatureCollection<Geometry, { name?: string }>;
  valueByFips: Map<string, number>;
  metric: MapMetric;
  domain: ScaleDomain;
  onHover?: (info: { object?: Feature | null }) => void;
  onClick?: (info: { object?: Feature | null }) => void;
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
  onHover?: (info: { object?: Feature | null }) => void;
  onClick?: (info: { object?: Feature | null }) => void;
  updateTriggers: { getFillColor: unknown[] };
}

function scaleFor(metric: MapMetric): (v: number | null | undefined, d: ScaleDomain) => RGBA {
  return metric === 'deaths' ? deathsColorScale : pillsColorScale;
}

export function buildCountyLayerProps(args: BuildCountyLayerPropsArgs): PolygonLayerProps {
  const { featureCollection, valueByFips, metric, domain } = args;
  const colorFn = scaleFor(metric);

  return {
    id: `counties-${metric}`,
    data: featureCollection.features,
    pickable: true,
    stroked: true,
    filled: true,
    extruded: false,
    getPolygon: (f) => {
      const g = f.geometry;
      if (g.type === 'Polygon') return g.coordinates;
      if (g.type === 'MultiPolygon') return g.coordinates[0]!;
      return [];
    },
    getFillColor: (f) => {
      const id = String(f.id ?? '');
      const val = valueByFips.get(id);
      return colorFn(val ?? null, domain);
    },
    getLineColor: [26, 26, 26, 40],
    getLineWidth: 1,
    lineWidthMinPixels: 0.5,
    onHover: args.onHover,
    onClick: args.onClick,
    updateTriggers: {
      getFillColor: [metric, domain.domainMin, domain.domainMax, valueByFips],
    },
  };
}
