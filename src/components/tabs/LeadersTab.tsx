import { TabHeader } from "../shared";
import { LEADERS } from "../../data/mock";

export default function LeadersTab() {
  return (
    <div className="h-full flex flex-col">
      <TabHeader title="Хранители районов" sub="лидерборд недели" />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-area px-4 pb-4 space-y-2">
        {LEADERS.map((l) => (
          <div
            key={l.rank}
            className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
            style={{
              borderColor: l.you ? "var(--terracotta)" : "var(--line)",
              background: l.you ? "var(--surface-2)" : "var(--surface)",
            }}
          >
            <span
              className="font-mono text-[15px] font-extrabold w-7 text-center"
              style={{ color: l.rank <= 3 ? "var(--terracotta)" : "var(--ink-soft)" }}
            >
              {l.rank}
            </span>
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-[13px]"
              style={{ background: "var(--bg-2)", color: "var(--ink)" }}
            >
              {l.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[13px] font-bold truncate" style={{ color: "var(--ink)" }}>
                {l.name} {l.you && <span style={{ color: "var(--terracotta)" }}>· ты</span>}
              </p>
              <p className="font-mono text-[10px]" style={{ color: "var(--ink-soft)" }}>
                {l.district}
              </p>
            </div>
            <span className="font-mono text-[14px] font-extrabold tabular-nums" style={{ color: "var(--ink)" }}>
              {l.hexes.toLocaleString("ru-RU")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
