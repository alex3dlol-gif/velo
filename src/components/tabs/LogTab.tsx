import { useEffect, useState } from "react";
import { TabHeader } from "../shared";
import { onJournalUpdated, useApp } from "../../context/AppContext";
import { getJournalEntries, type JournalEntry } from "../../utils/rideJournal";

export default function LogTab() {
  const { activeTab } = useApp();
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    const refresh = () => setEntries(getJournalEntries());
    refresh();
    return onJournalUpdated(refresh);
  }, []);

  useEffect(() => {
    if (activeTab === "log") setEntries(getJournalEntries());
  }, [activeTab]);

  return (
    <div className="h-full flex flex-col">
      <TabHeader title="Журнал" sub="маршруты от 5 минут · фото" />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-area px-4 pb-4 space-y-3">
        {entries.length === 0 ? (
          <p className="font-mono text-[12px] text-center py-8" style={{ color: "var(--ink-soft)" }}>
            Пока нет записей. Завершите вылазку длительностью от 5 минут.
          </p>
        ) : (
          entries.map((e) => (
            <article
              key={e.id}
              className="rounded-xl overflow-hidden border"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
            >
              <div className="h-36 w-full relative" style={{ background: "var(--bg-2)" }}>
                {e.img ? (
                  <img src={e.img} alt={e.title} className="w-full h-full object-cover" style={{ filter: "saturate(.92)" }} loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>
                    без фото
                  </div>
                )}
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
                  <span>{e.durationMin} мин</span>
                </div>
                {e.photos.length > 1 && (
                  <div className="flex gap-1.5 mt-2 overflow-x-auto">
                    {e.photos.slice(1).map((src, i) => (
                      <img key={i} src={src} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
