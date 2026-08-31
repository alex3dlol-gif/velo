import type { MapBounds } from "../types/map";
import { MKAD_BOUNDS, MKAD_CENTER } from "./mkad";

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

const LNG_SPLITS = [37.369, 37.485, 37.601, 37.717, 37.834] as const;
const LAT_SPLITS = [55.574, 55.685, 55.796, 55.908] as const;

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

function boundsFromGrid(col: number, row: number): MapBounds {
  return {
    west: LNG_SPLITS[col],
    south: LAT_SPLITS[row],
    east: LNG_SPLITS[col + 1],
    north: LAT_SPLITS[row + 1],
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
      const center: [number, number] = [
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

function getGridIndices(lng: number, lat: number): { col: number; row: number } | null {
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

export function getDistrictIdForCoords(lng: number, lat: number): string | null {
  const idx = getGridIndices(lng, lat);
  if (!idx) return null;
  return GRID[idx.row]![idx.col]!.id;
}

export function getDistrictByGrid(col: number, row: number): GameDistrict | undefined {
  const cell = GRID[row]?.[col];
  return cell ? getDistrictById(cell.id) : undefined;
}

export function isInsideMkad(lat: number, lng: number): boolean {
  return (
    lng >= MKAD_BOUNDS.west &&
    lng <= MKAD_BOUNDS.east &&
    lat >= MKAD_BOUNDS.south &&
    lat <= MKAD_BOUNDS.north
  );
}
