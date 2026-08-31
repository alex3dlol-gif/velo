import {
  cellToBoundary,
  cellToLatLng,
  gridDisk,
  isValidCell,
  latLngToCell,
} from "h3-js";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { H3_RESOLUTION } from "../constants/h3";
import { isInsideMkadRing } from "../constants/mkadPolygon";
import { MKAD_BOUNDS, MKAD_CENTER, MKAD_DEFAULT_ZOOM } from "../constants/mkad";
import type { MapBounds } from "../types/map";

export { H3_RESOLUTION } from "../constants/h3";
export type { MapBounds } from "../types/map";
const TERRACOTTA = "#D95D39";
const BOUNDARY_CACHE = new Map<string, [number, number][]>();
const VIEWPORT_CELL_CACHE = new Map<string, string[]>();

function maxCellsForZoom(zoom: number, resolution = H3_RESOLUTION): number {
  const scale = resolution <= 8 ? 1.4 : 1;
  if (zoom >= 16) return Math.round(320 * scale);
  if (zoom >= 14) return Math.round(240 * scale);
  if (zoom >= 12) return Math.round(180 * scale);
  if (zoom >= 11) return Math.round(130 * scale);
  return Math.round(100 * scale);
}

/** Крупнее гексы при отдалении — иначе сетка не видна на всём городе. */
export function resolutionForZoom(zoom: number): number {
  if (zoom < 12) return 8;
  return H3_RESOLUTION;
}

function getCellRing(h3Index: string): [number, number][] {
  const cached = BOUNDARY_CACHE.get(h3Index);
  if (cached) return cached;

  const boundary = cellToBoundary(h3Index, true);
  const ring =
    boundary.length > 1 &&
    boundary[0]![0] === boundary[boundary.length - 1]![0] &&
    boundary[0]![1] === boundary[boundary.length - 1]![1]
      ? boundary
      : ([...boundary, boundary[0]!] as [number, number][]);

  if (BOUNDARY_CACHE.size > 4000) BOUNDARY_CACHE.clear();
  BOUNDARY_CACHE.set(h3Index, ring);
  return ring;
}

function polygonFromRing(h3Index: string, properties: Record<string, unknown> = {}): Feature<Polygon> {
  return {
    type: "Feature",
    properties: { h3Index, ...properties },
    geometry: { type: "Polygon", coordinates: [getCellRing(h3Index)] },
  };
}

function cellToGridLineFeature(h3Index: string): Feature {
  return {
    type: "Feature",
    properties: { h3Index, grid: true },
    geometry: { type: "LineString", coordinates: getCellRing(h3Index) },
  };
}

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

function isCellInsideMkad(h3Index: string): boolean {
  const [lat, lng] = cellToLatLng(h3Index);
  if (
    lng < MKAD_BOUNDS.west ||
    lng > MKAD_BOUNDS.east ||
    lat < MKAD_BOUNDS.south ||
    lat > MKAD_BOUNDS.north
  ) {
    return false;
  }
  if (isInsideMkadRing(lat, lng)) return true;
  for (const [lngPt, latPt] of cellToBoundary(h3Index, true)) {
    if (isInsideMkadRing(latPt, lngPt)) return true;
  }
  return false;
}

function filterMkadCells(indices: string[]): string[] {
  return indices.filter(isCellInsideMkad);
}

function cellIntersectsBounds(h3Index: string, bounds: MapBounds): boolean {
  const [lat, lng] = cellToLatLng(h3Index);
  if (isInsideBounds(lat, lng, bounds)) return true;
  for (const [lngPt, latPt] of cellToBoundary(h3Index, true)) {
    if (isInsideBounds(latPt, lngPt, bounds)) return true;
  }
  return false;
}

