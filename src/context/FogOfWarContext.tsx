import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useFogOfWar } from "../hooks/useFogOfWar";
import { useApp } from "./AppContext";
import { installOfflineSyncListener } from "../features/tracking/offlineHexQueue";

type FogOfWarContextValue = ReturnType<typeof useFogOfWar>;

const FogOfWarContext = createContext<FogOfWarContextValue | null>(null);

export function FogOfWarProvider({ children }: { children: ReactNode }) {
  const fog = useFogOfWar();
  const { isExploring } = useApp();

  useEffect(() => {
    if (isExploring) fog.resetSession();
  }, [isExploring]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => installOfflineSyncListener(), []);

  return <FogOfWarContext.Provider value={fog}>{children}</FogOfWarContext.Provider>;
}

export function useFogOfWarContext() {
  const ctx = useContext(FogOfWarContext);
  if (!ctx) throw new Error("useFogOfWarContext must be used within FogOfWarProvider");
  return ctx;
}
