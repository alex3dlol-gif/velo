/** Цвет зоны по id района — стабильный хэш. */
export function getDistrictZoneColor(districtId: string): string {
  let h = 0;
  for (let i = 0; i < districtId.length; i++) {
    h = (h * 31 + districtId.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 42% 58%)`;
}
