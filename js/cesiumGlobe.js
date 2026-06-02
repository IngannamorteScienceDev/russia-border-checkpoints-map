import { DEFAULT_CAMERA, DEFAULT_IMAGERY_MODE, QUALITY_LEVELS, TYPE_COLORS } from "./config.js";

const CHECKPOINT_SOURCE_ID = "checkpoints";
const ANALYSIS_SOURCE_ID = "checkpoint-analysis";
const CORRIDOR_SOURCE_ID = "checkpoint-corridors";
const FLOW_SOURCE_ID = "checkpoint-flows";
const HEATMAP_SOURCE_ID = "checkpoint-heatmap";
const INFRASTRUCTURE_SOURCE_ID = "checkpoint-infrastructure";

const EARTH_RADIUS_METERS = 6371008.8;
const FLOW_LIMIT = 72;
const CORRIDOR_LIMIT = 220;
const HEATMAP_CELL_DEGREES = 3.2;
const LABEL_NEAR_DISTANCE = 520000;
const LABEL_SELECTED_DISTANCE = 1400000;

function colorForType(Cesium, type) {
  return Cesium.Color.fromCssColorString(
    TYPE_COLORS[type] || TYPE_COLORS[Object.keys(TYPE_COLORS).at(-1)]
  );
}

function colorForQuality(Cesium, quality) {
  return Cesium.Color.fromCssColorString(
    QUALITY_LEVELS[quality?.id]?.color || QUALITY_LEVELS.low.color
  );
}

function colorWithAlpha(Cesium, color, alpha) {
  return Cesium.Color.fromCssColorString(color).withAlpha(alpha);
}

function entityId(feature) {
  return `checkpoint-${feature.properties.__id}`;
}

function coordinatesOf(feature) {
  const coordinates = feature.geometry?.coordinates;
  return Array.isArray(coordinates) ? coordinates : null;
}

function groundHeightReference(Cesium) {
  return Cesium.HeightReference.CLAMP_TO_GROUND;
}

function relativeHeightReference(Cesium) {
  return Cesium.HeightReference.RELATIVE_TO_TERRAIN || Cesium.HeightReference.RELATIVE_TO_GROUND;
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

function createHighDefinitionLayer(Cesium, mode) {
  if (mode === "street") {
    return new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        maximumLevel: 19,
        credit: "OpenStreetMap contributors"
      }),
      { show: true }
    );
  }

  if (mode === "satellite") {
    return new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maximumLevel: 18,
        credit: "Esri, Maxar, Earthstar Geographics, and the GIS User Community"
      }),
      { show: true }
    );
  }

  return null;
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

function destinationForFeature(Cesium, feature, height = 850000) {
  const coordinates = coordinatesOf(feature);
  if (!coordinates) return null;

  return Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1], height);
}

function radians(value) {
  return (value * Math.PI) / 180;
}

function degrees(value) {
  return (value * 180) / Math.PI;
}

function distanceKm(featureA, featureB) {
  const a = coordinatesOf(featureA);
  const b = coordinatesOf(featureB);
  if (!a || !b) return Number.POSITIVE_INFINITY;

  const deltaLat = radians(b[1] - a[1]);
  const deltaLon = radians(b[0] - a[0]);
  const latA = radians(a[1]);
  const latB = radians(b[1]);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;

  return (
    (2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))) / 1000
  );
}

function pairKey(featureA, featureB) {
  return [featureA.properties.__id, featureB.properties.__id].sort().join("--");
}

function buildNearestPairs(features, { maxPairs, maxDistanceKm } = {}) {
  const pairs = new Map();

  for (const feature of features) {
    let nearestFeature = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of features) {
      if (candidate.properties.__id === feature.properties.__id) continue;

      const distance = distanceKm(feature, candidate);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestFeature = candidate;
      }
    }

    if (!nearestFeature || nearestDistance > maxDistanceKm) continue;
    pairs.set(pairKey(feature, nearestFeature), {
      feature,
      target: nearestFeature,
      distanceKm: nearestDistance
    });
  }

  return [...pairs.values()]
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, maxPairs);
}

function cartographicsBetween(Cesium, startCoordinates, endCoordinates, sampleCount) {
  const start = Cesium.Cartographic.fromDegrees(startCoordinates[0], startCoordinates[1], 0);
  const end = Cesium.Cartographic.fromDegrees(endCoordinates[0], endCoordinates[1], 0);
  const geodesic = new Cesium.EllipsoidGeodesic(start, end);
  const positions = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    positions.push(geodesic.interpolateUsingFraction(index / sampleCount));
  }

  return positions;
}

