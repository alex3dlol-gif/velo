import type { DistrictStates } from "../../utils/districtProgress";
import { getDistrictState } from "../../utils/districtProgress";
import { formatSectorCount } from "../../constants/units";

type DistrictCardProps = {
  districtId: string | null;
  states: DistrictStates;
  onClose: () => void;
};

export default function DistrictCard({ districtId, states, onClose }: DistrictCardProps) {
  if (!districtId) return null;

  const { district, progress, unlocked, revealed, total, unlockHint } = getDistrictState(
    districtId,
    states,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl p-4 pb-6 max-h-[70vh] overflow-y-auto scroll-area"
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
              {district.area} · {unlocked ? "Уровень открыт" : "Уровень закрыт"}
            </p>
            <h2 className="font-mono text-[16px] font-extrabold mt-1 leading-snug" style={{ color: "var(--ink)" }}>
              {!unlocked && <span className="mr-1">🔒</span>}
              {district.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[16px]"
            style={{ background: "var(--bg-2)", color: "var(--ink-soft)" }}
          >
            ×
          </button>
        </div>

        <div className="mt-4 rounded-xl p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>
              Прогресс района
            </span>
            <span className="font-mono text-[22px] font-extrabold" style={{ color: unlocked ? "var(--terracotta)" : "var(--ink-soft)" }}>
              {progress}%
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-2)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: unlocked ? "var(--terracotta)" : "var(--ink-soft)" }}
            />
          </div>
          <p className="font-mono text-[10px] mt-2" style={{ color: "var(--ink-soft)" }}>
            {formatSectorCount(revealed)} / {formatSectorCount(total)} секторов
          </p>
        </div>

        {!unlocked && unlockHint && (
          <div
            className="mt-3 rounded-xl p-3 font-mono text-[11px] leading-snug"
            style={{ background: "var(--bg-2)", color: "var(--ink-soft)", border: "1px dashed var(--line)" }}
          >
            <span className="font-bold uppercase tracking-widest text-[9px] block mb-1" style={{ color: "var(--terracotta)" }}>
              Как открыть
            </span>
            {unlockHint}
          </div>
        )}

        {unlocked && progress >= 80 && (
          <div
            className="mt-3 rounded-xl p-3 font-mono text-[11px]"
            style={{ background: "rgba(217,93,57,0.1)", color: "var(--terracotta)", border: "1px solid var(--terracotta)" }}
          >
            Почти зачищен! При 100% откроется следующий район.
          </div>
        )}
      </div>
    </div>
  );
}
