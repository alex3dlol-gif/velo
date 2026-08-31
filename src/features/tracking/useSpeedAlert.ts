import { useEffect, useRef } from "react";
import { vibrateSpeedWarning } from "../../utils/haptics";

const SPEED_LIMIT_KMH = 25;
const COOLDOWN_MS = 15_000;

/** Предупреждающая вибрация при скорости выше порога (анти-спуфинг). */
export function useSpeedAlert(speedKmh: number, enabled: boolean) {
  const lastAlertRef = useRef(0);

  useEffect(() => {
    if (!enabled || speedKmh <= SPEED_LIMIT_KMH) return;
    const now = Date.now();
    if (now - lastAlertRef.current < COOLDOWN_MS) return;
    lastAlertRef.current = now;
    vibrateSpeedWarning();
  }, [speedKmh, enabled]);
}
