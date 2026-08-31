import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "sunlight" | "amoled";

type ThemeContextValue = {
  mode: ThemeMode;
  isAmoled: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleAmoled: () => void;
};

const STORAGE_KEY = "veilo-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "amoled" || stored === "sunlight") return stored;
  } catch {
    /* ignore */
  }
  return "sunlight";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredTheme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const setMode = (next: ThemeMode) => setModeState(next);
  const toggleAmoled = () => setModeState((m) => (m === "amoled" ? "sunlight" : "amoled"));

  return (
    <ThemeContext.Provider
      value={{ mode, isAmoled: mode === "amoled", setMode, toggleAmoled }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
