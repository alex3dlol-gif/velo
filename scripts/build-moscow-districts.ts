/**
 * Скачивает все районы Москвы (click_that_hood / OSM) и сохраняет data/moscow-districts.geojson
 * Usage: npx tsx scripts/build-moscow-districts.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";
import { polygonToCells } from "h3-js";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { isInsideMkadRing } from "../src/constants/mkadPolygon";

const H3_RESOLUTION = 9;

const SOURCE_URL =
  "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/moscow.geojson";
const OUTPUT = resolve(import.meta.dirname ?? ".", "../data/moscow-districts.geojson");
const OUTPUT_TS = resolve(import.meta.dirname ?? ".", "../src/generated/moscowDistrictsData.ts");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/^район\s+/i, "")
    .replace(/муниципальный\s+округ\s+/i, "")
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .replace(/[а-яё]/g, (ch) => {
      const map: Record<string, string> = {
        а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
        к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
        х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
      };
      return map[ch] ?? ch;
    })
    .slice(0, 48);
}

function cleanName(raw: string): string {
  return raw
    .replace(/^район\s+/i, "")
    .replace(/^муниципальный\s+округ\s+/i, "")
    .trim();
}

function shortName(name: string): string {
  const trimmed = name.replace(/\s+район$/i, "").trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= 2) return trimmed;
  return words.slice(0, 2).join(" ");
}

function geometryToH3Cells(geometry: Polygon | MultiPolygon): string[] {
  const rings: Position[][] =
    geometry.type === "Polygon" ? [geometry.coordinates[0]!] : geometry.coordinates.map((p) => p[0]!);

  const cells = new Set<string>();
  for (const ring of rings) {
    if (!ring || ring.length < 3) continue;
    const h3Ring: [number, number][] = ring.map(([lng, lat]) => [lat, lng]);
    try {
      for (const idx of polygonToCells(h3Ring, H3_RESOLUTION)) cells.add(idx);
    } catch {
      /* skip bad ring */
    }
  }
  return [...cells];
}

function simplifyFeature(feature: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> {
  try {
    return turf.simplify(feature, { tolerance: 0.00012, highQuality: true }) as Feature<
      Polygon | MultiPolygon
    >;
  } catch {
    return feature;
  }
}

async function main() {
  console.log("[build-districts] downloading…");
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const source = (await res.json()) as FeatureCollection;

  const candidates: Feature<Polygon | MultiPolygon>[] = [];
  for (const f of source.features) {
    if (!f.geometry || (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon")) continue;
    const name = String(f.properties?.name ?? "").trim();
    if (!name) continue;
    const feat = f as Feature<Polygon | MultiPolygon>;
    const c = turf.centroid(feat).geometry.coordinates as Position;
    if (!isInsideMkadRing(c[1]!, c[0]!)) continue;
    candidates.push(simplifyFeature(feat));
  }

  console.log(`[build-districts] ${candidates.length} districts inside MKAD`);

  const withMeta = candidates.map((geom, i) => {
    const rawName = String(
      (geom.properties?.name as string) ?? `district-${i}`,
    );
    const name = cleanName(rawName);
    const districtId = slugify(name) || `district-${i}`;
    const center = turf.centroid(geom).geometry.coordinates as [number, number];
    const bbox = turf.bbox(geom);
    return {
      districtId,
      name,
      shortName: shortName(name),
      center,
      bounds: { west: bbox[0], south: bbox[1], east: bbox[2], north: bbox[3] },
      feature: {
        type: "Feature" as const,
        properties: { districtId, name, shortName: shortName(name) },
        geometry: geom.geometry,
      },
    };
  });

  // dedupe ids
  const seen = new Set<string>();
  for (const d of withMeta) {
    let id = d.districtId;
    let n = 2;
    while (seen.has(id)) {
      id = `${d.districtId}-${n++}`;
    }
    d.districtId = id;
    d.feature.properties.districtId = id;
    seen.add(id);
  }

  // соседи по общей границе
  for (const a of withMeta) {
    const neighbors: string[] = [];
    for (const b of withMeta) {
      if (a.districtId === b.districtId) continue;
      try {
        if (turf.booleanTouches(a.feature, b.feature)) neighbors.push(b.districtId);
      } catch {
        /* skip */
      }
    }
    a.feature.properties.neighbors = neighbors;
    a.feature.properties.centerLng = a.center[0];
    a.feature.properties.centerLat = a.center[1];
    a.feature.properties.west = a.bounds.west;
    a.feature.properties.south = a.bounds.south;
    a.feature.properties.east = a.bounds.east;
    a.feature.properties.north = a.bounds.north;
    a.feature.properties.playableCells = geometryToH3Cells(a.feature.geometry).length;
  }

  const features = withMeta.map((d) => d.feature);

  const collection: FeatureCollection = { type: "FeatureCollection", features };
  mkdirSync(resolve(import.meta.dirname ?? ".", "../src/generated"), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(collection));
  writeFileSync(
    OUTPUT_TS,
    `import type { FeatureCollection } from "geojson";\n\nexport const MOSCOW_DISTRICTS_DATA = ${JSON.stringify(collection)} as FeatureCollection;\n`,
  );
  console.log(`[build-districts] wrote ${features.length} → ${OUTPUT}`);
  console.log(`[build-districts] wrote TS module → ${OUTPUT_TS}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
