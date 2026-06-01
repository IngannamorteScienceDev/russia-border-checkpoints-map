const EARTH_CIRCUMFERENCE_METERS = 40075016.68557849;
const ZOOM_HEIGHT_FACTOR = 2.5;
const MIN_CAMERA_HEIGHT = 1200;
const MAX_CAMERA_HEIGHT = 65000000;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function zoomToHeight(zoom) {
  const safeZoom = clamp(Number(zoom) || 0, 0, 22);
  return clamp(
    (EARTH_CIRCUMFERENCE_METERS * ZOOM_HEIGHT_FACTOR) / 2 ** safeZoom,
    MIN_CAMERA_HEIGHT,
    MAX_CAMERA_HEIGHT
  );
}

function heightToZoom(height) {
  const safeHeight = clamp(
    Number(height) || MAX_CAMERA_HEIGHT,
    MIN_CAMERA_HEIGHT,
    MAX_CAMERA_HEIGHT
  );
  return clamp(Math.log2((EARTH_CIRCUMFERENCE_METERS * ZOOM_HEIGHT_FACTOR) / safeHeight), 0, 22);
}

function coordinatesToRectangle(Cesium, bounds) {
  const [southWest, northEast] = bounds || [];
  if (!Array.isArray(southWest) || !Array.isArray(northEast)) return null;

  const west = clamp(southWest[0], -180, 180);
  const south = clamp(southWest[1], -90, 90);
  const east = clamp(northEast[0], -180, 180);
  const north = clamp(northEast[1], -90, 90);

  if (![west, south, east, north].every(Number.isFinite)) return null;
  return Cesium.Rectangle.fromDegrees(west, south, east, north);
}

function cameraCenter(viewer, Cesium) {
  const canvas = viewer.scene.canvas;
  const centerPixel = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
  const picked = viewer.camera.pickEllipsoid(centerPixel, viewer.scene.globe.ellipsoid);
  const cartographic = picked
    ? Cesium.Cartographic.fromCartesian(picked)
    : viewer.camera.positionCartographic;

  return {
    lng: Cesium.Math.toDegrees(cartographic.longitude),
    lat: Cesium.Math.toDegrees(cartographic.latitude)
  };
}

function createEventHub() {
  const listeners = new Map();

  return {
    on(eventName, handler) {
      if (typeof handler !== "function") return;
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(handler);
    },
    off(eventName, handler) {
      listeners.get(eventName)?.delete(handler);
    },
    emit(eventName, event) {
      for (const handler of listeners.get(eventName) || []) handler(event);
    }
  };
}

function createNaturalEarthLayer(viewer, Cesium) {
  const providerPromise = Cesium.TileMapServiceImageryProvider.fromUrl(
    Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
    {
      fileExtension: "jpg",
      maximumLevel: 2,
      credit: "Natural Earth II / CesiumJS"
    }
  );
  const layer = Cesium.ImageryLayer.fromProviderAsync(providerPromise, { show: true });
  viewer.imageryLayers.add(layer, 0);
  return layer;
}

