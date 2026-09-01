import type { Travel } from "../context/AppContext";
import { notifyJournalUpdated } from "../context/AppContext";

export type JournalEntry = {
  id: string;
  title: string;
  place: string;
  date: string;
  dist: string;
  hexes: number;
  img: string;
  photos: string[];
  travel: Travel;
  startedAt: number;
  endedAt: number;
  durationMin: number;
};

const STORAGE_KEY = "veilo-journal";
export const MIN_RIDE_MS = 5 * 60 * 1000;

function loadAll(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as JournalEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(entries: JournalEntry[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function getJournalEntries(): JournalEntry[] {
  return loadAll().sort((a, b) => b.endedAt - a.endedAt);
}

export function saveRideToJournal(entry: Omit<JournalEntry, "id">): JournalEntry | null {
  const full: JournalEntry = { ...entry, id: `ride-${entry.endedAt}` };
  const all = loadAll();
  all.unshift(full);

  if (saveAll(all.slice(0, 80))) {
    notifyJournalUpdated();
    return full;
  }

  // Фото часто переполняют localStorage — сохраняем без них.
  const withoutPhotos: JournalEntry = {
    ...full,
    img: "",
    photos: [],
  };
  const retry = [withoutPhotos, ...loadAll().filter((e) => e.id !== full.id)];
  if (saveAll(retry.slice(0, 80))) {
    notifyJournalUpdated();
    return withoutPhotos;
  }

  return null;
}

export function formatJournalDate(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm} · ${hh}:${min}`;
}
