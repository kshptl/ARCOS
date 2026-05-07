import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MapMetric } from "@/components/map/layers/countyLayer";

const mocks = vi.hoisted(() => {
  const countyFeature: Feature<Geometry, { name?: string }> = {
    type: "Feature",
    id: "54059",
    properties: { name: "Mingo County" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-82, 37],
          [-81, 37],
          [-81, 38],
          [-82, 38],
          [-82, 37],
        ],
      ],
    },
  };

  const stateFeature: Feature<Geometry, { name?: string }> = {
    type: "Feature",
    id: "54",
    properties: { name: "West Virginia" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-83, 37],
          [-80, 37],
          [-80, 40],
          [-83, 40],
          [-83, 37],
        ],
      ],
    },
  };

  const topology: FeatureCollection<Geometry, { name?: string }> = {
    type: "FeatureCollection",
    features: [countyFeature],
  };

  const valuesByMetric: Record<MapMetric, Map<number, Map<string, number>>> = {
    pills: new Map([[2012, new Map([["54059", 2000]])]]),
    pills_per_capita: new Map([[2012, new Map([["54059", 7.5]])]]),
    deaths: new Map([[2012, new Map([["54059", 11]])]]),
  };

  return {
    countyFeature,
    mapProps: [] as Array<{
      focusedStateFips?: string | null;
      initialViewState?: { zoom?: number };
      showCountyLayer?: boolean;
      stateValueByFips?: Map<string, number>;
      viewState?: { zoom?: number };
    }>,
    stateFeature,
    topology,
    valuesByMetric,
  };
});

