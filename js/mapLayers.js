import {
  BOUNDARIES_LAYER_ID,
  BOUNDARIES_SOURCE,
  ROADS_LAYER_ID,
  ROADS_SOURCE,
  SATELLITE_LAYER_ID,
  SATELLITE_SOURCE,
  TYPE_COLORS
} from "./config.js";

const CHECKPOINT_SOURCE_ID = "checkpoints";
const COMPATIBILITY_LAYER_IDS = [
  "clusters",
  "cluster-count",
  "quality-points-alert",
  "favorite-points-halo",
  "points",
  "points-hit"
];

function featureId(feature) {
  return String(feature?.properties?.__id || "");
}

function entityId(feature) {
  return `checkpoint-${featureId(feature)}`;
}

function colorForType(Cesium, type) {
  return Cesium.Color.fromCssColorString(TYPE_COLORS[type] || TYPE_COLORS.Другое);
}

function qualityTone(feature) {
  if (feature.properties?.__hasCriticalQualityIssues) return "critical";
  if (feature.properties?.__hasQualityIssues) return "warning";
  return "";
}

function featureBounds(features) {
  const coordinates = features
    .map((feature) => feature.geometry?.coordinates)
    .filter(
      (coords) => Array.isArray(coords) && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
    );

  if (!coordinates.length) return null;

  const lngs = coordinates.map((coords) => coords[0]);
  const lats = coordinates.map((coords) => coords[1]);

  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  ];
}

function ensureCompatibilityLayer(map, id) {
  if (!map.getLayer?.(id)) {
    map.addLayer?.({ id, type: "cesium-entity", layout: { visibility: "visible" } });
  }
}

function setCompatibilitySourceData(map, features) {
  const data = { type: "FeatureCollection", features };
  const source = map.getSource?.(CHECKPOINT_SOURCE_ID);

  if (source?.setData) {
    source.setData(data);
    return;
  }

  map.addSource?.(CHECKPOINT_SOURCE_ID, { type: "geojson", data });
}

export function ensureSatelliteLayer(map) {
  if (map.ensureRasterLayer) {
    map.ensureRasterLayer(SATELLITE_LAYER_ID, SATELLITE_SOURCE, { visibility: "none" });
    map.ensureRasterLayer(BOUNDARIES_LAYER_ID, BOUNDARIES_SOURCE, {
      visibility: "none",
      opacity: 0.92
    });
    map.ensureRasterLayer(ROADS_LAYER_ID, ROADS_SOURCE, { visibility: "none", opacity: 0.9 });
    return;
  }

  [SATELLITE_LAYER_ID, BOUNDARIES_LAYER_ID, ROADS_LAYER_ID].forEach((id) =>
    ensureCompatibilityLayer(map, id)
  );
}

export function setMapReferenceVisibility(map, { satellite, boundaries, roads }) {
  if (map.getLayer?.(SATELLITE_LAYER_ID)) {
    map.setLayoutProperty?.(SATELLITE_LAYER_ID, "visibility", satellite ? "visible" : "none");
  }

  if (map.getLayer?.(BOUNDARIES_LAYER_ID)) {
    map.setLayoutProperty?.(
      BOUNDARIES_LAYER_ID,
      "visibility",
      satellite && boundaries ? "visible" : "none"
    );
  }

  if (map.getLayer?.(ROADS_LAYER_ID)) {
    map.setLayoutProperty?.(ROADS_LAYER_ID, "visibility", satellite && roads ? "visible" : "none");
  }
}

