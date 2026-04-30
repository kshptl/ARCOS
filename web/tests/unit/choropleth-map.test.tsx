import { render, screen } from "@testing-library/react";
import type { FeatureCollection, Geometry } from "geojson";
import { describe, expect, it, vi } from "vitest";

vi.mock("@deck.gl/react", () => ({
  __esModule: true,
  default: (props: { layers: unknown[]; viewState?: unknown }) => (
    <div data-testid="deck" data-layer-count={(props.layers ?? []).length} />
  ),
  DeckGL: (props: { layers: unknown[] }) => (
    <div data-testid="deck" data-layer-count={(props.layers ?? []).length} />
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
  it("renders two layers (county + state) when both topologies provided", () => {
    render(
      <ChoroplethMap
        counties={COUNTIES}
        states={STATES}
        valueByFips={new Map([["54059", 100]])}
        metric="pills"
        domain={{ domainMin: 0, domainMax: 100 }}
        width={320}
        height={200}
      />,
    );
    const deck = screen.getByTestId("deck");
    expect(deck.getAttribute("data-layer-count")).toBe("2");
  });

  it("renders with aria-label describing metric and year", () => {
    render(
      <ChoroplethMap
        counties={COUNTIES}
        states={STATES}
        valueByFips={new Map()}
        metric="pills"
        domain={{ domainMin: 0, domainMax: 100 }}
        width={320}
        height={200}
        year={2012}
        ariaLabel="County map of pills shipped, 2012"
      />,
    );
    expect(screen.getByRole("figure")).toHaveAttribute(
      "aria-label",
      "County map of pills shipped, 2012",
    );
  });
});
