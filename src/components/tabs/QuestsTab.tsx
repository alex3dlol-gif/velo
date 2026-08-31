import Icon from "../Icon";
import { TabHeader } from "../shared";
import { QUESTS } from "../../data/mock";

export default function QuestsTab() {
  return (
    <div className="h-full flex flex-col">
      <TabHeader title="Задачи" sub="маршруты · ачивки · серии" />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-area px-4 pb-4 space-y-2.5">
        {QUESTS.map((q, i) => (
          <div key={i} className="rounded-xl border p-3.5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span
                  className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{ background: "var(--bg-2)", color: "var(--ink-soft)" }}
                >
                  {q.kind}
                </span>
                <h3 className="font-mono text-[14px] font-bold mt-1.5" style={{ color: "var(--ink)" }}>
                  {q.title}
                </h3>
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: q.done ? "var(--terracotta)" : "var(--bg-2)",
                  color: q.done ? "#fff" : "var(--ink-soft)",
                }}
              >
                <Icon name="check" size={16} />
              </div>
            </div>
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-2)" }}>
              <div className="h-full rounded-full" style={{ width: `${q.pct}%`, background: "var(--terracotta)" }} />
            </div>
            <div className="flex items-center justify-between mt-2 font-mono text-[10px]" style={{ color: "var(--ink-soft)" }}>
              <span>{q.len}</span>
              <span style={{ color: "var(--terracotta)" }}>{q.reward}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