export function createCheckpointsLayerController({ map, openPopup }) {
  let dataSource = null;
  let clickHandler = null;

  function styleCluster(Cesium, clusteredEntities, cluster) {
    const count = clusteredEntities.length;

    cluster.billboard.show = false;
    cluster.point.show = true;
    cluster.point.pixelSize = count >= 80 ? 32 : count >= 30 ? 27 : 22;
    cluster.point.color = Cesium.Color.fromCssColorString("#3b82f6").withAlpha(0.96);
    cluster.point.outlineColor = Cesium.Color.fromCssColorString("#020617");
    cluster.point.outlineWidth = 3;

    cluster.label.show = true;
    cluster.label.text = count.toLocaleString("ru-RU");
    cluster.label.fillColor = Cesium.Color.fromCssColorString("#e5e7eb");
    cluster.label.outlineColor = Cesium.Color.fromCssColorString("#020617");
    cluster.label.outlineWidth = 3;
    cluster.label.style = Cesium.LabelStyle.FILL_AND_OUTLINE;
    cluster.label.font = "700 13px system-ui, sans-serif";
    cluster.label.disableDepthTestDistance = Number.POSITIVE_INFINITY;
  }

  function bindCesiumEvents() {
    if (!map.isCesium || clickHandler) return;

    const { Cesium, viewer } = map;
    clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    clickHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      const pickedId = picked?.id;

      if (Array.isArray(pickedId)) {
        const clusteredFeatures = pickedId.map((entity) => entity.kppFeature).filter(Boolean);
        const bounds = featureBounds(clusteredFeatures);
        if (bounds) map.fitBounds(bounds);
        return;
      }

      const feature = pickedId?.kppFeature;
      if (!feature) return;
      openPopup(feature, feature.geometry.coordinates);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    clickHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.endPosition);
      const pickedId = picked?.id;
      const hasCheckpoint = Array.isArray(pickedId)
        ? pickedId.some((entity) => entity.kppFeature)
        : Boolean(pickedId?.kppFeature);

      viewer.scene.canvas.style.cursor = hasCheckpoint ? "pointer" : "";
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  function ensureDataSource() {
    if (!map.isCesium) return null;
    if (dataSource) return dataSource;

    const { Cesium, viewer } = map;
    dataSource = new Cesium.CustomDataSource(CHECKPOINT_SOURCE_ID);
    dataSource.clustering.enabled = true;
    dataSource.clustering.pixelRange = 52;
    dataSource.clustering.minimumClusterSize = 3;
    dataSource.clustering.clusterBillboards = false;
    dataSource.clustering.clusterLabels = false;
    dataSource.clustering.clusterPoints = true;
    dataSource.clustering.clusterEvent.addEventListener((clusteredEntities, cluster) => {
      styleCluster(Cesium, clusteredEntities, cluster);
    });

    viewer.dataSources.add(dataSource);
    bindCesiumEvents();
    return dataSource;
  }

  function addEntityForFeature(dataSourceRef, feature) {
    const { Cesium } = map;
    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates)) return;

    const props = feature.properties || {};
    const tone = qualityTone(feature);
    const isFavorite = props.__isFavorite === true;
    const color = colorForType(Cesium, props.__type);
    const outlineColor = isFavorite
      ? "#facc15"
      : tone === "critical"
        ? "#fecaca"
        : tone === "warning"
          ? "#fde68a"
          : "#020617";

    const entity = dataSourceRef.entities.add({
      id: entityId(feature),
      name: props.__name || props.__id || "КПП",
      position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1]),
      point: {
        pixelSize: isFavorite ? 14 : tone ? 12 : 10,
        color,
        outlineColor: Cesium.Color.fromCssColorString(outlineColor),
        outlineWidth: isFavorite ? 4 : tone ? 3 : 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      properties: props
    });

    entity.kppFeature = feature;
  }

  function renderCesiumFeatures(features) {
    const dataSourceRef = ensureDataSource();
    if (!dataSourceRef) return;

    dataSourceRef.entities.suspendEvents();
    dataSourceRef.entities.removeAll();
    features.forEach((feature) => addEntityForFeature(dataSourceRef, feature));
    dataSourceRef.entities.resumeEvents();
    map.requestRender?.();
  }

  function updateSourceData(features) {
    setCompatibilitySourceData(map, features);
    if (map.isCesium) renderCesiumFeatures(features);
  }

  function rebuildLayers(features) {
    COMPATIBILITY_LAYER_IDS.forEach((id) => ensureCompatibilityLayer(map, id));
    updateSourceData(features);
  }

  return {
    rebuildLayers,
    updateSourceData,
    destroy() {
      clickHandler?.destroy?.();
      clickHandler = null;
    }
  };
}
