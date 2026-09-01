import type { MultiPolygon, Polygon } from "geojson";
import { MOSCOW_DISTRICTS_DATA } from "../generated/moscowDistrictsData";
import type { MapBounds } from "../types/map";
import { MKAD_CENTER } from "./mkad";
import { isInsideMkadRing } from "./mkadPolygon";
import { pointInBounds, pointInPolygon } from "../utils/pointInPolygon";

export const DISTRICT_UNLOCK_THRESHOLD = 80;

export type GameDistrict = {
  id: string;
  name: string;
  shortName: string;
  bounds: MapBounds;
  center: [number, number];
  labelPosition: [number, number];
  labelAnchor: "left" | "right" | "top" | "bottom";
  totalHexes: number;
  neighbors: string[];
  geometry: Polygon | MultiPolygon;
};

function exteriorLabel(
  bounds: MapBounds,
  cityCenter: [number, number],
): { position: [number, number]; anchor: GameDistrict["labelAnchor"] } {
  const cx = (bounds.west + bounds.east) / 2;
  const cy = (bounds.south + bounds.north) / 2;
  const [ccLng, ccLat] = cityCenter;
  const dx = cx - ccLng;
  const dy = cy - ccLat;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;

  const halfW = (bounds.east - bounds.west) / 2;
  const halfH = (bounds.north - bounds.south) / 2;
  const push = Math.max(halfW, halfH) * 0.55 + 0.004;

  const lng = cx + nx * push;
  const lat = cy + ny * push;

  let anchor: GameDistrict["labelAnchor"];
  if (Math.abs(nx) >= Math.abs(ny)) {
    anchor = nx > 0 ? "left" : "right";
  } else {
    anchor = ny > 0 ? "top" : "bottom";
  }

  return { position: [lng, lat], anchor };
}

function buildDistrictsFromGeo(): GameDistrict[] {
  const districts: GameDistrict[] = [];

  for (const feature of MOSCOW_DISTRICTS_DATA.features) {
    const props = feature.properties ?? {};
    const geometry = feature.geometry;
    if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) continue;

    const id = String(props.districtId ?? "");
    const name = String(props.name ?? id);
    if (!id) continue;

    const bounds: MapBounds = {
      west: Number(props.west),
      south: Number(props.south),
      east: Number(props.east),
      north: Number(props.north),
    };
    const center: [number, number] = [
      Number(props.centerLng ?? (bounds.west + bounds.east) / 2),
      Number(props.centerLat ?? (bounds.south + bounds.north) / 2),
    ];
    const { position, anchor } = exteriorLabel(bounds, MKAD_CENTER);
    const neighbors = Array.isArray(props.neighbors) ? props.neighbors.map(String) : [];

    districts.push({
      id,
      name,
      shortName: String(props.shortName ?? name),
      bounds,
      center,
      labelPosition: position,
      labelAnchor: anchor,
      totalHexes: Number(props.playableCells) || 200,
      neighbors,
      geometry,
    });
  }

  districts.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return districts;
}

export const GAME_DISTRICTS: GameDistrict[] = buildDistrictsFromGeo();

export const MOSCOW_DISTRICTS_GEOJSON = MOSCOW_DISTRICTS_DATA;

export function getDistrictById(id: string): GameDistrict | undefined {
  return GAME_DISTRICTS.find((d) => d.id === id);
}

export function getDistrictIdForCoords(lng: number, lat: number): string | null {
  if (!isInsideMkadRing(lat, lng)) return null;

  for (const district of GAME_DISTRICTS) {
    if (!pointInBounds(lng, lat, district.bounds)) continue;
    if (pointInPolygon(lng, lat, district.geometry)) return district.id;
  }

  return null;
}

export function isInsideMkad(lat: number, lng: number): boolean {
  return isInsideMkadRing(lat, lng);
}

export function getDistrictsNearHome(homeDistrictId: string): GameDistrict[] {
  const home = getDistrictById(homeDistrictId);
  if (!home) return GAME_DISTRICTS.slice(0, 20);
  const neighborIds = new Set([homeDistrictId, ...home.neighbors]);
  return GAME_DISTRICTS.filter((d) => neighborIds.has(d.id));
}