export function createCesiumGlobe({ container, center, zoom }) {
  const Cesium = globalThis.Cesium;
  const eventHub = createEventHub();
  const sources = new Map();
  const layers = new Map();

  const viewer = new Cesium.Viewer(container, {
    animation: false,
    baseLayer: false,
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
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity
  });

  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#dbe7dc");
  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.moon.show = false;
  viewer.scene.fog.enabled = false;
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(center[0], center[1], zoomToHeight(zoom))
  });
  viewer.camera.moveEnd.addEventListener(() => eventHub.emit("moveend"));

  createNaturalEarthLayer(viewer, Cesium);

  function triggerMoveEnd() {
    eventHub.emit("moveend");
    viewer.scene.requestRender();
  }

  function addSource(id, source) {
    sources.set(id, {
      ...source,
      data: source.data,
      setData(data) {
        this.data = data;
      },
      getClusterExpansionZoom(_id, callback) {
        callback(null, Math.min(heightToZoom(viewer.camera.positionCartographic.height) + 2, 12));
      }
    });
  }

  function addLayer(layer) {
    layers.set(layer.id, { ...layer, layout: layer.layout ? { ...layer.layout } : {} });
  }

  const globe = {
    isCesium: true,
    isFallback: false,
    viewer,
    Cesium,
    loaded: () => true,
    once(_eventName, callback) {
      callback();
    },
    addControl() {},
    addSource,
    getSource(id) {
      return sources.get(id);
    },
    removeSource(id) {
      sources.delete(id);
    },
    addLayer,
    getLayer(id) {
      return layers.get(id);
    },
    removeLayer(id) {
      const layer = layers.get(id);
      if (layer?.imageryLayer) {
        viewer.imageryLayers.remove(layer.imageryLayer, false);
      }
      layers.delete(id);
    },
    on(eventName, maybeLayer, maybeHandler) {
      const handler = typeof maybeLayer === "function" ? maybeLayer : maybeHandler;
      eventHub.on(eventName, handler);
    },
    off(eventName, maybeLayer, maybeHandler) {
      const handler = typeof maybeLayer === "function" ? maybeLayer : maybeHandler;
      eventHub.off(eventName, handler);
    },
    easeTo(options = {}) {
      const nextCenter = Array.isArray(options.center)
        ? options.center
        : [cameraCenter(viewer, Cesium).lng, cameraCenter(viewer, Cesium).lat];
      const nextZoom = typeof options.zoom === "number" ? options.zoom : this.getZoom();

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          nextCenter[0],
          nextCenter[1],
          zoomToHeight(nextZoom)
        ),
        duration: 0.45,
        complete: triggerMoveEnd,
        cancel: triggerMoveEnd
      });
    },
    fitBounds(bounds) {
      const rectangle = coordinatesToRectangle(Cesium, bounds);
      if (!rectangle) return;

      viewer.camera.flyTo({
        destination: rectangle,
        duration: 0.45,
        complete: triggerMoveEnd,
        cancel: triggerMoveEnd
      });
    },
    resize() {
      viewer.resize();
      viewer.scene.requestRender();
    },
    getCanvas() {
      return viewer.scene.canvas;
    },
    getZoom() {
      return heightToZoom(viewer.camera.positionCartographic.height);
    },
    getCenter() {
      return cameraCenter(viewer, Cesium);
    },
    getBounds() {
      const rectangle = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);

      return {
        contains(coordinates) {
          if (!rectangle) return true;
          if (!Array.isArray(coordinates)) return false;

          const cartographic = Cesium.Cartographic.fromDegrees(coordinates[0], coordinates[1]);
          return Cesium.Rectangle.contains(rectangle, cartographic);
        }
      };
    },
    setLayoutProperty(id, prop, value) {
      const layer = layers.get(id);
      if (!layer) return;
      if (!layer.layout) layer.layout = {};
      layer.layout[prop] = value;

      if (prop === "visibility" && layer.imageryLayer) {
        layer.imageryLayer.show = value === "visible";
        viewer.scene.requestRender();
      }
    },
    getLayoutProperty(id, prop) {
      return layers.get(id)?.layout?.[prop] ?? "none";
    },
    ensureRasterLayer(id, source, { visibility = "none", opacity = 1 } = {}) {
      if (layers.has(id)) return;

      const provider = new Cesium.UrlTemplateImageryProvider({
        url: source.tiles[0],
        tileWidth: source.tileSize || 256,
        tileHeight: source.tileSize || 256,
        credit: source.attribution || "",
        enablePickFeatures: false
      });
      const imageryLayer = new Cesium.ImageryLayer(provider, {
        show: visibility === "visible",
        alpha: opacity
      });

      viewer.imageryLayers.add(imageryLayer);
      layers.set(id, {
        id,
        type: "raster",
        source,
        imageryLayer,
        layout: { visibility },
        paint: { "raster-opacity": opacity }
      });
    },
    addUserLocationMarker(coordinates) {
      const entity = viewer.entities.add({
        id: "user-location",
        position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1]),
        point: {
          pixelSize: 14,
          color: Cesium.Color.fromCssColorString("#f97316"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });

      viewer.scene.requestRender();

      return {
        remove() {
          viewer.entities.remove(entity);
          viewer.scene.requestRender();
        }
      };
    },
    requestRender() {
      viewer.scene.requestRender();
    }
  };

  globalThis.__KPP_MAP_READY__?.(globe);
  return globe;
}