function destinationCartographic(Cesium, origin, bearingRadians, distanceMeters) {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const latitude = origin.latitude;
  const longitude = origin.longitude;
  const sinLat = Math.sin(latitude);
  const cosLat = Math.cos(latitude);
  const sinDistance = Math.sin(angularDistance);
  const cosDistance = Math.cos(angularDistance);

  const destinationLatitude = Math.asin(
    sinLat * cosDistance + cosLat * sinDistance * Math.cos(bearingRadians)
  );
  const destinationLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearingRadians) * sinDistance * cosLat,
      cosDistance - sinLat * Math.sin(destinationLatitude)
    );

  return new Cesium.Cartographic(destinationLongitude, destinationLatitude, 0);
}

function analyzeSampledLine(samples, { observerHeightMeters, targetHeightMeters }) {
  const originTerrain = samples[0]?.height || 0;
  const targetTerrain = samples.at(-1)?.height || 0;
  const observerHeight = originTerrain + observerHeightMeters;
  const targetHeight = targetTerrain + targetHeightMeters;
  let minimumClearance = Number.POSITIVE_INFINITY;
  let highestTerrain = Number.NEGATIVE_INFINITY;
  let lowestTerrain = Number.POSITIVE_INFINITY;

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const terrainHeight = Number.isFinite(sample.height) ? sample.height : 0;
    highestTerrain = Math.max(highestTerrain, terrainHeight);
    lowestTerrain = Math.min(lowestTerrain, terrainHeight);

    if (index === 0 || index === samples.length - 1) continue;

    const fraction = index / (samples.length - 1);
    const lineHeight = observerHeight + (targetHeight - observerHeight) * fraction;
    minimumClearance = Math.min(minimumClearance, lineHeight - terrainHeight);
  }

  if (!Number.isFinite(minimumClearance)) minimumClearance = targetHeight - originTerrain;

  return {
    visible: minimumClearance >= 0,
    clearanceMeters: minimumClearance,
    originHeightMeters: originTerrain,
    targetHeightMeters: targetTerrain,
    reliefMeters: Math.max(0, highestTerrain - lowestTerrain)
  };
}

async function sampleCartographics(viewer, cartographics) {
  const Cesium = globalThis.Cesium;
  if (!cartographics.length) return cartographics;

  try {
    if (viewer.terrainProvider?.availability && Cesium.sampleTerrainMostDetailed) {
      await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, cartographics, false);
    } else if (Cesium.sampleTerrain) {
      await Cesium.sampleTerrain(viewer.terrainProvider, 10, cartographics, false);
    }
  } catch (error) {
    console.warn("Terrain sampling failed", error);
  }

  return cartographics;
}

function heatmapCells(features) {
  const cells = new Map();

  for (const feature of features) {
    const coordinates = coordinatesOf(feature);
    if (!coordinates) continue;

    const [longitude, latitude] = coordinates;
    const cellLon = Math.round(longitude / HEATMAP_CELL_DEGREES) * HEATMAP_CELL_DEGREES;
    const cellLat = Math.round(latitude / HEATMAP_CELL_DEGREES) * HEATMAP_CELL_DEGREES;
    const key = `${cellLon.toFixed(2)}:${cellLat.toFixed(2)}`;
    const cell = cells.get(key) || {
      longitude: 0,
      latitude: 0,
      count: 0
    };

    cell.longitude += longitude;
    cell.latitude += latitude;
    cell.count += 1;
    cells.set(key, cell);
  }

  return [...cells.values()].map((cell) => ({
    longitude: cell.longitude / cell.count,
    latitude: cell.latitude / cell.count,
    count: cell.count
  }));
}

function heatColor(Cesium, ratio, alpha) {
  if (ratio > 0.72) return colorWithAlpha(Cesium, "#eb5757", alpha);
  if (ratio > 0.42) return colorWithAlpha(Cesium, "#f2994a", alpha);
  if (ratio > 0.2) return colorWithAlpha(Cesium, "#f2c94c", alpha);
  return colorWithAlpha(Cesium, "#39d98a", alpha);
}

