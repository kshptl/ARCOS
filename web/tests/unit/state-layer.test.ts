import { describe, expect, it } from 'vitest';
import type { FeatureCollection, Geometry } from 'geojson';
import { buildStateLayerProps } from '@/components/map/layers/stateLayer';

const FC: FeatureCollection<Geometry, { name?: string }> = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: '54', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, properties: { name: 'West Virginia' } },
  ],
};

describe('stateLayer', () => {
  it('builds PolygonLayer props for states with ink stroke', () => {
    const props = buildStateLayerProps({ featureCollection: FC });
    expect(props.id).toBe('states');
    expect(props.filled).toBe(false);
    expect(props.stroked).toBe(true);
    expect(props.getLineColor).toEqual([26, 26, 26, 200]);
  });
});
