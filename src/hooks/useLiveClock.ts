import { useEffect, useState } from "react";

function formatClock(date: Date): string {
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function useLiveClock(updateMs = 30_000): string {
  const [time, setTime] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const tick = () => setTime(formatClock(new Date()));
    tick();
    const id = window.setInterval(tick, updateMs);
    return () => window.clearInterval(id);
  }, [updateMs]);

  return time;
}
