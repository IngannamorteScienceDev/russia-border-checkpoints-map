import { DEFAULT_CAMERA, TYPE_COLORS } from "./config.js";

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
  viewer.camera.lookAt(
    Cesium.Cartesian3.fromRadians(initialTarget.longitude, initialTarget.latitude),
    new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-68), 9300000)
  );
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

  return viewer;
}

export function createCheckpointLayer({ viewer, features, onSelect }) {
  const Cesium = globalThis.Cesium;
  const dataSource = new Cesium.CustomDataSource(CHECKPOINT_SOURCE_ID);
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  let selectedEntity = null;

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
    if (!coordinates || !entity) return;

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
    destroy() {
      handler.destroy();
      viewer.dataSources.remove(dataSource, true);
    }
  };
}
