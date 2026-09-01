import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { maplibregl, getMapStyle, type Map } from "../../lib/maplibre";
import { applyMkadRestrictions } from "../../constants/mkad";
import { DEFAULT_ZOOM } from "../../utils/h3Grid";
import RouteCanvasOverlay from "../map/RouteCanvasOverlay";
import DistrictCanvasOverlay from "../map/DistrictCanvasOverlay";
import type { TrackPoint } from "../../utils/rideJournalStore";
import { trackBounds, trackToRouteGeoJSON } from "../../utils/rideJournalStore";
import type { RouteGeoJSON } from "../../types/sector";

type JournalMapProps = {
  track: TrackPoint[];
  photoMarkers?: Array<{ lat: number; lng: number; url: string }>;
};

export default function JournalMap({ track, photoMarkers = [] }: JournalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [route, setRoute] = useState<RouteGeoJSON | null>(null);

  useEffect(() => {
    const routeFeature = trackToRouteGeoJSON(track);
    setRoute(routeFeature as RouteGeoJSON | null);
  }, [track]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const start = track[0] ?? [37.6173, 55.7558];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(false),
      center: start,
      zoom: DEFAULT_ZOOM,
      bearing: 0,
      pitch: 0,
      attributionControl: false,
    });

    mapRef.current = map;
    applyMkadRestrictions(map);

    map.on("load", () => {
      setMapInstance(map);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || track.length < 2) return;
    const bounds = trackBounds(track);
    if (bounds) map.fitBounds(bounds, { padding: 48, duration: 500, maxZoom: 16 });
  }, [track, mapInstance]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = photoMarkers.map((p) => {
      const el = document.createElement("div");
      el.className = "journal-photo-pin";
      el.style.backgroundImage = `url(${p.url})`;
      return new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
    });
  }, [photoMarkers, mapInstance]);

  return (
    <div className="relative h-full w-full min-h-[220px] rounded-xl overflow-hidden border" style={{ borderColor: "var(--line)" }}>
      <div ref={containerRef} className="absolute inset-0" />
      {mapInstance && <DistrictCanvasOverlay map={mapInstance} />}
      {mapInstance && <RouteCanvasOverlay map={mapInstance} route={route} />}
    </div>
  );
}
