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
import { isSpeedAllowed } from "../utils/geoMotion";
import { formatJournalDate, MIN_RIDE_MS, saveRideToJournal } from "../utils/rideJournal";
import { getDistrictForCoords } from "../utils/districtGeometry";

const EXPLORE_SPLIT_KEY = "veilo-explore-split";

export default function ExploreMode() {
  return (
    <ExploreTrackingProvider>
      <ExploreModeContent />
    </ExploreTrackingProvider>
  );
}

function ExploreModeContent() {
  const {
    isExploring,
    isPaused,
    isNavigating,
    travel,
    setIsPaused,
    stopExploring,
    clearRoute,
    setSpeedBlocked,
    speedBlocked,
  } = useApp();
  const { sessionRevealed } = useFogOfWarContext();
  const { position } = useGeolocation(true);
  const { registerActivity } = useStealth();
  const [dist, setDist] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const startedAtRef = useRef(Date.now());
  const photoInputRef = useRef<HTMLInputElement>(null);

  const speedKmh = position?.speedKmh ?? 0;
  const trackingActive = isExploring && !isPaused;

  useSpeedAlert(speedKmh, trackingActive, travel);

  useEffect(() => {
    if (!trackingActive) {
      setSpeedBlocked(false);
      return;
    }
    setSpeedBlocked(!isSpeedAllowed(speedKmh, travel));
  }, [speedKmh, travel, trackingActive, setSpeedBlocked]);

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

  const handlePhoto = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      if (!dataUrl) return;
      setPhotos((prev) => [...prev, dataUrl]);
    };
    reader.readAsDataURL(file);
  };

  const finishRide = () => {
    const duration = Date.now() - startedAtRef.current;
    if (duration >= MIN_RIDE_MS && position) {
      const place = getDistrictForCoords(position.lat, position.lng);
      saveRideToJournal({
        title: isNavigating ? "Маршрут" : "Вылазка",
        place,
        date: formatJournalDate(Date.now()),
        dist: dist.toFixed(1),
        hexes: sessionRevealed,
        img: photos[0] ?? "",
        photos,
        travel,
        startedAt: startedAtRef.current,
        endedAt: Date.now(),
        durationMin: Math.round(duration / 60_000),
      });
    }
    clearRoute();
    stopExploring();
  };

  return (
    <div
      className="relative h-full"
      onPointerDown={registerActivity}
      onTouchStart={registerActivity}
    >
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handlePhoto(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

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
              {isPaused ? "на паузе" : isNavigating ? "навигация" : "запись трека"}
            </div>
          </div>
        }
        panel={
          <div className="h-full flex flex-col px-4 pt-2" style={{ background: "var(--surface)", paddingBottom: "var(--safe-bottom)", paddingLeft: "var(--safe-left)", paddingRight: "var(--safe-right)" }}>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="км/ч" value={speedKmh.toFixed(1)} big accent />
              <Metric label="км" value={dist.toFixed(2)} big />
              <Metric label={SECTOR_LABEL} value={`+${sessionRevealed}`} big accent />
            </div>

            {speedBlocked && (
              <p className="font-mono text-[10px] mt-2 text-center" style={{ color: "#c0392b" }}>
                Слишком высокая скорость — секторы не открываются
              </p>
            )}

            {photos.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {photos.map((src, i) => (
                  <img key={i} src={src} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5 mt-auto">
              <button
                onClick={() => photoInputRef.current?.click()}
                className="rounded-xl py-3 font-mono text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition active:scale-[.98]"
                style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1.5px solid var(--line-strong)" }}
              >
                📷 фото
              </button>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="rounded-xl py-3 font-mono text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition active:scale-[.98]"
                style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1.5px solid var(--line-strong)" }}
              >
                <Icon name={isPaused ? "chevron" : "pause"} size={14} /> {isPaused ? "ещё" : "пауза"}
              </button>
              <button
                onClick={finishRide}
                className="rounded-xl py-3 font-mono text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition active:scale-[.98]"
                style={{ background: "var(--terracotta)", color: "#fff" }}
              >
                <Icon name="stop" size={14} /> стоп
              </button>
            </div>
          </div>
        }
      />

      <StealthOverlay speedKmh={speedKmh} sessionSectors={sessionRevealed} />
    </div>
  );
}
