import { useCallback, useEffect, useRef } from "react";
import type { Map } from "../../lib/maplibre";
import { useTheme } from "../../context/ThemeContext";
import { getDistrictZoneColor } from "../../constants/districtColors";
import { MKAD_BOUNDS } from "../../constants/mkad";
import { getDistrictIdForCell } from "../../utils/districtGeometry";
import { buildViewportHexLayers, getCellRingCoords, type MapBounds } from "../../utils/h3Grid";
import { isNatureWaterCell } from "../../utils/natureReveals";

type HexCanvasOverlayProps = {
  map: Map | null;
  visited: ReadonlySet<string>;
  showGrid: boolean;
};

const DEFAULT_FOG = "#B8A4D8";
const GRID_LIGHT = "rgba(92, 61, 30, 0.55)";
const GRID_DARK = "rgba(232, 212, 255, 0.45)";
const REVEALED_STROKE = "rgba(232, 90, 43, 0.85)";
const NATURE_STROKE = "rgba(46, 159, 214, 0.7)";
const FOG_ALPHA_LIGHT = 0.68;
const FOG_ALPHA_DARK = 0.78;

function mapBounds(map: Map): MapBounds {
  const b = map.getBounds();
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
}

/** Синхронизируем буфер overlay 1:1 с canvas MapLibre — иначе сетка «сжимается» в полоску сверху. */
function syncCanvasToMap(map: Map, canvas: HTMLCanvasElement): { cssW: number; cssH: number; dpr: number } {
  const mapCanvas = map.getCanvas();
  const cssW = mapCanvas.clientWidth;
  const cssH = mapCanvas.clientHeight;
  const dpr = cssW > 0 ? mapCanvas.width / cssW : window.devicePixelRatio || 1;

  if (canvas.width !== mapCanvas.width || canvas.height !== mapCanvas.height) {
    canvas.width = mapCanvas.width;
    canvas.height = mapCanvas.height;
  }

  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "1";

  return { cssW, cssH, dpr };
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function fogColorForCell(h3Index: string, isAmoled: boolean): string {
  const districtId = getDistrictIdForCell(h3Index);
  const base = districtId ? getDistrictZoneColor(districtId) : DEFAULT_FOG;
  const alpha = isAmoled ? FOG_ALPHA_DARK : FOG_ALPHA_LIGHT;
  return hexToRgba(base, alpha);
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  map: Map,
  ring: [number, number][],
  fill: string,
  stroke?: string,
  lineWidth = 2,
) {
  if (ring.length < 3) return;
  ctx.beginPath();
  const first = map.project(ring[0]!);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < ring.length; i++) {
    const p = map.project(ring[i]!);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  map: Map,
  coords: [number, number][],
  stroke: string,
  lineWidth: number,
) {
  if (coords.length < 2) return;
  ctx.beginPath();
  const first = map.project(coords[0]!);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < coords.length; i++) {
    const p = map.project(coords[i]!);
    ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export default function HexCanvasOverlay({ map, visited, showGrid }: HexCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isAmoled } = useTheme();
  const visitedRef = useRef(visited);
  const showGridRef = useRef(showGrid);
  visitedRef.current = visited;
  showGridRef.current = showGrid;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    const { cssW, cssH, dpr } = syncCanvasToMap(map, canvas);
    if (cssW < 2 || cssH < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const bounds = mapBounds(map);
    const zoom = map.getZoom();
    const gridColor = isAmoled ? GRID_DARK : GRID_LIGHT;
    const visitedSet = visitedRef.current;

    try {
      const { fog, grid, cells } = buildViewportHexLayers(
        bounds,
        visitedSet,
        MKAD_BOUNDS,
        zoom,
        isNatureWaterCell,
      );

      for (const feature of fog.features) {
        const h3Index = feature.properties?.h3Index as string;
        const ring = feature.geometry.coordinates[0] as [number, number][];
        drawRing(ctx, map, ring, fogColorForCell(h3Index, isAmoled));
      }

      if (showGridRef.current) {
        for (const feature of grid.features) {
          if (feature.geometry.type !== "LineString") continue;
          drawLine(ctx, map, feature.geometry.coordinates as [number, number][], gridColor, 1.5);
        }
      }

      for (const idx of cells) {
        if (!visitedSet.has(idx) && !isNatureWaterCell(idx)) continue;
        const ring = getCellRingCoords(idx);
        if (isNatureWaterCell(idx)) {
          drawRing(ctx, map, ring, "", NATURE_STROKE, 1.5);
        } else {
          drawRing(ctx, map, ring, "", REVEALED_STROKE, 2);
        }
      }

      for (const idx of visitedSet) {
        if (cells.includes(idx)) continue;
        const ring = getCellRingCoords(idx);
        drawRing(ctx, map, ring, "", REVEALED_STROKE, 2);
      }
    } catch (error) {
      console.warn("[HexCanvasOverlay] draw failed", error);
    }
  }, [map, isAmoled]);

  useEffect(() => {
    if (!map || !canvasRef.current) return;

    const host = map.getCanvasContainer();
    const el = canvasRef.current;
    if (el.parentElement !== host) {
      host.appendChild(el);
    }

    paint();

    map.on("move", paint);
    map.on("zoom", paint);
    map.on("resize", paint);
    map.on("render", paint);

    return () => {
      map.off("move", paint);
      map.off("zoom", paint);
      map.off("resize", paint);
      map.off("render", paint);
    };
  }, [map, paint]);

  useEffect(() => {
    paint();
  }, [visited, showGrid, paint]);

  return <canvas ref={canvasRef} aria-hidden />;
}
