import { cellToLatLng } from "h3-js";
import { isInsideMkad } from "../constants/districts";
import { isNatureWaterCell, NATURE_WATER_LABEL } from "./natureReveals";
import { getDistrictById } from "../constants/districts";
import { getUnlockHint } from "./districtProgress";
import type { DistrictStates } from "./districtProgress";
import { getDistrictIdForCell, isDistrictCellPlayable } from "./districtGeometry";

export type CellAccessStatus = "playable" | "nature" | "district-locked";

export type FullCellAccess =
  | { status: "playable" }
  | { status: "nature"; label: string }
  | { status: "district-locked"; label: string };

export function getFullCellAccess(h3Index: string, states: DistrictStates): FullCellAccess {
  if (isNatureWaterCell(h3Index)) {
    return { status: "nature", label: NATURE_WATER_LABEL };
  }

  if (!isDistrictCellPlayable(h3Index, states)) {
    const districtId = getDistrictIdForCell(h3Index);
    const district = districtId ? getDistrictById(districtId) : null;
    const hint = district ? getUnlockHint(district, states) : null;
    return {
      status: "district-locked",
      label: hint ?? (district ? `Район закрыт · ${district.name}` : "Район закрыт"),
    };
  }

  return { status: "playable" };
}

/** Можно снять туман войны (пешая разведка). */
export function isCellExplorable(h3Index: string, states: DistrictStates): boolean {
  return getFullCellAccess(h3Index, states).status === "playable";
}

/** Можно построить маршрут (внутри МКАД, не вода). */
export function isCellRoutable(h3Index: string): boolean {
  if (isNatureWaterCell(h3Index)) return false;
  const [lat, lng] = cellToLatLng(h3Index);
  return isInsideMkad(lat, lng);
}

/** Можно построить маршрут и засчитать визит. */
export function isCellInteractive(h3Index: string, states: DistrictStates): boolean {
  return isCellRoutable(h3Index) && isDistrictCellPlayable(h3Index, states);
}
