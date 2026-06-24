import { render, screen } from "@testing-library/react";
import type { FeatureCollection, Geometry } from "geojson";
import { describe, expect, it, vi } from "vitest";

vi.mock("@deck.gl/react", () => ({
  __esModule: true,
  default: (props: {
    layers: Array<{
      props?: {
        data?: unknown[];
        id?: string;
        onClick?: unknown;
        onHover?: unknown;
      };
    }>;
    viewState?: unknown;
  }) => (
    <div
      data-testid="deck"
      data-layer-count={(props.layers ?? []).length}
      data-layer-ids={(props.layers ?? []).map((layer) => layer.props?.id ?? "").join(",")}
      data-layer-sizes={(props.layers ?? [])
        .map((layer) => `${layer.props?.id ?? ""}:${layer.props?.data?.length ?? 0}`)
        .join(",")}
      data-layer-hover-enabled={(props.layers ?? [])
        .map((layer) => `${layer.props?.id ?? ""}:${Boolean(layer.props?.onHover)}`)
        .join(",")}
      data-layer-click-enabled={(props.layers ?? [])
        .map((layer) => `${layer.props?.id ?? ""}:${Boolean(layer.props?.onClick)}`)
        .join(",")}
    />
  ),
  DeckGL: (props: {
    layers: Array<{
      props?: {
        data?: unknown[];
        id?: string;
        onClick?: unknown;
        onHover?: unknown;
      };
    }>;
  }) => (
    <div
      data-testid="deck"
      data-layer-count={(props.layers ?? []).length}
      data-layer-ids={(props.layers ?? []).map((layer) => layer.props?.id ?? "").join(",")}
      data-layer-sizes={(props.layers ?? [])
        .map((layer) => `${layer.props?.id ?? ""}:${layer.props?.data?.length ?? 0}`)
        .join(",")}
      data-layer-hover-enabled={(props.layers ?? [])
        .map((layer) => `${layer.props?.id ?? ""}:${Boolean(layer.props?.onHover)}`)
        .join(",")}
      data-layer-click-enabled={(props.layers ?? [])
        .map((layer) => `${layer.props?.id ?? ""}:${Boolean(layer.props?.onClick)}`)
        .join(",")}
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
  TextLayer: class TextLayer {
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
    {
      type: "Feature",
      id: "01001",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [2, 2],
            [3, 2],
            [3, 3],
            [2, 2],
          ],
        ],
      },
      properties: { name: "Autauga" },
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

  it("keeps every county hoverable when the map is focused on one state", () => {
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
        focusedStateFips="54"
        showCountyLayer={true}
      />,
    );
    const deck = screen.getByTestId("deck");
    expect(deck.getAttribute("data-layer-sizes")).toContain("counties-pills_per_capita:2");
  });

  it("keeps state clicks but hides state hover tooltips while county detail is visible", () => {
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
        onCountyHover={vi.fn()}
        onStateHover={vi.fn()}
        onStateClick={vi.fn()}
      />,
    );
    const deck = screen.getByTestId("deck");
    expect(deck.getAttribute("data-layer-hover-enabled")).toContain("states:false");
    expect(deck.getAttribute("data-layer-hover-enabled")).toContain(
      "counties-pills_per_capita:true",
    );
    expect(deck.getAttribute("data-layer-click-enabled")).toContain("states:true");
  });

  it("renders city labels only after the user zooms in", () => {
    const { rerender } = render(
      <ChoroplethMap
        counties={COUNTIES}
        states={STATES}
        valueByFips={new Map([["54059", 100]])}
        stateValueByFips={new Map([["54", 100]])}
        metric="pills_per_capita"
        domain={{ domainMin: 0, domainMax: 100 }}
        width={320}
        height={200}
        viewState={{ longitude: -98, latitude: 39, zoom: 3.2, pitch: 0, bearing: 0 }}
        showCountyLayer={true}
      />,
    );
    expect(screen.getByTestId("deck").getAttribute("data-layer-ids")).not.toContain("city-labels");

    rerender(
      <ChoroplethMap
        counties={COUNTIES}
        states={STATES}
        valueByFips={new Map([["54059", 100]])}
        stateValueByFips={new Map([["54", 100]])}
        metric="pills_per_capita"
        domain={{ domainMin: 0, domainMax: 100 }}
        width={320}
        height={200}
        viewState={{ longitude: -98, latitude: 39, zoom: 5.1, pitch: 0, bearing: 0 }}
        showCountyLayer={true}
      />,
    );
    expect(screen.getByTestId("deck").getAttribute("data-layer-ids")).toContain("city-labels");
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
