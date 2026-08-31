import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { cellToLatLng } from "h3-js";
import "maplibre-gl/dist/maplibre-gl.css";
import { maplibregl, getMapStyle, type Map } from "../../lib/maplibre";
import { useTheme } from "../../context/ThemeContext";
import { useApp } from "../../context/AppContext";
import { useFogOfWarContext } from "../../context/FogOfWarContext";
import { useGeolocation } from "../../hooks/useGeolocation";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  buildFogMask,
  buildHexLayers,
  buildNatureWaterLayer,
  cellToPolygonFeature,
  coordsToCell,
  getCellsForViewport,
  getHexLayerPaint,
  type MapBounds,
} from "../../utils/h3Grid";
import { getDistrictForCell, getDistrictForCoords } from "../../utils/districtGeometry";
import { MKAD_BOUNDS, applyMkadRestrictions, clampToMkad } from "../../constants/mkad";
import { getFullCellAccess, isCellInteractive } from "../../utils/cellPlayability";
import { ensureNatureWaterLoaded, isNatureWaterCell } from "../../utils/natureReveals";
import {
  buildDistrictBoundaries,
  buildDistrictLabels,
  buildDistrictLeaderLines,
} from "../../utils/districtGeometry";
import { fetchRoute, routeBounds } from "../../utils/routing";
import type { RouteGeoJSON, SectorCardData } from "../../types/sector";
import SectorCard from "./SectorCard";
import DistrictCard from "./DistrictCard";
import MapFab from "./MapFab";

const FOG_MASK_LAYER = "h3-fog-mask";
const FOG_MASK_SOURCE = "h3-fog-mask";
const NATURE_SOURCE = "nature-water";
const NATURE_LINE_LAYER = "nature-water-line";
const DISTRICT_SOURCE = "districts";
const DISTRICT_LABELS_SOURCE = "district-labels";
const DISTRICT_LEADERS_SOURCE = "district-leaders";
const DISTRICT_BOUNDARY_UNLOCKED = "district-boundary-unlocked";
const DISTRICT_BOUNDARY_LOCKED = "district-boundary-locked";
const DISTRICT_LABEL_HIT_LAYER = "district-label-hit";
const DISTRICT_LABEL_LAYER = "district-labels";
const DISTRICT_LEADER_LAYER = "district-leader-lines";
const REVEALED_SOURCE = "h3-revealed";
const SELECTED_SOURCE = "h3-selected";
const ROUTE_SOURCE = "route";

type VeiloMapProps = {
  className?: string;
  showHeader?: boolean;
  autoFollow?: boolean;
  onSessionHex?: (count: number) => void;
};

