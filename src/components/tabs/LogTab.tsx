import { TabHeader } from "../shared";
import { LOG } from "../../data/mock";

export default function LogTab() {
  return (
    <div className="h-full flex flex-col">
      <TabHeader title="Журнал" sub="история вылазок · фото" />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-area px-4 pb-4 space-y-3">
        {LOG.map((e) => (
          <article
            key={e.id}
            className="rounded-xl overflow-hidden border"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            <div className="h-36 w-full relative" style={{ background: "var(--bg-2)" }}>
              <img src={e.img} alt={e.title} className="w-full h-full object-cover" style={{ filter: "saturate(.92)" }} loading="lazy" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(20,16,12,.55), transparent 55%)" }} />
              <span className="absolute bottom-2 left-3 font-mono text-[10px] uppercase tracking-widest text-white/90">{e.place}</span>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-[14px] font-bold" style={{ color: "var(--ink)" }}>
                  {e.title}
                </h3>
                <span className="font-mono text-[10px]" style={{ color: "var(--ink-soft)" }}>
                  {e.date}
                </span>
              </div>
              <div className="flex gap-4 mt-2 font-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>
                <span>
                  <b style={{ color: "var(--ink)" }}>{e.dist}</b> км
                </span>
                <span>
                  <b style={{ color: "var(--terracotta)" }}>+{e.hexes}</b> гексов
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