function infrastructureShapeFor(feature) {
  const type = feature.properties.__type || "";
  const lower = type.toLocaleLowerCase("ru-RU");

  if (lower.includes("\u0432\u043e\u0437\u0434\u0443\u0448")) {
    return {
      kind: "box",
      dimensions: [1800, 380, 72],
      color: "#9b51e0"
    };
  }

  if (lower.includes("\u043c\u043e\u0440") || lower.includes("\u0440\u0435\u0447")) {
    return {
      kind: "cylinder",
      length: 82,
      radius: 360,
      color: "#00bcd4"
    };
  }

  if (lower.includes("\u0436\u0435\u043b\u0435\u0437")) {
    return {
      kind: "box",
      dimensions: [900, 140, 58],
      color: "#27ae60"
    };
  }

  return {
    kind: "box",
    dimensions: [360, 260, 46],
    color: "#2f80ed"
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

export function setImageryMode(viewer, mode) {
  const Cesium = globalThis.Cesium;

  if (viewer.kppHighDefinitionLayer) {
    viewer.imageryLayers.remove(viewer.kppHighDefinitionLayer, true);
    viewer.kppHighDefinitionLayer = null;
  }

  const layer = createHighDefinitionLayer(Cesium, mode);
  if (layer) {
    viewer.imageryLayers.add(layer);
    viewer.kppHighDefinitionLayer = layer;
  }

  viewer.kppImageryMode = mode;
  viewer.scene.requestRender();
}

export async function setTerrainEnabled(viewer, enabled) {
  const Cesium = globalThis.Cesium;
  viewer.kppTerrainRequested = Boolean(enabled);

  if (!viewer.kppEllipsoidTerrainProvider) {
    viewer.kppEllipsoidTerrainProvider = new Cesium.EllipsoidTerrainProvider();
  }

  if (!enabled) {
    viewer.terrainProvider = viewer.kppEllipsoidTerrainProvider;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.globe.enableLighting = false;
    viewer.kppTerrainStatus = {
      enabled: false,
      mode: "ellipsoid",
      message: "Ellipsoid terrain"
    };
    viewer.scene.requestRender();
    return viewer.kppTerrainStatus;
  }

  try {
    if (!viewer.kppWorldTerrainProvider) {
      if (!Cesium.createWorldTerrainAsync) throw new Error("Cesium World Terrain API missing.");

      viewer.kppWorldTerrainProviderPromise ||= Cesium.createWorldTerrainAsync({
        requestWaterMask: true,
        requestVertexNormals: true
      });
      viewer.kppWorldTerrainProvider = await viewer.kppWorldTerrainProviderPromise;
    }

    if (!viewer.kppTerrainRequested) {
      return setTerrainEnabled(viewer, false);
    }

    viewer.terrainProvider = viewer.kppWorldTerrainProvider;
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = false;
    viewer.kppTerrainStatus = {
      enabled: true,
      mode: "world",
      message: "Cesium World Terrain"
    };
  } catch (error) {
    console.warn("World terrain unavailable", error);
    viewer.terrainProvider = viewer.kppEllipsoidTerrainProvider;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.globe.enableLighting = false;
    viewer.kppTerrainStatus = {
      enabled: false,
      mode: "fallback",
      message: String(error?.message || error)
    };
  }

  viewer.scene.requestRender();
  return viewer.kppTerrainStatus;
}

export async function setInfrastructureTiles(viewer, { enabled, url = "" } = {}) {
  const Cesium = globalThis.Cesium;
  const tilesetUrl = String(url || "").trim();
  const key = tilesetUrl || "osm-buildings";

  if (!enabled) {
    if (viewer.kppTilesetLayer) viewer.kppTilesetLayer.show = false;
    viewer.kppTilesetStatus = {
      enabled: false,
      mode: "hidden",
      message: "3D Tiles hidden"
    };
    viewer.scene.requestRender();
    return viewer.kppTilesetStatus;
  }

  if (viewer.kppTilesetLayer?.kppTilesetKey === key) {
    viewer.kppTilesetLayer.show = true;
    viewer.kppTilesetStatus = {
      enabled: true,
      mode: tilesetUrl ? "custom" : "osm",
      message: tilesetUrl ? "Custom 3D Tiles" : "OpenStreetMap Buildings"
    };
    viewer.scene.requestRender();
    return viewer.kppTilesetStatus;
  }

  if (viewer.kppTilesetLayer) {
    viewer.scene.primitives.remove(viewer.kppTilesetLayer);
    viewer.kppTilesetLayer = null;
  }

  try {
    const tileset = tilesetUrl
      ? await Cesium.Cesium3DTileset.fromUrl(tilesetUrl, {
          maximumScreenSpaceError: 6,
          enableCollision: true
        })
      : await Cesium.createOsmBuildingsAsync({
          maximumScreenSpaceError: 6,
          enableCollision: true
        });

    tileset.kppTilesetKey = key;
    tileset.show = true;
    viewer.scene.primitives.add(tileset);
    viewer.kppTilesetLayer = tileset;
    viewer.kppTilesetStatus = {
      enabled: true,
      mode: tilesetUrl ? "custom" : "osm",
      message: tilesetUrl ? "Custom 3D Tiles" : "OpenStreetMap Buildings"
    };
  } catch (error) {
    console.warn("3D Tiles unavailable", error);
    viewer.kppTilesetStatus = {
      enabled: false,
      mode: "fallback",
      message: String(error?.message || error)
    };
  }

  viewer.scene.requestRender();
  return viewer.kppTilesetStatus;
}

export async function analyzeVisibility(
  viewer,
  originFeature,
  targetFeatures,
  {
    radiusKm = 100,
    rayCount = 24,
    sampleCount = 14,
    observerHeightMeters = 8,
    targetHeightMeters = 4
  } = {}
) {
  const Cesium = globalThis.Cesium;
  const originCoordinates = coordinatesOf(originFeature);
  if (!originCoordinates) {
    return {
      featureId: "",
      targets: [],
      rays: [],
      originHeightMeters: 0,
      reliefMeters: 0
    };
  }

  const origin = Cesium.Cartographic.fromDegrees(originCoordinates[0], originCoordinates[1], 0);
  const descriptors = [];
  const samples = [];

  for (const targetFeature of targetFeatures) {
    const targetCoordinates = coordinatesOf(targetFeature);
    if (!targetCoordinates) continue;

    const startIndex = samples.length;
    samples.push(
      ...cartographicsBetween(Cesium, originCoordinates, targetCoordinates, sampleCount)
    );
    descriptors.push({
      kind: "target",
      startIndex,
      length: sampleCount + 1,
      feature: targetFeature,
      coordinates: targetCoordinates
    });
  }

  const radiusMeters = Math.max(10, Number(radiusKm) || 100) * 1000;
  for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
    const bearing = (Math.PI * 2 * rayIndex) / rayCount;
    const destination = destinationCartographic(Cesium, origin, bearing, radiusMeters);
    const endCoordinates = [degrees(destination.longitude), degrees(destination.latitude)];
    const startIndex = samples.length;
    samples.push(...cartographicsBetween(Cesium, originCoordinates, endCoordinates, sampleCount));
    descriptors.push({
      kind: "ray",
      startIndex,
      length: sampleCount + 1,
      bearing,
      coordinates: endCoordinates
    });
  }

  await sampleCartographics(viewer, samples);

  const targets = [];
  const rays = [];
  let originHeightMeters = samples[0]?.height || 0;
  let reliefMeters = 0;

  for (const descriptor of descriptors) {
    const lineSamples = samples.slice(
      descriptor.startIndex,
      descriptor.startIndex + descriptor.length
    );
    const line = analyzeSampledLine(lineSamples, {
      observerHeightMeters,
      targetHeightMeters
    });
    originHeightMeters = line.originHeightMeters;
    reliefMeters = Math.max(reliefMeters, line.reliefMeters);

    if (descriptor.kind === "target") {
      targets.push({
        featureId: descriptor.feature.properties.__id,
        visible: line.visible,
        clearanceMeters: line.clearanceMeters,
        targetHeightMeters: line.targetHeightMeters,
        reliefMeters: line.reliefMeters,
        coordinates: descriptor.coordinates
      });
    } else {
      rays.push({
        visible: line.visible,
        clearanceMeters: line.clearanceMeters,
        reliefMeters: line.reliefMeters,
        coordinates: descriptor.coordinates
      });
    }
  }

  return {
    featureId: originFeature.properties.__id,
    terrainMode: viewer.kppTerrainStatus?.mode || "ellipsoid",
    targets,
    rays,
    originHeightMeters,
    reliefMeters
  };
}

export function createGlobe({ container }) {
  const Cesium = globalThis.Cesium;
  const ellipsoidTerrainProvider = new Cesium.EllipsoidTerrainProvider();
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
    terrainProvider: ellipsoidTerrainProvider,
    contextOptions: {
      webgl: {
        antialias: true,
        preserveDrawingBuffer: true
      }
    },
    requestRenderMode: false
  });

  viewer.kppEllipsoidTerrainProvider = ellipsoidTerrainProvider;
  viewer.kppTerrainStatus = {
    enabled: false,
    mode: "ellipsoid",
    message: "Ellipsoid terrain"
  };
  viewer.resolutionScale = Math.min(globalThis.devicePixelRatio || 1, 2);
  viewer.clock.shouldAnimate = true;
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#d8e4d7");
  viewer.scene.globe.enableLighting = false;
  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.scene.globe.maximumScreenSpaceError = 1.5;
  viewer.scene.highDynamicRange = false;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.moon.show = false;
  viewer.scene.fog.enabled = false;
  setImageryMode(viewer, DEFAULT_IMAGERY_MODE);
  viewer.kppTerrainPromise = setTerrainEnabled(viewer, true);

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

