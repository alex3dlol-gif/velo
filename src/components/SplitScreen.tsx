import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

const DEFAULT_RATIO = 0.62;
const MIN_RATIO = 0.32;
const MAX_RATIO = 0.8;

type SplitScreenProps = {
  storageKey: string;
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  map: ReactNode;
  panel: ReactNode;
};

export default function SplitScreen({
  storageKey,
  defaultRatio = DEFAULT_RATIO,
  minRatio = MIN_RATIO,
  maxRatio = MAX_RATIO,
  map,
  panel,
}: SplitScreenProps) {
  const [ratio, setRatio] = useState(() => readRatio(storageKey, defaultRatio));
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(ratio));
    } catch {
      /* ignore */
    }
  }, [ratio, storageKey]);

  const onDrag = useCallback(
    (clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = (clientY - rect.top) / rect.height;
      setRatio(Math.max(minRatio, Math.min(maxRatio, next)));
    },
    [minRatio, maxRatio],
  );

  return (
    <div ref={containerRef} className="h-full flex flex-col select-none overflow-hidden">
      <motion.div
        className="relative min-h-0 overflow-hidden"
        style={{ height: `${ratio * 100}%` }}
        layout
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        {map}
      </motion.div>

      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-t-[16px]"
        style={{ background: "var(--surface)", boxShadow: "0 -2px 16px rgba(0,0,0,0.06)" }}
      >
        <div
          className="shrink-0 flex justify-center cursor-grab active:cursor-grabbing touch-none"
          style={{ paddingTop: 10, paddingBottom: 8 }}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => dragging.current && onDrag(e.clientY)}
          onPointerUp={() => {
            dragging.current = false;
          }}
        >
          <div className="sheet-drag-handle" />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">{panel}</div>
      </div>
    </div>
  );
}

function readRatio(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n >= MIN_RATIO && n <= MAX_RATIO) return n;
  } catch {
    /* ignore */
  }
  return fallback;
}
