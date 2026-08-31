import { useCallback, useRef, useState, type ReactNode } from "react";

export const SNAP_EXPANDED = 0.4;
export const SNAP_COLLAPSED = 0.75;
const SNAP_MID = (SNAP_EXPANDED + SNAP_COLLAPSED) / 2;

type SheetSnap = "expanded" | "collapsed";

type MapBottomSheetProps = {
  storageKey: string;
  map: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  collapsedSummary?: ReactNode;
};

export default function MapBottomSheet({
  storageKey,
  map,
  children,
  footer,
  collapsedSummary,
}: MapBottomSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<SheetSnap>(() => readSnap(storageKey));
  const [mapRatio, setMapRatio] = useState(() =>
    readSnap(storageKey) === "collapsed" ? SNAP_COLLAPSED : SNAP_EXPANDED,
  );
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartRatio = useRef(SNAP_EXPANDED);

  const applySnap = useCallback(
    (next: SheetSnap) => {
      setSnap(next);
      setMapRatio(next === "expanded" ? SNAP_EXPANDED : SNAP_COLLAPSED);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    dragStartY.current = e.clientY;
    dragStartRatio.current = mapRatio;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const h = containerRef.current.getBoundingClientRect().height;
    const delta = (e.clientY - dragStartY.current) / h;
    const next = Math.max(SNAP_EXPANDED, Math.min(SNAP_COLLAPSED, dragStartRatio.current + delta));
    setMapRatio(next);
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    applySnap(mapRatio < SNAP_MID ? "expanded" : "collapsed");
  };

  const isExpanded = snap === "expanded";

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      <div
        className="relative min-h-0 shrink-0 overflow-hidden"
        style={{
          height: `${mapRatio * 100}%`,
          transition: dragging.current ? "none" : "height 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {map}
      </div>

      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-t-[16px]"
        style={{
          background: "var(--surface)",
          boxShadow: "0 -2px 16px rgba(0,0,0,0.06)",
          zIndex: 10,
        }}
      >
        <div
          className="shrink-0 flex justify-center cursor-grab active:cursor-grabbing touch-none"
          style={{ paddingTop: 10, paddingBottom: 8 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="sheet-drag-handle" />
        </div>

        <div className={`flex-1 min-h-0 overflow-y-auto scroll-area px-4 ${isExpanded ? "pb-2" : "pb-0"}`}>
          {isExpanded ? children : (collapsedSummary ?? null)}
        </div>

        <div className="shrink-0 px-4 pt-2" style={{ paddingBottom: 16 }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

function readSnap(key: string): SheetSnap {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "expanded" || raw === "collapsed") return raw;
  } catch {
    /* ignore */
  }
  return "expanded";
}