vi.mock("@/components/map/ChoroplethMap", () => ({
  ChoroplethMap: (props: {
    initialViewState?: { zoom?: number };
    focusedStateFips?: string | null;
    onCountyHover?: (
      fips: string | null,
      feature: Feature<Geometry, { name?: string }> | null,
      pos: { x: number; y: number },
    ) => void;
    viewState?: { zoom?: number };
    onCountyClick?: (fips: string, feature: Feature<Geometry, { name?: string }>) => void;
    onStateClick?: (fips: string, feature: Feature<Geometry, { name?: string }>) => void;
    onStateHover?: (
      fips: string | null,
      feature: Feature<Geometry, { name?: string }> | null,
      pos: { x: number; y: number },
    ) => void;
  }) => {
    mocks.mapProps.push(props);
    const zoom = props.viewState?.zoom ?? props.initialViewState?.zoom ?? 0;
    return (
      <div data-testid="mock-map-shell">
        <button
          type="button"
          data-testid="mock-map"
          data-zoom={zoom}
          onClick={() => props.onCountyClick?.("54059", mocks.countyFeature)}
          onMouseEnter={() => props.onCountyHover?.("54059", mocks.countyFeature, { x: 18, y: 24 })}
        >
          Map county
        </button>
        <button
          type="button"
          onClick={() => props.onStateClick?.("54", mocks.stateFeature)}
          onMouseEnter={() => props.onStateHover?.("54", mocks.stateFeature, { x: 28, y: 34 })}
        >
          Map state
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/map/useWebGLSupport", () => ({
  useWebGLSupport: () => true,
}));

vi.mock("@/components/explorer/DataLoader", async () => {
  const React = await import("react");
  return {
    DataLoader: ({
      metric = "pills",
      onData,
    }: {
      metric?: MapMetric;
      onData: (year: number, values: Map<string, number>) => void;
    }) => {
      React.useEffect(() => {
        const byYear = mocks.valuesByMetric[metric];
        for (const [year, values] of byYear) onData(year, values);
      }, [metric, onData]);
      return null;
    },
  };
});

vi.mock("@/lib/geo/topology", () => ({
  loadCountyTopology: vi.fn().mockResolvedValue(mocks.topology),
  loadStateTopology: vi.fn().mockResolvedValue({
    type: "FeatureCollection",
    features: [mocks.stateFeature],
  }),
}));

import { Explorer, interpolateMapViewState } from "@/components/explorer/Explorer";

async function flushExplorerEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Explorer interactions", () => {
  beforeEach(() => {
    mocks.mapProps.length = 0;
    window.history.replaceState(null, "", "/explorer");
  });

  it("computes in-between map views for smooth zoom animations", () => {
    const start = { longitude: -98, latitude: 39, zoom: 3.2, pitch: 0, bearing: 0 };
    const target = { longitude: -82, latitude: 38, zoom: 6.5, pitch: 0, bearing: 0 };

    const middle = interpolateMapViewState(start, target, 0.5);

    expect(middle.longitude).toBeGreaterThan(start.longitude);
    expect(middle.longitude).toBeLessThan(target.longitude);
    expect(middle.zoom).toBeGreaterThan(start.zoom);
    expect(middle.zoom).toBeLessThan(target.zoom);
    expect(interpolateMapViewState(start, target, 1)).toEqual(target);
  });

  it("keeps real values after switching metrics", async () => {
    const user = userEvent.setup();
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    const details = screen.getByRole("complementary", { name: "Selected county details" });
    await waitFor(() => expect(within(details).getByText("7.5")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Pills shipped" }));

    await waitFor(() => expect(within(details).getByText("2,000")).toBeInTheDocument());
    expect(within(details).queryByText(/^0(?:\.0)?$/)).not.toBeInTheDocument();
  });

  it("zooms the map toward a county when that county is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    const map = await screen.findByTestId("mock-map");
    const beforeZoom = Number(map.dataset.zoom);

    await user.click(map);

    await waitFor(() => {
      const latest = mocks.mapProps.at(-1);
      const nextZoom = latest?.viewState?.zoom ?? latest?.initialViewState?.zoom ?? 0;
      expect(nextZoom).toBeGreaterThan(beforeZoom);
    });
  });

  it("removes the large explainer heading from the explorer workspace", async () => {
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    expect(screen.getByRole("region", { name: "Explorer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Explorer" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /US counties/i })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Shipments, per-capita rates, and overdose deaths/i),
    ).not.toBeInTheDocument();
  });

  it("uses county search autocomplete without showing the full browse list", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Explorer
        counties={[
          { fips: "54059", name: "Mingo County", state: "WV", pop: 26000 },
          { fips: "01001", name: "Autauga County", state: "AL", pop: 54954 },
        ]}
      />,
    );
    await flushExplorerEffects();

    expect(
      screen.queryByRole("complementary", { name: "Browse counties" }),
    ).not.toBeInTheDocument();

    const input = screen.getByLabelText("Search counties");
    await user.type(input, "Mingo");

    const options = Array.from(container.querySelectorAll("datalist option")).map((option) =>
      option.getAttribute("value"),
    );
    expect(options).toContain("Mingo County, WV");
    expect(options).not.toContain("Autauga County, AL");

    await user.clear(input);
    await user.type(input, "Mingo County, WV");

    await waitFor(() => {
      const latest = mocks.mapProps.at(-1);
      const nextZoom = latest?.viewState?.zoom ?? latest?.initialViewState?.zoom ?? 0;
      expect(nextZoom).toBeGreaterThan(3.2);
    });
  });

  it("zooms to a state click and switches the map into county detail", async () => {
    const user = userEvent.setup();
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    const beforeZoom = mocks.mapProps.at(-1)?.initialViewState?.zoom ?? 0;
    await user.click(screen.getByRole("button", { name: "Map state" }));

    await waitFor(() => {
      const latest = mocks.mapProps.at(-1);
      const nextZoom = latest?.viewState?.zoom ?? latest?.initialViewState?.zoom ?? 0;
      expect(nextZoom).toBeGreaterThan(beforeZoom);
      expect(latest?.focusedStateFips).toBe("54");
      expect(latest?.showCountyLayer).toBe(true);
      expect(latest?.stateValueByFips?.get("54")).toBe(7.5);
    });
  });

  it("shows stats when hovering over a state or county", async () => {
    const user = userEvent.setup();
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    await user.hover(screen.getByRole("button", { name: "Map state" }));
    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveTextContent("West Virginia");
      expect(tooltip).toHaveTextContent("7.5");
    });

    await user.hover(screen.getByRole("button", { name: "Map county" }));
    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveTextContent("Mingo County, WV");
      expect(tooltip).toHaveTextContent("7.5");
    });
  });
});
