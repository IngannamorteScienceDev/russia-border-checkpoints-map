export const STYLE_MAP = {
  version: 8,
  name: "KPP local base",
  sources: {},
  layers: [
    {
      id: "local-base",
      type: "background",
      paint: {
        "background-color": "rgba(219, 231, 220, 0.9)"
      }
    }
  ]
};

export const SATELLITE_SOURCE_ID = "sat";
export const SATELLITE_LAYER_ID = "sat-layer";
export const BOUNDARIES_SOURCE_ID = "esri-boundaries-places";
export const BOUNDARIES_LAYER_ID = "esri-boundaries-places-layer";
export const ROADS_SOURCE_ID = "esri-transportation";
export const ROADS_LAYER_ID = "esri-transportation-layer";

export const SATELLITE_SOURCE = {
  type: "raster",
  tiles: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  ],
  tileSize: 256,
  attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
};

export const BOUNDARIES_SOURCE = {
  type: "raster",
  tiles: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
  ],
  tileSize: 256,
  attribution: "Reference tiles &copy; Esri"
};

export const ROADS_SOURCE = {
  type: "raster",
  tiles: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
  ],
  tileSize: 256,
  attribution: "Transportation tiles &copy; Esri"
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
