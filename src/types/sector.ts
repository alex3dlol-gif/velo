export type SectorCategory = "residential" | "park" | "social" | "retail" | "transit" | "unknown";

export const SECTOR_CATEGORY_LABELS: Record<SectorCategory, string> = {
  residential: "🏠 Жилой массив",
  park: "🌳 Парк / Сквер",
  social: "🏫 Социальный объект",
  retail: "🛍 Торговый центр",
  transit: "🚂 Транспорт",
  unknown: "📍 Городской сектор",
};

export type SectorGeoInfo = {
  h3Index: string;
  name: string;
  category: SectorCategory;
  tags: string[];
};

export type SectorSocialStats = {
  firstDiscoveredBy: string | null;
  discoveryCount: number;
  userVisitsCount: number;
};

export type SectorCardData = {
  h3Index: string;
  visited: boolean;
  accessible: boolean;
  routable: boolean;
  isNature?: boolean;
  statusLabel?: string;
  inaccessibleReason?: string;
  district: string;
  lat: number;
  lng: number;
};

export type RouteGeoJSON = GeoJSON.Feature<GeoJSON.LineString>;
