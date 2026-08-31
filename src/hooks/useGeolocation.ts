import { useEffect, useRef, useState } from "react";

export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
};

type GeoState = {
  position: GeoPosition | null;
  error: string | null;
  loading: boolean;
};

const DEFAULT_POSITION: GeoPosition = {
  lat: 55.629,
  lng: 37.606,
  accuracy: 12,
  heading: null,
  speed: null,
};

export function useGeolocation(enabled = true) {
  const [state, setState] = useState<GeoState>({
    position: DEFAULT_POSITION,
    error: null,
    loading: true,
  });
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      setState({ position: DEFAULT_POSITION, error: null, loading: false });
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      setState({
        position: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        },
        error: null,
        loading: false,
      });
    };

    const onError = (err: GeolocationPositionError) => {
      setState((prev) => ({
        position: prev.position ?? DEFAULT_POSITION,
        error: err.message,
        loading: false,
      }));
    };

    watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    });

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [enabled]);

  return state;
}
