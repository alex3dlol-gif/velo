import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { MKAD_CENTER } from "../constants/mkad";
import { enrichPosition, type GeoPosition } from "../utils/geoMotion";

type GeolocationState = {
  position: GeoPosition | null;
  error: string | null;
  loading: boolean;
};

const FALLBACK: GeoPosition = {
  lat: MKAD_CENTER[1],
  lng: MKAD_CENTER[0],
  accuracy: 999,
  heading: null,
  speed: null,
  speedKmh: 0,
  timestamp: Date.now(),
};

const GeolocationContext = createContext<GeolocationState>({
  position: null,
  error: null,
  loading: true,
});

export function GeolocationProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    error: null,
    loading: true,
  });
  const prevRef = useRef<GeoPosition | null>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState({ position: null, error: null, loading: false });
      return;
    }

    if (!navigator.geolocation) {
      setState({ position: FALLBACK, error: "Геолокация недоступна", loading: false });
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      const enriched = enrichPosition(pos.coords, prevRef.current, pos.timestamp);
      prevRef.current = enriched;
      setState({ position: enriched, error: null, loading: false });
    };

    const onError = (err: GeolocationPositionError) => {
      setState((prev) => ({
        position: prev.position ?? FALLBACK,
        error: err.message,
        loading: false,
      }));
    };

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 15000,
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
    watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, options);

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [enabled]);

  return <GeolocationContext.Provider value={state}>{children}</GeolocationContext.Provider>;
}

/** Единый GPS-поток для всего приложения. */
export function useGeolocation(_enabled = true) {
  return useContext(GeolocationContext);
}

export type { GeoPosition };
