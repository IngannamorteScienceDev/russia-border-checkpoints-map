import { CAMERA_PRESETS, DEFAULT_CAMERA, TYPE_COLORS } from "./config.js";

const CHECKPOINT_SOURCE_ID = "checkpoints";

function colorForType(Cesium, type) {
  return Cesium.Color.fromCssColorString(TYPE_COLORS[type] || TYPE_COLORS.Другое);
}

function entityId(feature) {
  return `checkpoint-${feature.properties.__id}`;
}

function coordinatesOf(feature) {
  const coordinates = feature.geometry?.coordinates;
  return Array.isArray(coordinates) ? coordinates : null;
}

function createNaturalEarthLayer(Cesium) {
  return Cesium.ImageryLayer.fromProviderAsync(
    Cesium.TileMapServiceImageryProvider.fromUrl(
      Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
      {
        fileExtension: "jpg",
        maximumLevel: 2,
        credit: "Natural Earth II / CesiumJS"
      }
    ),
    { show: true }
  );
}

function boundsForFeatures(features) {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const feature of features) {
    const coordinates = coordinatesOf(feature);
    if (!coordinates) continue;

    const [longitude, latitude] = coordinates;
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  }

  if (![west, south, east, north].every(Number.isFinite)) return null;

  const width = Math.max(0.8, east - west);
  const height = Math.max(0.8, north - south);
  const padding = Math.max(width, height) * 0.16;

  return {
    west: Math.max(-180, west - padding),
    south: Math.max(-90, south - padding),
    east: Math.min(180, east + padding),
    north: Math.min(90, north + padding)
  };
}

export function flyToBounds(viewer, bounds, { duration = 0.8 } = {}) {
  const Cesium = globalThis.Cesium;
  const destination = Cesium.Rectangle.fromDegrees(
    bounds.west,
    bounds.south,
    bounds.east,
    bounds.north
  );

  viewer.camera.flyTo({
    destination,
    duration
  });
}

export function flyToCameraPreset(viewer, presetId) {
  const preset = CAMERA_PRESETS.find((item) => item.id === presetId) || CAMERA_PRESETS[0];
  flyToBounds(viewer, preset.bounds);
}

export function createGlobe({ container }) {
  const Cesium = globalThis.Cesium;
  const viewer = new Cesium.Viewer(container, {
    animation: false,
    baseLayer: createNaturalEarthLayer(Cesium),
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    contextOptions: {
      webgl: {
        antialias: true,
        preserveDrawingBuffer: true
      }
    },
    requestRenderMode: false
  });

  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#d8e4d7");
  viewer.scene.globe.enableLighting = false;
  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.scene.highDynamicRange = false;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.moon.show = false;
  viewer.scene.fog.enabled = false;

  const initialTarget = Cesium.Rectangle.center(
    Cesium.Rectangle.fromDegrees(
      DEFAULT_CAMERA.west,
      DEFAULT_CAMERA.south,
      DEFAULT_CAMERA.east,
      DEFAULT_CAMERA.north
    )
  );
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromRadians(
      initialTarget.longitude,
      initialTarget.latitude,
      10200000
    ),
    orientation: {
      heading: 0,
      pitch: -Cesium.Math.PI_OVER_TWO,
      roll: 0
    }
  });

  return viewer;
}

