import type { LngLatBoundsLike, Map } from "maplibre-gl";
import type { MapBounds } from "../types/map";
import { isInsideMkadRing, MKAD_POLYGON_BOUNDS } from "./mkadPolygon";

/** MKAD bounding box — по полигону кольца. */
export const MKAD_BOUNDS: MapBounds = { ...MKAD_POLYGON_BOUNDS };

export const MKAD_MAX_BOUNDS: LngLatBoundsLike = [
  [MKAD_BOUNDS.west, MKAD_BOUNDS.south],
  [MKAD_BOUNDS.east, MKAD_BOUNDS.north],
];

/** Центр Москвы внутри МКАД. */
export const MKAD_CENTER: [number, number] = [37.6173, 55.7558];

/** Минимальный zoom: нельзя отдалиться дальше, чем весь МКАД. */
export const MKAD_MIN_ZOOM = 10;

export const MKAD_MAX_ZOOM = 18;

export const MKAD_DEFAULT_ZOOM = 14;

/** Ограничивает координаты рамкой МКАД (bbox). */
export function clampToMkad(lng: number, lat: number): [number, number] {
  return [
    Math.max(MKAD_BOUNDS.west, Math.min(MKAD_BOUNDS.east, lng)),
    Math.max(MKAD_BOUNDS.south, Math.min(MKAD_BOUNDS.north, lat)),
  ];
}

/** Точка внутри кольца МКАД (полигон, не bbox). */
export { isInsideMkadRing };

/** Пересечение видимой области карты с МКАД. */
export function intersectWithMkad(bounds: MapBounds): MapBounds | null {
  const west = Math.max(bounds.west, MKAD_BOUNDS.west);
  const south = Math.max(bounds.south, MKAD_BOUNDS.south);
  const east = Math.min(bounds.east, MKAD_BOUNDS.east);
  const north = Math.min(bounds.north, MKAD_BOUNDS.north);
  if (west >= east || south >= north) return null;
  return { west, south, east, north };
}

/** Применяет ограничения панорамирования и зума по МКАД. */
export function applyMkadRestrictions(map: Map): void {
  map.setMaxBounds(MKAD_MAX_BOUNDS);
  map.setMinZoom(MKAD_MIN_ZOOM);
  map.setMaxZoom(MKAD_MAX_ZOOM);
}
