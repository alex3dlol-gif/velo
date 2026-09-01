import { useCallback, useEffect, useRef } from "react";
import type { Map } from "../../lib/maplibre";
import { useTheme } from "../../context/ThemeContext";
import { getDistrictZoneColor } from "../../constants/districtColors";
import { MKAD_BOUNDS } from "../../constants/mkad";
import { getDistrictIdForCell } from "../../utils/districtGeometry";
import { getCellRingCoords, getViewportCellBuckets, type MapBounds } from "../../utils/h3Grid";
import { isNatureWaterCell } from "../../utils/natureReveals";

type HexCanvasOverlayProps = {
  map: Map | null;
  visited: ReadonlySet<string>;
  showGrid: boolean;
};

const DEFAULT_FOG = "#B8A4D8";
const GRID_LIGHT = "rgba(92, 61, 30, 0.45)";
const GRID_DARK = "rgba(232, 212, 255, 0.35)";
const REVEALED_STROKE = "rgba(232, 90, 43, 0.85)";
const NATURE_STROKE = "rgba(46, 159, 214, 0.7)";
const FOG_ALPHA_LIGHT = 0.32;
const FOG_ALPHA_DARK = 0.4;
const FOG_BLEND = 0.18;

const fogColorCache = new Map<string, string>();

function mapBounds(map: Map): MapBounds {
  const b = map.getBounds();
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
}

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

function blendHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] as const;
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar * (1 - t) + br * t);
  const g = Math.round(ag * (1 - t) + bg * t);
  const bl = Math.round(ab * (1 - t) + bb * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

function fogColorForCell(h3Index: string, isAmoled: boolean): string {
  const districtId = getDistrictIdForCell(h3Index);
  const cacheKey = `${districtId ?? "default"}:${isAmoled ? "d" : "l"}`;
  const cached = fogColorCache.get(cacheKey);
  if (cached) return cached;

  const district = districtId ? getDistrictZoneColor(districtId) : DEFAULT_FOG;
  const blended = blendHex(district, DEFAULT_FOG, FOG_BLEND);
  const h = blended.replace("#", "");
  const alpha = isAmoled ? FOG_ALPHA_DARK : FOG_ALPHA_LIGHT;
  const color = `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`;
  fogColorCache.set(cacheKey, color);
  return color;
}

function appendRing(ctx: CanvasRenderingContext2D, map: Map, ring: [number, number][]) {
  if (ring.length < 3) return;
  const first = map.project(ring[0]!);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < ring.length; i++) {
    const p = map.project(ring[i]!);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

function fillCells(ctx: CanvasRenderingContext2D, map: Map, indices: string[], fill: string) {
  if (!indices.length) return;
  ctx.beginPath();
  for (const idx of indices) appendRing(ctx, map, getCellRingCoords(idx));
  ctx.fillStyle = fill;
  ctx.fill("evenodd");
}

function strokeCells(
  ctx: CanvasRenderingContext2D,
  map: Map,
  indices: string[],
  stroke: string,
  lineWidth: number,
) {
  if (!indices.length) return;
  ctx.beginPath();
  for (const idx of indices) appendRing(ctx, map, getCellRingCoords(idx));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export default function HexCanvasOverlay({ map, visited, showGrid }: HexCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
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
      const { cells, fog, revealed } = getViewportCellBuckets(
        bounds,
        visitedSet,
        MKAD_BOUNDS,
        zoom,
        isNatureWaterCell,
      );

      const fogByColor = new Map<string, string[]>();
      for (const idx of fog) {
        const color = fogColorForCell(idx, isAmoled);
        const bucket = fogByColor.get(color);
        if (bucket) bucket.push(idx);
        else fogByColor.set(color, [idx]);
      }
      for (const [color, indices] of fogByColor) {
        fillCells(ctx, map, indices, color);
      }

      if (showGridRef.current) {
        strokeCells(ctx, map, cells, gridColor, 1);
      }

      const visitedCells: string[] = [];
      const natureCells: string[] = [];
      for (const idx of revealed) {
        if (isNatureWaterCell(idx)) natureCells.push(idx);
        else visitedCells.push(idx);
      }
      strokeCells(ctx, map, visitedCells, REVEALED_STROKE, 1.8);
      strokeCells(ctx, map, natureCells, NATURE_STROKE, 1.2);
    } catch (error) {
      console.warn("[HexCanvasOverlay] draw failed", error);
    }
  }, [map, isAmoled]);

  const schedulePaint = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      paint();
    });
  }, [paint]);

  useEffect(() => {
    if (!map || !canvasRef.current) return;

    const host = map.getCanvasContainer();
    const el = canvasRef.current;
    if (el.parentElement !== host) {
      host.appendChild(el);
    }

    paint();

    map.on("move", schedulePaint);
    map.on("zoom", schedulePaint);
    map.on("resize", schedulePaint);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.off("move", schedulePaint);
      map.off("zoom", schedulePaint);
      map.off("resize", schedulePaint);
    };
  }, [map, paint, schedulePaint]);

  useEffect(() => {
    schedulePaint();
  }, [visited, showGrid, schedulePaint]);

  return <canvas ref={canvasRef} aria-hidden />;
}
