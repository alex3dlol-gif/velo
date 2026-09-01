import type { GeoPosition } from "../../context/GeolocationContext";

type MapMotionHudProps = {
  position: GeoPosition | null;
  speedBlocked?: boolean;
  navigating?: boolean;
};

export default function MapMotionHud({ position, speedBlocked, navigating }: MapMotionHudProps) {
  if (!position) return null;

  const speed = position.speedKmh.toFixed(1);
  const heading =
    position.heading != null ? `${Math.round(position.heading)}°` : "—";

  return (
    <div
      className="absolute z-10 pointer-events-none flex flex-col gap-1.5"
      style={{
        top: "max(0.75rem, var(--safe-top))",
        right: "calc(4rem + var(--safe-right))",
      }}
    >
      {navigating && (
        <div
          className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded-lg text-center"
          style={{ background: "var(--terracotta)", color: "#fff" }}
        >
          навигация
        </div>
      )}
      <div
        className="font-mono text-[10px] px-2.5 py-1.5 rounded-xl flex items-center gap-2"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}
      >
        <span style={{ color: "var(--terracotta)", fontWeight: 700 }}>{speed}</span>
        <span style={{ color: "var(--ink-soft)" }}>км/ч</span>
        <span style={{ color: "var(--line-strong)" }}>|</span>
        <span style={{ color: "var(--ink-soft)" }}>↗</span>
        <span style={{ fontWeight: 700 }}>{heading}</span>
      </div>
      {speedBlocked && (
        <div
          className="font-mono text-[9px] uppercase tracking-wide px-2 py-1 rounded-lg text-center"
          style={{ background: "#3d1515", color: "#ffb4a8", border: "1px solid #ff6b4a" }}
        >
          слишком быстро — гексы не открываются
        </div>
      )}
    </div>
  );
}
