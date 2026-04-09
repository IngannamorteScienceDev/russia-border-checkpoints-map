import {
  SATELLITE_LAYER_ID,
  SATELLITE_SOURCE,
  SATELLITE_SOURCE_ID,
  TYPE_COLORS
} from "./config.js";

export function ensureSatelliteLayer(map) {
  if (!map.getSource(SATELLITE_SOURCE_ID)) {
    map.addSource(SATELLITE_SOURCE_ID, {
      ...SATELLITE_SOURCE,
      tiles: [...SATELLITE_SOURCE.tiles]
    });
  }

  if (!map.getLayer(SATELLITE_LAYER_ID)) {
    map.addLayer({
      id: SATELLITE_LAYER_ID,
      type: "raster",
      source: SATELLITE_SOURCE_ID,
      layout: { visibility: "none" }
    });
  }
}

export function createCheckpointsLayerController({ map, openPopup }) {
  const handlers = {
    clustersClick: null,
    pointsClick: null,
    enterPoints: null,
    leavePoints: null
  };

  function updateSourceData(features) {
    const source = map.getSource("checkpoints");
    if (!source) return;
    source.setData({ type: "FeatureCollection", features });
  }

  function safeRemoveLayer(id) {
    if (map.getLayer(id)) map.removeLayer(id);
  }

  function safeRemoveSource(id) {
    if (map.getSource(id)) map.removeSource(id);
  }

  function unbindLayerEvents() {
    if (handlers.clustersClick) map.off("click", "clusters", handlers.clustersClick);
    if (handlers.pointsClick) map.off("click", "points-hit", handlers.pointsClick);
    if (handlers.enterPoints) map.off("mouseenter", "points-hit", handlers.enterPoints);
    if (handlers.leavePoints) map.off("mouseleave", "points-hit", handlers.leavePoints);

    handlers.clustersClick = null;
    handlers.pointsClick = null;
    handlers.enterPoints = null;
    handlers.leavePoints = null;
  }

  function rebuildLayers(features) {
    unbindLayerEvents();

    ["clusters", "cluster-count", "points", "points-hit"].forEach(safeRemoveLayer);
    safeRemoveSource("checkpoints");

    map.addSource("checkpoints", {
      type: "geojson",
      data: { type: "FeatureCollection", features },
      cluster: true,
      clusterRadius: 52,
      clusterMaxZoom: 10
    });

    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "checkpoints",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#3b82f6",
        "circle-radius": ["step", ["get", "point_count"], 16, 30, 22, 80, 28],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#020617"
      }
    });

    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "checkpoints",
      filter: ["has", "point_count"],
      layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
      paint: { "text-color": "#e5e7eb" }
    });

    map.addLayer({
      id: "points",
      type: "circle",
      source: "checkpoints",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 6,
        "circle-color": [
          "match",
          ["get", "__type"],
          "Автомобильный", TYPE_COLORS.Автомобильный,
          "Железнодорожный", TYPE_COLORS.Железнодорожный,
          "Воздушный", TYPE_COLORS.Воздушный,
          "Морской", TYPE_COLORS.Морской,
          "Речной", TYPE_COLORS.Речной,
          "Пешеходный", TYPE_COLORS.Пешеходный,
          TYPE_COLORS.Другое
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#020617"
      }
    });

    map.addLayer({
      id: "points-hit",
      type: "circle",
      source: "checkpoints",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 18,
        "circle-opacity": 0
      }
    });

    handlers.clustersClick = event => {
      const feature = event.features?.[0];
      if (!feature) return;

      const source = map.getSource("checkpoints");
      source.getClusterExpansionZoom(feature.properties.cluster_id, (error, zoom) => {
        if (!error) map.easeTo({ center: feature.geometry.coordinates, zoom });
      });
    };

    handlers.enterPoints = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    handlers.leavePoints = () => {
      map.getCanvas().style.cursor = "";
    };

    handlers.pointsClick = event => {
      openPopup(event.features?.[0], event.lngLat);
    };

    map.on("click", "clusters", handlers.clustersClick);
    map.on("mouseenter", "points-hit", handlers.enterPoints);
    map.on("mouseleave", "points-hit", handlers.leavePoints);
    map.on("click", "points-hit", handlers.pointsClick);
  }

  return {
    rebuildLayers,
    updateSourceData
  };
}
