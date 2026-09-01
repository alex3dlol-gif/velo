import { useEffect, useRef, useState } from "react";
import { TabHeader } from "../shared";
import JournalDetail from "../journal/JournalDetail";
import { onJournalUpdated, useApp } from "../../context/AppContext";
import { blobToPreviewUrl } from "../../utils/photoCompress";
import { getJournalEntries, getPhotoById, type JournalEntry } from "../../utils/rideJournal";

export default function LogTab() {
  const { activeTab } = useApp();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const coverUrlsRef = useRef<string[]>([]);

  const loadEntries = async () => {
    const rows = await getJournalEntries();
    setEntries(rows);

    coverUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    coverUrlsRef.current = [];

    const nextCovers: Record<string, string> = {};
    await Promise.all(
      rows.map(async (entry) => {
        if (!entry.coverPhotoId) return;
        const photo = await getPhotoById(entry.coverPhotoId);
        if (!photo) return;
        const url = blobToPreviewUrl(photo.blob);
        coverUrlsRef.current.push(url);
        nextCovers[entry.id] = url;
      }),
    );
    setCovers(nextCovers);
  };

  useEffect(() => {
    void loadEntries();
    return onJournalUpdated(() => {
      void loadEntries();
    });
  }, []);

  useEffect(() => {
    if (activeTab === "log") void loadEntries();
  }, [activeTab]);

  useEffect(
    () => () => {
      coverUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  return (
    <div className="h-full flex flex-col">
      <TabHeader title="Журнал" sub="маршруты от 5 минут · трек · фото" />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-area px-4 pb-4 space-y-3">
        {entries.length === 0 ? (
          <p className="font-mono text-[12px] text-center py-8" style={{ color: "var(--ink-soft)" }}>
            Пока нет записей. Завершите вылазку длительностью от 5 минут.
          </p>
        ) : (
          entries.map((e) => {
            const cover = covers[e.id];
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedId(e.id)}
                className="w-full text-left rounded-xl overflow-hidden border transition active:scale-[.99]"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                <div className="h-36 w-full relative" style={{ background: "var(--bg-2)" }}>
                  {cover ? (
                    <img src={cover} alt={e.title} className="w-full h-full object-cover" style={{ filter: "saturate(.92)" }} loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-mono text-[11px]" style={{ color: "var(--ink-soft)" }}>
                      {e.track.length >= 2 ? "маршрут" : "без фото"}
                    </div>
                  )}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(20,16,12,.55), transparent 55%)" }} />
                  <span className="absolute bottom-2 left-3 font-mono text-[10px] uppercase tracking-widest text-white/90">{e.place}</span>
                  {e.track.length >= 2 && (
                    <span className="absolute top-2 right-2 font-mono text-[9px] px-2 py-0.5 rounded-md uppercase tracking-widest" style={{ background: "rgba(0,0,0,.45)", color: "#fff" }}>
                      трек
                    </span>
                  )}
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
                    {e.photoCount > 0 && <span>📷 {e.photoCount}</span>}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedId && <JournalDetail entryId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
