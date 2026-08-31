import type { FeatureCollection, Polygon } from "geojson";

/** Водоёмы и реки — всегда видны на карте (не исследуются пешком). */
export const MAP_WATER: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { natural: "water", name: "Чертановские пруды" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [37.595, 55.625],
            [37.605, 55.625],
            [37.605, 55.632],
            [37.595, 55.632],
            [37.595, 55.625],
          ],
        ],
      },
    },
  ],
};
