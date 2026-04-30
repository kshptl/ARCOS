import { describe, expect, it } from 'vitest';
import type { FeatureCollection, Geometry } from 'geojson';
import { buildCountyLayerProps } from '@/components/map/layers/countyLayer';

const FC: FeatureCollection<Geometry, { name?: string }> = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: '54059', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, properties: { name: 'Mingo' } },
    { type: 'Feature', id: '54047', geometry: { type: 'Polygon', coordinates: [[[1, 1], [2, 1], [2, 2], [1, 1]]] }, properties: { name: 'McDowell' } },
  ],
};

describe('countyLayer', () => {
  it('builds PolygonLayer props with getFillColor callback', () => {
    const data = new Map<string, number>([['54059', 100], ['54047', 50]]);
    const props = buildCountyLayerProps({
      featureCollection: FC,
      valueByFips: data,
      metric: 'pills',
      domain: { domainMin: 0, domainMax: 100 },
    });
    expect(props.id).toBe('counties-pills');
    expect(props.data).toBe(FC.features);
    expect(typeof props.getFillColor).toBe('function');
    const c = (props.getFillColor as (f: (typeof FC.features)[number]) => number[])(FC.features[0]!);
    expect(c).toHaveLength(4);
  });

  it('getFillColor returns null color for missing fips', () => {
    const props = buildCountyLayerProps({
      featureCollection: FC,
      valueByFips: new Map(),
      metric: 'pills',
      domain: { domainMin: 0, domainMax: 100 },
    });
    const c = (props.getFillColor as (f: (typeof FC.features)[number]) => number[])(FC.features[0]!);
    expect(c[0]).toEqual(c[1]);
  });

  it('switches color scale when metric is deaths', () => {
    const data = new Map<string, number>([['54059', 9]]);
    const props = buildCountyLayerProps({
      featureCollection: FC,
      valueByFips: data,
      metric: 'deaths',
      domain: { domainMin: 0, domainMax: 10 },
    });
    const c = (props.getFillColor as (f: (typeof FC.features)[number]) => number[])(FC.features[0]!);
    expect(c[0]).toBeLessThan(c[2]);
  });
});
