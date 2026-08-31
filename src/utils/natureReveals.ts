import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import { cellToBoundary, cellToLatLng, polygonToCells } from "h3-js";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { MAP_WATER } from "../constants/mapWater";
import { MKAD_BOUNDS } from "../constants/mkad";
import { H3_RESOLUTION } from "../constants/h3";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const waterHexes = new Set<string>();
let loadedFromOsm = false;
let loadPromise: Promise<void> | null = null;

function ringToH3Cells(ring: [number, number][]): string[] {
  const latLngRing = ring.map(([lng, lat]) => [lat, lng] as [number, number]);
  return polygonToCells(latLngRing, H3_RESOLUTION);
}

function addPolygonCoords(coords: [number, number][][]) {
  for (const idx of ringToH3Cells(coords[0])) waterHexes.add(idx);
}

function addFeatureGeometry(feature: Feature<Polygon | MultiPolygon>) {
  if (feature.geometry.type === "Polygon") {
    addPolygonCoords(feature.geometry.coordinates);
  } else {
    for (const poly of feature.geometry.coordinates) addPolygonCoords(poly);
  }
}

function cellTouchesWater(h3Index: string, test: (lng: number, lat: number) => boolean): boolean {
  const [lat, lng] = cellToLatLng(h3Index);
  if (test(lng, lat)) return true;
  for (const [lngPt, latPt] of cellToBoundary(h3Index, true)) {
    if (test(lngPt, latPt)) return true;
  }
  return false;
}

function buildPointTester(features: Feature<Polygon | MultiPolygon>[]) {
  const polys = features.map((f) => {
    if (f.geometry.type === "Polygon") return polygon(f.geometry.coordinates);
    return polygon(f.geometry.coordinates[0]);
  });

  return (lng: number, lat: number) => {
    const pt = point([lng, lat]);
    return polys.some((p) => booleanPointInPolygon(pt, p));
  };
}

function indexFeatures(features: Feature<Polygon | MultiPolygon>[]) {
  const test = buildPointTester(features);
  const candidates = new Set<string>();
  for (const feature of features) {
    if (feature.geometry.type === "Polygon") {
      for (const idx of ringToH3Cells(feature.geometry.coordinates[0])) candidates.add(idx);
    } else {
      for (const poly of feature.geometry.coordinates) {
        for (const idx of ringToH3Cells(poly[0])) candidates.add(idx);
      }
    }
  }
  for (const idx of candidates) {
    if (cellTouchesWater(idx, test)) waterHexes.add(idx);
  }
}

for (const feature of MAP_WATER.features) {
  try {
    addFeatureGeometry(feature as Feature<Polygon>);
  } catch {
    /* skip invalid geometry */
  }
}

type OverpassElement = {
  type: string;
  geometry?: { lat: number; lon: number }[];
};

function wayToPolygon(el: OverpassElement): [number, number][] | null {
  if (!el.geometry || el.geometry.length < 3) return null;
  const ring = el.geometry.map((p) => [p.lon, p.lat] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  return ring;
}

async function fetchWaterFromOverpass(): Promise<Feature<Polygon>[]> {
  const { south, west, north, east } = MKAD_BOUNDS;
  const query = `[out:json][timeout:25];(way["natural"="water"](${south},${west},${north},${east});way["waterway"~"river|canal|stream"](${south},${west},${north},${east}););out geom;`;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error("Overpass failed");

  const data = (await res.json()) as { elements?: OverpassElement[] };
  const features: Feature<Polygon>[] = [];

  for (const el of data.elements ?? []) {
    const ring = wayToPolygon(el);
    if (!ring) continue;
    features.push({
      type: "Feature",
      properties: { source: "osm-water" },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }

  return features;
}

/** Подгружает реки/водоёмы OSM (кэш в памяти на сессию). */
export function ensureNatureWaterLoaded(): Promise<void> {
  if (loadedFromOsm) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = fetchWaterFromOverpass()
    .then((features) => {
      if (features.length > 0) indexFeatures(features);
      loadedFromOsm = true;
    })
    .catch(() => {
      loadedFromOsm = true;
    });

  return loadPromise;
}

export function isNatureWaterCell(h3Index: string): boolean {
  return waterHexes.has(h3Index);
}

export function getNatureWaterCells(): ReadonlySet<string> {
  return waterHexes;
}

export const NATURE_WATER_LABEL = "Водоём · не исследуется";
