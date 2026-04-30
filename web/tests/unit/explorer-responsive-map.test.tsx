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

type ROCallback = (entries: Array<{ contentRect: { width: number } }>) => void;

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
  trigger(width: number) {
    this.cb([{ contentRect: { width } }]);
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
  it("passes a narrower width to the map when the container shrinks", async () => {
    const { getByTestId } = render(<Explorer counties={[]} />);
    await flush();

    const ro = MockResizeObserver.instances.at(-1);
    expect(ro).toBeDefined();
    // Simulate a 375px mobile viewport parent.
    await act(async () => {
      ro?.trigger(375);
    });

    const map = getByTestId("map");
    const width = Number(map.dataset.width);
    const height = Number(map.dataset.height);
    expect(width).toBeLessThanOrEqual(375);
    expect(width).toBeGreaterThanOrEqual(280);
    // Maintain ~1.714 aspect ratio (720:420).
    expect(Math.abs(width / height - 720 / 420)).toBeLessThan(0.02);
  });

  it("caps width at 1200 on very wide containers", async () => {
    const { getByTestId } = render(<Explorer counties={[]} />);
    await flush();

    const ro = MockResizeObserver.instances.at(-1);
    await act(async () => {
      ro?.trigger(2560);
    });

    const map = getByTestId("map");
    expect(Number(map.dataset.width)).toBeLessThanOrEqual(1200);
  });
});
