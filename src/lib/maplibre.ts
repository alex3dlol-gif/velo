import type { StyleSpecification } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

maplibregl.setWorkerUrl(workerUrl);

export { maplibregl };
export type { Map, MapLayerMouseEvent, GeoJSONSource } from "maplibre-gl";

const MAP_GLYPHS = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

/** Мягкая «игровая» подложка — не сухой OSM. */
const GAME_TILE_PAINT_LIGHT = {
  "raster-saturation": -0.45,
  "raster-brightness-min": 0.22,
  "raster-brightness-max": 0.92,
  "raster-contrast": -0.08,
  "raster-hue-rotate": 18,
};

const GAME_TILE_PAINT_DARK = {
  "raster-saturation": -0.55,
  "raster-brightness-min": 0.08,
  "raster-brightness-max": 0.55,
  "raster-contrast": 0.05,
  "raster-hue-rotate": 25,
};

export const MAP_STYLE_LIGHT: StyleSpecification = {
  version: 8,
  glyphs: MAP_GLYPHS,
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
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
      paint: GAME_TILE_PAINT_LIGHT,
    },
  ],
};

export const MAP_STYLE_DARK: StyleSpecification = {
  version: 8,
  glyphs: MAP_GLYPHS,
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
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
      paint: GAME_TILE_PAINT_DARK,
    },
  ],
};

export function getMapStyle(isAmoled: boolean): StyleSpecification {
  return isAmoled ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
}
