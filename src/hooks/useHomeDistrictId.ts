import { useEffect, useState } from "react";
import type { GeoPosition } from "./useGeolocation";
import {
  fallbackHomeDistrictId,
  loadStoredHomeDistrictId,
  resolveHomeDistrictId,
  storeHomeDistrictId,
} from "../utils/homeDistrict";

export function useHomeDistrictId(position: GeoPosition | null): string {
  const [storedId, setStoredId] = useState(loadStoredHomeDistrictId);

  useEffect(() => {
    if (!position || storedId) return;
    const id = resolveHomeDistrictId(position.lat, position.lng);
    storeHomeDistrictId(id);
    setStoredId(id);
  }, [position, storedId]);

  if (storedId) return storedId;
  if (position) return resolveHomeDistrictId(position.lat, position.lng);
  return fallbackHomeDistrictId();
}
