import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { formatRideDuration } from "../utils/rideDuration";

/** Тикающий таймер активной вылазки (без паузы). */
export function useRideTimer(active: boolean): string {
  const { getExploreElapsedMs } = useApp();
  const [label, setLabel] = useState("00:00");

  useEffect(() => {
    if (!active) {
      setLabel("00:00");
      return;
    }

    const tick = () => setLabel(formatRideDuration(getExploreElapsedMs()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, getExploreElapsedMs]);

  return label;
}
