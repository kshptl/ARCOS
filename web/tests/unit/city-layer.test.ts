import { describe, expect, it } from "vitest";
import {
  buildCityLabelLayerProps,
  CITY_LABELS,
  citiesForZoom,
  type MapCity,
} from "@/components/map/layers/cityLayer";

const CITIES: MapCity[] = [
  {
    name: "National City",
    state: "NC",
    longitude: -99,
    latitude: 39,
    population: 2_000_000,
    minZoom: 3.9,
  },
  {
    name: "Regional City",
    state: "RC",
    longitude: -98,
    latitude: 38,
    population: 600_000,
    minZoom: 4.7,
  },
  {
    name: "Local City",
    state: "LC",
    longitude: -97,
    latitude: 37,
    population: 90_000,
    minZoom: 6.3,
  },
];

describe("cityLayer", () => {
  it("shows no city labels at the outermost national zoom", () => {
    expect(citiesForZoom(CITIES, 3.2)).toEqual([]);
  });

  it("adds more city labels as the map zooms in", () => {
    expect(citiesForZoom(CITIES, 4).map((city) => city.name)).toEqual(["National City"]);
    expect(citiesForZoom(CITIES, 5).map((city) => city.name)).toEqual([
      "National City",
      "Regional City",
    ]);
    expect(citiesForZoom(CITIES, 7).map((city) => city.name)).toEqual([
      "National City",
      "Regional City",
      "Local City",
    ]);
  });

  it("builds text labels with city coordinates and subdued map styling", () => {
    const props = buildCityLabelLayerProps({
      cities: CITIES,
      zoom: 5,
    });

    expect(props).not.toBeNull();
    expect(props?.id).toBe("city-labels");
    expect(props?.data).toHaveLength(2);
    expect(props?.getText(CITIES[0]!)).toBe("National City");
    expect(props?.getPosition(CITIES[0]!)).toEqual([-99, 39]);
    expect(props?.getSize(CITIES[0]!)).toBeGreaterThanOrEqual(10);
  });

  it("keeps the real city list sparse until the map is deeply zoomed in", () => {
    const mediumZoomCount = citiesForZoom(CITY_LABELS, 6.8).length;
    const closeZoomCount = citiesForZoom(CITY_LABELS, 8.4).length;

    expect(mediumZoomCount).toBeLessThanOrEqual(60);
    expect(closeZoomCount).toBeGreaterThan(mediumZoomCount);
  });
});
