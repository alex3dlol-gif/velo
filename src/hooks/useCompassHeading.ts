import { useCallback, useEffect, useRef, useState } from "react";

type DeviceOrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

function readHeading(e: DeviceOrientationEvent): number | null {
  const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
  if (typeof ios === "number" && !Number.isNaN(ios)) return ios;
  if (e.alpha != null && !Number.isNaN(e.alpha)) {
    return (360 - e.alpha) % 360;
  }
  return null;
}

/** Компас устройства — стрелка на карте. На iOS нужен вызов enableCompass() по тапу. */
export function useCompassHeading(enabled = true) {
  const [heading, setHeading] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const needsPermissionRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const ctor = DeviceOrientationEvent as DeviceOrientationEventCtor;
    needsPermissionRef.current = typeof ctor.requestPermission === "function";
    if (!needsPermissionRef.current) setActive(true);
  }, [enabled]);

  const enableCompass = useCallback(async () => {
    if (!enabled || active) return true;
    const ctor = DeviceOrientationEvent as DeviceOrientationEventCtor;
    if (typeof ctor.requestPermission === "function") {
      try {
        const state = await ctor.requestPermission();
        if (state !== "granted") return false;
      } catch {
        return false;
      }
    }
    setActive(true);
    return true;
  }, [enabled, active]);

  useEffect(() => {
    if (!enabled || !active) return;

    const onOrientation = (e: Event) => {
      const h = readHeading(e as DeviceOrientationEvent);
      if (h != null) setHeading(h);
    };

    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    window.addEventListener("deviceorientation", onOrientation, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation, true);
      window.removeEventListener("deviceorientation", onOrientation, true);
    };
  }, [enabled, active]);

  return { heading, enableCompass, compassActive: active, needsPermission: needsPermissionRef.current };
}
