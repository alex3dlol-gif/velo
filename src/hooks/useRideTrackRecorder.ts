import { useEffect, useRef } from "react";
import type { GeoPosition } from "../context/GeolocationContext";
import type { TrackPoint } from "../utils/rideJournalStore";

const MIN_INTERVAL_MS = 8_000;
const MIN_DISTANCE_M = 12;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** Записывает трек вылазки с прореживанием точек. */
export function useRideTrackRecorder(active: boolean, position: GeoPosition | null) {
  const trackRef = useRef<TrackPoint[]>([]);
  const lastAtRef = useRef(0);
  const lastPointRef = useRef<TrackPoint | null>(null);

  useEffect(() => {
    if (!active) return;
    trackRef.current = [];
    lastAtRef.current = 0;
    lastPointRef.current = null;
  }, [active]);

  useEffect(() => {
    if (!active || !position) return;

    const point: TrackPoint = [position.lng, position.lat];
    const now = Date.now();
    const last = lastPointRef.current;
    const elapsed = now - lastAtRef.current;
    const moved = last ? haversineM(last[1], last[0], point[1], point[0]) : Infinity;

    if (!last || elapsed >= MIN_INTERVAL_MS || moved >= MIN_DISTANCE_M) {
      trackRef.current.push(point);
      lastAtRef.current = now;
      lastPointRef.current = point;
    }
  }, [active, position]);

  return trackRef;
}
