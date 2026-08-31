import { type ReactNode } from "react";
import { useApp } from "../../context/AppContext";
import { useWakeLock } from "./useWakeLock";
import { StealthProvider } from "./StealthProvider";

type ExploreTrackingProviderProps = {
  children: ReactNode;
};

/** Обёртка вылазки: Wake Lock + таймер стелс-режима. */
export function ExploreTrackingProvider({ children }: ExploreTrackingProviderProps) {
  const { isExploring, isPaused } = useApp();
  const trackingActive = isExploring && !isPaused;

  useWakeLock(trackingActive);

  return <StealthProvider enabled={trackingActive}>{children}</StealthProvider>;
}
