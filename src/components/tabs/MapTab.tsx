import { useMemo } from "react";
import Icon from "../Icon";
import MapBottomSheet from "../map/MapBottomSheet";
import VeiloMap from "../map/VeiloMap";
import SectorMetric from "../SectorMetric";
import { Metric } from "../shared";
import { useApp } from "../../context/AppContext";
import { useFogOfWarContext } from "../../context/FogOfWarContext";
import { useGeolocation } from "../../hooks/useGeolocation";
import { formatSectorCount } from "../../constants/units";
import { GAME_DISTRICTS } from "../../constants/districts";
import { getUnlockHint } from "../../utils/districtProgress";

const SHEET_SNAP_KEY = "veilo-map-sheet-snap";

export default function MapTab() {
  const { startExploring, activeRoute, clearRoute } = useApp();
  const { progressPct, visitedCount, districtStates, homeDistrict } = useFogOfWarContext();
  const { position } = useGeolocation(true);
  const displayPct = districtStates.progress[homeDistrict.id] ?? progressPct;
  const mapView = useMemo(() => <VeiloMap showHeader />, []);
  const speedKmh = position?.speedKmh ?? 0;

  const goButton = activeRoute ? (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => startExploring(true)}
        className="w-full rounded-xl py-4 font-mono text-[16px] font-extrabold uppercase tracking-[0.15em] transition active:scale-[.985] flex items-center justify-center gap-3"
        style={{ background: "var(--terracotta)", color: "#fff" }}
      >
        Начать навигацию
        <Icon name="chevron" size={20} />
      </button>
      <button
        onClick={clearRoute}
        className="w-full rounded-xl py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest"
        style={{ background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}
      >
        Сбросить маршрут
      </button>
    </div>
  ) : (
    <button
      onClick={() => startExploring(false)}
      className="w-full rounded-xl py-4 font-mono text-[19px] font-extrabold uppercase tracking-[0.2em] transition active:scale-[.985] flex items-center justify-center gap-3"
      style={{ background: "var(--terracotta)", color: "#fff" }}
    >
      В путь
      <Icon name="chevron" size={20} />
    </button>
  );

  return (
    <MapBottomSheet
      storageKey={SHEET_SNAP_KEY}
      map={mapView}
      footer={goButton}
      collapsedSummary={
        <div className="flex items-center justify-between py-1">
          <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>
            {homeDistrict.shortName} · {displayPct}%
            {activeRoute ? " · маршрут" : ""}
          </span>
          <SectorMetric value={formatSectorCount(visitedCount)} />
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Metric label="км/ч" value={speedKmh.toFixed(1)} big />
        <Metric label="км пути" value="0.00" big />
        <SectorMetric value={formatSectorCount(visitedCount)} big />
      </div>

      <div className="mt-3 rounded-xl border p-3.5" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>
            {homeDistrict.name}
          </span>
          <span className="font-mono text-[26px] font-extrabold leading-none" style={{ color: "var(--ink)" }}>
            {displayPct}
            <span className="text-[14px]" style={{ color: "var(--terracotta)" }}>
              %
            </span>
          </span>
        </div>
        <div className="mt-2.5 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-2)" }}>
          <div className="h-full rounded-full" style={{ width: `${displayPct}%`, background: "var(--terracotta)" }} />
        </div>
      </div>

      <div className="mt-3">
        <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--ink-soft)" }}>
          Районы Москвы
        </p>
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto scroll-area">
          {GAME_DISTRICTS.map((district) => {
            const unlocked = districtStates.unlocked[district.id];
            const pct = districtStates.progress[district.id] ?? 0;
            const hint = getUnlockHint(district, districtStates);

            return (
              <div
                key={district.id}
                className="rounded-xl p-3"
                style={{ background: "var(--surface-2)", border: "1px solid var(--line)", opacity: unlocked ? 1 : 0.92 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[12px] font-bold truncate" style={{ color: "var(--ink)" }}>
                      {!unlocked && <span className="mr-1">🔒</span>}
                      {district.name}
                    </p>
                    <p className="font-mono text-[9px] uppercase tracking-widest mt-0.5" style={{ color: "var(--ink-soft)" }}>
                      {district.area}
                      {unlocked ? " · открыт" : " · закрыт"}
                    </p>
                  </div>
                  <span className="font-mono text-[15px] font-extrabold shrink-0" style={{ color: unlocked ? "var(--terracotta)" : "var(--ink-soft)" }}>
                    {pct}%
                  </span>
                </div>
                {!unlocked && hint && (
                  <p className="font-mono text-[9px] mt-2 leading-snug" style={{ color: "var(--ink-soft)" }}>
                    {hint}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </MapBottomSheet>
  );
}
