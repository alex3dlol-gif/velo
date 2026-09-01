import type { Feature, FeatureCollection, LineString, MultiPolygon, Point, Polygon } from "geojson";
import { cellToLatLng } from "h3-js";
import {
  GAME_DISTRICTS,
  getDistrictById,
  getDistrictIdForCoords,
  isInsideMkad,
  type GameDistrict,
} from "../constants/districts";
import { getDistrictZoneColor } from "../constants/districtColors";
import type { DistrictStates } from "./districtProgress";

export function getDistrictIdForCell(h3Index: string): string | null {
  const [lat, lng] = cellToLatLng(h3Index);
  return getDistrictIdForCoords(lng, lat);
}

export function getDistrictForCell(h3Index: string): string {
  const id = getDistrictIdForCell(h3Index);
  if (!id) return "Москва";
  return getDistrictById(id)?.name ?? "Москва";
}

export function getDistrictForCoords(lat: number, lng: number): string {
  const id = getDistrictIdForCoords(lng, lat);
  if (!id) return "Москва";
  return getDistrictById(id)?.name ?? "Москва";
}

export function isDistrictCellPlayable(h3Index: string, states: DistrictStates): boolean {
  const districtId = getDistrictIdForCell(h3Index);
  if (!districtId) {
    const [lat, lng] = cellToLatLng(h3Index);
    return isInsideMkad(lat, lng);
  }
  return states.unlocked[districtId] ?? false;
}

export function buildDistrictBoundaries(states: DistrictStates): FeatureCollection<Polygon | MultiPolygon> {
  const features: Feature<Polygon | MultiPolygon>[] = GAME_DISTRICTS.map((district) => ({
    type: "Feature",
    properties: {
      districtId: district.id,
      name: district.name,
      shortName: district.shortName,
      unlocked: states.unlocked[district.id],
      progress: states.progress[district.id] ?? 0,
      locked: !states.unlocked[district.id],
      zoneColor: getDistrictZoneColor(district.id),
      isHome: district.id === states.homeDistrictId,
    },
    geometry: district.geometry,
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

function shouldShowDistrictLabel(district: GameDistrict, states: DistrictStates): boolean {
  if (district.id === states.homeDistrictId) return true;
  if (states.unlocked[district.id]) return true;
  if ((states.progress[district.id] ?? 0) > 0) return true;
  return district.neighbors.some((n) => states.unlocked[n]);
}

export function buildDistrictLabels(states: DistrictStates): FeatureCollection<Point> {
  const features: Feature<Point>[] = GAME_DISTRICTS.filter((d) => shouldShowDistrictLabel(d, states)).map(
    (district) => {
      const unlocked = states.unlocked[district.id];
      const progress = states.progress[district.id] ?? 0;
      const [lng, lat] = district.labelPosition;

      let statusLine: string;
      if (unlocked) {
        statusLine = district.id === states.homeDistrictId ? `🏠 ${progress}%` : `✦ ${progress}%`;
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
          isHome: district.id === states.homeDistrictId,
          zoneColor: getDistrictZoneColor(district.id),
          textAnchor: anchorToTextAnchor(district.labelAnchor),
          textJustify: anchorToTextJustify(district.labelAnchor),
          textOffsetX: anchorToTextOffset(district.labelAnchor)[0],
          textOffsetY: anchorToTextOffset(district.labelAnchor)[1],
        },
        geometry: { type: "Point", coordinates: [lng, lat] },
      };
    },
  );

  return { type: "FeatureCollection", features };
}

export function buildDistrictLeaderLines(states: DistrictStates): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = GAME_DISTRICTS.filter((d) => shouldShowDistrictLabel(d, states)).map(
    (district) => {
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
    },
  );

  return { type: "FeatureCollection", features };
}

export function getDistrictAtPoint(lat: number, lng: number): GameDistrict | null {
  const id = getDistrictIdForCoords(lng, lat);
  return id ? (getDistrictById(id) ?? null) : null;
}
