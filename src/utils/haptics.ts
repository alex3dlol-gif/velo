const HAPTICS_KEY = "veilo-haptics-enabled";

export function isHapticsSupported(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function isHapticsEnabled(): boolean {
  if (!isHapticsSupported()) return false;
  try {
    const raw = localStorage.getItem(HAPTICS_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(HAPTICS_KEY, String(enabled));
  } catch {
    /* ignore */
  }
}

function vibrate(pattern: number | number[]): void {
  if (!isHapticsEnabled()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/** Двойной импульс при открытии нового H3-сектора. */
export function vibrateNewHex(): void {
  vibrate([120, 80, 120]);
}

/** Предупреждение о высокой скорости (>25 км/ч). */
export function vibrateSpeedWarning(): void {
  vibrate([300]);
}

export function cancelVibration(): void {
  if (!isHapticsSupported()) return;
  try {
    navigator.vibrate(0);
  } catch {
    /* ignore */
  }
}