export default function VeiloMap({
  className = "",
  showHeader = true,
  autoFollow = false,
  onSessionHex,
}: VeiloMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);
  const lastCellRef = useRef<string | null>(null);
  const isAmoledRef = useRef(false);
  const prevAmoledRef = useRef<boolean | null>(null);
  const selectedHexRef = useRef<string | null>(null);
  const sectorCardRef = useRef<(data: SectorCardData | null) => void>(() => {});
  const selectHexRef = useRef<(h3Index: string | null) => void>(() => {});
  const districtCardRef = useRef<(id: string | null) => void>(() => {});

  const { isAmoled } = useTheme();
  const { travel, isExploring, isPaused } = useApp();
  const { visited, revealHex, sessionRevealed, districtStates } = useFogOfWarContext();
  const { position } = useGeolocation(true);

  const [mapReady, setMapReady] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [sectorCard, setSectorCard] = useState<SectorCardData | null>(null);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteGeoJSON | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [districtCardId, setDistrictCardId] = useState<string | null>(null);
  const [districtName, setDistrictName] = useState("Чертаново Центральное");

  const visitedRef = useRef(visited);
  const showGridRef = useRef(showGrid);
  const districtStatesRef = useRef(districtStates);

  visitedRef.current = visited;
  showGridRef.current = showGrid;
  districtStatesRef.current = districtStates;
  isAmoledRef.current = isAmoled;
  selectedHexRef.current = selectedHex;
  sectorCardRef.current = setSectorCard;
  selectHexRef.current = setSelectedHex;
  districtCardRef.current = setDistrictCardId;

  const updateFogMask = useCallback((map: Map) => {
    if (!map.getSource(FOG_MASK_SOURCE)) return;

    if (!showGridRef.current) {
      setSourceData(map, FOG_MASK_SOURCE, { type: "FeatureCollection", features: [] });
      return;
    }

    const b = map.getBounds();
    const bounds: MapBounds = {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    };

    try {
      const mask = buildFogMask(
        bounds,
        visitedRef.current,
        MKAD_BOUNDS,
        map.getZoom(),
        isNatureWaterCell,
      );
      setSourceData(map, FOG_MASK_SOURCE, { type: "FeatureCollection", features: [mask] });
    } catch {
      /* skip */
    }
  }, []);

  const updateNatureLayer = useCallback((map: Map) => {
    if (!map.getSource(NATURE_SOURCE)) return;

    if (!showGridRef.current) {
      setSourceData(map, NATURE_SOURCE, { type: "FeatureCollection", features: [] });
      return;
    }

    const b = map.getBounds();
    const bounds: MapBounds = {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    };

    try {
      const cells = getCellsForViewport(bounds, MKAD_BOUNDS, undefined, map.getZoom());
      const layer = buildNatureWaterLayer(cells, isNatureWaterCell);
      setSourceData(map, NATURE_SOURCE, layer);
    } catch {
      /* skip */
    }
  }, []);

  const updateDistrictLayers = useCallback((map: Map) => {
    if (!map.getSource(DISTRICT_SOURCE)) return;
    const states = districtStatesRef.current;
    setSourceData(map, DISTRICT_SOURCE, buildDistrictBoundaries(states));
    if (map.getSource(DISTRICT_LABELS_SOURCE)) {
      setSourceData(map, DISTRICT_LABELS_SOURCE, buildDistrictLabels(states));
    }
    if (map.getSource(DISTRICT_LEADERS_SOURCE)) {
      setSourceData(map, DISTRICT_LEADERS_SOURCE, buildDistrictLeaderLines(states));
    }
  }, []);

  const updateRevealedBorders = useCallback((map: Map) => {
    if (!map.getSource(REVEALED_SOURCE)) return;

    if (!showGridRef.current) {
      setSourceData(map, REVEALED_SOURCE, { type: "FeatureCollection", features: [] });
      return;
    }

    const b = map.getBounds();
    const bounds: MapBounds = {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    };

    try {
      const cells = getCellsForViewport(bounds, MKAD_BOUNDS, undefined, map.getZoom());
      const { revealed } = buildHexLayers(cells, visitedRef.current);
      setSourceData(map, REVEALED_SOURCE, revealed);
    } catch {
      /* skip */
    }
  }, []);

  const updateHexLayers = useCallback(
    (map: Map) => {
      updateFogMask(map);
      updateNatureLayer(map);
      updateDistrictLayers(map);
      updateRevealedBorders(map);
    },
    [updateFogMask, updateNatureLayer, updateDistrictLayers, updateRevealedBorders],
  );

  const updateSelectedLayer = useCallback((map: Map, h3Index: string | null) => {
    if (!map.getSource(SELECTED_SOURCE)) return;
    if (!h3Index) {
      setSourceData(map, SELECTED_SOURCE, { type: "FeatureCollection", features: [] });
      return;
    }
    setSourceData(map, SELECTED_SOURCE, {
      type: "FeatureCollection",
      features: [cellToPolygonFeature(h3Index, { selected: true })],
    });
  }, []);

  const updateRouteLayer = useCallback((map: Map, routeData: RouteGeoJSON | null) => {
    if (!map.getSource(ROUTE_SOURCE)) return;
    setSourceData(map, ROUTE_SOURCE, {
      type: "FeatureCollection",
      features: routeData ? [routeData] : [],
    });
  }, []);

  const installMapLayers = useCallback(
    (map: Map) => {
      removeMapLayers(map);
      addMapSources(map);
      applyLayerPaint(map, isAmoledRef.current);
      updateHexLayers(map);
      updateDistrictLayers(map);
      updateSelectedLayer(map, selectedHexRef.current);
      updateRouteLayer(map, null);
      bindHexInteractions(map, sectorCardRef, selectHexRef, visitedRef, districtCardRef, districtStatesRef);
    },
    [updateHexLayers, updateDistrictLayers, updateSelectedLayer, updateRouteLayer],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let map: Map | null = null;
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    const init = () => {
      if (cancelled || mapRef.current) return;
      if (container.clientWidth < 10 || container.clientHeight < 10) {
        requestAnimationFrame(init);
        return;
      }

      map = new maplibregl.Map({
        container,
        style: getMapStyle(isAmoledRef.current),
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
        maxPitch: 0,
        fadeDuration: 0,
      });

      applyMkadRestrictions(map);
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

      map.on("load", () => {
        if (!map) return;
        installMapLayers(map);
        map.resize();
        setMapReady(true);
        prevAmoledRef.current = isAmoledRef.current;
      });

      map.on("idle", () => {
        if (!map) return;
        map.resize();
        updateHexLayers(map);
      });

      const syncFog = () => map && updateFogMask(map);
      const syncNature = () => map && updateNatureLayer(map);
      const syncAll = () => map && updateHexLayers(map);

      map.on("move", syncFog);
      map.on("zoom", syncFog);
      map.on("move", syncNature);
      map.on("zoom", syncNature);
      map.on("moveend", syncAll);
      map.on("zoomend", syncAll);

      let borderRaf = 0;
      map.on("move", () => {
        if (!map) return;
        cancelAnimationFrame(borderRaf);
        borderRaf = requestAnimationFrame(() => updateRevealedBorders(map!));
      });

      mapRef.current = map;

      ro = new ResizeObserver(() => {
        if (!map) return;
        map.resize();
        if (map.isStyleLoaded()) updateHexLayers(map);
      });
      ro.observe(container);
    };

    init();

    return () => {
      cancelled = true;
      ro?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
      prevAmoledRef.current = null;
    };
  }, [installMapLayers, updateHexLayers, updateFogMask, updateNatureLayer, updateDistrictLayers, updateRevealedBorders]);

  useEffect(() => {
    ensureNatureWaterLoaded().then(() => {
      const map = mapRef.current;
      if (map && mapReady) {
        updateFogMask(map);
        updateNatureLayer(map);
      }
    });
  }, [mapReady, updateFogMask, updateNatureLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    updateDistrictLayers(map);
    updateFogMask(map);
  }, [districtStates, mapReady, updateDistrictLayers, updateFogMask]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (prevAmoledRef.current === isAmoled) return;
    const isFirstRun = prevAmoledRef.current === null;
    prevAmoledRef.current = isAmoled;
    if (isFirstRun) return;

    const savedRoute = route;
    map.setStyle(getMapStyle(isAmoled));
    map.once("style.load", () => {
      applyMkadRestrictions(map);
      installMapLayers(map);
      updateRouteLayer(map, savedRoute);
      map.resize();
    });
  }, [isAmoled, mapReady, installMapLayers, route, updateRouteLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    updateHexLayers(map);
  }, [visited, showGrid, mapReady, updateHexLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    updateSelectedLayer(map, selectedHex);
  }, [selectedHex, mapReady, updateSelectedLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    updateRouteLayer(map, route);
  }, [route, mapReady, updateRouteLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position || !mapReady) return;

    if (!markerElRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `<div class="user-marker"><div class="user-marker__pulse"></div><div class="user-marker__dot"></div><div class="user-marker__arrow"></div></div>`;
      markerElRef.current = el.firstElementChild as HTMLDivElement;
    }

    if (markerElRef.current && position.heading !== null) {
      markerElRef.current.style.transform = `rotate(${position.heading}deg)`;
    }

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ element: markerElRef.current, anchor: "center" })
        .setLngLat(clampToMkad(position.lng, position.lat))
        .addTo(map);
    } else {
      markerRef.current.setLngLat(clampToMkad(position.lng, position.lat));
    }

    setDistrictName(getDistrictForCoords(position.lat, position.lng));

    if (autoFollow && isExploring && !isPaused) {
      const [lng, lat] = clampToMkad(position.lng, position.lat);
      map.easeTo({ center: [lng, lat], duration: 800 });
    }
  }, [position, mapReady, autoFollow, isExploring, isPaused]);

  useEffect(() => {
    if (!position || !isExploring || isPaused) return;
    const cell = coordsToCell(position.lat, position.lng);
    if (cell === lastCellRef.current) return;
    lastCellRef.current = cell;
    revealHex(cell);
  }, [position, isExploring, isPaused, revealHex]);

  useEffect(() => {
    onSessionHex?.(sessionRevealed);
  }, [sessionRevealed, onSessionHex]);

  const flyToUser = useCallback(() => {
    const map = mapRef.current;
    if (!map || !position) return;
    const [lng, lat] = clampToMkad(position.lng, position.lat);
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 1200 });
  }, [position]);

  const handleBuildRoute = useCallback(
    async (h3Index: string) => {
      if (!position) return;
      setRouteLoading(true);
      const [targetLat, targetLng] = cellToLatLng(h3Index);
      const [startLng, startLat] = clampToMkad(position.lng, position.lat);

      const result = await fetchRoute(startLng, startLat, targetLng, targetLat, travel);
      setRouteLoading(false);

      if (!result) return;
      setRoute(result);

      const map = mapRef.current;
      if (!map) return;

      const [[swLng, swLat], [neLng, neLat]] = routeBounds(result);
      map.fitBounds(
        [
          [Math.min(swLng, startLng), Math.min(swLat, startLat)],
          [Math.max(neLng, startLng), Math.max(neLat, startLat)],
        ],
        { padding: 48, duration: 900 },
      );
    },
    [position, travel],
  );

  const clearRoute = useCallback(() => {
    setRoute(null);
  }, []);

  const closeSectorCard = useCallback(() => {
    setSectorCard(null);
    setSelectedHex(null);
  }, []);

  const closeDistrictCard = useCallback(() => setDistrictCardId(null), []);

  return (
    <div className={`relative h-full w-full min-h-[120px] ${className}`}>
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {showHeader && (
        <div className="absolute top-3 left-4 right-16 z-10 pointer-events-none">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: "var(--ink-soft)" }}>
            текущая зона
          </p>
          <h1 className="font-mono text-[17px] font-extrabold leading-tight drop-shadow-sm" style={{ color: "var(--ink)" }}>
            {districtName}
          </h1>
        </div>
      )}

      <MapFab showGrid={showGrid} onToggleGrid={() => setShowGrid((v) => !v)} onLocate={flyToUser} />

      {route && (
        <button
          onClick={clearRoute}
          className="absolute left-4 bottom-4 z-20 font-mono text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl"
          style={{ background: "var(--surface)", color: "var(--terracotta)", border: "1.5px solid var(--terracotta)" }}
        >
          Сбросить маршрут
        </button>
      )}

      <SectorCard
        data={sectorCard}
        onClose={closeSectorCard}
        onBuildRoute={handleBuildRoute}
        routeLoading={routeLoading}
      />

      <DistrictCard districtId={districtCardId} states={districtStates} onClose={closeDistrictCard} />
    </div>
  );
}

