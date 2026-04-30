export type RGBA = [number, number, number, number];

export interface ScaleDomain {
  domainMin: number;
  domainMax: number;
}

const NULL_COLOR: RGBA = [204, 204, 204, 220];
const ALPHA = 220;

type ColorStop = [number, [number, number, number]];
// Non-empty tuple: first stop is required, followed by one-or-more rest stops.
// This lets TS prove `stops[0]` and `last` are defined without `!`.
type NonEmptyStops = readonly [ColorStop, ...ColorStop[]];

const PILLS_STOPS: NonEmptyStops = [
  [0.0, [68, 1, 84]],
  [0.25, [59, 82, 139]],
  [0.5, [33, 144, 141]],
  [0.75, [94, 201, 98]],
  [1.0, [253, 231, 37]],
];

const DEATHS_STOPS: NonEmptyStops = [
  [0.0, [198, 219, 239]],
  [0.25, [158, 202, 225]],
  [0.5, [107, 174, 214]],
  [0.75, [49, 130, 189]],
  [1.0, [8, 48, 107]],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolate(stops: NonEmptyStops, t: number): [number, number, number] {
  const first = stops[0];
  if (t <= first[0]) return [...first[1]] as [number, number, number];
  const last = stops[stops.length - 1] ?? first;
  if (t >= last[0]) return [...last[1]] as [number, number, number];
  let prev: ColorStop = first;
  for (let i = 1; i < stops.length; i++) {
    const curr = stops[i];
    if (!curr) continue;
    const [tb, cb] = curr;
    if (t <= tb) {
      const [ta, ca] = prev;
      const k = (t - ta) / (tb - ta);
      return [
        Math.round(lerp(ca[0], cb[0], k)),
        Math.round(lerp(ca[1], cb[1], k)),
        Math.round(lerp(ca[2], cb[2], k)),
      ];
    }
    prev = curr;
  }
  return [...last[1]] as [number, number, number];
}

function build(
  stops: NonEmptyStops,
): (value: number | null | undefined, domain: ScaleDomain) => RGBA {
  return (value, domain) => {
    if (value == null || Number.isNaN(value)) return NULL_COLOR;
    const range = domain.domainMax - domain.domainMin;
    const t = range <= 0 ? 0 : Math.min(1, Math.max(0, (value - domain.domainMin) / range));
    const [r, g, b] = interpolate(stops, t);
    return [r, g, b, ALPHA];
  };
}

export const pillsColorScale = build(PILLS_STOPS);
export const deathsColorScale = build(DEATHS_STOPS);

export function rgbToCss(rgba: RGBA): string {
  const [r, g, b, a] = rgba;
  const alphaStr = (a / 255).toFixed(3).replace(/\.?0+$/, "");
  return `rgba(${r}, ${g}, ${b}, ${alphaStr || "0"})`;
}

export function quantizeBuckets(
  domain: ScaleDomain,
  bucketCount = 6,
): Array<{ min: number; max: number; color: RGBA }> {
  const buckets: Array<{ min: number; max: number; color: RGBA }> = [];
  const range = domain.domainMax - domain.domainMin;
  const step = range / bucketCount;
  for (let i = 0; i < bucketCount; i++) {
    const min = domain.domainMin + step * i;
    const max = min + step;
    const mid = (min + max) / 2;
    buckets.push({ min, max, color: pillsColorScale(mid, domain) });
  }
  return buckets;
}
