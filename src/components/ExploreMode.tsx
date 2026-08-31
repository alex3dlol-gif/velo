import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import SplitScreen from "./SplitScreen";
import VeiloMap from "./map/VeiloMap";
import { Metric } from "./shared";
import { SECTOR_LABEL } from "../constants/units";
import { useApp } from "../context/AppContext";
import { useFogOfWarContext } from "../context/FogOfWarContext";
import { useGeolocation } from "../hooks/useGeolocation";
import {
  ExploreTrackingProvider,
  StealthOverlay,
  useSpeedAlert,
  useStealth,
} from "../features/tracking";

const EXPLORE_SPLIT_KEY = "veilo-explore-split";

export default function ExploreMode() {
  return (
    <ExploreTrackingProvider>
      <ExploreModeContent />
    </ExploreTrackingProvider>
  );
}

function ExploreModeContent() {
  const { isExploring, isPaused, setIsPaused, stopExploring } = useApp();
  const { sessionRevealed } = useFogOfWarContext();
  const { position } = useGeolocation(true);
  const { registerActivity } = useStealth();
  const [dist, setDist] = useState(0);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const speedKmh = position?.speed != null ? Math.max(0, position.speed * 3.6) : 0;
  const trackingActive = isExploring && !isPaused;

  useSpeedAlert(speedKmh, trackingActive);

  useEffect(() => {
    if (isPaused || !position) return;
    const prev = lastPosRef.current;
    if (prev) {
      const dLat = (position.lat - prev.lat) * 111;
      const dLng = (position.lng - prev.lng) * 111 * Math.cos((position.lat * Math.PI) / 180);
      setDist((d) => +(d + Math.sqrt(dLat * dLat + dLng * dLng)).toFixed(3));
    }
    lastPosRef.current = { lat: position.lat, lng: position.lng };
  }, [position, isPaused]);

  return (
    <div
      className="relative h-full"
      onPointerDown={registerActivity}
      onTouchStart={registerActivity}
    >
      <SplitScreen
        storageKey={EXPLORE_SPLIT_KEY}
        defaultRatio={0.68}
        map={
          <div className="relative h-full">
            <VeiloMap showHeader={false} autoFollow />
            <div
              className="absolute top-3 left-3 font-mono text-[10px] px-2 py-1 rounded-md uppercase tracking-widest flex items-center gap-1.5 z-10"
              style={{ background: "var(--surface)", color: "var(--terracotta)", border: "1px solid var(--line)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: isPaused ? "var(--ink-soft)" : "var(--terracotta)" }}
              />
              {isPaused ? "на паузе" : "запись трека"}
            </div>
          </div>
        }
        panel={
          <div className="h-full flex flex-col px-4 pt-2 pb-4" style={{ background: "var(--surface)" }}>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="км/ч" value={speedKmh.toFixed(1)} big accent />
              <Metric label="км" value={dist.toFixed(2)} big />
              <Metric label={SECTOR_LABEL} value={`+${sessionRevealed}`} big accent />
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-auto">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="rounded-xl py-3 font-mono text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition active:scale-[.98]"
                style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1.5px solid var(--line-strong)" }}
              >
                <Icon name={isPaused ? "chevron" : "pause"} size={16} /> {isPaused ? "продолжить" : "пауза"}
              </button>
              <button
                onClick={stopExploring}
                className="rounded-xl py-3 font-mono text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition active:scale-[.98]"
                style={{ background: "var(--terracotta)", color: "#fff" }}
              >
                <Icon name="stop" size={15} /> завершить
              </button>
            </div>
          </div>
        }
      />

      <StealthOverlay speedKmh={speedKmh} sessionSectors={sessionRevealed} />
    </div>
  );
}