function setSourceData(map: Map, id: string, data: GeoJSON.FeatureCollection) {
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData(data);
}

function removeMapLayers(map: Map) {
  for (const id of [
    "route-line",
    "h3-selected-line",
    DISTRICT_LABEL_LAYER,
    DISTRICT_LABEL_HIT_LAYER,
    DISTRICT_LEADER_LAYER,
    DISTRICT_BOUNDARY_UNLOCKED,
    DISTRICT_BOUNDARY_LOCKED,
    "h3-revealed-line",
    NATURE_LINE_LAYER,
    FOG_MASK_LAYER,
  ]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [
    ROUTE_SOURCE,
    SELECTED_SOURCE,
    DISTRICT_LABELS_SOURCE,
    DISTRICT_LEADERS_SOURCE,
    DISTRICT_SOURCE,
    REVEALED_SOURCE,
    NATURE_SOURCE,
    FOG_MASK_SOURCE,
  ]) {
    if (map.getSource(id)) map.removeSource(id);
  }
}

function addMapSources(map: Map) {
  const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

  map.addSource(FOG_MASK_SOURCE, { type: "geojson", data: empty });
  map.addLayer({
    id: FOG_MASK_LAYER,
    type: "fill",
    source: FOG_MASK_SOURCE,
    paint: { "fill-color": "#EFECE6", "fill-opacity": 0.95 },
  });

  map.addSource(REVEALED_SOURCE, { type: "geojson", data: empty });
  map.addLayer({
    id: "h3-revealed-line",
    type: "line",
    source: REVEALED_SOURCE,
    paint: { "line-color": "#D95D39", "line-width": 1.5, "line-opacity": 0.6 },
  });

  map.addSource(NATURE_SOURCE, { type: "geojson", data: empty });
  map.addLayer({
    id: NATURE_LINE_LAYER,
    type: "line",
    source: NATURE_SOURCE,
    paint: {
      "line-color": "#5B9BD5",
      "line-width": 1.5,
      "line-opacity": 0.55,
      "line-dasharray": [2, 3],
    },
  });

  map.addSource(DISTRICT_SOURCE, { type: "geojson", data: empty });
  map.addLayer({
    id: DISTRICT_BOUNDARY_UNLOCKED,
    type: "line",
    source: DISTRICT_SOURCE,
    filter: ["==", ["get", "unlocked"], true],
    paint: { "line-color": "#D95D39", "line-width": 2, "line-opacity": 0.85 },
  });
  map.addLayer({
    id: DISTRICT_BOUNDARY_LOCKED,
    type: "line",
    source: DISTRICT_SOURCE,
    filter: ["==", ["get", "unlocked"], false],
    paint: {
      "line-color": "#9CA3AF",
      "line-width": 2,
      "line-opacity": 0.7,
      "line-dasharray": [5, 4],
    },
  });

  map.addSource(DISTRICT_LEADERS_SOURCE, { type: "geojson", data: empty });
  map.addLayer({
    id: DISTRICT_LEADER_LAYER,
    type: "line",
    source: DISTRICT_LEADERS_SOURCE,
    paint: {
      "line-color": "#9CA3AF",
      "line-width": 1,
      "line-opacity": 0.45,
      "line-dasharray": [2, 2],
    },
  });

  map.addSource(DISTRICT_LABELS_SOURCE, { type: "geojson", data: empty });
  map.addLayer({
    id: DISTRICT_LABEL_HIT_LAYER,
    type: "circle",
    source: DISTRICT_LABELS_SOURCE,
    paint: { "circle-radius": 22, "circle-opacity": 0 },
  });
  map.addLayer({
    id: DISTRICT_LABEL_LAYER,
    type: "symbol",
    source: DISTRICT_LABELS_SOURCE,
    layout: {
      "text-field": ["concat", ["get", "name"], "\n", ["get", "statusLine"]],
      "text-size": 10,
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "text-anchor": ["get", "textAnchor"],
      "text-justify": ["get", "textJustify"],
      "text-offset": [
        "array",
        ["get", "textOffsetX"],
        ["get", "textOffsetY"],
      ],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "text-max-width": 10,
      "text-line-height": 1.15,
    },
    paint: {
      "text-color": [
        "case",
        ["get", "unlocked"],
        "#3D3830",
        "#6B7280",
      ],
      "text-halo-color": "#EFECE6",
      "text-halo-width": 1.8,
    },
  });

  map.addSource(SELECTED_SOURCE, { type: "geojson", data: empty });
  map.addLayer({
    id: "h3-selected-line",
    type: "line",
    source: SELECTED_SOURCE,
    paint: { "line-color": "#D95D39", "line-width": 3, "line-opacity": 1 },
  });

  map.addSource(ROUTE_SOURCE, { type: "geojson", data: empty });
  map.addLayer({
    id: "route-line",
    type: "line",
    source: ROUTE_SOURCE,
    paint: {
      "line-color": "#D95D39",
      "line-width": 4,
      "line-opacity": 0.9,
      "line-dasharray": [2, 2],
    },
  });
}

