import { DEFAULT_CAMERA, DEFAULT_IMAGERY_MODE, QUALITY_LEVELS, TYPE_COLORS } from "./config.js";

const CHECKPOINT_SOURCE_ID = "checkpoints";
const ANALYSIS_SOURCE_ID = "checkpoint-analysis";
const EARTH_RADIUS_METERS = 6371008.8;
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

function degrees(value) {
  return (value * 180) / Math.PI;
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
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#111827");
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
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  const entitiesById = new Map();
  const featuresById = new Map(features.map((feature) => [feature.properties.__id, feature]));
  let selectedEntity = null;
  let colorMode = "type";
  let clusterPreference = true;
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
    cluster.label.fillColor = Cesium.Color.fromCssColorString("#101827");
    cluster.label.outlineColor = Cesium.Color.WHITE;
    cluster.label.outlineWidth = 0;
    cluster.label.font = `${Math.round(14 * scale)}px Inter, sans-serif`;
    cluster.point.show = true;
    cluster.point.pixelSize = Math.min(50, (24 + clusteredEntities.length * 0.18) * scale);
    cluster.point.color = Cesium.Color.fromCssColorString("#9ee8ff");
    cluster.point.outlineColor = Cesium.Color.fromCssColorString("#ffffff");
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
      : Cesium.Color.fromCssColorString("#f8fbff");
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
    const color = options.color || "#9ee8ff";
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
        material: Cesium.Color.fromCssColorString("#9ee8ff").withAlpha(0.12),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#9ee8ff"),
        outlineWidth: 2,
        height: 0,
        heightReference: groundHeightReference(Cesium)
      }
    });

    const nearestCoordinates = nearestFeature ? coordinatesOf(nearestFeature) : null;
    if (nearestCoordinates) {
      addSurfaceLine(analysisSource, "nearest-line", coordinates, nearestCoordinates, {
        color: "#9ee8ff",
        glow: true,
        width: 4
      });
    }

    if (visibility?.rays?.length) {
      visibility.rays.forEach((ray, index) => {
        addSurfaceLine(analysisSource, `viewshed-ray-${index}`, coordinates, ray.coordinates, {
          color: ray.visible ? "#6ee7b7" : "#fb7185",
          alpha: ray.visible ? 0.72 : 0.5,
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
          color: target.visible ? "#6ee7b7" : "#fb7185",
          alpha: target.visible ? 0.94 : 0.78,
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

  function setVisibleFeatures(visibleFeatures) {
    const visibleIds = new Set(visibleFeatures.map((feature) => feature.properties.__id));

    for (const [featureId, entity] of entitiesById) {
      entity.show = visibleIds.has(featureId);
    }

    if (selectedEntity && !selectedEntity.show) {
      clearSelection();
      onSelect?.(null);
    }

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
        outlineColor: Cesium.Color.fromCssColorString("#f8fbff"),
        outlineWidth: 2,
        heightReference: groundHeightReference(Cesium),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: feature.properties.__name,
        show: true,
        font: "700 12px Inter, sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString("#101827"),
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

  cameraListener = viewer.camera.changed.addEventListener(updateClusterForCamera);
  updateClusterForCamera();
  viewer.scene.requestRender();

  return {
    dataSource,
    analysisSource,
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
    flyHome() {
      flyToBounds(viewer, DEFAULT_CAMERA);
    },
    destroy() {
      handler.destroy();
      cameraListener?.();
      viewer.dataSources.remove(dataSource, true);
      viewer.dataSources.remove(analysisSource, true);
    }
  };
}
