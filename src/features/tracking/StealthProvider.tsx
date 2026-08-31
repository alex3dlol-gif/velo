import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const INACTIVITY_MS = 12_000;

type StealthContextValue = {
  isStealthActive: boolean;
  registerActivity: () => void;
};

const StealthContext = createContext<StealthContextValue | null>(null);

export function useStealth() {
  const ctx = useContext(StealthContext);
  if (!ctx) throw new Error("useStealth must be used within StealthProvider");
  return ctx;
}

type StealthProviderProps = {
  enabled: boolean;
  children: ReactNode;
};

export function StealthProvider({ enabled, children }: StealthProviderProps) {
  const [isStealthActive, setIsStealthActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleStealth = useCallback(() => {
    clearTimer();
    if (!enabled) return;
    timerRef.current = setTimeout(() => setIsStealthActive(true), INACTIVITY_MS);
  }, [clearTimer, enabled]);

  const registerActivity = useCallback(() => {
    setIsStealthActive(false);
    scheduleStealth();
  }, [scheduleStealth]);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      setIsStealthActive(false);
      return;
    }
    scheduleStealth();
    return clearTimer;
  }, [enabled, scheduleStealth, clearTimer]);

  return (
    <StealthContext.Provider value={{ isStealthActive, registerActivity }}>
      {children}
    </StealthContext.Provider>
  );
}
