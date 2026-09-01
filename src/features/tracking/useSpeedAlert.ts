import { useEffect, useRef } from "react";
import { vibrateSpeedWarning } from "../../utils/haptics";

const COOLDOWN_MS = 15_000;

export function useSpeedAlert(speedKmh: number, enabled: boolean, travel: "bike" | "walk" = "bike") {
  const lastAlertRef = useRef(0);
  const limit = travel === "walk" ? 12 : 30;

  useEffect(() => {
    if (!enabled || speedKmh <= limit) return;
    const now = Date.now();
    if (now - lastAlertRef.current < COOLDOWN_MS) return;
    lastAlertRef.current = now;
    vibrateSpeedWarning();
  }, [speedKmh, enabled, travel]);
}
