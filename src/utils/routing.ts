import type { Travel } from "../context/AppContext";
import type { RouteGeoJSON } from "../types/sector";

const OSRM_BASE = "https://router.project-osrm.org/route/v1";

type OsrmResponse = {
  code: string;
  routes?: { geometry: GeoJSON.LineString }[];
};

export async function fetchRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  travel: Travel,
): Promise<RouteGeoJSON | null> {
  const profile = travel === "bike" ? "bike" : "foot";
  const coords = `${startLng},${startLat};${endLng},${endLat}`;
  const url = `${OSRM_BASE}/${profile}/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as OsrmResponse;
  const geometry = data.routes?.[0]?.geometry;
  if (!geometry) return null;

  return {
    type: "Feature",
    properties: { profile },
    geometry,
  };
}

export function routeBounds(route: RouteGeoJSON): [[number, number], [number, number]] {
  const coords = route.geometry.coordinates;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
