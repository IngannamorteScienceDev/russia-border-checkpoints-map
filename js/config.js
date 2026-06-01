export const DEFAULT_CAMERA = {
  west: 18,
  south: 35,
  east: 180,
  north: 82
};

export const CAMERA_PRESETS = [
  {
    id: "overview",
    label: "Обзор",
    bounds: DEFAULT_CAMERA
  },
  {
    id: "west",
    label: "Запад",
    bounds: { west: 18, south: 44, east: 43, north: 70 }
  },
  {
    id: "south",
    label: "Юг",
    bounds: { west: 28, south: 41, east: 56, north: 58 }
  },
  {
    id: "siberia",
    label: "Сибирь",
    bounds: { west: 56, south: 48, east: 112, north: 74 }
  },
  {
    id: "far-east",
    label: "Дальний Восток",
    bounds: { west: 108, south: 41, east: 180, north: 73 }
  }
];

export const TYPE_COLORS = {
  Автомобильный: "#2f80ed",
  Железнодорожный: "#27ae60",
  Воздушный: "#9b51e0",
  Морской: "#0097a7",
  Речной: "#00a676",
  Пешеходный: "#f2994a",
  Другое: "#7b8794"
};

export const UNKNOWN_VALUE = "Не указано";