export function flyToCameraPreset(viewer, preset) {
  flyToBounds(viewer, preset.bounds);
}

export function createCheckpointLayer({ viewer, features, onSelect }) {
  const Cesium = globalThis.Cesium;
  const dataSource = new Cesium.CustomDataSource(CHECKPOINT_SOURCE_ID);
  const analysisSource = new Cesium.CustomDataSource(ANALYSIS_SOURCE_ID);
  const corridorSource = new Cesium.CustomDataSource(CORRIDOR_SOURCE_ID);
  const flowSource = new Cesium.CustomDataSource(FLOW_SOURCE_ID);
  const heatmapSource = new Cesium.CustomDataSource(HEATMAP_SOURCE_ID);
  const infrastructureSource = new Cesium.CustomDataSource(INFRASTRUCTURE_SOURCE_ID);
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  const entitiesById = new Map();
  const featuresById = new Map(features.map((feature) => [feature.properties.__id, feature]));
  const flowStart = Cesium.JulianDate.now();
  let selectedEntity = null;
  let colorMode = "type";
  let visibleFeatureList = features;
  let clusterPreference = true;
  let corridorsEnabled = false;
  let flowsEnabled = false;
  let heatmapEnabled = false;
  let infrastructureEnabled = false;
  let cameraListener = null;

  dataSource.clustering.enabled = true;
  dataSource.clustering.pixelRange = 46;
  dataSource.clustering.minimumClusterSize = 4;
  dataSource.clustering.clusterEvent.addEventListener((clusteredEntities, cluster) => {
    const height = viewer.camera.positionCartographic.height;
    const scale = height > 6000000 ? 1.18 : height > 1800000 ? 1 : 0.82;

    cluster.billboard.show = false;
    cluster.label.show = true;
    cluster.label.text = String(clusteredEntities.length);
    cluster.label.fillColor = Cesium.Color.fromCssColorString("#071512");
    cluster.label.outlineColor = Cesium.Color.WHITE;
    cluster.label.outlineWidth = 0;
    cluster.label.font = `${Math.round(14 * scale)}px Inter, sans-serif`;
    cluster.point.show = true;
    cluster.point.pixelSize = Math.min(50, (24 + clusteredEntities.length * 0.18) * scale);
    cluster.point.color = Cesium.Color.fromCssColorString("#f2c94c");
    cluster.point.outlineColor = Cesium.Color.fromCssColorString("#071512");
    cluster.point.outlineWidth = 3;
  });

  function entityColor(entity) {
    const props = entity.kppFeature.properties;
    return colorMode === "quality"
      ? colorForQuality(Cesium, props.__quality)
      : colorForType(Cesium, props.__type);
  }

  function styleEntity(entity, isSelected = false) {
    entity.point.pixelSize = isSelected ? 18 : 10;
    entity.point.color = entityColor(entity);
    entity.point.outlineColor = isSelected
      ? Cesium.Color.WHITE
      : Cesium.Color.fromCssColorString("#16201c");
    entity.point.outlineWidth = isSelected ? 5 : 2;
    entity.label.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(
      0,
      isSelected ? LABEL_SELECTED_DISTANCE : LABEL_NEAR_DISTANCE
    );
  }

  function restyleEntities() {
    for (const entity of entitiesById.values()) {
      styleEntity(entity, entity === selectedEntity);
    }

    viewer.scene.requestRender();
  }

  function updateClusterForCamera() {
    if (!clusterPreference) {
      dataSource.clustering.enabled = false;
      viewer.scene.requestRender();
      return;
    }

    const height = viewer.camera.positionCartographic.height;
    dataSource.clustering.enabled = height > 420000;
    dataSource.clustering.pixelRange =
      height > 7000000 ? 82 : height > 2500000 ? 62 : height > 900000 ? 42 : 30;
    dataSource.clustering.minimumClusterSize = height > 7000000 ? 2 : height > 1800000 ? 3 : 4;
    viewer.scene.requestRender();
  }

  function clearAnalysis() {
    analysisSource.entities.removeAll();
    viewer.scene.requestRender();
  }

  function clearSelection() {
    if (selectedEntity) {
      styleEntity(selectedEntity, false);
      selectedEntity = null;
      viewer.selectedEntity = undefined;
      clearAnalysis();
    }
  }

  function addSurfaceLine(source, id, startCoordinates, endCoordinates, options = {}) {
    const color = options.color || "#f2c94c";
    const alpha = options.alpha ?? 0.92;
    const material = options.dashed
      ? new Cesium.PolylineDashMaterialProperty({
          color: colorWithAlpha(Cesium, color, alpha),
          dashLength: options.dashLength || 18
        })
      : options.glow
        ? new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.18,
            taperPower: 0.7,
            color: colorWithAlpha(Cesium, color, alpha)
          })
        : colorWithAlpha(Cesium, color, alpha);

    source.entities.add({
      id,
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
          startCoordinates[0],
          startCoordinates[1],
          endCoordinates[0],
          endCoordinates[1]
        ]),
        width: options.width || 3,
        arcType: Cesium.ArcType.GEODESIC,
        clampToGround: true,
        material
      }
    });
  }

  function setAnalysis({ feature, nearestFeature, radiusKm, visibility }) {
    clearAnalysis();
    if (!feature) return;

    const coordinates = coordinatesOf(feature);
    if (!coordinates) return;

    analysisSource.entities.add({
      id: "selected-radius",
      position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1]),
      ellipse: {
        semiMajorAxis: radiusKm * 1000,
        semiMinorAxis: radiusKm * 1000,
        material: Cesium.Color.fromCssColorString("#f2c94c").withAlpha(0.11),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#f2c94c"),
        outlineWidth: 2,
        height: 0,
        heightReference: groundHeightReference(Cesium)
      }
    });

    analysisSource.entities.add({
      id: "observer-mast",
      position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1], 45),
      cylinder: {
        length: 90,
        topRadius: 16,
        bottomRadius: 28,
        material: Cesium.Color.WHITE.withAlpha(0.62),
        heightReference: relativeHeightReference(Cesium)
      }
    });

    const nearestCoordinates = nearestFeature ? coordinatesOf(nearestFeature) : null;
    if (nearestCoordinates) {
      addSurfaceLine(analysisSource, "nearest-line", coordinates, nearestCoordinates, {
        color: "#f2c94c",
        glow: true,
        width: 4
      });
    }

    if (visibility?.rays?.length) {
      analysisSource.entities.add({
        id: "viewshed-zone",
        position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1]),
        ellipse: {
          semiMajorAxis: radiusKm * 1000,
          semiMinorAxis: radiusKm * 1000,
          material: Cesium.Color.fromCssColorString("#39d98a").withAlpha(0.055),
          height: 0,
          heightReference: groundHeightReference(Cesium)
        }
      });

      visibility.rays.forEach((ray, index) => {
        addSurfaceLine(analysisSource, `viewshed-ray-${index}`, coordinates, ray.coordinates, {
          color: ray.visible ? "#39d98a" : "#eb5757",
          alpha: ray.visible ? 0.7 : 0.48,
          dashed: !ray.visible,
          width: 2
        });
      });
    }

    if (visibility?.targets?.length) {
      visibility.targets.forEach((target) => {
        const targetFeature = featuresById.get(target.featureId);
        const targetCoordinates = target.coordinates || coordinatesOf(targetFeature);
        if (!targetCoordinates) return;

        addSurfaceLine(analysisSource, `los-${target.featureId}`, coordinates, targetCoordinates, {
          color: target.visible ? "#39d98a" : "#eb5757",
          alpha: target.visible ? 0.94 : 0.76,
          dashed: !target.visible,
          width: target.visible ? 4 : 3
        });
      });
    }

    viewer.scene.requestRender();
  }

  function selectFeature(feature) {
    const entity = dataSource.entities.getById(entityId(feature));
    if (!entity || !entity.show) return;

    clearSelection();
    selectedEntity = entity;
    styleEntity(entity, true);
    viewer.selectedEntity = entity;

    const destination = destinationForFeature(Cesium, feature);
    if (destination) {
      viewer.camera.flyTo({
        destination,
        orientation: {
          heading: 0,
          pitch: -Cesium.Math.PI_OVER_TWO,
          roll: 0
        },
        duration: 0.7
      });
    }

    onSelect?.(feature);
    viewer.scene.requestRender();
  }

  function renderCorridors() {
    corridorSource.entities.removeAll();
    if (!corridorsEnabled) return;

    const pairs = buildNearestPairs(visibleFeatureList, {
      maxPairs: CORRIDOR_LIMIT,
      maxDistanceKm: 850
    });

    pairs.forEach((pair, index) => {
      const start = coordinatesOf(pair.feature);
      const end = coordinatesOf(pair.target);
      if (!start || !end) return;

      addSurfaceLine(corridorSource, `corridor-${index}`, start, end, {
        color: "#56ccf2",
        alpha: 0.48,
        glow: true,
        width: pair.distanceKm < 120 ? 2.8 : 2
      });
    });

    viewer.scene.requestRender();
  }

  function renderFlows() {
    flowSource.entities.removeAll();
    if (!flowsEnabled) return;

    const pairs = buildNearestPairs(visibleFeatureList, {
      maxPairs: FLOW_LIMIT,
      maxDistanceKm: 950
    });

    pairs.forEach((pair, index) => {
      const start = coordinatesOf(pair.feature);
      const end = coordinatesOf(pair.target);
      if (!start || !end) return;

      flowSource.entities.add({
        id: `flow-line-${index}`,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([start[0], start[1], end[0], end[1]]),
          width: 2,
          arcType: Cesium.ArcType.GEODESIC,
          clampToGround: true,
          material: new Cesium.PolylineArrowMaterialProperty(
            Cesium.Color.fromCssColorString("#59d9ff").withAlpha(0.58)
          )
        }
      });

      const startCartographic = Cesium.Cartographic.fromDegrees(start[0], start[1], 0);
      const endCartographic = Cesium.Cartographic.fromDegrees(end[0], end[1], 0);
      const geodesic = new Cesium.EllipsoidGeodesic(startCartographic, endCartographic);
      const phase = (index * 0.137) % 1;
      const speed = 0.035 + Math.min(0.045, 18 / Math.max(pair.distanceKm, 80));

      flowSource.entities.add({
        id: `flow-dot-${index}`,
        position: new Cesium.CallbackProperty((time) => {
          const seconds = Cesium.JulianDate.secondsDifference(time, flowStart);
          const fraction = (((seconds * speed + phase) % 1) + 1) % 1;
          const cartographic = geodesic.interpolateUsingFraction(fraction);
          return Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 9000);
        }, false),
        point: {
          pixelSize: 7,
          color: Cesium.Color.fromCssColorString("#ffffff"),
          outlineColor: Cesium.Color.fromCssColorString("#00bcd4"),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
    });

    viewer.scene.requestRender();
  }

  function renderHeatmap() {
    heatmapSource.entities.removeAll();
    if (!heatmapEnabled) return;

    const cells = heatmapCells(visibleFeatureList);
    const maxCount = Math.max(1, ...cells.map((cell) => cell.count));

    cells.forEach((cell, index) => {
      const ratio = cell.count / maxCount;
      const radius = 56000 + Math.sqrt(cell.count) * 42000;
      heatmapSource.entities.add({
        id: `heat-cell-${index}`,
        position: Cesium.Cartesian3.fromDegrees(cell.longitude, cell.latitude),
        ellipse: {
          semiMajorAxis: Math.min(330000, radius * 1.35),
          semiMinorAxis: Math.min(220000, radius),
          material: heatColor(Cesium, ratio, 0.16 + ratio * 0.28),
          height: 0,
          heightReference: groundHeightReference(Cesium)
        }
      });
    });

    viewer.scene.requestRender();
  }

  function renderInfrastructure() {
    infrastructureSource.entities.removeAll();
    if (!infrastructureEnabled) return;

    const limit = viewer.camera.positionCartographic.height > 1800000 ? 90 : 180;
    visibleFeatureList.slice(0, limit).forEach((feature, index) => {
      const coordinates = coordinatesOf(feature);
      if (!coordinates) return;

      const shape = infrastructureShapeFor(feature);
      const height = shape.kind === "box" ? shape.dimensions[2] : shape.length;
      const entity = {
        id: `infra-${index}`,
        position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1], height / 2),
        properties: feature.properties
      };

      if (shape.kind === "cylinder") {
        entity.cylinder = {
          length: shape.length,
          topRadius: shape.radius * 0.72,
          bottomRadius: shape.radius,
          material: colorWithAlpha(Cesium, shape.color, 0.34),
          outline: true,
          outlineColor: colorWithAlpha(Cesium, "#ffffff", 0.34),
          heightReference: relativeHeightReference(Cesium)
        };
      } else {
        entity.box = {
          dimensions: new Cesium.Cartesian3(...shape.dimensions),
          material: colorWithAlpha(Cesium, shape.color, 0.34),
          outline: true,
          outlineColor: colorWithAlpha(Cesium, "#ffffff", 0.34),
          heightReference: relativeHeightReference(Cesium)
        };
      }

      infrastructureSource.entities.add(entity);
    });

    viewer.scene.requestRender();
  }

  function refreshAnalyticLayers() {
    renderCorridors();
    renderFlows();
    renderHeatmap();
    renderInfrastructure();
  }

  function setVisibleFeatures(visibleFeatures) {
    visibleFeatureList = visibleFeatures;
    const visibleIds = new Set(visibleFeatures.map((feature) => feature.properties.__id));

    for (const [featureId, entity] of entitiesById) {
      entity.show = visibleIds.has(featureId);
    }

    if (selectedEntity && !selectedEntity.show) {
      clearSelection();
      onSelect?.(null);
    }

    refreshAnalyticLayers();
    updateClusterForCamera();
    viewer.scene.requestRender();
  }

  function flyToFeatures(visibleFeatures) {
    const bounds = boundsForFeatures(visibleFeatures);
    if (!bounds) return;

    flyToBounds(viewer, bounds);
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
        heightReference: groundHeightReference(Cesium),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: feature.properties.__name,
        show: true,
        font: "700 12px Inter, sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString("#071512"),
        outlineWidth: 4,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: groundHeightReference(Cesium),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, LABEL_NEAR_DISTANCE),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      properties: feature.properties
    });

    entity.kppFeature = feature;
    entitiesById.set(feature.properties.__id, entity);
  }

  viewer.dataSources.add(heatmapSource);
  viewer.dataSources.add(corridorSource);
  viewer.dataSources.add(flowSource);
  viewer.dataSources.add(infrastructureSource);
  viewer.dataSources.add(dataSource);
  viewer.dataSources.add(analysisSource);

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

  cameraListener = viewer.camera.changed.addEventListener(() => {
    updateClusterForCamera();
    if (infrastructureEnabled) renderInfrastructure();
  });
  updateClusterForCamera();
  viewer.scene.requestRender();

  return {
    dataSource,
    analysisSource,
    corridorSource,
    flowSource,
    heatmapSource,
    infrastructureSource,
    selectFeature,
    clearSelection,
    setAnalysis,
    clearAnalysis,
    setVisibleFeatures,
    flyToFeatures,
    setClustered(enabled) {
      clusterPreference = Boolean(enabled);
      updateClusterForCamera();
    },
    setColorMode(mode) {
      colorMode = mode === "quality" ? "quality" : "type";
      restyleEntities();
    },
    setCorridors({ enabled, features: nextFeatures } = {}) {
      corridorsEnabled = Boolean(enabled);
      if (nextFeatures) visibleFeatureList = nextFeatures;
      renderCorridors();
    },
    setFlows({ enabled, features: nextFeatures } = {}) {
      flowsEnabled = Boolean(enabled);
      if (nextFeatures) visibleFeatureList = nextFeatures;
      renderFlows();
    },
    setHeatmap({ enabled, features: nextFeatures } = {}) {
      heatmapEnabled = Boolean(enabled);
      if (nextFeatures) visibleFeatureList = nextFeatures;
      renderHeatmap();
    },
    setInfrastructure({ enabled, features: nextFeatures } = {}) {
      infrastructureEnabled = Boolean(enabled);
      if (nextFeatures) visibleFeatureList = nextFeatures;
      renderInfrastructure();
    },
    flyHome() {
      flyToBounds(viewer, DEFAULT_CAMERA);
    },
    destroy() {
      handler.destroy();
      cameraListener?.();
      viewer.dataSources.remove(dataSource, true);
      viewer.dataSources.remove(analysisSource, true);
      viewer.dataSources.remove(corridorSource, true);
      viewer.dataSources.remove(flowSource, true);
      viewer.dataSources.remove(heatmapSource, true);
      viewer.dataSources.remove(infrastructureSource, true);
    }
  };
}