function applyLayerPaint(map: Map, isAmoled: boolean) {
  const paint = getHexLayerPaint(isAmoled);
  if (map.getLayer(NATURE_LINE_LAYER)) {
    map.setPaintProperty(NATURE_LINE_LAYER, "line-color", paint.nature.line);
    map.setPaintProperty(NATURE_LINE_LAYER, "line-opacity", paint.nature.lineOpacity);
    map.setPaintProperty(NATURE_LINE_LAYER, "line-width", paint.nature.lineWidth);
  }
  if (map.getLayer(DISTRICT_BOUNDARY_UNLOCKED)) {
    map.setPaintProperty(DISTRICT_BOUNDARY_UNLOCKED, "line-color", paint.district.unlockedLine);
    map.setPaintProperty(DISTRICT_BOUNDARY_UNLOCKED, "line-width", paint.district.lineWidth);
  }
  if (map.getLayer(DISTRICT_BOUNDARY_LOCKED)) {
    map.setPaintProperty(DISTRICT_BOUNDARY_LOCKED, "line-color", paint.district.lockedLine);
    map.setPaintProperty(DISTRICT_BOUNDARY_LOCKED, "line-width", paint.district.lineWidth);
  }
  if (map.getLayer(DISTRICT_LEADER_LAYER)) {
    map.setPaintProperty(DISTRICT_LEADER_LAYER, "line-color", isAmoled ? "#6B7280" : "#9CA3AF");
  }
  if (map.getLayer(DISTRICT_LABEL_LAYER)) {
    map.setPaintProperty(
      DISTRICT_LABEL_LAYER,
      "text-color",
      [
        "case",
        ["get", "unlocked"],
        isAmoled ? "#E8E4DC" : "#3D3830",
        isAmoled ? "#9CA3AF" : "#6B7280",
      ],
    );
    map.setPaintProperty(
      DISTRICT_LABEL_LAYER,
      "text-halo-color",
      isAmoled ? "#000000" : "#EFECE6",
    );
  }
  if (map.getLayer(FOG_MASK_LAYER)) {
    map.setPaintProperty(FOG_MASK_LAYER, "fill-color", paint.fog.fill);
    map.setPaintProperty(FOG_MASK_LAYER, "fill-opacity", paint.fog.fillOpacity);
  }
  if (map.getLayer("h3-revealed-line")) {
    map.setPaintProperty("h3-revealed-line", "line-color", paint.revealed.line);
    map.setPaintProperty("h3-revealed-line", "line-opacity", paint.revealed.lineOpacity);
    map.setPaintProperty("h3-revealed-line", "line-width", paint.revealed.lineWidth);
  }
  if (map.getLayer("h3-selected-line")) {
    map.setPaintProperty("h3-selected-line", "line-color", paint.selected.line);
    map.setPaintProperty("h3-selected-line", "line-width", paint.selected.lineWidth);
  }
}

