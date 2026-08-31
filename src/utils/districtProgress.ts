import { DISTRICT_UNLOCK_THRESHOLD, GAME_DISTRICTS, getDistrictById, type GameDistrict } from "../constants/districts";
import { DISTRICT_PLAYABLE_CELLS } from "./districtGeometry";
import { getUnlockOrder } from "./homeDistrict";

export type DistrictStates = {
  progress: Record<string, number>;
  unlocked: Record<string, boolean>;
  revealed: Record<string, number>;
  total: Record<string, number>;
  homeDistrictId: string;
};

export function computeDistrictStates(
  visited: ReadonlySet<string>,
  homeDistrictId: string,
): DistrictStates {
  const progress: Record<string, number> = {};
  const unlocked: Record<string, boolean> = {};
  const revealed: Record<string, number> = {};
  const total: Record<string, number> = {};

  for (const district of GAME_DISTRICTS) {
    const cells = DISTRICT_PLAYABLE_CELLS.get(district.id) ?? [];
    const count = cells.filter((idx) => visited.has(idx)).length;
    const cellTotal = cells.length || district.totalHexes;

    revealed[district.id] = count;
    total[district.id] = cellTotal;
    progress[district.id] = Math.min(100, Math.round((count / cellTotal) * 100));
  }

  const unlockOrder = getUnlockOrder(homeDistrictId);
  for (let i = 0; i < unlockOrder.length; i++) {
    const districtId = unlockOrder[i]!;
    if (i === 0) {
      unlocked[districtId] = true;
      continue;
    }
    const prevId = unlockOrder[i - 1]!;
    unlocked[districtId] = (progress[prevId] ?? 0) >= DISTRICT_UNLOCK_THRESHOLD;
  }

  return { progress, unlocked, revealed, total, homeDistrictId };
}

export function getUnlockHint(district: GameDistrict, states: DistrictStates): string | null {
  if (states.unlocked[district.id]) return null;

  const unlockOrder = getUnlockOrder(states.homeDistrictId);
  const idx = unlockOrder.indexOf(district.id);
  if (idx <= 0) return null;

  const prevId = unlockOrder[idx - 1]!;
  const req = getDistrictById(prevId);
  const reqProgress = states.progress[prevId] ?? 0;
  const remaining = Math.max(0, DISTRICT_UNLOCK_THRESHOLD - reqProgress);
  return `Исследуйте «${req?.name ?? ""}» ещё на ${remaining}%`;
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
