import cityLabels from "../cityLabels.json";

export interface MapCity {
  name: string;
  state: string;
  longitude: number;
  latitude: number;
  population: number;
  minZoom: number;
}

export interface CityLabelLayerProps {
  id: "city-labels";
  data: MapCity[];
  pickable: false;
  billboard: true;
  getPosition: (city: MapCity) => [number, number];
  getText: (city: MapCity) => string;
  getSize: (city: MapCity) => number;
  getColor: [number, number, number, number];
  getTextAnchor: "middle";
  getAlignmentBaseline: "center";
  fontFamily: string;
  fontWeight: number;
  background: true;
  getBackgroundColor: [number, number, number, number];
  backgroundPadding: [number, number];
  updateTriggers: { getText: unknown[]; getSize: unknown[] };
}

// Generated from 2024 Census place coordinates joined to 2024 city population estimates.
export const CITY_LABELS = cityLabels as MapCity[];

export function citiesForZoom(cities: readonly MapCity[], zoom: number): MapCity[] {
  return cities.filter((city) => zoom >= city.minZoom);
}

function cityLabelSize(city: MapCity): number {
  if (city.population >= 1_500_000) return 12;
  if (city.population >= 400_000) return 11;
  return 10;
}

export function buildCityLabelLayerProps(args: {
  cities?: readonly MapCity[];
  zoom: number;
}): CityLabelLayerProps | null {
  const visibleCities = citiesForZoom(args.cities ?? CITY_LABELS, args.zoom);
  if (visibleCities.length === 0) return null;

  return {
    id: "city-labels",
    data: visibleCities,
    pickable: false,
    billboard: true,
    getPosition: (city) => [city.longitude, city.latitude],
    getText: (city) => city.name,
    getSize: cityLabelSize,
    getColor: [43, 40, 30, 230],
    getTextAnchor: "middle",
    getAlignmentBaseline: "center",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: 700,
    background: true,
    getBackgroundColor: [250, 247, 241, 190],
    backgroundPadding: [4, 2],
    updateTriggers: {
      getText: [visibleCities.length],
      getSize: [visibleCities.length],
    },
  };
}
