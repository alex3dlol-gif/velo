import type { StyleSpecification } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

maplibregl.setWorkerUrl(workerUrl);

export { maplibregl };
export type { Map, MapLayerMouseEvent, GeoJSONSource } from "maplibre-gl";

/** OpenStreetMap raster — no API key required. */
export const MAP_STYLE_LIGHT: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
};

export const MAP_STYLE_DARK: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "osm-tiles", type: "raster", source: "osm", paint: { "raster-brightness-min": 0.05, "raster-saturation": -0.6 } },
  ],
};

export function getMapStyle(isAmoled: boolean): StyleSpecification {
  return isAmoled ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
}
