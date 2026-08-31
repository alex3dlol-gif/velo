import { cellToLatLng } from "h3-js";
import type { SectorCategory, SectorGeoInfo } from "../types/sector";
import { SECTOR_CATEGORY_LABELS } from "../types/sector";

const CACHE_KEY = "veilo-sector-geo-cache";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

type NominatimResponse = {
  display_name?: string;
  address?: Record<string, string>;
  type?: string;
  category?: string;
};

function loadCache(): Record<string, SectorGeoInfo> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, SectorGeoInfo>;
  } catch {
    /* ignore */
  }
  return {};
}

function saveCache(cache: Record<string, SectorGeoInfo>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function detectCategory(data: NominatimResponse): SectorCategory {
  const type = `${data.type ?? ""} ${data.category ?? ""}`.toLowerCase();
  const addr = data.address ?? {};
  const joined = Object.values(addr).join(" ").toLowerCase();

  if (/park|garden|forest|square|сквер|парк/.test(type + joined)) return "park";
  if (/station|metro|railway|остановк|вокзал/.test(type + joined)) return "transit";
  if (/shop|mall|market|торгов|тц/.test(type + joined)) return "retail";
  if (/school|kindergarten|hospital|university|школ|больниц/.test(type + joined)) return "social";
  if (/residential|suburb|neighbourhood|квартал|жил/.test(type + joined)) return "residential";
  return "unknown";
}

function buildSectorName(data: NominatimResponse): string {
  const a = data.address ?? {};
  if (a.leisure || a.park) return `Сектор: ${a.leisure ?? a.park}`;
  if (a.road && a.house_number) return `Сектор: ${a.road}, д. ${a.house_number}`;
  if (a.road) return `Сектор: ${a.road}`;
  if (a.suburb) return `Сектор: ${a.suburb}`;
  if (a.neighbourhood) return `Сектор: ${a.neighbourhood}`;
  if (a.quarter) return `Сектор: ${a.quarter}`;
  const short = data.display_name?.split(",").slice(0, 2).join(", ");
  return short ? `Сектор: ${short}` : "Сектор: неизвестная территория";
}

function buildTags(category: SectorCategory, data: NominatimResponse): string[] {
  const tags = [SECTOR_CATEGORY_LABELS[category]];
  const a = data.address ?? {};
  if (a.city || a.town) tags.push(a.city ?? a.town!);
  if (a.suburb && !tags.includes(a.suburb)) tags.push(a.suburb);
  return tags.slice(0, 4);
}

/** Reverse geocoding with LocalStorage cache (Nominatim). */
export async function fetchSectorGeoInfo(h3Index: string): Promise<SectorGeoInfo> {
  const cache = loadCache();
  if (cache[h3Index]) return cache[h3Index];

  const [lat, lng] = cellToLatLng(h3Index);
  const url = `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

  const res = await fetch(url, {
    headers: { "Accept-Language": "ru", "User-Agent": "Veilo/1.0 (urban exploration app)" },
  });

  if (!res.ok) throw new Error("Geocoding failed");

  const data = (await res.json()) as NominatimResponse;
  const category = detectCategory(data);
  const info: SectorGeoInfo = {
    h3Index,
    name: buildSectorName(data),
    category,
    tags: buildTags(category, data),
  };

  cache[h3Index] = info;
  saveCache(cache);
  return info;
}
