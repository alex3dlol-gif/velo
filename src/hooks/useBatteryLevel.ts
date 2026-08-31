import { useEffect, useState } from "react";

type BatteryState = {
  level: number | null;
  charging: boolean;
  supported: boolean;
};

export function useBatteryLevel(): BatteryState {
  const [state, setState] = useState<BatteryState>({
    level: null,
    charging: false,
    supported: false,
  });

  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManager>;
    };
    if (!nav.getBattery) return;

    let battery: BatteryManager | null = null;
    let cancelled = false;

    const sync = () => {
      if (!battery) return;
      setState({
        level: Math.round(battery.level * 100),
        charging: battery.charging,
        supported: true,
      });
    };

    nav
      .getBattery()
      .then((b) => {
        if (cancelled) return;
        battery = b;
        sync();
        b.addEventListener("levelchange", sync);
        b.addEventListener("chargingchange", sync);
      })
      .catch(() => {
        /* Battery API unavailable (iOS Safari) */
      });

    return () => {
      cancelled = true;
      if (!battery) return;
      battery.removeEventListener("levelchange", sync);
      battery.removeEventListener("chargingchange", sync);
    };
  }, []);

  return state;
}
