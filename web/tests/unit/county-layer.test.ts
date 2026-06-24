import type { FeatureCollection, Geometry } from "geojson";
import { describe, expect, it } from "vitest";
import { buildCountyLayerProps } from "@/components/map/layers/countyLayer";

const FC: FeatureCollection<Geometry, { name?: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "54059",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
      properties: { name: "Mingo" },
    },
    {
      type: "Feature",
      id: "54047",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [1, 1],
            [2, 1],
            [2, 2],
            [1, 1],
          ],
        ],
      },
      properties: { name: "McDowell" },
    },
  ],
};

const MULTI_PART_FC: FeatureCollection<Geometry, { name?: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "06037",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
          [
            [
              [2, 2],
              [3, 2],
              [3, 3],
              [2, 2],
            ],
          ],
        ],
      },
      properties: { name: "Los Angeles" },
    },
  ],
};

describe("countyLayer", () => {
  it("builds PolygonLayer props with getFillColor callback", () => {
    const data = new Map<string, number>([
      ["54059", 100],
      ["54047", 50],
    ]);
    const props = buildCountyLayerProps({
      featureCollection: FC,
      valueByFips: data,
      metric: "pills_per_capita",
      domain: { domainMin: 0, domainMax: 100 },
    });
    expect(props.id).toBe("counties-pills_per_capita");
    expect(props.data).toBe(FC.features);
    expect(typeof props.getFillColor).toBe("function");
    const c = (props.getFillColor as (f: (typeof FC.features)[number]) => number[])(
      FC.features[0]!,
    );
    expect(c).toHaveLength(4);
  });

  it("getFillColor returns null color for missing fips", () => {
    const props = buildCountyLayerProps({
      featureCollection: FC,
      valueByFips: new Map(),
      metric: "pills_per_capita",
      domain: { domainMin: 0, domainMax: 100 },
    });
    const c = (props.getFillColor as (f: (typeof FC.features)[number]) => number[])(
      FC.features[0]!,
    );
    expect(c.slice(0, 3)).toEqual([222, 214, 200]);
  });

  it("normalizes numeric topology ids before looking up county values", () => {
    const props = buildCountyLayerProps({
      featureCollection: {
        ...FC,
        features: [{ ...FC.features[0]!, id: 1001 }],
      },
      valueByFips: new Map([["01001", 100]]),
      metric: "pills_per_capita",
      domain: { domainMin: 0, domainMax: 100 },
    });

    const c = props.getFillColor(props.data[0]!);
    expect(c.slice(0, 3)).not.toEqual([222, 214, 200]);
  });

  it("switches color scale when metric is deaths per 100k", () => {
    const data = new Map<string, number>([["54059", 9]]);
    const props = buildCountyLayerProps({
      featureCollection: FC,
      valueByFips: data,
      metric: "deaths_per_100k",
      domain: { domainMin: 0, domainMax: 10 },
    });
    const c = (props.getFillColor as (f: (typeof FC.features)[number]) => number[])(
      FC.features[0]!,
    );
    expect(c[0]!).toBeGreaterThan(c[2]!);
  });

  it("draws county boundaries strongly enough to be visible at national zoom", () => {
    const props = buildCountyLayerProps({
      featureCollection: FC,
      valueByFips: new Map([["54059", 100]]),
      metric: "pills_per_capita",
      domain: { domainMin: 0, domainMax: 200 },
    });

    expect(props.getLineColor).toEqual([255, 255, 255, 185]);
    expect(props.lineWidthMinPixels).toBeGreaterThanOrEqual(0.95);
  });

  it("keeps every polygon part for multi-part counties", () => {
    const props = buildCountyLayerProps({
      featureCollection: MULTI_PART_FC,
      valueByFips: new Map([["06037", 100]]),
      metric: "pills_per_capita",
      domain: { domainMin: 0, domainMax: 100 },
    });

    expect(props.data).toHaveLength(2);
    expect(props.data.map((feature) => feature.id)).toEqual(["06037", "06037"]);
    expect(props.data.map((feature) => props.getPolygon(feature))).toEqual(
      MULTI_PART_FC.features[0]!.geometry.type === "MultiPolygon"
        ? MULTI_PART_FC.features[0]!.geometry.coordinates
        : [],
    );
    expect(props.getFillColor(props.data[0]!)).toEqual(props.getFillColor(props.data[1]!));
  });
});
