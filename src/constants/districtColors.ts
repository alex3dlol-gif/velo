/** Различимая палитра районов — hex для карты и canvas. */
const DISTRICT_PALETTE = [
  "#E85A4B",
  "#4A90D9",
  "#50B86C",
  "#F5A623",
  "#9B59B6",
  "#1ABC9C",
  "#E67E22",
  "#3498DB",
  "#2ECC71",
  "#E74C3C",
  "#8E44AD",
  "#16A085",
  "#D35400",
  "#2980B9",
  "#27AE60",
  "#C0392B",
  "#7F8C8D",
  "#F39C12",
  "#6C5CE7",
  "#00B894",
  "#FD79A8",
  "#0984E3",
  "#55EFC4",
  "#FFEAA7",
] as const;

export function getDistrictZoneColor(districtId: string): string {
  let h = 0;
  for (let i = 0; i < districtId.length; i++) {
    h = (h * 31 + districtId.charCodeAt(i)) | 0;
  }
  return DISTRICT_PALETTE[Math.abs(h) % DISTRICT_PALETTE.length]!;
}
