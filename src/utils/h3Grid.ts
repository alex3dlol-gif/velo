import {
  cellToBoundary,
  cellToLatLng,
  gridDisk,
  latLngToCell,
  polygonToCells,
} from "h3-js";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { H3_RESOLUTION } from "../constants/h3";
import type { MapBounds } from "../types/map";

export { H3_RESOLUTION } from "../constants/h3";
export type { MapBounds } from "../types/map";
const TERRACOTTA = "#D95D39";

/** Padding ~1.2 km at z14 — scales up when zoomed out to avoid edge gaps. */
const VIEWPORT_PAD_LAT = 0.011;
const VIEWPORT_PAD_LNG = 0.016;

function padScaleForZoom(zoom: number): number {
  return Math.pow(2, Math.max(0, 14 - zoom));
}

function padBounds(bounds: MapBounds, zoom = 14): MapBounds {
  const scale = padScaleForZoom(zoom);
  return {
    west: bounds.west - VIEWPORT_PAD_LNG * scale,
    south: bounds.south - VIEWPORT_PAD_LAT * scale,
    east: bounds.east + VIEWPORT_PAD_LNG * scale,
    north: bounds.north + VIEWPORT_PAD_LAT * scale,
  };
}

function clampBounds(bounds: MapBounds, limit: MapBounds): MapBounds {
  return {
    west: Math.max(bounds.west, limit.west),
    south: Math.max(bounds.south, limit.south),
    east: Math.min(bounds.east, limit.east),
    north: Math.min(bounds.north, limit.north),
  };
}

function boundsToRing(bounds: MapBounds): [number, number][] {
  return [
    [bounds.north, bounds.west],
    [bounds.north, bounds.east],
    [bounds.south, bounds.east],
    [bounds.south, bounds.west],
  ];
}

