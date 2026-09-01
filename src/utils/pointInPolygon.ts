import type { MultiPolygon, Polygon, Position } from "geojson";

function pointInRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(lng: number, lat: number, geometry: Polygon | MultiPolygon): boolean {
  if (geometry.type === "Polygon") {
    const [outer, ...holes] = geometry.coordinates;
    if (!outer || !pointInRing(lng, lat, outer)) return false;
    for (const hole of holes) {
      if (pointInRing(lng, lat, hole)) return false;
    }
    return true;
  }

  for (const poly of geometry.coordinates) {
    const [outer, ...holes] = poly;
    if (!outer || !pointInRing(lng, lat, outer)) continue;
    let inHole = false;
    for (const hole of holes) {
      if (pointInRing(lng, lat, hole)) inHole = true;
    }
    if (!inHole) return true;
  }
  return false;
}

export function pointInBounds(
  lng: number,
  lat: number,
  bounds: { west: number; south: number; east: number; north: number },
): boolean {
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}
