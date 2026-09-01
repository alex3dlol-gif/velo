import type { MapBounds } from "../types/map";
import { MKAD_BOUNDS, MKAD_CENTER } from "./mkad";
import { isInsideMkadRing } from "./mkadPolygon";

export const DISTRICT_UNLOCK_THRESHOLD = 80;

export type GameDistrict = {
  id: string;
  name: string;
  shortName: string;
  area: string;
  bounds: MapBounds;
  /** Геометрический центр зоны [lng, lat]. */
  center: [number, number];
  /** Позиция подписи снаружи зоны [lng, lat]. */
  labelPosition: [number, number];
  /** Якорь текста относительно labelPosition. */
  labelAnchor: "left" | "right" | "top" | "bottom";
  totalHexes: number;
  unlockAfter: { districtId: string; thresholdPct: number } | null;
};

/** Реальные центры районов [lng, lat] — ближайший район по координатам. */
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  ramenki: [37.498, 55.705],
  ochakovo: [37.47, 55.682],
  chertanovo: [37.603, 55.628],
  marino: [37.745, 55.65],
  fili: [37.472, 55.752],
  hamovniki: [37.568, 55.727],
  zamoskvorechye: [37.632, 55.736],
  tagansky: [37.655, 55.74],
  sokol: [37.515, 55.805],
  tverskoy: [37.61, 55.765],
  sokolniki: [37.68, 55.792],
  izmailovo: [37.78, 55.79],
};

type GridCell = {
  id: string;
  name: string;
  shortName: string;
  area: string;
};

/** 4×3 непересекающаяся сетка внутри МКАД (юг → север, запад → восток). */
const GRID: GridCell[][] = [
  [
    { id: "ramenki", name: "Раменки", shortName: "Раменки", area: "ЗАО" },
    { id: "ochakovo", name: "Очаково-Матвеевское", shortName: "Очаково", area: "ЗАО" },
    { id: "chertanovo", name: "Чертаново Центральное", shortName: "Чертаново", area: "ЮАО" },
    { id: "marino", name: "Марьино", shortName: "Марьино", area: "ЮВАО" },
  ],
  [
    { id: "fili", name: "Фили-Давыдково", shortName: "Фили", area: "ЗАО" },
    { id: "hamovniki", name: "Хамовники", shortName: "Хамовники", area: "ЦАО" },
    { id: "zamoskvorechye", name: "Замоскворечье", shortName: "Замоскворечье", area: "ЦАО" },
    { id: "tagansky", name: "Таганский", shortName: "Таганский", area: "ЦАО" },
  ],
  [
    { id: "sokol", name: "Сокол", shortName: "Сокол", area: "САО" },
    { id: "tverskoy", name: "Тверской", shortName: "Тверской", area: "ЦАО" },
    { id: "sokolniki", name: "Сокольники", shortName: "Сокольники", area: "ВАО" },
    { id: "izmailovo", name: "Измайлово", shortName: "Измайлово", area: "ВАО" },
  ],
];

/** Порядок разблокировки: от стартовой зоны по спирали. */
const UNLOCK_ORDER = [
  "chertanovo",
  "hamovniki",
  "zamoskvorechye",
  "ochakovo",
  "tagansky",
  "fili",
  "tverskoy",
  "marino",
  "ramenki",
  "sokolniki",
  "sokol",
  "izmailovo",
] as const;

function getGridIndices(lng: number, lat: number): { col: number; row: number } | null {
  const LNG_SPLITS = splitLine(MKAD_BOUNDS.west, MKAD_BOUNDS.east, 4);
  const LAT_SPLITS = splitLine(MKAD_BOUNDS.south, MKAD_BOUNDS.north, 3);
  const col = LNG_SPLITS.findIndex(
    (west, i) =>
      lng >= west &&
      (i === LNG_SPLITS.length - 2 ? lng <= LNG_SPLITS[i + 1]! : lng < LNG_SPLITS[i + 1]!),
  );
  const row = LAT_SPLITS.findIndex(
    (south, i) =>
      lat >= south &&
      (i === LAT_SPLITS.length - 2 ? lat <= LAT_SPLITS[i + 1]! : lat < LAT_SPLITS[i + 1]!),
  );
  if (col < 0 || row < 0 || row >= GRID.length || col >= GRID[row]!.length) return null;
  return { col, row };
}

