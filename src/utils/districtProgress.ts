import {
  DISTRICT_UNLOCK_THRESHOLD,
  GAME_DISTRICTS,
  getDistrictById,
  type GameDistrict,
} from "../constants/districts";
import { getUnlockOrder } from "./homeDistrict";
import { getDistrictIdForCell } from "./districtGeometry";
import { isNatureWaterCell } from "./natureReveals";

export type DistrictStates = {
  progress: Record<string, number>;
  unlocked: Record<string, boolean>;
  revealed: Record<string, number>;
  total: Record<string, number>;
  homeDistrictId: string;
};

function computeUnlocked(
  homeDistrictId: string,
  progress: Record<string, number>,
): Record<string, boolean> {
  const unlocked: Record<string, boolean> = {};
  for (const district of GAME_DISTRICTS) unlocked[district.id] = false;
  unlocked[homeDistrictId] = true;

  let changed = true;
  while (changed) {
    changed = false;
    for (const district of GAME_DISTRICTS) {
      if (unlocked[district.id]) continue;
      for (const neighborId of district.neighbors) {
        if (unlocked[neighborId] && (progress[neighborId] ?? 0) >= DISTRICT_UNLOCK_THRESHOLD) {
          unlocked[district.id] = true;
          changed = true;
          break;
        }
      }
    }
  }

  return unlocked;
}

export function computeDistrictStates(
  visited: ReadonlySet<string>,
  homeDistrictId: string,
): DistrictStates {
  const progress: Record<string, number> = {};
  const revealed: Record<string, number> = {};
  const total: Record<string, number> = {};

  for (const district of GAME_DISTRICTS) {
    revealed[district.id] = 0;
    total[district.id] = district.totalHexes;
    progress[district.id] = 0;
  }

  for (const idx of visited) {
    if (isNatureWaterCell(idx)) continue;
    const districtId = getDistrictIdForCell(idx);
    if (!districtId) continue;
    revealed[districtId] = (revealed[districtId] ?? 0) + 1;
  }

  for (const district of GAME_DISTRICTS) {
    const cellTotal = total[district.id] || 1;
    const count = revealed[district.id] ?? 0;
    progress[district.id] = Math.min(100, Math.round((count / cellTotal) * 100));
  }

  const unlocked = computeUnlocked(homeDistrictId, progress);

  return { progress, unlocked, revealed, total, homeDistrictId };
}

export function getUnlockHint(district: GameDistrict, states: DistrictStates): string | null {
  if (states.unlocked[district.id]) return null;

  const readyNeighbors = district.neighbors
    .map((id) => getDistrictById(id))
    .filter((n): n is GameDistrict => !!n && states.unlocked[n.id]);

  if (readyNeighbors.length === 0) {
    return "Сначала исследуйте соседние открытые районы";
  }

  let best: { name: string; remaining: number } | null = null;
  for (const neighbor of readyNeighbors) {
    const reqProgress = states.progress[neighbor.id] ?? 0;
    const remaining = Math.max(0, DISTRICT_UNLOCK_THRESHOLD - reqProgress);
    if (!best || remaining < best.remaining) {
      best = { name: neighbor.shortName, remaining };
    }
  }

  if (!best || best.remaining <= 0) return null;
  return `Исследуйте «${best.name}» ещё на ${best.remaining}%`;
}

export function getDistrictState(
  districtId: string,
  states: DistrictStates,
): {
  district: GameDistrict;
  progress: number;
  unlocked: boolean;
  revealed: number;
  total: number;
  unlockHint: string | null;
} {
  const district = getDistrictById(districtId)!;
  return {
    district,
    progress: states.progress[districtId] ?? 0,
    unlocked: states.unlocked[districtId] ?? false,
    revealed: states.revealed[districtId] ?? 0,
    total: states.total[districtId] ?? district.totalHexes,
    unlockHint: getUnlockHint(district, states),
  };
}

export function getDistrictListForUi(states: DistrictStates): GameDistrict[] {
  const order = getUnlockOrder(states.homeDistrictId);
  const orderIndex = new Map(order.map((id, i) => [id, i]));
  const visible = GAME_DISTRICTS.filter((d) => {
    if (states.unlocked[d.id]) return true;
    if ((states.progress[d.id] ?? 0) > 0) return true;
    return d.neighbors.some((n) => states.unlocked[n]);
  });

  return visible.sort(
    (a, b) =>
      Number(states.unlocked[b.id]) - Number(states.unlocked[a.id]) ||
      (orderIndex.get(a.id) ?? 999) - (orderIndex.get(b.id) ?? 999) ||
      a.name.localeCompare(b.name, "ru"),
  );
}
