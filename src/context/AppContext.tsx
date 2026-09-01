import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { RouteGeoJSON } from "../types/sector";

export type Tab = "map" | "log" | "leaders" | "quests" | "settings";
export type Travel = "bike" | "walk";

const TRAVEL_KEY = "veilo-travel-mode";

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
  }, []);

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
        setIsPaused,
        isNavigating,
        activeRoute,
        routeTargetHex,
        setActiveRoute,
        clearRoute,
        speedBlocked,
        setSpeedBlocked,
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
