import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    pills_per_capita: new Map([[2012, new Map([["54059", 7.5]])]]),
    deaths_per_100k: new Map([[2012, new Map([["54059", 55.2]])]]),
    mme_per_capita: new Map([[2012, new Map([["54059", 200.4]])]]),
  };

  const stateValuesByMetric: Record<MapMetric, Map<number, Map<string, number>>> = {
    pills_per_capita: new Map(),
    deaths_per_100k: new Map(),
    mme_per_capita: new Map([[2024, new Map([["54", 222.4]])]]),
  };

  return {
    countyFeature,
    mapProps: [] as Array<{
      ariaLabel?: string;
      focusedStateFips?: string | null;
      initialViewState?: { zoom?: number };
      showCountyLayer?: boolean;
      stateValueByFips?: Map<string, number>;
      viewState?: { zoom?: number };
    }>,
    stateFeature,
    stateValuesByMetric,
    topology,
    valuesByMetric,
  };
});

vi.mock("@/components/map/ChoroplethMap", () => ({
  ChoroplethMap: (props: {
    ariaLabel?: string;
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
      metric = "pills_per_capita",
      onData,
      onStateData,
    }: {
      metric?: MapMetric;
      onData: (year: number, values: Map<string, number>) => void;
      onStateData?: (year: number, values: Map<string, number>) => void;
    }) => {
      React.useEffect(() => {
        const byYear = mocks.valuesByMetric[metric];
        for (const [year, values] of byYear) onData(year, values);
        const stateByYear = mocks.stateValuesByMetric[metric];
        for (const [year, values] of stateByYear) onStateData?.(year, values);
      }, [metric, onData, onStateData]);
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

import {
  buildSparklinePoints,
  centerViewStateInOpenArea,
  computeOpenMapOffset,
  Explorer,
  interpolateMapViewState,
} from "@/components/explorer/Explorer";

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
    let frameTime = 1000;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const id = window.setTimeout(() => {
        frameTime += 1000;
        callback(frameTime);
      }, 0);
      return Number(id);
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      window.clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("moves a target map center toward the open space between floating panels", () => {
    const offset = computeOpenMapOffset(
      { left: 0, top: 0, right: 1440, bottom: 839, width: 1440, height: 839 },
      {
        leftPanel: { left: 12, top: 222, right: 160, bottom: 408, width: 148, height: 186 },
        topBar: { left: 12, top: 73, right: 1128, bottom: 184, width: 1116, height: 111 },
        rightPanel: { left: 1140, top: 73, right: 1428, bottom: 888, width: 288, height: 815 },
        bottomBar: { left: 12, top: 815, right: 1128, bottom: 888, width: 1116, height: 73 },
      },
      12,
    );

    expect(offset.x).toBeLessThan(0);
    expect(offset.y).toBeGreaterThan(0);

    const centered = centerViewStateInOpenArea(
      { longitude: -98, latitude: 39, zoom: 3.2, pitch: 0, bearing: 0 },
      offset,
    );

    expect(centered.longitude).toBeGreaterThan(-98);
    expect(centered.latitude).toBeGreaterThan(39);
  });

  it("aligns sparkline endpoints with the first and last year labels", () => {
    const points = buildSparklinePoints([
      { year: 2006, value: 10 },
      { year: 2010, value: 20 },
      { year: 2014, value: 15 },
    ])
      .split(" ")
      .map((point) => point.split(",").map(Number));

    expect(points[0]?.[0]).toBe(0);
    expect(points[1]?.[0]).toBe(110);
    expect(points[2]?.[0]).toBe(220);
  });

  it("moves MME URLs on unsupported years to the latest source-backed MME year", async () => {
    window.history.replaceState(null, "", "/explorer?year=2014&metric=mme_per_capita");
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    await waitFor(() =>
      expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "2024"),
    );
    expect(new URLSearchParams(window.location.search).get("metric")).toBe("mme_per_capita");
    expect(new URLSearchParams(window.location.search).get("year")).not.toBe("2014");
  });

  it("limits the MME trend to source-backed years", async () => {
    const user = userEvent.setup();
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    await user.click(screen.getByRole("button", { name: "MME per capita" }));

    const trend = await screen.findByRole("region", { name: "MME per capita trend" });
    expect(trend).toHaveTextContent("2006-2012");
    expect(within(trend).queryByText("2014")).not.toBeInTheDocument();
  });

  it("keeps real values after switching metrics", async () => {
    const user = userEvent.setup();
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    const details = screen.getByRole("complementary", { name: "Selected county details" });
    await waitFor(() => expect(within(details).getByText("7.5")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Overdose deaths per 100k" }));

    await waitFor(() => expect(within(details).getByText("55.2")).toBeInTheDocument());
    expect(within(details).queryByText(/^0(?:\.0)?$/)).not.toBeInTheDocument();
  });

  it("does not repeat metric unit text below the selected county value", async () => {
    const user = userEvent.setup();
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    const details = screen.getByRole("complementary", { name: "Selected county details" });
    await waitFor(() => expect(within(details).getByText("7.5")).toBeInTheDocument());
    expect(within(details).queryByText("pills per person")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Overdose deaths per 100k" }));
    await waitFor(() => expect(within(details).getByText("55.2")).toBeInTheDocument());
    expect(within(details).queryByText("deaths per 100,000 people")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "MME per capita" }));
    await waitFor(() => expect(within(details).getByText("200.4")).toBeInTheDocument());
    expect(within(details).queryByText("MME per person")).not.toBeInTheDocument();
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

  it("keeps the year slider outside the top controls as its own map overlay", async () => {
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    const controls = screen.getByRole("region", { name: "Explorer controls" });
    const yearOverlay = screen.getByRole("region", { name: "Year slider" });
    const slider = screen.getByRole("slider");

    expect(within(controls).queryByRole("slider")).not.toBeInTheDocument();
    expect(yearOverlay).toContainElement(slider);
  });

  it("removes the FIPS block from the selected county details", async () => {
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    const details = screen.getByRole("complementary", { name: "Selected county details" });
    await waitFor(() => expect(within(details).getByText("7.5")).toBeInTheDocument());
    expect(within(details).queryByText("FIPS")).not.toBeInTheDocument();
    expect(within(details).queryByText("54059")).not.toBeInTheDocument();
  });

  it("uses an exclamation mark for the highest county summary icon", async () => {
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    const summary = screen.getByRole("region", { name: "Explorer summary" });
    expect(within(summary).getByText("!")).toBeInTheDocument();
    expect(within(summary).queryByText("☆")).not.toBeInTheDocument();
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

  it("keeps county geometry visible from the outer zoom", async () => {
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    await waitFor(() => {
      const latest = mocks.mapProps.at(-1);
      expect(latest?.focusedStateFips).toBeNull();
      expect(latest?.showCountyLayer).toBe(true);
    });
  });

  it("renders post-2014 MME as a state-only map layer", async () => {
    window.history.replaceState(null, "", "/explorer?year=2024&metric=mme_per_capita");
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    await waitFor(() => {
      const latest = mocks.mapProps.at(-1);
      expect(latest?.showCountyLayer).toBe(false);
      expect(latest?.stateValueByFips?.get("54")).toBe(222.4);
    });
    expect(screen.getByText("Highest state (2024)")).toBeInTheDocument();
    expect(screen.getByText("Selected state (2024)")).toBeInTheDocument();
    expect(screen.getByLabelText("State map panel")).toBeInTheDocument();
    expect(mocks.mapProps.at(-1)?.ariaLabel).toBe("State map of MME per capita, 2024");
  });

  it("uses fixed legend intervals without unit parentheticals", async () => {
    const user = userEvent.setup();
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    const pillsLegend = await screen.findByRole("complementary", {
      name: "Pills per capita legend",
    });
    expect(pillsLegend).toHaveTextContent("> 200");
    expect(pillsLegend).toHaveTextContent("100 - 200");
    expect(pillsLegend).toHaveTextContent("< 20");
    expect(pillsLegend).not.toHaveTextContent("(pills per person)");

    await user.click(screen.getByRole("button", { name: "Overdose deaths per 100k" }));
    const deathsLegend = await screen.findByRole("complementary", {
      name: "Overdose deaths per 100k legend",
    });
    expect(deathsLegend).toHaveTextContent("> 100");
    expect(deathsLegend).toHaveTextContent("50 - 100");
    expect(deathsLegend).toHaveTextContent("< 10");
    expect(deathsLegend).not.toHaveTextContent("(deaths per 100,000 people)");

    await user.click(screen.getByRole("button", { name: "MME per capita" }));
    const mmeLegend = await screen.findByRole("complementary", {
      name: "MME per capita legend",
    });
    expect(mmeLegend).toHaveTextContent("> 1,000");
    expect(mmeLegend).toHaveTextContent("500 - 1,000");
    expect(mmeLegend).toHaveTextContent("< 100");
    expect(mmeLegend).not.toHaveTextContent("(MME per person)");
  });

  it("shows stats when hovering over a state or county", async () => {
    const user = userEvent.setup();
    render(
      <Explorer counties={[{ fips: "54059", name: "Mingo County", state: "WV", pop: 26000 }]} />,
    );
    await flushExplorerEffects();

    await user.hover(screen.getByRole("button", { name: "Map state" }));
    await waitFor(() => {
      const tooltip = screen
        .getAllByRole("tooltip")
        .find((node) => node.textContent?.includes("West Virginia"));
      expect(tooltip).toBeTruthy();
      expect(tooltip).toHaveTextContent("West Virginia");
      expect(tooltip).toHaveTextContent("7.5");
    });

    await user.hover(screen.getByRole("button", { name: "Map county" }));
    await waitFor(() => {
      const tooltip = screen
        .getAllByRole("tooltip")
        .find((node) => node.textContent?.includes("Mingo County, WV"));
      expect(tooltip).toBeTruthy();
      expect(tooltip).toHaveTextContent("Mingo County, WV");
      expect(tooltip).toHaveTextContent("7.5");
    });
  });
});
