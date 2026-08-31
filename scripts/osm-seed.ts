/**
 * OSM auto-markup seed: marks H3 hexes as inaccessible when they intersect
 * water bodies (natural=water) or closed/private landuse areas.
 *
 * Usage: npx tsx scripts/osm-seed.ts [districts.geojson]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";
import { cellToBoundary, latLngToCell, polygonToCells } from "h3-js";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";

const H3_RESOLUTION = 9;
const DATA_DIR = resolve(import.meta.dirname ?? ".", "../data");
const DISTRICTS_PATH = process.argv[2] ?? resolve(DATA_DIR, "moscow-districts.geojson");
const WATER_PATH = resolve(DATA_DIR, "moscow-water.geojson");
const CLOSED_PATH = resolve(DATA_DIR, "moscow-closed.geojson");
const OUTPUT_PATH = resolve(DATA_DIR, "seed-output.json");

type DistrictSeed = {
  name: string;
  geometry: Polygon | MultiPolygon;
  hexes: { h3_index: string; is_accessible: boolean }[];
};

function loadGeoJSON(path: string): FeatureCollection {
  if (!existsSync(path)) {
    console.warn(`[seed] Missing ${path} — using empty collection`);
    return { type: "FeatureCollection", features: [] };
  }
  return JSON.parse(readFileSync(path, "utf-8")) as FeatureCollection;
}

function polygonFeatureToH3Cells(feature: Feature<Polygon | MultiPolygon>): string[] {
  const cells = new Set<string>();

  if (feature.geometry.type === "Polygon") {
    const ring = feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
    for (const idx of polygonToCells(ring, H3_RESOLUTION)) cells.add(idx);
  } else {
    for (const poly of feature.geometry.coordinates) {
      const ring = poly[0].map(([lng, lat]) => [lat, lng] as [number, number]);
      for (const idx of polygonToCells(ring, H3_RESOLUTION)) cells.add(idx);
    }
  }

  return [...cells];
}

function hexIntersectsFeature(h3Index: string, feature: Feature): boolean {
  const boundary = cellToBoundary(h3Index, true);
  const ring = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
  ring.push(ring[0]);
  const hexPoly = turf.polygon([ring]);
  return turf.booleanIntersects(hexPoly, feature);
}

function isBlockedHex(h3Index: string, blockers: Feature[]): boolean {
  return blockers.some((f) => hexIntersectsFeature(h3Index, f));
}

function main() {
  const districts = loadGeoJSON(DISTRICTS_PATH);
  const water = loadGeoJSON(WATER_PATH);
  const closed = loadGeoJSON(CLOSED_PATH);

  const blockers: Feature[] = [
    ...water.features.filter((f) => f.geometry?.type),
    ...closed.features.filter((f) => f.geometry?.type),
  ];

  const results: DistrictSeed[] = [];

  for (const feature of districts.features) {
    if (!feature.geometry || (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon")) {
      continue;
    }

    const name = (feature.properties?.name as string) ?? "Unknown";
    const cells = polygonFeatureToH3Cells(feature as Feature<Polygon | MultiPolygon>);

    const hexes = cells.map((h3_index) => ({
      h3_index,
      is_accessible: !isBlockedHex(h3_index, blockers),
    }));

    const accessible = hexes.filter((h) => h.is_accessible).length;
    console.log(`[seed] ${name}: ${cells.length} hexes, ${accessible} accessible`);

    results.push({
      name,
      geometry: feature.geometry,
      hexes,
    });
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
  console.log(`[seed] Wrote ${OUTPUT_PATH}`);
}

main();