export function createCheckpointLayer({ viewer, features, onSelect }) {
  const Cesium = globalThis.Cesium;
  const dataSource = new Cesium.CustomDataSource(CHECKPOINT_SOURCE_ID);
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  const entitiesById = new Map();
  let selectedEntity = null;
  let clusteringEnabled = true;

  dataSource.clustering.enabled = clusteringEnabled;
  dataSource.clustering.pixelRange = 46;
  dataSource.clustering.minimumClusterSize = 4;
  dataSource.clustering.clusterEvent.addEventListener((clusteredEntities, cluster) => {
    cluster.billboard.show = false;
    cluster.label.show = true;
    cluster.label.text = String(clusteredEntities.length);
    cluster.label.fillColor = Cesium.Color.fromCssColorString("#071512");
    cluster.label.outlineColor = Cesium.Color.WHITE;
    cluster.label.outlineWidth = 0;
    cluster.label.font = "700 14px Inter, sans-serif";
    cluster.point.show = true;
    cluster.point.pixelSize = Math.min(42, 24 + clusteredEntities.length * 0.18);
    cluster.point.color = Cesium.Color.fromCssColorString("#f2c94c");
    cluster.point.outlineColor = Cesium.Color.fromCssColorString("#071512");
    cluster.point.outlineWidth = 3;
  });

  function styleEntity(entity, isSelected = false) {
    const feature = entity.kppFeature;
    const props = feature.properties;

    entity.point.pixelSize = isSelected ? 17 : 10;
    entity.point.color = colorForType(Cesium, props.__type);
    entity.point.outlineColor = isSelected
      ? Cesium.Color.WHITE
      : Cesium.Color.fromCssColorString("#16201c");
    entity.point.outlineWidth = isSelected ? 5 : 2;
  }

  function clearSelection() {
    if (selectedEntity) {
      styleEntity(selectedEntity, false);
      selectedEntity = null;
      viewer.selectedEntity = undefined;
      viewer.scene.requestRender();
    }
  }

  function selectFeature(feature) {
    const coordinates = coordinatesOf(feature);
    const entity = dataSource.entities.getById(entityId(feature));
    if (!coordinates || !entity || !entity.show) return;

    clearSelection();
    selectedEntity = entity;
    styleEntity(entity, true);
    viewer.selectedEntity = entity;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1], 850000),
      orientation: {
        heading: 0,
        pitch: -Cesium.Math.PI_OVER_TWO,
        roll: 0
      },
      duration: 0.7
    });

    onSelect?.(feature);
    viewer.scene.requestRender();
  }

  function setVisibleFeatures(visibleFeatures) {
    const visibleIds = new Set(visibleFeatures.map((feature) => feature.properties.__id));

    for (const [featureId, entity] of entitiesById) {
      entity.show = visibleIds.has(featureId);
    }

    if (selectedEntity && !selectedEntity.show) {
      clearSelection();
      onSelect?.(null);
    }

    viewer.scene.requestRender();
  }

  function flyToFeatures(visibleFeatures) {
    const bounds = boundsForFeatures(visibleFeatures);
    if (!bounds) return;

    flyToBounds(viewer, bounds);
  }

  function setClustered(enabled) {
    clusteringEnabled = Boolean(enabled);
    dataSource.clustering.enabled = clusteringEnabled;
    viewer.scene.requestRender();
  }

  for (const feature of features) {
    const coordinates = coordinatesOf(feature);
    if (!coordinates) continue;

    const entity = dataSource.entities.add({
      id: entityId(feature),
      name: feature.properties.__name,
      position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1]),
      point: {
        pixelSize: 10,
        color: colorForType(Cesium, feature.properties.__type),
        outlineColor: Cesium.Color.fromCssColorString("#16201c"),
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      properties: feature.properties
    });

    entity.kppFeature = feature;
    entitiesById.set(feature.properties.__id, entity);
  }

  viewer.dataSources.add(dataSource);

  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position);
    const feature = picked?.id?.kppFeature;

    if (!feature) {
      clearSelection();
      onSelect?.(null);
      return;
    }

    selectFeature(feature);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.endPosition);
    viewer.scene.canvas.style.cursor = picked?.id?.kppFeature ? "pointer" : "";
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  viewer.scene.requestRender();

  return {
    dataSource,
    selectFeature,
    clearSelection,
    setVisibleFeatures,
    flyToFeatures,
    setClustered,
    flyHome() {
      flyToBounds(viewer, DEFAULT_CAMERA);
    },
    destroy() {
      handler.destroy();
      viewer.dataSources.remove(dataSource, true);
    }
  };
}
