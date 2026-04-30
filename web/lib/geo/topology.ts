import type { FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

export interface TopologyLoadOptions {
  /** Pre-parsed TopoJSON, used by tests. Bypasses fetch. */
  json?: Topology;
  /** Called exactly once after first successful load. Used for memoization tests. */
  onLoad?: () => void;
  /** Absolute or relative URL to us-atlas counties-10m TopoJSON. */
  url?: string;
}

const DEFAULT_URL =
  typeof window === "undefined"
    ? "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json"
    : "/data/counties-10m.json";

let cachedTopology: Topology | null = null;
let inflight: Promise<Topology> | null = null;

async function getTopology(options: TopologyLoadOptions): Promise<Topology> {
  if (options.json) {
    if (!cachedTopology) {
      cachedTopology = options.json;
      options.onLoad?.();
    }
    return cachedTopology;
  }
  if (cachedTopology) return cachedTopology;
  if (inflight) return inflight;

  const url = options.url ?? DEFAULT_URL;
  inflight = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`topology fetch failed: ${res.status}`);
      const json = (await res.json()) as Topology;
      cachedTopology = json;
      options.onLoad?.();
      return json;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function loadCountyTopology(
  options: TopologyLoadOptions = {},
): Promise<FeatureCollection<Geometry, { name?: string }>> {
  const topo = await getTopology(options);
  const obj = topo.objects.counties as GeometryCollection;
  return feature(topo, obj) as unknown as FeatureCollection<Geometry, { name?: string }>;
}

export async function loadStateTopology(
  options: TopologyLoadOptions = {},
): Promise<FeatureCollection<Geometry, { name?: string }>> {
  const topo = await getTopology(options);
  const obj = topo.objects.states as GeometryCollection;
  return feature(topo, obj) as unknown as FeatureCollection<Geometry, { name?: string }>;
}

export function resetTopologyCache(): void {
  cachedTopology = null;
  inflight = null;
}
