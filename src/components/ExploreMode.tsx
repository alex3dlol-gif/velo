import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import SplitScreen from "./SplitScreen";
import VeiloMap from "./map/VeiloMap";
import { Metric } from "./shared";
import { SECTOR_LABEL } from "../constants/units";
import { useApp } from "../context/AppContext";
import { useFogOfWarContext } from "../context/FogOfWarContext";
import { useGeolocation } from "../hooks/useGeolocation";
import { useRideTimer } from "../hooks/useRideTimer";
import { useRideTrackRecorder } from "../hooks/useRideTrackRecorder";
import {
  ExploreTrackingProvider,
  StealthOverlay,
  useSpeedAlert,
  useStealth,
} from "../features/tracking";
import { isSpeedAllowed } from "../utils/geoMotion";
import { blobToPreviewUrl, compressImageFile } from "../utils/photoCompress";
import { formatJournalDate, MIN_RIDE_MS, saveRideToJournal } from "../utils/rideJournal";
import { getDistrictForCoords } from "../utils/districtGeometry";
import { formatRideDuration } from "../utils/rideDuration";

const EXPLORE_SPLIT_KEY = "veilo-explore-split";

type PendingPhoto = {
  blob: Blob;
  preview: string;
  lat: number | null;
  lng: number | null;
  takenAt: number;
};

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
    exploreStartedAt,
    getExploreElapsedMs,
  } = useApp();
  const { sessionRevealed } = useFogOfWarContext();
  const { position } = useGeolocation(true);
  const { registerActivity } = useStealth();
  const [dist, setDist] = useState(0);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PendingPhoto[]>([]);
  const rideTimer = useRideTimer(isExploring);
  const trackRef = useRideTrackRecorder(isExploring && !isPaused, position);
  photosRef.current = photos;

  const speedKmh = position?.speedKmh ?? 0;
  const trackingActive = isExploring && !isPaused;
  const elapsedMs = getExploreElapsedMs();
  const minLeftMs = Math.max(0, MIN_RIDE_MS - elapsedMs);

  useSpeedAlert(speedKmh, trackingActive, travel);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

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

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    try {
      const blob = await compressImageFile(file);
      const preview = blobToPreviewUrl(blob);
      setPhotos((prev) => [
        ...prev,
        {
          blob,
          preview,
          lat: position?.lat ?? null,
          lng: position?.lng ?? null,
          takenAt: Date.now(),
        },
      ]);
    } catch {
      setSaveNote("Не удалось обработать фото");
    }
  };

  const finishRide = () => {
    const duration = getExploreElapsedMs();
    const endedAt = Date.now();
    const startedAt = exploreStartedAt ?? endedAt - duration;
    const lastPos = lastPosRef.current ?? (position ? { lat: position.lat, lng: position.lng } : null);
    const track = [...trackRef.current];
    if (lastPos) {
      const last = track[track.length - 1];
      if (!last || last[0] !== lastPos.lng || last[1] !== lastPos.lat) {
        track.push([lastPos.lng, lastPos.lat]);
      }
    }

    const finalize = (saved: boolean, note: string) => {
      setSaveNote(note);
      window.setTimeout(() => {
        photos.forEach((p) => URL.revokeObjectURL(p.preview));
        clearRoute();
        stopExploring();
      }, saved ? 700 : 1400);
    };

    if (duration < MIN_RIDE_MS) {
      finalize(false, `Маршрут короче 5 мин (${formatRideDuration(duration)}) — в журнал не записан`);
      return;
    }

    const place = lastPos ? getDistrictForCoords(lastPos.lat, lastPos.lng) : "Москва";
    void saveRideToJournal(
      {
        title: isNavigating ? "Маршрут" : "Вылазка",
        place,
        date: formatJournalDate(endedAt),
        dist: dist.toFixed(1),
        hexes: sessionRevealed,
        travel,
        startedAt,
        endedAt,
        durationMin: Math.max(1, Math.round(duration / 60_000)),
        track,
      },
      photos.map((p) => ({
        blob: p.blob,
        lat: p.lat,
        lng: p.lng,
        takenAt: p.takenAt,
      })),
    ).then((saved) => {
      if (!saved) {
        finalize(false, "Не удалось сохранить маршрут");
        return;
      }
      const photoNote = photos.length > 0 ? ` · ${photos.length} фото` : "";
      finalize(true, `Маршрут сохранён в журнал${photoNote}`);
    });
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
          void handlePhoto(e.target.files?.[0] ?? null);
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
              {isPaused ? "на паузе" : isNavigating ? "навигация" : "запись"} · {rideTimer}
            </div>
          </div>
        }
        panel={
          <div className="h-full flex flex-col px-4 pt-2" style={{ background: "var(--surface)", paddingBottom: "var(--safe-bottom)", paddingLeft: "var(--safe-left)", paddingRight: "var(--safe-right)" }}>
            <div className="grid grid-cols-4 gap-2">
              <Metric label="время" value={rideTimer} big accent />
              <Metric label="км/ч" value={speedKmh.toFixed(1)} big />
              <Metric label="км" value={dist.toFixed(2)} big />
              <Metric label={SECTOR_LABEL} value={`+${sessionRevealed}`} big accent />
            </div>

            {minLeftMs > 0 && !isPaused && (
              <p className="font-mono text-[9px] mt-2 text-center uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>
                до журнала {formatRideDuration(minLeftMs)}
              </p>
            )}

            {speedBlocked && (
              <p className="font-mono text-[10px] mt-2 text-center" style={{ color: "#c0392b" }}>
                Слишком высокая скорость — секторы не открываются
              </p>
            )}

            {saveNote && (
              <p className="font-mono text-[10px] mt-2 text-center" style={{ color: "var(--terracotta)" }}>
                {saveNote}
              </p>
            )}

            {photos.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {photos.map((p, i) => (
                  <img key={i} src={p.preview} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
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

      <StealthOverlay speedKmh={speedKmh} sessionSectors={sessionRevealed} rideTimer={rideTimer} />
    </div>
  );
}
