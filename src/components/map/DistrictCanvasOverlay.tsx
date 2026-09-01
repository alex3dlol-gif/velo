import { useCallback, useEffect, useRef } from "react";
import type { Map } from "../../lib/maplibre";
import { GAME_DISTRICTS } from "../../constants/districts";
import { getDistrictZoneColor } from "../../constants/districtColors";
import type { MapBounds } from "../../types/map";

type DistrictCanvasOverlayProps = {
  map: Map | null;
};

function syncCanvas(map: Map, canvas: HTMLCanvasElement) {
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
  canvas.style.zIndex = "1.5";
  return { cssW, cssH, dpr };
}

function boundsOverlap(view: MapBounds, district: MapBounds): boolean {
  return !(
    district.east < view.west ||
    district.west > view.east ||
    district.north < view.south ||
    district.south > view.north
  );
}

function drawPolygonRing(
  ctx: CanvasRenderingContext2D,
  map: Map,
  ring: [number, number][],
) {
  if (ring.length < 3) return;
  const first = map.project(ring[0]!);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < ring.length; i++) {
    const p = map.project(ring[i]!);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

export default function DistrictCanvasOverlay({ map }: DistrictCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    const { cssW, cssH, dpr } = syncCanvas(map, canvas);
    if (cssW < 2 || cssH < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const b = map.getBounds();
    const view: MapBounds = {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    };

    for (const district of GAME_DISTRICTS) {
      if (!boundsOverlap(view, district.bounds)) continue;

      const color = getDistrictZoneColor(district.id);
      const geometry = district.geometry;

      ctx.beginPath();
      if (geometry.type === "Polygon") {
        for (const ring of geometry.coordinates) {
          drawPolygonRing(ctx, map, ring as [number, number][]);
        }
      } else {
        for (const poly of geometry.coordinates) {
          for (const ring of poly) {
            drawPolygonRing(ctx, map, ring as [number, number][]);
          }
        }
      }
      ctx.fillStyle = color + "22";
      ctx.fill("evenodd");

      ctx.beginPath();
      if (geometry.type === "Polygon") {
        for (const ring of geometry.coordinates) {
          drawPolygonRing(ctx, map, ring as [number, number][]);
        }
      } else {
        for (const poly of geometry.coordinates) {
          for (const ring of poly) {
            drawPolygonRing(ctx, map, ring as [number, number][]);
          }
        }
      }
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = color + "CC";
      ctx.stroke();

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.stroke();
    }
  }, [map]);

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
    if (el.parentElement !== host) host.appendChild(el);

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

  return <canvas ref={canvasRef} aria-hidden />;
}
