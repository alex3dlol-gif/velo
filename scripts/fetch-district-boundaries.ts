/**
 * Fetches Moscow raion boundaries from OSM Overpass and writes data/moscow-districts.geojson
 * Usage: npx tsx scripts/fetch-district-boundaries.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

const OUTPUT = resolve(import.meta.dirname ?? ".", "../data/moscow-districts.geojson");

/** Game id → OSM name:ru (admin_level 5 rayony) */
const DISTRICT_OSM_NAMES: Record<string, string> = {
  ramenki: "Раменки",
  ochakovo: "Очаково-Матвеевское",
  chertanovo: "Чертаново Центральное",
  marino: "Марьино",
  fili: "Фили-Давыдково",
  hamovniki: "Хамовники",
  zamoskvorechye: "Замоскворечье",
  tagansky: "Таганский",
  sokol: "Сокол",
  tverskoy: "Тверской",
  sokolniki: "Сокольники",
  izmailovo: "Измайлово",
};

const QUERY = `
[out:json][timeout:120];
area["name"="Москва"]["admin_level"="4"]->.msk;
(
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Раменки"](area.msk);
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Очаково-Матвеевское"](area.msk);
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Чертаново Центральное"](area.msk);
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Марьино"](area.msk);
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Фили-Давыдково"](area.msk);
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Хамовники"](area.msk);
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Замоскворечье"](area.msk);
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Таганский"](area.msk);
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Сокол"](area.msk);
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Тверской"](area.msk);
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Сокольники"](area.msk);
  relation["boundary"="administrative"]["admin_level"="5"]["name"="Измайлово"](area.msk);
);
out geom;
`;

type OsmNode = { type: "node"; id: number; lat: number; lon: number };
type OsmWay = { type: "way"; id: number; nodes: number[]; geometry?: { lat: number; lon: number }[] };
type OsmRelation = {
  type: "relation";
  id: number;
  tags?: Record<string, string>;
  members: { type: string; ref: number; role: string }[];
};

type OsmResponse = { elements: (OsmNode | OsmWay | OsmRelation)[] };

function ringArea(ring: Position[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[i + 1]!;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function closeRing(ring: Position[]): Position[] {
  if (ring.length === 0) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function relationToPolygon(relation: OsmRelation, ways: Map<number, OsmWay>): Polygon | MultiPolygon | null {
  const outerWays = relation.members.filter((m) => m.type === "way" && (m.role === "outer" || m.role === ""));
  const rings: Position[][] = [];

  for (const member of outerWays) {
    const way = ways.get(member.ref);
    if (!way?.geometry?.length) continue;
    const ring = closeRing(way.geometry.map((p) => [p.lon, p.lat] as Position));
    if (ring.length >= 4) rings.push(ring);
  }

  if (rings.length === 0) return null;
  if (rings.length === 1) return { type: "Polygon", coordinates: [rings[0]!] };

  return {
    type: "MultiPolygon",
    coordinates: rings.map((r) => [r]),
  };
}

function simplifyRing(ring: Position[], tolerance = 0.00015): Position[] {
  if (ring.length <= 8) return ring;
  const step = Math.max(1, Math.floor(ring.length / 120));
  const out: Position[] = [];
  for (let i = 0; i < ring.length; i += step) out.push(ring[i]!);
  return closeRing(out);
}

function simplifyGeometry(geom: Polygon | MultiPolygon): Polygon | MultiPolygon {
  if (geom.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geom.coordinates.map((ring) => simplifyRing(ring)),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: geom.coordinates.map((poly) => poly.map((ring) => simplifyRing(ring))),
  };
}

function centroid(geom: Polygon | MultiPolygon): [number, number] {
  const ring =
    geom.type === "Polygon" ? geom.coordinates[0]! : geom.coordinates[0]![0]!;
  let sx = 0;
  let sy = 0;
  for (const [lng, lat] of ring) {
    sx += lng;
    sy += lat;
  }
  return [sx / ring.length, sy / ring.length];
}

async function main() {
  console.log("[fetch-districts] querying Overpass…");
  const res = await fetch("https://overpass.kumi.systems/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: `data=${encodeURIComponent(QUERY.trim())}`,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data = (await res.json()) as OsmResponse;

  const ways = new Map<number, OsmWay>();
  const relations: OsmRelation[] = [];
  for (const el of data.elements) {
    if (el.type === "way") ways.set(el.id, el);
    if (el.type === "relation") relations.push(el);
  }

  const nameToId = new Map(Object.entries(DISTRICT_OSM_NAMES).map(([id, name]) => [name, id]));
  const features: Feature<Polygon | MultiPolygon>[] = [];

  for (const rel of relations) {
    const name = rel.tags?.name;
    if (!name) continue;
    const districtId = nameToId.get(name);
    if (!districtId) continue;

    const geom = relationToPolygon(rel, ways);
    if (!geom) {
      console.warn(`[fetch-districts] no geometry for ${name}`);
      continue;
    }

    const simplified = simplifyGeometry(geom);
    const [cx, cy] = centroid(simplified);
    features.push({
      type: "Feature",
      properties: { districtId, name, osmId: rel.id, centerLng: cx, centerLat: cy },
      geometry: simplified,
    });
    console.log(`[fetch-districts] ✓ ${name} (${districtId})`);
  }

  const missing = Object.keys(DISTRICT_OSM_NAMES).filter(
    (id) => !features.some((f) => f.properties?.districtId === id),
  );
  if (missing.length) {
    console.warn("[fetch-districts] missing:", missing.join(", "));
  }

  const collection: FeatureCollection = { type: "FeatureCollection", features };
  writeFileSync(OUTPUT, JSON.stringify(collection, null, 2));
  console.log(`[fetch-districts] wrote ${features.length} features → ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
