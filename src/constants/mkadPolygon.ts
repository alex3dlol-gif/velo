import type { Feature, Polygon } from "geojson";
import type { MapBounds } from "../types/map";

/**
 * Упрощённый полигон МКАД (GeoJSON: [lng, lat], замкнутое кольцо).
 * Источник: упрощённая граница Москвы (Yandex Map Constructor / OSM).
 */
export const MKAD_RING: [number, number][] = [
  [37.376685, 55.795788],
  [37.364325, 55.731523],
  [37.394538, 55.697412],
  [37.408271, 55.682673],
  [37.453589, 55.636869],
  [37.498908, 55.594899],
  [37.596411, 55.571563],
  [37.691169, 55.572341],
  [37.817511, 55.631431],
  [37.85047, 55.650849],
  [37.833991, 55.691983],
  [37.84635, 55.708269],
  [37.853217, 55.763282],
  [37.849097, 55.818217],
  [37.718634, 55.89623],
  [37.63349, 55.898545],
  [37.588172, 55.913973],
  [37.542853, 55.912431],
  [37.474189, 55.883882],
  [37.449469, 55.883882],
  [37.411017, 55.874618],
  [37.394538, 55.852222],
  [37.400031, 55.831359],
  [37.376685, 55.795788],
];

const MKAD_RING_CW: [number, number][] = [...MKAD_RING].reverse();

function boundsFromRing(ring: [number, number][]): MapBounds {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of ring) {
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }
  return { west, south, east, north };
}

export const MKAD_POLYGON_BOUNDS = boundsFromRing(MKAD_RING);

/** Ray-casting point-in-polygon (lat/lng). */
export function isInsideMkadRing(lat: number, lng: number): boolean {
  let inside = false;
  for (let i = 0, j = MKAD_RING.length - 1; i < MKAD_RING.length; j = i++) {
    const [xi, yi] = MKAD_RING[i]!;
    const [xj, yj] = MKAD_RING[j]!;
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function viewportOuterRing(bounds: MapBounds): [number, number][] {
  const { west, south, east, north } = bounds;
  return [
    [west, south],
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

/** Затемнение всего за пределами МКАД в текущем viewport. */
export function buildOutsideMkadMask(viewport: MapBounds): Feature<Polygon> {
  const padded = {
    west: viewport.west - 0.02,
    south: viewport.south - 0.02,
    east: viewport.east + 0.02,
    north: viewport.north + 0.02,
  };

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [viewportOuterRing(padded), MKAD_RING_CW],
    },
  };
}
