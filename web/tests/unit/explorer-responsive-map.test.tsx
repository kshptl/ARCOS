import { render } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock heavy/irrelevant children so we can focus on width propagation.
vi.mock("@/components/map/ChoroplethMap", () => ({
  ChoroplethMap: ({ width, height }: { width: number; height: number }) => (
    <div data-testid="map" data-width={width} data-height={height} />
  ),
}));
vi.mock("@/components/map/useWebGLSupport", () => ({
  useWebGLSupport: () => true,
}));
vi.mock("@/components/explorer/DataLoader", () => ({
  DataLoader: () => null,
}));
vi.mock("@/lib/geo/topology", () => ({
  loadCountyTopology: vi.fn().mockResolvedValue({
    type: "FeatureCollection",
    features: [],
  }),
  loadStateTopology: vi.fn().mockResolvedValue({
    type: "FeatureCollection",
    features: [],
  }),
}));

import { Explorer } from "@/components/explorer/Explorer";

type ROCallback = (entries: Array<{ contentRect: { width: number; height: number } }>) => void;

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  cb: ROCallback;
  constructor(cb: ROCallback) {
    this.cb = cb;
    MockResizeObserver.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger(width: number, height: number) {
    this.cb([{ contentRect: { width, height } }]);
  }
}

beforeEach(() => {
  MockResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function flush() {
  // Allow topology effect microtasks to settle.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Explorer responsive map", () => {
  it("passes the full map panel rectangle to the map", async () => {
    const { getByTestId } = render(<Explorer counties={[]} />);
    await flush();

    const ro = MockResizeObserver.instances.at(-1);
    expect(ro).toBeDefined();
    // Simulate the size of the visible map panel.
    await act(async () => {
      ro?.trigger(375, 300);
    });

    const map = getByTestId("map");
    const width = Number(map.dataset.width);
    const height = Number(map.dataset.height);
    expect(width).toBe(375);
    expect(height).toBe(300);
  });

  it("fills very wide desktop containers instead of capping at a narrow map width", async () => {
    const { getByTestId } = render(<Explorer counties={[]} />);
    await flush();

    const ro = MockResizeObserver.instances.at(-1);
    await act(async () => {
      ro?.trigger(2560, 1300);
    });

    const map = getByTestId("map");
    expect(Number(map.dataset.width)).toBe(2560);
    expect(Number(map.dataset.height)).toBe(1300);
  });
});
