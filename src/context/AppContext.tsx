import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { RouteGeoJSON } from "../types/sector";

export type Tab = "map" | "log" | "leaders" | "quests" | "settings";
export type Travel = "bike" | "walk";

const TRAVEL_KEY = "veilo-travel-mode";
const JOURNAL_UPDATED_EVENT = "veilo-journal-updated";

export function notifyJournalUpdated() {
  window.dispatchEvent(new Event(JOURNAL_UPDATED_EVENT));
}

export function onJournalUpdated(listener: () => void): () => void {
  window.addEventListener(JOURNAL_UPDATED_EVENT, listener);
  return () => window.removeEventListener(JOURNAL_UPDATED_EVENT, listener);
}

function loadTravel(): Travel {
  try {
    const v = localStorage.getItem(TRAVEL_KEY);
    if (v === "walk" || v === "bike") return v;
  } catch {
    /* ignore */
  }
  return "bike";
}

type AppContextValue = {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  travel: Travel;
  setTravel: (travel: Travel) => void;
  isExploring: boolean;
  setIsExploring: (v: boolean) => void;
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
  isNavigating: boolean;
  activeRoute: RouteGeoJSON | null;
  routeTargetHex: string | null;
  setActiveRoute: (route: RouteGeoJSON | null, targetHex?: string | null) => void;
  clearRoute: () => void;
  speedBlocked: boolean;
  setSpeedBlocked: (v: boolean) => void;
  exploreStartedAt: number | null;
  getExploreElapsedMs: () => number;
  startExploring: (navigate?: boolean) => void;
  stopExploring: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [travel, setTravelState] = useState<Travel>(loadTravel);
  const [isExploring, setIsExploring] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeRoute, setActiveRouteState] = useState<RouteGeoJSON | null>(null);
  const [routeTargetHex, setRouteTargetHex] = useState<string | null>(null);
  const [speedBlocked, setSpeedBlocked] = useState(false);
  const [exploreStartedAt, setExploreStartedAt] = useState<number | null>(null);
  const [explorePausedMs, setExplorePausedMs] = useState(0);
  const explorePausedMsRef = useRef(0);
  const explorePauseStartedRef = useRef<number | null>(null);

  const setTravel = useCallback((mode: Travel) => {
    setTravelState(mode);
    try {
      localStorage.setItem(TRAVEL_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const setActiveRoute = useCallback((route: RouteGeoJSON | null, targetHex: string | null = null) => {
    setActiveRouteState(route);
    setRouteTargetHex(targetHex);
  }, []);

  const clearRoute = useCallback(() => {
    setActiveRouteState(null);
    setRouteTargetHex(null);
    setIsNavigating(false);
  }, []);

  const startExploring = useCallback(
    (navigate = false) => {
      const now = Date.now();
      explorePausedMsRef.current = 0;
      explorePauseStartedRef.current = null;
      setExplorePausedMs(0);
      setExploreStartedAt(now);
      setIsPaused(false);
      setIsNavigating(navigate && activeRoute != null);
      setIsExploring(true);
    },
    [activeRoute],
  );

  const stopExploring = useCallback(() => {
    setIsPaused(false);
    setIsExploring(false);
    setIsNavigating(false);
    setSpeedBlocked(false);
    setExploreStartedAt(null);
    explorePausedMsRef.current = 0;
    explorePauseStartedRef.current = null;
    setExplorePausedMs(0);
  }, []);

  const setIsPausedTracked = useCallback((paused: boolean) => {
    const now = Date.now();
    setIsPaused((wasPaused) => {
      if (paused === wasPaused) return wasPaused;
      if (paused) {
        explorePauseStartedRef.current = now;
      } else if (explorePauseStartedRef.current != null) {
        explorePausedMsRef.current += now - explorePauseStartedRef.current;
        explorePauseStartedRef.current = null;
        setExplorePausedMs(explorePausedMsRef.current);
      }
      return paused;
    });
  }, []);

  const getExploreElapsedMs = useCallback(() => {
    if (exploreStartedAt == null) return 0;
    const now = Date.now();
    const currentPause =
      explorePauseStartedRef.current != null ? now - explorePauseStartedRef.current : 0;
    return Math.max(0, now - exploreStartedAt - explorePausedMsRef.current - currentPause);
  }, [exploreStartedAt, explorePausedMs]);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        travel,
        setTravel,
        isExploring,
        setIsExploring,
        isPaused,
        setIsPaused: setIsPausedTracked,
        isNavigating,
        activeRoute,
        routeTargetHex,
        setActiveRoute,
        clearRoute,
        speedBlocked,
        setSpeedBlocked,
        exploreStartedAt,
        getExploreElapsedMs,
        startExploring,
        stopExploring,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
