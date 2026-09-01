import { useEffect, useState } from "react";
import JournalMap from "./JournalMap";
import {
  getJournalEntry,
  getRidePhotos,
  type JournalEntry,
  type JournalPhoto,
} from "../../utils/rideJournalStore";
import { blobToPreviewUrl } from "../../utils/photoCompress";

type JournalDetailProps = {
  entryId: string;
  onClose: () => void;
};

type PhotoView = {
  id: string;
  url: string;
  lat: number | null;
  lng: number | null;
};

export default function JournalDetail({ entryId, onClose }: JournalDetailProps) {
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [photos, setPhotos] = useState<PhotoView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    void (async () => {
      setLoading(true);
      const row = await getJournalEntry(entryId);
      const rawPhotos = row ? await getRidePhotos(entryId) : [];
      if (cancelled) return;

      const views: PhotoView[] = rawPhotos.map((p: JournalPhoto) => {
        const url = blobToPreviewUrl(p.blob);
        urls.push(url);
        return { id: p.id, url, lat: p.lat, lng: p.lng };
      });

      setEntry(row);
      setPhotos(views);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [entryId]);

  const photoMarkers = photos
    .filter((p): p is PhotoView & { lat: number; lng: number } => p.lat != null && p.lng != null)
    .map((p) => ({ lat: p.lat, lng: p.lng, url: p.url }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl p-4 pb-6 max-h-[92vh] overflow-y-auto scroll-area"
        style={{
          maxWidth: 410,
          background: "var(--surface)",
          borderTop: "1px solid var(--line)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>
              {entry?.place ?? "…"}
            </p>
            <h2 className="font-mono text-[16px] font-extrabold mt-1" style={{ color: "var(--ink)" }}>
              {entry?.title ?? "Маршрут"}
            </h2>
            {entry && (
              <p className="font-mono text-[10px] mt-1" style={{ color: "var(--ink-soft)" }}>
                {entry.date} · {entry.dist} км · +{entry.hexes} гексов · {entry.durationMin} мин
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

        {loading ? (
          <p className="font-mono text-[11px] text-center py-10" style={{ color: "var(--ink-soft)" }}>
            загрузка маршрута…
          </p>
        ) : entry && entry.track.length >= 2 ? (
          <div className="h-56">
            <JournalMap track={entry.track} photoMarkers={photoMarkers} />
          </div>
        ) : (
          <div
            className="h-36 rounded-xl flex items-center justify-center font-mono text-[11px]"
            style={{ background: "var(--bg-2)", color: "var(--ink-soft)" }}
          >
            Трек не записан (старые записи)
          </div>
        )}

        {photos.length > 0 && (
          <div className="mt-3">
            <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--ink-soft)" }}>
              Фото ({photos.length})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <img key={p.id} src={p.url} alt="" className="w-full aspect-square rounded-lg object-cover" loading="lazy" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
