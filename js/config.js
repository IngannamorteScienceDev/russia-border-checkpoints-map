export const STYLE_MAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export const SATELLITE_SOURCE_ID = "sat";
export const SATELLITE_LAYER_ID = "sat-layer";

export const SATELLITE_SOURCE = {
  type: "raster",
  tiles: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  ],
  tileSize: 256
};

export const TYPE_COLORS = {
  Автомобильный: "#3b82f6",
  Железнодорожный: "#22c55e",
  Воздушный: "#a855f7",
  Морской: "#0ea5e9",
  Речной: "#14b8a6",
  Пешеходный: "#f97316",
  Другое: "#64748b"
};
