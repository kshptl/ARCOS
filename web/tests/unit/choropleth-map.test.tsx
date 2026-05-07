import { render, screen } from "@testing-library/react";
import type { FeatureCollection, Geometry } from "geojson";
import { describe, expect, it, vi } from "vitest";

vi.mock("@deck.gl/react", () => ({
  __esModule: true,
  default: (props: { layers: Array<{ props?: { id?: string } }>; viewState?: unknown }) => (
    <div
      data-testid="deck"
      data-layer-count={(props.layers ?? []).length}
      data-layer-ids={(props.layers ?? []).map((layer) => layer.props?.id ?? "").join(",")}
    />
  ),
  DeckGL: (props: { layers: Array<{ props?: { id?: string } }> }) => (
    <div
      data-testid="deck"
      data-layer-count={(props.layers ?? []).length}
      data-layer-ids={(props.layers ?? []).map((layer) => layer.props?.id ?? "").join(",")}
    />
  ),
}));

vi.mock("@deck.gl/layers", () => ({
  PolygonLayer: class PolygonLayer {
    props: unknown;
    constructor(props: unknown) {
      this.props = props;
    }
  },
}));

import { ChoroplethMap } from "@/components/map/ChoroplethMap";

const COUNTIES: FeatureCollection<Geometry, { name?: string }> = {
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
  ],
};

const STATES: FeatureCollection<Geometry, { name?: string }> = {
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
            [2, 0],
            [2, 2],
            [0, 0],
          ],
        ],
      },
      properties: { name: "WV" },
    },
  ],
};

describe("ChoroplethMap", () => {
  it("renders the state aggregate layer when county detail is not requested", () => {
    render(
      <ChoroplethMap
        counties={COUNTIES}
        states={STATES}
        valueByFips={new Map([["54059", 100]])}
        stateValueByFips={new Map([["54", 100]])}
        metric="pills_per_capita"
        domain={{ domainMin: 0, domainMax: 100 }}
        width={320}
        height={200}
        showCountyLayer={false}
      />,
    );
    const deck = screen.getByTestId("deck");
    expect(deck.getAttribute("data-layer-ids")).toBe("states-pills_per_capita");
  });

  it("renders county detail over state outlines when county detail is requested", () => {
    render(
      <ChoroplethMap
        counties={COUNTIES}
        states={STATES}
        valueByFips={new Map([["54059", 100]])}
        stateValueByFips={new Map([["54", 100]])}
        metric="pills_per_capita"
        domain={{ domainMin: 0, domainMax: 100 }}
        width={320}
        height={200}
        showCountyLayer={true}
      />,
    );
    const deck = screen.getByTestId("deck");
    expect(deck.getAttribute("data-layer-ids")).toBe(
      "states,counties-pills_per_capita,state-outlines",
    );
  });

  it("renders with aria-label describing metric and year", () => {
    render(
      <ChoroplethMap
        counties={COUNTIES}
        states={STATES}
        valueByFips={new Map()}
        metric="pills_per_capita"
        domain={{ domainMin: 0, domainMax: 100 }}
        width={320}
        height={200}
        year={2012}
        ariaLabel="County map of pills per capita, 2012"
      />,
    );
    expect(screen.getByRole("figure")).toHaveAttribute(
      "aria-label",
      "County map of pills per capita, 2012",
    );
  });
});
