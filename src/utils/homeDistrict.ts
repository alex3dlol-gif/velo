import { getDistrictById, getDistrictIdForCoords } from "../constants/districts";
import { MKAD_CENTER } from "../constants/mkad";

const STORAGE_KEY = "veilo-home-district";

/** Базовый порядок разблокировки (спираль); стартовый район — первый в цепочке. */
export const BASE_UNLOCK_ORDER = [
  "chertanovo",
  "hamovniki",
  "zamoskvorechye",
  "ochakovo",
  "tagansky",
  "fili",
  "tverskoy",
  "marino",
  "ramenki",
  "sokolniki",
  "sokol",
  "izmailovo",
] as const;

export type HomeDistrictId = (typeof BASE_UNLOCK_ORDER)[number];

export function getUnlockOrder(homeDistrictId: string): readonly string[] {
  const idx = BASE_UNLOCK_ORDER.indexOf(homeDistrictId as HomeDistrictId);
  if (idx <= 0) return BASE_UNLOCK_ORDER;
  return [...BASE_UNLOCK_ORDER.slice(idx), ...BASE_UNLOCK_ORDER.slice(0, idx)];
}

export function resolveHomeDistrictId(lat: number, lng: number): string {
  return (
    getDistrictIdForCoords(lng, lat) ??
    getDistrictIdForCoords(MKAD_CENTER[0], MKAD_CENTER[1]) ??
    "hamovniki"
  );
}

export function loadStoredHomeDistrictId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && getDistrictById(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function storeHomeDistrictId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function fallbackHomeDistrictId(): string {
  return resolveHomeDistrictId(MKAD_CENTER[1], MKAD_CENTER[0]);
}
