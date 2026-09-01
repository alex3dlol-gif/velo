import type { Travel } from "../context/AppContext";
import { notifyJournalUpdated } from "../context/AppContext";

export type TrackPoint = [number, number];

export type JournalEntry = {
  id: string;
  title: string;
  place: string;
  date: string;
  dist: string;
  hexes: number;
  travel: Travel;
  startedAt: number;
  endedAt: number;
  durationMin: number;
  track: TrackPoint[];
  photoCount: number;
  coverPhotoId: string | null;
};

export type JournalPhoto = {
  id: string;
  rideId: string;
  takenAt: number;
  lat: number | null;
  lng: number | null;
  blob: Blob;
};

export type RidePhotoInput = {
  blob: Blob;
  lat: number | null;
  lng: number | null;
  takenAt: number;
};

export const MIN_RIDE_MS = 5 * 60 * 1000;

const DB_NAME = "veilo-journal";
const DB_VERSION = 1;
const ENTRIES_STORE = "entries";
const PHOTOS_STORE = "photos";
const LEGACY_STORAGE_KEY = "veilo-journal";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ENTRIES_STORE)) {
        db.createObjectStore(ENTRIES_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
        const photos = db.createObjectStore(PHOTOS_STORE, { keyPath: "id" });
        photos.createIndex("rideId", "rideId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function migrateLegacyEntries(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Array<
      JournalEntry & { img?: string; photos?: string[]; track?: TrackPoint[] }
    >;
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ENTRIES_STORE, "readwrite");
      const store = tx.objectStore(ENTRIES_STORE);
      for (const row of parsed) {
        const entry: JournalEntry = {
          id: row.id ?? `ride-${row.endedAt}`,
          title: row.title,
          place: row.place,
          date: row.date,
          dist: row.dist,
          hexes: row.hexes,
          travel: row.travel,
          startedAt: row.startedAt,
          endedAt: row.endedAt,
          durationMin: row.durationMin,
          track: row.track ?? [],
          photoCount: row.photos?.length ?? (row.img ? 1 : 0),
          coverPhotoId: null,
        };
        store.put(entry);
      }
      tx.oncomplete = () => {
        db.close();
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    /* ignore migration errors */
  }
}

let migrated = false;
async function ensureMigrated() {
  if (migrated) return;
  migrated = true;
  await migrateLegacyEntries();
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  await ensureMigrated();
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENTRIES_STORE, "readonly");
    const req = tx.objectStore(ENTRIES_STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as JournalEntry[]).sort((a, b) => b.endedAt - a.endedAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getJournalEntry(id: string): Promise<JournalEntry | null> {
  await ensureMigrated();
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENTRIES_STORE, "readonly");
    const req = tx.objectStore(ENTRIES_STORE).get(id);
    req.onsuccess = () => resolve((req.result as JournalEntry | undefined) ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getRidePhotos(rideId: string): Promise<JournalPhoto[]> {
  await ensureMigrated();
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTOS_STORE, "readonly");
    const idx = tx.objectStore(PHOTOS_STORE).index("rideId");
    const req = idx.getAll(rideId);
    req.onsuccess = () => {
      const rows = (req.result as JournalPhoto[]).sort((a, b) => a.takenAt - b.takenAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getPhotoById(id: string): Promise<JournalPhoto | null> {
  await ensureMigrated();
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTOS_STORE, "readonly");
    const req = tx.objectStore(PHOTOS_STORE).get(id);
    req.onsuccess = () => resolve((req.result as JournalPhoto | undefined) ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveRideToJournal(
  entry: Omit<JournalEntry, "id" | "photoCount" | "coverPhotoId">,
  photos: RidePhotoInput[],
): Promise<JournalEntry | null> {
  await ensureMigrated();
  if (typeof indexedDB === "undefined") return null;

  const id = `ride-${entry.endedAt}`;
  const coverPhotoId = photos[0] ? `${id}-photo-0` : null;
  const full: JournalEntry = {
    ...entry,
    id,
    photoCount: photos.length,
    coverPhotoId,
  };

  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([ENTRIES_STORE, PHOTOS_STORE], "readwrite");
      const entries = tx.objectStore(ENTRIES_STORE);
      const photoStore = tx.objectStore(PHOTOS_STORE);

      entries.put(full);
      photos.forEach((photo, i) => {
        photoStore.put({
          id: `${id}-photo-${i}`,
          rideId: id,
          takenAt: photo.takenAt,
          lat: photo.lat,
          lng: photo.lng,
          blob: photo.blob,
        } satisfies JournalPhoto);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    notifyJournalUpdated();
    return full;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export function formatJournalDate(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm} · ${hh}:${min}`;
}

export function trackToRouteGeoJSON(track: TrackPoint[]): GeoJSON.Feature<GeoJSON.LineString> | null {
  if (track.length < 2) return null;
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: track },
  };
}

export function trackBounds(track: TrackPoint[]): [[number, number], [number, number]] | null {
  if (track.length === 0) return null;
  let west = track[0]![0];
  let east = track[0]![0];
  let south = track[0]![1];
  let north = track[0]![1];
  for (const [lng, lat] of track) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}
