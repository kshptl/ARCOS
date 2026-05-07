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
    mapProps: [] as Array<{ initialViewState?: { zoom?: number }; viewState?: { zoom?: number } }>,
    topology,
    valuesByMetric,
  };
});

vi.mock("@/components/map/ChoroplethMap", () => ({
  ChoroplethMap: (props: {
    initialViewState?: { zoom?: number };
    viewState?: { zoom?: number };
    onCountyClick?: (fips: string, feature: Feature<Geometry, { name?: string }>) => void;
  }) => {
    mocks.mapProps.push(props);
    const zoom = props.viewState?.zoom ?? props.initialViewState?.zoom ?? 0;
    return (
      <button
        type="button"
        data-testid="mock-map"
        data-zoom={zoom}
        onClick={() => props.onCountyClick?.("54059", mocks.countyFeature)}
      >
        Map county
      </button>
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
    features: [],
  }),
}));

import { Explorer } from "@/components/explorer/Explorer";

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
});
