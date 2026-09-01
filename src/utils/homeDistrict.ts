import { GAME_DISTRICTS, getDistrictById, getDistrictIdForCoords } from "../constants/districts";
import { MKAD_CENTER } from "../constants/mkad";

const STORAGE_KEY = "veilo-home-district";

export function getUnlockOrder(homeDistrictId: string): readonly string[] {
  const home = getDistrictById(homeDistrictId);
  if (!home) return GAME_DISTRICTS.map((d) => d.id);

  const [homeLng, homeLat] = home.center;
  return [...GAME_DISTRICTS]
    .sort((a, b) => {
      const [alng, alat] = a.center;
      const [blng, blat] = b.center;
      const da = (alng - homeLng) ** 2 + (alat - homeLat) ** 2;
      const db = (blng - homeLng) ** 2 + (blat - homeLat) ** 2;
      return da - db;
    })
    .map((d) => d.id);
}

export function resolveHomeDistrictId(lat: number, lng: number): string {
  return (
    getDistrictIdForCoords(lng, lat) ??
    getDistrictIdForCoords(MKAD_CENTER[0], MKAD_CENTER[1]) ??
    GAME_DISTRICTS[0]?.id ??
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
