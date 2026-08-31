export const DISTRICTS = [
  { name: "Чертаново Центральное", pct: 88, hexes: 1284, area: "ЮАО" },
  { name: "Тверской", pct: 61, hexes: 902, area: "ЦАО" },
  { name: "Замоскворечье", pct: 34, hexes: 410, area: "ЦАО" },
  { name: "Хамовники", pct: 12, hexes: 148, area: "ЦАО" },
];

export const LOG = [
  {
    id: 1,
    title: "Рассвет над прудами",
    place: "Чертаново Центральное",
    date: "30.08 · 07:42",
    dist: "14.2",
    hexes: 38,
    img: "https://images.unsplash.com/photo-1784031865427-b968c627abfb?w=600&h=440&fit=crop&auto=format",
  },
  {
    id: 2,
    title: "Переулки Тверского",
    place: "Тверской",
    date: "28.08 · 19:10",
    dist: "9.8",
    hexes: 26,
    img: "https://images.unsplash.com/photo-1754405917895-30751487d810?w=600&h=440&fit=crop&auto=format",
  },
  {
    id: 3,
    title: "Ночная зачистка",
    place: "Замоскворечье",
    date: "25.08 · 23:31",
    dist: "18.4",
    hexes: 51,
    img: "https://images.unsplash.com/photo-1633858051938-38b402e34465?w=600&h=440&fit=crop&auto=format",
  },
];

export const LEADERS = [
  { rank: 1, name: "kudesnik.msk", hexes: 4820, district: "Чертаново Ц.", you: false },
  { rank: 2, name: "foma_ride", hexes: 4103, district: "Тверской", you: false },
  { rank: 3, name: "ты", hexes: 3877, district: "Чертаново Ц.", you: true },
  { rank: 4, name: "grisha_велик", hexes: 3540, district: "Хамовники", you: false },
  { rank: 5, name: "nord_walker", hexes: 2988, district: "Замоскворечье", you: false },
];

export const QUESTS = [
  {
    title: "Кольцо бульваров",
    kind: "Маршрут",
    len: "9 км",
    reward: "+120 гексов",
    done: false,
    pct: 45,
  },
  {
    title: "Зачистить Чертаново",
    kind: "Ачивка",
    len: "осталось 10%",
    reward: "Титул: Хранитель",
    done: false,
    pct: 90,
  },
  {
    title: "Ранняя птица ×7",
    kind: "Серия",
    len: "5 / 7 дней",
    reward: "Значок «Рассвет»",
    done: false,
    pct: 71,
  },
  {
    title: "Первые 100 гексов",
    kind: "Ачивка",
    len: "выполнено",
    reward: "Значок «Разведчик»",
    done: true,
    pct: 100,
  },
];
