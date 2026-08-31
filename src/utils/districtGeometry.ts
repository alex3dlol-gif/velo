import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";
import { cellToLatLng, polygonToCells } from "h3-js";
import { GAME_DISTRICTS, getDistrictById, getDistrictIdForCoords, isInsideMkad, type GameDistrict } from "../constants/districts";
import type { MapBounds } from "../types/map";
import { H3_RESOLUTION } from "../constants/h3";
import { isNatureWaterCell } from "./natureReveals";
import type { DistrictStates } from "./districtProgress";

function boundsToRing(bounds: MapBounds): [number, number][] {
  return [
    [bounds.north, bounds.west],
    [bounds.north, bounds.east],
    [bounds.south, bounds.east],
    [bounds.south, bounds.west],
  ];
}

function boundsPolygon(bounds: MapBounds): [number, number][] {
  const { west, south, east, north } = bounds;
  return [
    [west, south],
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

export function getDistrictIdForCell(h3Index: string): string | null {
  const [lat, lng] = cellToLatLng(h3Index);
  return getDistrictIdForCoords(lng, lat);
}

export function getDistrictForCell(h3Index: string): string {
  const id = getDistrictIdForCell(h3Index);
  if (!id) return "Москва";
  return getDistrictById(id)?.name ?? "Москва";
}

/** Precomputed playable hex indices per district (non-overlapping grid). */
export const DISTRICT_PLAYABLE_CELLS = new Map<string, string[]>();

for (const district of GAME_DISTRICTS) {
  try {
    const cells = polygonToCells(boundsToRing(district.bounds), H3_RESOLUTION).filter(
      (idx) => getDistrictIdForCell(idx) === district.id && !isNatureWaterCell(idx),
    );
    DISTRICT_PLAYABLE_CELLS.set(district.id, cells);
    district.totalHexes = cells.length || district.totalHexes;
  } catch {
    DISTRICT_PLAYABLE_CELLS.set(district.id, []);
  }
}

export function getDistrictForCoords(lat: number, lng: number): string {
  const id = getDistrictIdForCoords(lng, lat);
  if (!id) return "Москва";
  return getDistrictById(id)?.name ?? "Москва";
}

export function isDistrictCellPlayable(h3Index: string, states: DistrictStates): boolean {
  if (isNatureWaterCell(h3Index)) return false;
  const districtId = getDistrictIdForCell(h3Index);
  if (!districtId) {
    const [lat, lng] = cellToLatLng(h3Index);
    return isInsideMkad(lat, lng);
  }
  return states.unlocked[districtId] ?? false;
}

export function buildDistrictBoundaries(states: DistrictStates): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = GAME_DISTRICTS.map((district) => ({
    type: "Feature",
    properties: {
      districtId: district.id,
      name: district.name,
      shortName: district.shortName,
      unlocked: states.unlocked[district.id],
      progress: states.progress[district.id] ?? 0,
      locked: !states.unlocked[district.id],
    },
    geometry: {
      type: "Polygon",
      coordinates: [boundsPolygon(district.bounds)],
    },
  }));

  return { type: "FeatureCollection", features };
}

function anchorToTextOffset(anchor: GameDistrict["labelAnchor"]): [number, number] {
  switch (anchor) {
    case "left":
      return [1.1, 0];
    case "right":
      return [-1.1, 0];
    case "top":
      return [0, 1.2];
    case "bottom":
      return [0, -1.2];
  }
}

function anchorToTextJustify(anchor: GameDistrict["labelAnchor"]): "left" | "right" | "center" {
  if (anchor === "left") return "left";
  if (anchor === "right") return "right";
  return "center";
}

function anchorToTextAnchor(anchor: GameDistrict["labelAnchor"]): "left" | "right" | "top" | "bottom" | "center" {
  if (anchor === "left") return "right";
  if (anchor === "right") return "left";
  if (anchor === "top") return "bottom";
  if (anchor === "bottom") return "top";
  return "center";
}

export function buildDistrictLabels(states: DistrictStates): FeatureCollection<Point> {
  const features: Feature<Point>[] = GAME_DISTRICTS.map((district) => {
    const unlocked = states.unlocked[district.id];
    const progress = states.progress[district.id] ?? 0;
    const [lng, lat] = district.labelPosition;

    let statusLine: string;
    if (unlocked) {
      statusLine = `${progress}%`;
    } else if (district.unlockAfter) {
      const req = getDistrictById(district.unlockAfter.districtId);
      statusLine = `🔒 ${req?.shortName ?? ""}`;
    } else {
      statusLine = "🔒";
    }

    return {
      type: "Feature",
      properties: {
        districtId: district.id,
        name: district.shortName,
        statusLine,
        unlocked,
        progress,
        textAnchor: anchorToTextAnchor(district.labelAnchor),
        textJustify: anchorToTextJustify(district.labelAnchor),
        textOffsetX: anchorToTextOffset(district.labelAnchor)[0],
        textOffsetY: anchorToTextOffset(district.labelAnchor)[1],
      },
      geometry: { type: "Point", coordinates: [lng, lat] },
    };
  });

  return { type: "FeatureCollection", features };
}

/** Тонкие линии-указатели от подписи к границе зоны. */
export function buildDistrictLeaderLines(states: DistrictStates): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = GAME_DISTRICTS.map((district) => {
    const [labelLng, labelLat] = district.labelPosition;
    const [cx, cy] = district.center;
    return {
      type: "Feature",
      properties: {
        districtId: district.id,
        unlocked: states.unlocked[district.id],
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [labelLng, labelLat],
          [cx, cy],
        ],
      },
    };
  });

  return { type: "FeatureCollection", features };
}

export function getDistrictAtPoint(lat: number, lng: number): GameDistrict | null {
  const id = getDistrictIdForCoords(lng, lat);
  return id ? (getDistrictById(id) ?? null) : null;
}
