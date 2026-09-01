import { useCallback, useEffect, useRef } from "react";
import type { Map } from "../../lib/maplibre";
import type { RouteGeoJSON } from "../../types/sector";

type RouteCanvasOverlayProps = {
  map: Map | null;
  route: RouteGeoJSON | null;
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
  canvas.style.zIndex = "2";
  return { cssW, cssH, dpr };
}

export default function RouteCanvasOverlay({ map, route }: RouteCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const routeRef = useRef(route);
  routeRef.current = route;
  const rafRef = useRef(0);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const currentRoute = routeRef.current;
    if (!map || !canvas) return;

    const { cssW, cssH, dpr } = syncCanvas(map, canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (!currentRoute?.geometry?.coordinates?.length) return;

    const coords = currentRoute.geometry.coordinates;
    ctx.beginPath();
    const first = map.project(coords[0]!);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < coords.length; i++) {
      const p = map.project(coords[i]!);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = "rgba(217, 93, 57, 0.95)";
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [map]);

  const schedule = useCallback(() => {
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
    map.on("move", schedule);
    map.on("zoom", schedule);
    map.on("resize", schedule);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.off("move", schedule);
      map.off("zoom", schedule);
      map.off("resize", schedule);
    };
  }, [map, paint, schedule]);

  useEffect(() => {
    schedule();
  }, [route, schedule]);

  return <canvas ref={canvasRef} aria-hidden />;
}