function isInsideBounds(lat: number, lng: number, bounds: MapBounds): boolean {
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

/** Быстрая выборка ячеек по сетке lat/lng — без polygonToCells. */
export function getCellsInBounds(bounds: MapBounds, resolution = H3_RESOLUTION, maxCells = 140): string[] {
  const cells = new Set<string>();
  const rows = Math.max(4, Math.ceil(Math.sqrt(maxCells)));
  const cols = rows;
  const latStep = (bounds.north - bounds.south) / rows || 0.001;
  const lngStep = (bounds.east - bounds.west) / cols || 0.001;

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const lat = bounds.south + r * latStep;
      const lng = bounds.west + c * lngStep;
      if (!isInsideMkadRing(lat, lng)) continue;
      cells.add(latLngToCell(lat, lng, resolution));
    }
  }

  return [...cells];
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
  const h3Res = resolution === H3_RESOLUTION ? resolutionForZoom(zoom) : resolution;
  const maxCells = maxCellsForZoom(zoom, h3Res);
  const cacheKey = `${viewport.west.toFixed(4)}:${viewport.south.toFixed(4)}:${viewport.east.toFixed(4)}:${viewport.north.toFixed(4)}:${zoom}:${h3Res}`;
  const cached = VIEWPORT_CELL_CACHE.get(cacheKey);
  if (cached) return cached;

  const cells = filterMkadCells(
    getCellsForBounds(clampBounds(padBounds(viewport, zoom), clip), viewport, clip, h3Res, maxCells),
  );

  if (cells.length > 0) {
    if (VIEWPORT_CELL_CACHE.size > 24) VIEWPORT_CELL_CACHE.clear();
    VIEWPORT_CELL_CACHE.set(cacheKey, cells);
  }
  return cells;
}

/** All H3 cells in the padded viewport — includes areas outside MKAD. */
export function getCellsForViewportExtended(
  viewport: MapBounds,
  resolution = H3_RESOLUTION,
  zoom = 14,
): string[] {
  return getCellsForBounds(padBounds(viewport, zoom), viewport, null, resolution, maxCellsForZoom(zoom));
}

function getCellsForBounds(
  query: MapBounds,
  viewport: MapBounds,
  clip: MapBounds | null,
  resolution = H3_RESOLUTION,
  maxCells = 140,
): string[] {
  const cells = new Set(getCellsInBounds(query, resolution, maxCells));

  const centerLat = (viewport.north + viewport.south) / 2;
  const centerLng = (viewport.east + viewport.west) / 2;
  const centerCell = latLngToCell(centerLat, centerLng, resolution);
  cells.add(centerCell);
  for (const neighbor of gridDisk(centerCell, 4)) cells.add(neighbor);

  const edgeSamples: [number, number][] = [
    [viewport.north, viewport.west],
    [viewport.north, viewport.east],
    [viewport.south, viewport.west],
    [viewport.south, viewport.east],
    [centerLat, centerLng],
  ];

  for (const [lat, lng] of edgeSamples) {
    if (clip && !isInsideBounds(lat, lng, clip)) continue;
    const origin = latLngToCell(lat, lng, resolution);
    cells.add(origin);
    for (const neighbor of gridDisk(origin, 2)) cells.add(neighbor);
  }

  return [...cells].slice(0, Math.round(maxCells * 1.5));
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
  return polygonFromRing(h3Index, properties);
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

/** Один проход: туман, сетка, заливка и границы исследованных гексов. */
export function buildViewportHexLayers(
  viewport: MapBounds,
  visited: ReadonlySet<string>,
  clip: MapBounds,
  zoom = 14,
  isAutoRevealed: (h3Index: string) => boolean = () => false,
): {
  fog: FeatureCollection<Polygon>;
  explored: FeatureCollection<Polygon>;
  grid: FeatureCollection;
  revealed: FeatureCollection<Polygon>;
  cells: string[];
} {
  const h3Res = resolutionForZoom(zoom);
  const cells = getCellsForViewport(viewport, clip, h3Res, zoom);
  const cellSet = new Set(cells);
  const explored: Feature<Polygon>[] = [];
  const grid: Feature[] = [];
  const revealed: Feature<Polygon>[] = [];

  for (const idx of cells) {
    grid.push(cellToGridLineFeature(idx));
  }

  for (const idx of cells) {
    if (!isValidCell(idx)) continue;
    if (visited.has(idx)) {
      explored.push(polygonFromRing(idx, { explored: true }));
      revealed.push(polygonFromRing(idx, { visited: true }));
    }
  }

  for (const idx of visited) {
    if (!isValidCell(idx)) continue;
    if (!cellIntersectsBounds(idx, viewport) || cellSet.has(idx)) continue;
    explored.push(polygonFromRing(idx, { explored: true }));
    revealed.push(polygonFromRing(idx, { visited: true }));
    grid.push(cellToGridLineFeature(idx));
  }

  return {
    fog: { type: "FeatureCollection", features: [] },
    explored: { type: "FeatureCollection", features: explored },
    grid: { type: "FeatureCollection", features: grid },
    revealed: { type: "FeatureCollection", features: revealed },
    cells,
  };
}

/**
 * Туман войны: заливка неисследованных гексов внутри МКАД.
 */
export function buildFogCellsLayer(
  viewport: MapBounds,
  visited: ReadonlySet<string>,
  clip: MapBounds,
  zoom = 14,
  isAutoRevealed: (h3Index: string) => boolean = () => false,
): FeatureCollection<Polygon> {
  return buildViewportHexLayers(viewport, visited, clip, zoom, isAutoRevealed).fog;
}

/** Контуры всех гексов в viewport (сетка H3). */
export function buildHexGridLayer(
  viewport: MapBounds,
  clip: MapBounds,
  zoom = 14,
): FeatureCollection {
  return buildViewportHexLayers(viewport, new Set(), clip, zoom).grid;
}

/**
 * Сплошной лист тумана на весь viewport (без дыр — надёжно на мобильных).
 * Исследованные гексы перекрывают его слоем explored сверху.
 */
export function buildViewportFogSheet(viewport: MapBounds, clip: MapBounds, zoom = 14): Feature<Polygon> {
  const padded = clampBounds(padBounds(viewport, zoom), clip);
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [viewportOuterRing(padded)],
    },
  };
}

