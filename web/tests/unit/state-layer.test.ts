import type { FeatureCollection, Geometry } from "geojson";
import { describe, expect, it, vi } from "vitest";
import { buildStateLayerProps } from "@/components/map/layers/stateLayer";

const FC: FeatureCollection<Geometry, { name?: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "54",
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
      properties: { name: "West Virginia" },
    },
  ],
};

const MULTI_PART_FC: FeatureCollection<Geometry, { name?: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "02",
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
      properties: { name: "Alaska" },
    },
  ],
};

describe("stateLayer", () => {
  it("builds PolygonLayer props for states with ink stroke", () => {
    const props = buildStateLayerProps({ featureCollection: FC });
    expect(props.id).toBe("states");
    expect(props.filled).toBe(false);
    expect(props.stroked).toBe(true);
    expect(props.getLineColor).toEqual([26, 26, 26, 200]);
  });

  it("can fill and pick states when metric values and handlers are provided", () => {
    const onHover = vi.fn();
    const onClick = vi.fn();
    const props = buildStateLayerProps({
      featureCollection: FC,
      valueByStateFips: new Map([["54", 100]]),
      metric: "pills",
      domain: { domainMin: 0, domainMax: 100 },
      colorKey: "pills-2012",
      onHover,
      onClick,
    });

    expect(props.id).toBe("states-pills");
    expect(props.filled).toBe(true);
    expect(props.pickable).toBe(true);
    expect(props.getFillColor(FC.features[0]!)).not.toEqual([0, 0, 0, 0]);

    props.onHover?.({ object: FC.features[0] });
    props.onClick?.({ object: FC.features[0] });
    expect(onHover).toHaveBeenCalledWith({ object: FC.features[0] });
    expect(onClick).toHaveBeenCalledWith({ object: FC.features[0] });
  });

  it("keeps every polygon part for multi-part states", () => {
    const props = buildStateLayerProps({
      featureCollection: MULTI_PART_FC,
      valueByStateFips: new Map([["02", 100]]),
      metric: "pills",
      domain: { domainMin: 0, domainMax: 100 },
    });

    expect(props.data).toHaveLength(2);
    expect(props.data.map((feature) => feature.id)).toEqual(["02", "02"]);
    expect(props.data.map((feature) => props.getPolygon(feature))).toEqual(
      MULTI_PART_FC.features[0]!.geometry.type === "MultiPolygon"
        ? MULTI_PART_FC.features[0]!.geometry.coordinates
        : [],
    );
  });
});
