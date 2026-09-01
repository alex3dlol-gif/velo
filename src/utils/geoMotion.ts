import type { Travel } from "../context/AppContext";

export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  /** m/s */
  speed: number | null;
  speedKmh: number;
  timestamp: number;
};

export function speedLimitKmh(travel: Travel): number {
  return travel === "walk" ? 12 : 30;
}

export function isSpeedAllowed(speedKmh: number, travel: Travel): boolean {
  return speedKmh <= speedLimitKmh(travel);
}

export function enrichPosition(
  coords: GeolocationCoordinates,
  prev: GeoPosition | null,
  timestamp = Date.now(),
): GeoPosition {
  let speed = coords.speed;
  let heading = coords.heading;

  if (prev) {
    const dt = (timestamp - prev.timestamp) / 1000;
    if (dt >= 0.4 && dt < 45) {
      const dLat = (coords.latitude - prev.lat) * 111_320;
      const dLng =
        (coords.longitude - prev.lng) * 111_320 * Math.cos((coords.latitude * Math.PI) / 180);
      const dist = Math.hypot(dLat, dLng);
      const derived = dist / dt;
      if (speed == null || speed < 0 || Number.isNaN(speed)) {
        speed = derived;
      } else if (derived > 0.3) {
        speed = speed * 0.45 + derived * 0.55;
      }
      if ((heading == null || Number.isNaN(heading)) && dist > 4) {
        heading = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
      }
    }
  }

  const speedMs = speed != null && speed >= 0 && !Number.isNaN(speed) ? speed : 0;
  const headingDeg =
    heading != null && !Number.isNaN(heading) && heading >= 0 ? heading : null;

  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    heading: headingDeg,
    speed: speedMs,
    speedKmh: speedMs * 3.6,
    timestamp,
  };
}
