import type { GeoPosition } from "../../hooks/useGeolocation";

export type HexPopupData = {
  h3Index: string;
  district: string;
  visited: boolean;
  lngLat: [number, number];
};

type HexPopupProps = {
  data: HexPopupData | null;
  onClose: () => void;
};

export default function HexPopup({ data, onClose }: HexPopupProps) {
  if (!data) return null;

  return (
    <div
      className="absolute left-4 right-16 z-20 rounded-xl border p-3 shadow-lg"
      style={{
        top: 12,
        background: "var(--surface)",
        borderColor: "var(--line)",
        boxShadow: "0 8px 24px -8px rgba(0,0,0,.35)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-soft)" }}>
            H3 · r9
          </p>
          <p className="font-mono text-[11px] font-bold mt-1 truncate" style={{ color: "var(--ink)" }}>
            {data.h3Index}
          </p>
          <p className="font-mono text-[11px] mt-1.5" style={{ color: "var(--ink-soft)" }}>
            {data.district}
          </p>
          <span
            className="inline-block mt-2 font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-md"
            style={{
              background: data.visited ? "rgba(217,93,57,0.15)" : "var(--bg-2)",
              color: data.visited ? "var(--terracotta)" : "var(--ink-soft)",
              border: `1px solid ${data.visited ? "var(--terracotta)" : "var(--line)"}`,
            }}
          >
            {data.visited ? "Исследован" : "Не исследован"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[14px]"
          style={{ background: "var(--bg-2)", color: "var(--ink-soft)" }}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function UserMarker({ heading }: { heading: number | null }) {
  const rotation = heading ?? 0;
  return (
    <div className="user-marker" style={{ transform: `rotate(${rotation}deg)` }}>
      <div className="user-marker__pulse" />
      <div className="user-marker__dot" />
      <div className="user-marker__arrow" />
    </div>
  );
}

export type { GeoPosition };
