import { useEffect, useState } from "react";
import { cellToLatLng } from "h3-js";
import { useApp } from "../../context/AppContext";
import type { SectorCardData, SectorGeoInfo, SectorSocialStats } from "../../types/sector";
import { SECTOR_CATEGORY_LABELS } from "../../types/sector";
import { fetchSectorGeoInfo } from "../../utils/sectorGeocoding";
import { recordSectorVisit } from "../../utils/sectorStats";

type SectorCardProps = {
  data: SectorCardData | null;
  onClose: () => void;
  onBuildRoute: (h3Index: string) => void;
  routeLoading?: boolean;
  routeError?: string | null;
};

export default function SectorCard({ data, onClose, onBuildRoute, routeLoading, routeError }: SectorCardProps) {
  const { travel } = useApp();
  const [geo, setGeo] = useState<SectorGeoInfo | null>(null);
  const [stats, setStats] = useState<SectorSocialStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) {
      setGeo(null);
      setStats(null);
      return;
    }

    setLoading(true);
    setError(null);
    setStats(data.accessible ? recordSectorVisit(data.h3Index, false) : null);

    fetchSectorGeoInfo(data.h3Index)
      .then(setGeo)
      .catch(() => setError("Не удалось загрузить данные сектора"))
      .finally(() => setLoading(false));
  }, [data]);

  if (!data) return null;

  const [lat, lng] = cellToLatLng(data.h3Index);
  const routeLabel = travel === "bike" ? "ПОСТРОИТЬ ВЕЛОМАРШРУТ" : "ПОСТРОИТЬ ПЕШЕХОДНЫЙ МАРШРУТ";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl p-4 pb-6 max-h-[75vh] overflow-y-auto scroll-area"
        style={{
          maxWidth: 410,
          background: "var(--surface)",
          borderTop: "1px solid var(--line)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-soft)" }}>
              Сведения о секторе
            </p>
            <h2 className="font-mono text-[15px] font-extrabold mt-1 leading-snug" style={{ color: "var(--ink)" }}>
              {loading ? "Загрузка…" : geo?.name ?? "Сектор"}
            </h2>
            {geo && (
              <p className="font-mono text-[11px] mt-1" style={{ color: "var(--terracotta)" }}>
                {SECTOR_CATEGORY_LABELS[geo.category]}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[16px]"
            style={{ background: "var(--bg-2)", color: "var(--ink-soft)" }}
          >
            ×
          </button>
        </div>

        {error && (
          <p className="font-mono text-[11px] mt-3" style={{ color: "var(--terracotta)" }}>
            {error}
          </p>
        )}

        {geo && geo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {geo.tags.map((tag) => (
              <span
                key={tag}
                className="font-mono text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-md"
                style={{ background: "var(--bg-2)", color: "var(--ink-soft)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[10px]">
          <Stat label="Район" value={data.district} />
          <Stat
            label="Статус"
            value={
              data.statusLabel ??
              (data.visited ? "Исследован" : "Не исследован")
            }
            accent={data.accessible && data.visited}
            muted={data.isNature || !data.accessible}
          />
          <Stat label="Первопроходец" value={stats?.firstDiscoveredBy ?? "—"} />
          <Stat label="Всего визитов" value={String(stats?.discoveryCount ?? 0)} />
          <Stat label="Ваши визиты" value={String(stats?.userVisitsCount ?? 0)} accent />
        </div>

        <p className="font-mono text-[9px] mt-3" style={{ color: "var(--ink-soft)" }}>
          {lat.toFixed(5)}°N, {lng.toFixed(5)}°E
        </p>

        <button
          onClick={() => onBuildRoute(data.h3Index)}
          disabled={routeLoading || !data.routable}
          className="mt-4 w-full rounded-xl py-3.5 font-mono text-[12px] font-bold uppercase tracking-widest transition active:scale-[.98] disabled:opacity-60"
          style={{ background: "var(--terracotta)", color: "#fff" }}
        >
          {!data.routable
            ? data.isNature
              ? "Не исследуется"
              : "Вне зоны МКАД"
            : routeLoading
              ? "Построение…"
              : routeLabel}
        </button>
        {routeError && (
          <p className="font-mono text-[10px] mt-2 text-center leading-snug" style={{ color: "var(--terracotta)" }}>
            {routeError}
          </p>
        )}
        {!data.accessible && data.routable && data.inaccessibleReason && (
          <p className="font-mono text-[10px] mt-2 text-center leading-snug" style={{ color: "var(--ink-soft)" }}>
            {data.inaccessibleReason} — маршрут можно построить, но сектор не откроется
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
      <p className="uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>
        {label}
      </p>
      <p
        className="font-bold mt-0.5 truncate"
        style={{
          color: muted ? "var(--ink-soft)" : accent ? "var(--terracotta)" : "var(--ink)",
        }}
      >
        {value}
      </p>
    </div>
  );
}
