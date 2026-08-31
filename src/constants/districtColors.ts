/** Игровые цвета зон — мягкие, но различимые. */
export const DISTRICT_ZONE_COLORS: Record<string, string> = {
  ramenki: "#7EC8A4",
  ochakovo: "#6BB8FF",
  chertanovo: "#FFB347",
  marino: "#FF8F6B",
  fili: "#B88CFF",
  hamovniki: "#FF6B9D",
  zamoskvorechye: "#C77DFF",
  tagansky: "#FFD166",
  sokol: "#8BE0D8",
  tverskoy: "#F4A7BB",
  sokolniki: "#9AD66F",
  izmailovo: "#7EB6FF",
};

export function getDistrictZoneColor(districtId: string): string {
  return DISTRICT_ZONE_COLORS[districtId] ?? "#D95D39";
}