function splitLine(min: number, max: number, parts: number): number[] {
  const step = (max - min) / parts;
  return Array.from({ length: parts + 1 }, (_, i) => min + step * i);
}

function boundsFromGrid(col: number, row: number): MapBounds {
  const LNG_SPLITS = splitLine(MKAD_BOUNDS.west, MKAD_BOUNDS.east, 4);
  const LAT_SPLITS = splitLine(MKAD_BOUNDS.south, MKAD_BOUNDS.north, 3);
  return {
    west: LNG_SPLITS[col]!,
    south: LAT_SPLITS[row]!,
    east: LNG_SPLITS[col + 1]!,
    north: LAT_SPLITS[row + 1]!,
  };
}

function exteriorLabel(
  bounds: MapBounds,
  cityCenter: [number, number],
): { position: [number, number]; anchor: GameDistrict["labelAnchor"] } {
  const cx = (bounds.west + bounds.east) / 2;
  const cy = (bounds.south + bounds.north) / 2;
  const [ccLng, ccLat] = cityCenter;
  const dx = cx - ccLng;
  const dy = cy - ccLat;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;

  const halfW = (bounds.east - bounds.west) / 2;
  const halfH = (bounds.north - bounds.south) / 2;
  const push = Math.max(halfW, halfH) * 0.72 + 0.006;

  const lng = cx + nx * push;
  const lat = cy + ny * push;

  let anchor: GameDistrict["labelAnchor"];
  if (Math.abs(nx) >= Math.abs(ny)) {
    anchor = nx > 0 ? "left" : "right";
  } else {
    anchor = ny > 0 ? "top" : "bottom";
  }

  return { position: [lng, lat], anchor };
}

function buildDistricts(): GameDistrict[] {
  const districts: GameDistrict[] = [];

  for (let row = 0; row < GRID.length; row++) {
    for (let col = 0; col < GRID[row].length; col++) {
      const cell = GRID[row][col];
      const bounds = boundsFromGrid(col, row);
      const center: [number, number] = DISTRICT_CENTERS[cell.id] ?? [
        (bounds.west + bounds.east) / 2,
        (bounds.south + bounds.north) / 2,
      ];
      const { position, anchor } = exteriorLabel(bounds, MKAD_CENTER);

      districts.push({
        id: cell.id,
        name: cell.name,
        shortName: cell.shortName,
        area: cell.area,
        bounds,
        center,
        labelPosition: position,
        labelAnchor: anchor,
        totalHexes: 280,
        unlockAfter: null,
      });
    }
  }

  const orderIndex = new Map(UNLOCK_ORDER.map((id, i) => [id, i]));
  districts.sort((a, b) => (orderIndex.get(a.id as (typeof UNLOCK_ORDER)[number]) ?? 99) - (orderIndex.get(b.id as (typeof UNLOCK_ORDER)[number]) ?? 99));

  for (let i = 1; i < districts.length; i++) {
    districts[i].unlockAfter = {
      districtId: districts[i - 1].id,
      thresholdPct: DISTRICT_UNLOCK_THRESHOLD,
    };
  }

  return districts;
}

export const GAME_DISTRICTS: GameDistrict[] = buildDistricts();

export function getDistrictById(id: string): GameDistrict | undefined {
  return GAME_DISTRICTS.find((d) => d.id === id);
}

export function getDistrictIdForCoords(lng: number, lat: number): string | null {
  if (!isInsideMkadRing(lat, lng)) return null;
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const district of GAME_DISTRICTS) {
    const [dlng, dlat] = district.center;
    const dist = (lng - dlng) ** 2 + (lat - dlat) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestId = district.id;
    }
  }
  return bestId;
}

export function getDistrictByGrid(col: number, row: number): GameDistrict | undefined {
  const cell = GRID[row]?.[col];
  return cell ? getDistrictById(cell.id) : undefined;
}

export function isInsideMkad(lat: number, lng: number): boolean {
  return isInsideMkadRing(lat, lng);
}