/**
 * @deprecated Используйте buildViewportFogSheet + explored fill
 */
export function buildFogMask(
  viewport: MapBounds,
  visited: ReadonlySet<string>,
  clip: MapBounds,
  zoom = 14,
  isAutoRevealed: (h3Index: string) => boolean = () => false,
): Feature<Polygon> {
  const holes: [number, number][][] = [];

  for (const idx of visited) {
    if (!cellIntersectsBounds(idx, viewport)) continue;
    holes.push(reverseRing(getCellRing(idx)));
  }

  const cells = getCellsForViewport(viewport, clip, resolutionForZoom(zoom), zoom);
  for (const idx of cells) {
    if (!isAutoRevealed(idx)) continue;
    holes.push(reverseRing(getCellRing(idx)));
  }

  const padded = clampBounds(padBounds(viewport, zoom), clip);
  const outer = viewportOuterRing(padded);

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
    features.push(polygonFromRing(idx, { nature: "water" }));
  }
  return { type: "FeatureCollection", features };
}

/** MapLibre paint — игровой fog-of-war. */
export function getHexLayerPaint(isAmoled: boolean) {
  return {
    fog: {
      fill: isAmoled ? "#1e1438" : "#B8A4D8",
      fillOpacity: isAmoled ? 0.92 : 0.85,
    },
    explored: {
      fill: isAmoled ? "#3d2810" : "#FFE4A8",
      fillOpacity: isAmoled ? 0.6 : 0.82,
    },
    grid: {
      line: isAmoled ? "#E8D4FF" : "#5C3D1E",
      lineOpacity: isAmoled ? 0.9 : 0.95,
      lineWidth: 2,
    },
    revealed: {
      line: isAmoled ? "#FF8F5C" : "#E85A2B",
      lineOpacity: isAmoled ? 0.85 : 0.9,
      lineWidth: 2,
    },
    selected: {
      line: "#FFBE0B",
      lineWidth: 3.5,
      fill: isAmoled ? "rgba(255, 190, 11, 0.22)" : "rgba(255, 190, 11, 0.35)",
    },
    nature: {
      line: isAmoled ? "#5BC0EB" : "#2E9FD6",
      lineOpacity: 0.75,
      lineWidth: 2,
    },
    district: {
      unlockedLine: isAmoled ? "#FF8F5C" : "#D95D39",
      lockedLine: isAmoled ? "#7A6B9A" : "#9B8AB8",
      lineWidth: 3,
      lockedFill: isAmoled ? "#1a1030" : "#B8A8D8",
      lockedFillOpacity: isAmoled ? 0.35 : 0.22,
      unlockedFillOpacity: isAmoled ? 0.28 : 0.2,
    },
    outside: {
      fill: isAmoled ? "#05030a" : "#2A1B45",
      fillOpacity: isAmoled ? 0.88 : 0.78,
    },
    mkad: {
      line: isAmoled ? "#FFBE0B" : "#FFB84D",
      lineWidth: 3,
    },
    route: {
      line: isAmoled ? "#FFBE0B" : "#D95D39",
      lineWidth: 5,
    },
    accent: TERRACOTTA,
  };
}

/** @deprecated Use getMapStyle() from src/lib/maplibre.ts */
export const MAP_STYLES = {
  light: "inline",
  dark: "inline",
} as const;

/** Default map center — центр Москвы до получения GPS. */
export const DEFAULT_CENTER: [number, number] = MKAD_CENTER;
export const DEFAULT_ZOOM = MKAD_DEFAULT_ZOOM;

export { MKAD_BOUNDS, MKAD_CENTER, MKAD_DEFAULT_ZOOM } from "../constants/mkad";
