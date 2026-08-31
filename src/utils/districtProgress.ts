import { cellToLatLng } from "h3-js";
import { GAME_DISTRICTS, getDistrictById, type GameDistrict } from "../constants/districts";
import { DISTRICT_PLAYABLE_CELLS } from "./districtGeometry";

export type DistrictStates = {
  progress: Record<string, number>;
  unlocked: Record<string, boolean>;
  revealed: Record<string, number>;
  total: Record<string, number>;
};

export function computeDistrictStates(visited: ReadonlySet<string>): DistrictStates {
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

  for (const district of GAME_DISTRICTS) {
    if (!district.unlockAfter) {
      unlocked[district.id] = true;
      continue;
    }
    const reqProgress = progress[district.unlockAfter.districtId] ?? 0;
    unlocked[district.id] = reqProgress >= district.unlockAfter.thresholdPct;
  }

  return { progress, unlocked, revealed, total };
}

export function getUnlockHint(district: GameDistrict, states: DistrictStates): string | null {
  if (states.unlocked[district.id] || !district.unlockAfter) return null;
  const req = getDistrictById(district.unlockAfter.districtId);
  const reqProgress = states.progress[district.unlockAfter.districtId] ?? 0;
  const remaining = Math.max(0, district.unlockAfter.thresholdPct - reqProgress);
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
