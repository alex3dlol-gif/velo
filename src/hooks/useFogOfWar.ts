import { useCallback, useEffect, useMemo, useState } from "react";
import { computeDistrictStates } from "../utils/districtProgress";
import { isCellExplorable } from "../utils/cellPlayability";
import { recordSectorVisit } from "../utils/sectorStats";
import { getDistrictById } from "../constants/districts";
import { vibrateNewHex } from "../utils/haptics";
import { queueHexReveal } from "../features/tracking/offlineHexQueue";
import type { GeoPosition } from "./useGeolocation";
import { useHomeDistrictId } from "./useHomeDistrictId";

const STORAGE_KEY = "veilo-visited-hexes";

function loadVisited(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveVisited(hexes: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...hexes]));
  } catch {
    /* ignore */
  }
}

export function useFogOfWar(position: GeoPosition | null) {
  const [visited, setVisited] = useState<Set<string>>(loadVisited);
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const [sessionRevealed, setSessionRevealed] = useState(0);
  const homeDistrictId = useHomeDistrictId(position);

  const resetSession = useCallback(() => setSessionRevealed(0), []);

  useEffect(() => {
    saveVisited(visited);
  }, [visited]);

  const districtStates = useMemo(
    () => computeDistrictStates(visited, homeDistrictId),
    [visited, homeDistrictId],
  );

  const homeDistrict = useMemo(
    () => getDistrictById(homeDistrictId) ?? getDistrictById("hamovniki")!,
    [homeDistrictId],
  );

  const revealHex = useCallback(
    (h3Index: string): boolean => {
      let isNew = false;
      setVisited((prev) => {
        const states = computeDistrictStates(prev, homeDistrictId);
        if (!isCellExplorable(h3Index, states)) return prev;
        if (prev.has(h3Index)) return prev;
        isNew = true;
        const next = new Set(prev);
        next.add(h3Index);
        return next;
      });

      if (isNew) {
        vibrateNewHex();
        if (!navigator.onLine) void queueHexReveal(h3Index);
        recordSectorVisit(h3Index, true);
        setSessionRevealed((n) => n + 1);
        setFlashing((prev) => new Set(prev).add(h3Index));
        window.setTimeout(() => {
          setFlashing((prev) => {
            const next = new Set(prev);
            next.delete(h3Index);
            return next;
          });
        }, 900);
      }

      return isNew;
    },
    [homeDistrictId],
  );

  const visitedCount = visited.size;
  const progressPct = districtStates.progress[homeDistrictId] ?? 0;

  return {
    visited,
    flashing,
    visitedCount,
    sessionRevealed,
    progressPct,
    homeDistrict,
    homeDistrictId,
    revealHex,
    resetSession,
    isVisited: (h3Index: string) => visited.has(h3Index),
    districtStates,
  };
}
