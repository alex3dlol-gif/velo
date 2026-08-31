import { createContext, useContext, useState, type ReactNode } from "react";

export type Tab = "map" | "log" | "leaders" | "quests" | "settings";
export type Travel = "bike" | "walk";

type AppContextValue = {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  travel: Travel;
  setTravel: (travel: Travel) => void;
  isExploring: boolean;
  setIsExploring: (v: boolean) => void;
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
  startExploring: () => void;
  stopExploring: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [travel, setTravel] = useState<Travel>("bike");
  const [isExploring, setIsExploring] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const startExploring = () => {
    setIsPaused(false);
    setIsExploring(true);
  };

  const stopExploring = () => {
    setIsPaused(false);
    setIsExploring(false);
  };

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