function bindHexInteractions(
  map: Map,
  cardRef: MutableRefObject<(data: SectorCardData | null) => void>,
  selectRef: MutableRefObject<(h3Index: string | null) => void>,
  visitedRef: MutableRefObject<Set<string>>,
  districtCardRef: MutableRefObject<(id: string | null) => void>,
  districtStatesRef: MutableRefObject<import("../../utils/districtProgress").DistrictStates>,
) {
  map.on("click", (e) => {
    const districtHits = map.queryRenderedFeatures(e.point, {
      layers: [DISTRICT_LABEL_HIT_LAYER, DISTRICT_LABEL_LAYER],
    });
    if (districtHits.length > 0) {
      const districtId = districtHits[0].properties?.districtId as string;
      if (districtId) {
        districtCardRef.current(districtId);
        cardRef.current(null);
        selectRef.current(null);
        return;
      }
    }

    const h3Index = coordsToCell(e.lngLat.lat, e.lngLat.lng);
    const visited = visitedRef.current.has(h3Index);
    const access = getFullCellAccess(h3Index, districtStatesRef.current);
    districtCardRef.current(null);
    selectRef.current(h3Index);
    cardRef.current({
      h3Index,
      visited,
      accessible: isCellInteractive(h3Index, districtStatesRef.current),
      isNature: access.status === "nature",
      statusLabel:
        access.status === "nature"
          ? access.label
          : access.status === "district-locked"
            ? access.label
            : visited
              ? "Исследован"
              : "Не исследован",
      inaccessibleReason: access.status === "district-locked" ? access.label : undefined,
      district: getDistrictForCell(h3Index),
      lat: e.lngLat.lat,
      lng: e.lngLat.lng,
    });
  });

  const canvas = map.getCanvas();
  const setPointer = () => canvas.style.setProperty("cursor", "pointer");
  const clearPointer = () => canvas.style.removeProperty("cursor");
  canvas.addEventListener("mouseenter", setPointer);
  canvas.addEventListener("mouseleave", clearPointer);
}