function viewportOuterRing(bounds: MapBounds): [number, number][] {
  const { west, south, east, north } = bounds;
  // CCW exterior ring (GeoJSON spec)
  return [
    [west, south],
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function reverseRing(ring: [number, number][]): [number, number][] {
  const open = closeRing(ring);
  if (open.length <= 1) return open;
  const body = open.slice(0, -1).reverse();
  return closeRing(body);
}

function isInsideBounds(lat: number, lng: number, bounds: MapBounds): boolean {
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

function cellIntersectsBounds(h3Index: string, bounds: MapBounds): boolean {
  const [lat, lng] = cellToLatLng(h3Index);
  if (isInsideBounds(lat, lng, bounds)) return true;
  for (const [lngPt, latPt] of cellToBoundary(h3Index, true)) {
    if (isInsideBounds(latPt, lngPt, bounds)) return true;
  }
  return false;
}

/** Returns H3 indices for a bounding box polygon. */
export function getCellsInBounds(bounds: MapBounds, resolution = H3_RESOLUTION): string[] {
  return polygonToCells(boundsToRing(bounds), resolution);
}

/**
 * Returns H3 indices covering the map viewport edge-to-edge.
 * Pads the viewport, clips to MKAD, and supplements corner/edge cells.
 */
export function getCellsForViewport(
  viewport: MapBounds,
  clip: MapBounds,
  resolution = H3_RESOLUTION,
  zoom = 14,
): string[] {
  return getCellsForBounds(clampBounds(padBounds(viewport, zoom), clip), viewport, clip, resolution, zoom);
}

/** All H3 cells in the padded viewport — includes areas outside MKAD. */
export function getCellsForViewportExtended(
  viewport: MapBounds,
  resolution = H3_RESOLUTION,
  zoom = 14,
): string[] {
  return getCellsForBounds(padBounds(viewport, zoom), viewport, null, resolution, zoom);
}

function getCellsForBounds(
  query: MapBounds,
  viewport: MapBounds,
  clip: MapBounds | null,
  resolution = H3_RESOLUTION,
  zoom = 14,
): string[] {
  const cells = new Set(getCellsInBounds(query, resolution));

  const edgeSamples: [number, number][] = [
    [viewport.north, viewport.west],
    [viewport.north, viewport.east],
    [viewport.south, viewport.west],
    [viewport.south, viewport.east],
    [viewport.north, (viewport.west + viewport.east) / 2],
    [viewport.south, (viewport.west + viewport.east) / 2],
    [(viewport.north + viewport.south) / 2, viewport.west],
    [(viewport.north + viewport.south) / 2, viewport.east],
    [(viewport.north + viewport.south) / 2, (viewport.west + viewport.east) / 2],
  ];

  for (const [lat, lng] of edgeSamples) {
    if (clip && !isInsideBounds(lat, lng, clip)) continue;
    const origin = latLngToCell(lat, lng, resolution);
    cells.add(origin);
    for (const neighbor of gridDisk(origin, 1)) cells.add(neighbor);
  }

  return [...cells];
}

/** Converts lat/lng to H3 index at resolution 9. */
export function coordsToCell(lat: number, lng: number, resolution = H3_RESOLUTION): string {
  return latLngToCell(lat, lng, resolution);
}

/** Returns cell center coordinates [lat, lng]. */
export function cellCenter(h3Index: string): [number, number] {
  return cellToLatLng(h3Index);
}

/** Builds a GeoJSON polygon feature for a single H3 cell. */
export function cellToPolygonFeature(
  h3Index: string,
  properties: Record<string, unknown> = {},
): Feature<Polygon> {
  const boundary = cellToBoundary(h3Index, true);
  const ring =
    boundary.length > 1 &&
    boundary[0][0] === boundary[boundary.length - 1][0] &&
    boundary[0][1] === boundary[boundary.length - 1][1]
      ? boundary
      : [...boundary, boundary[0]];
  return {
    type: "Feature",
    properties: { h3Index, ...properties },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

/** Splits visible cells into fog (unvisited) and revealed (visited) GeoJSON collections. */
export function buildHexLayers(
  cellIndices: string[],
  visited: ReadonlySet<string>,
  flashing: ReadonlySet<string> = new Set(),
): { fog: FeatureCollection<Polygon>; revealed: FeatureCollection<Polygon> } {
  const fog: Feature<Polygon>[] = [];
  const revealed: Feature<Polygon>[] = [];

  for (const idx of cellIndices) {
    const isVisited = visited.has(idx);
    const feature = cellToPolygonFeature(idx, {
      visited: isVisited,
      flashing: flashing.has(idx),
    });
    if (isVisited) revealed.push(feature);
    else fog.push(feature);
  }

  return {
    fog: { type: "FeatureCollection", features: fog },
    revealed: { type: "FeatureCollection", features: revealed },
  };
}

/**
 * Single fog veil: viewport rectangle with holes for visited & auto-revealed (water) hexes.
 */
export function buildFogMask(
  viewport: MapBounds,
  visited: ReadonlySet<string>,
  clip: MapBounds,
  zoom = 14,
  isAutoRevealed: (h3Index: string) => boolean = () => false,
): Feature<Polygon> {
  const padded = clampBounds(padBounds(viewport, zoom), clip);
  const outer = viewportOuterRing(padded);
  const holes: [number, number][][] = [];
  const cells = getCellsForViewport(viewport, clip, H3_RESOLUTION, zoom);
  const cellSet = new Set(cells);

  for (const idx of cells) {
    if (!visited.has(idx) && !isAutoRevealed(idx)) continue;
    holes.push(reverseRing(cellToBoundary(idx, true)));
  }

  for (const idx of visited) {
    if (!cellIntersectsBounds(idx, padded) || cellSet.has(idx)) continue;
    holes.push(reverseRing(cellToBoundary(idx, true)));
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [outer, ...holes],
    },
  };
}

/** Water / nature hex outlines (auto-revealed, not explorable). */
export function buildNatureWaterLayer(
  cellIndices: string[],
  isWater: (h3Index: string) => boolean,
): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];
  for (const idx of cellIndices) {
    if (!isWater(idx)) continue;
    features.push(cellToPolygonFeature(idx, { nature: "water" }));
  }
  return { type: "FeatureCollection", features };
}

/** Demo seed: a small cluster of pre-revealed hexes around Chertanovo. */
export function getSeedVisitedCells(): string[] {
  const origin = latLngToCell(55.629, 37.606, H3_RESOLUTION);
  return gridDisk(origin, 4);
}

/** MapLibre paint — honest fog of war masking. */
export function getHexLayerPaint(isAmoled: boolean) {
  return {
    fog: {
      fill: isAmoled ? "#000000" : "#EFECE6",
      fillOpacity: isAmoled ? 1.0 : 0.95,
    },
    revealed: {
      line: "#D95D39",
      lineOpacity: 0.6,
      lineWidth: 1.5,
    },
    selected: {
      line: "#D95D39",
      lineWidth: 3,
    },
    nature: {
      line: "#5B9BD5",
      lineOpacity: 0.55,
      lineWidth: 1.5,
    },
    district: {
      unlockedLine: "#D95D39",
      lockedLine: isAmoled ? "#9CA3AF" : "#6B7280",
      lineWidth: 2.5,
      lockedFill: isAmoled ? "#111111" : "#E5E7EB",
      lockedFillOpacity: isAmoled ? 0.4 : 0.28,
    },
    accent: TERRACOTTA,
  };
}

/** @deprecated Use getMapStyle() from src/lib/maplibre.ts */
export const MAP_STYLES = {
  light: "inline",
  dark: "inline",
} as const;

/** Default map center: Chertanovo Central, Moscow (inside MKAD). */
export const DEFAULT_CENTER: [number, number] = [37.606, 55.629];
export const DEFAULT_ZOOM = 14;

export { MKAD_BOUNDS, MKAD_CENTER, MKAD_DEFAULT_ZOOM } from "../constants/mkad";
