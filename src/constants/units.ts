/** 1 открытый H3-сектор = 1 единица исследования (EXP / Очки Разведки). */
export const SECTOR_EXP_RATIO = 1;

export const SECTOR_LABEL = "секторов";
export const SECTOR_LABEL_SHORT = "ОН";
export const SECTOR_LABEL_GENITIVE = "сектор";

export const H3_INFO_TITLE = "Как работает сетка H3?";
export const H3_INFO_TEXT =
  "Вся карта разделена на равные географические секторы (H3-ячейки площади ~0.1 км²). Исследуя новые территории в реальном мире, вы снимаете «туман войны» и получаете 1 Сектор в свой личный зачёт.";

export function formatSectorCount(count: number): string {
  return count.toLocaleString("ru-RU");
}
