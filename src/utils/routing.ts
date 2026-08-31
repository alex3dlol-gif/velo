import type { Travel } from "../context/AppContext";
import type { RouteGeoJSON } from "../types/sector";

const OSRM_BASE = import.meta.env.DEV
  ? "/api/osrm/route/v1"
  : "/api/osrm/route/v1";

type OsrmResponse = {
  code: string;
  message?: string;
  routes?: { geometry: GeoJSON.LineString; distance?: number; duration?: number }[];
  waypoints?: { location: [number, number] }[];
};

export type FetchRouteResult =
  | { ok: true; route: RouteGeoJSON }
  | { ok: false; error: string };

const PROFILE_FALLBACK: Record<Travel, string[]> = {
  bike: ["bike", "foot", "car"],
  walk: ["foot", "car"],
};

async function snapToRoad(
  lng: number,
  lat: number,
  profile: string,
): Promise<{ lng: number; lat: number }> {
  const url = `${OSRM_BASE}/nearest/v1/${profile}/${lng},${lat}?number=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { lng, lat };
    const data = (await res.json()) as OsrmResponse;
    const loc = data.waypoints?.[0]?.location;
    if (!loc) return { lng, lat };
    return { lng: loc[0], lat: loc[1] };
  } catch {
    return { lng, lat };
  }
}

async function requestRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  profile: string,
): Promise<OsrmResponse | null> {
  const coords = `${startLng},${startLat};${endLng},${endLat}`;
  const url = `${OSRM_BASE}/${profile}/${coords}?overview=full&geometries=geojson&steps=false`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as OsrmResponse;
  } catch {
    return null;
  }
}

function osrmErrorMessage(code: string, message?: string): string {
  switch (code) {
    case "NoRoute":
      return "Маршрут не найден — попробуйте другой сектор";
    case "NoSegment":
      return "Точка слишком далеко от дороги";
    case "TooBig":
      return "Маршрут слишком длинный";
    default:
      return message ?? "Сервис маршрутизации недоступен";
  }
}

export async function fetchRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  travel: Travel,
): Promise<FetchRouteResult> {
  const profiles = PROFILE_FALLBACK[travel];
  let lastError = "Не удалось построить маршрут";

  for (const profile of profiles) {
    let data = await requestRoute(startLng, startLat, endLng, endLat, profile);

    if (!data) {
      lastError = "Нет связи с сервисом маршрутов";
      continue;
    }

    if (data.code !== "Ok" || !data.routes?.[0]?.geometry) {
      const snappedStart = await snapToRoad(startLng, startLat, profile);
      const snappedEnd = await snapToRoad(endLng, endLat, profile);
      data = await requestRoute(
        snappedStart.lng,
        snappedStart.lat,
        snappedEnd.lng,
        snappedEnd.lat,
        profile,
      );
    }

    if (!data) {
      lastError = "Нет связи с сервисом маршрутов";
      continue;
    }

    const geometry = data.routes?.[0]?.geometry;
    if (data.code === "Ok" && geometry) {
      return {
        ok: true,
        route: {
          type: "Feature",
          properties: { profile },
          geometry,
        },
      };
    }

    lastError = osrmErrorMessage(data.code, data.message);
  }

  return { ok: false, error: lastError };
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
