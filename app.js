import { SATELLITE_LAYER_ID, STYLE_MAP } from "./js/config.js";
import { toggleCompareId } from "./js/compare.js";
import { buildDatasetMeta, loadFeatures, filterFeatures } from "./js/data.js";
import {
  buildDatasetSnapshot,
  loadDatasetSnapshot,
  saveDatasetSnapshot,
  summarizeDatasetChanges
} from "./js/datasetChanges.js";
import { getDomElements } from "./js/dom.js";
import { exportFeaturesAsCsv, exportFeaturesAsGeoJson } from "./js/export.js";
import { loadFavoriteIds, saveFavoriteIds, toggleFavoriteId } from "./js/favorites.js";
import { haversine } from "./js/geo.js";
import {
  createCheckpointsLayerController,
  ensureSatelliteLayer,
  setMapReferenceVisibility
} from "./js/mapLayers.js";
import { createPopupController } from "./js/popup.js";
import { getQualityFlags } from "./js/quality.js";
import {
  buildLegend,
  fillFilters,
  renderCompare,
  renderDatasetChanges,
  renderList,
  renderNearestOpen,
  renderRecent,
  renderShareSheet,
  renderStats
} from "./js/render.js";
import { loadRecentIds, prependRecentId, saveRecentIds } from "./js/recent.js";
import { registerAppShellServiceWorker } from "./js/serviceWorker.js";
import { copyText } from "./js/share.js";
import { setupThemeToggle } from "./js/theme.js";
import {
  applyFilterStateFromUrl,
  getMapViewStateFromUrl,
  getSelectedCheckpointIdFromUrl,
  syncFilterStateToUrl,
  syncMapViewToUrl,
  syncSelectedCheckpointToUrl,
  getSatelliteModeFromUrl,
  syncSatelliteModeToUrl,
  getReferenceLayerStateFromUrl,
  syncReferenceLayerStateToUrl
} from "./js/urlState.js";

const dom = getDomElements();
setupThemeToggle({ button: dom.themeToggleEl });
registerAppShellServiceWorker();

const DEFAULT_MAP_VIEW = {
  center: [90, 61],
  zoom: 4
};
const QUICK_FILTER_PRESETS = {
  open: { status: "Действует" },
  auto: { type: "Автомобильный" },
  rail: { type: "Железнодорожный" },
  air: { type: "Воздушный" }
};
const initialMapView = getMapViewStateFromUrl(DEFAULT_MAP_VIEW);
const initialReferenceLayerState = getReferenceLayerStateFromUrl();
const isMapLibreAvailable = Boolean(globalThis.maplibregl?.Map);

const state = {
  allFeatures: [],
  viewFeatures: [],
  datasetMeta: null,
  datasetChangeSummary: null,
  favoriteIds: loadFavoriteIds(),
  recentIds: loadRecentIds(),
  compareIds: [],
  showFavoritesOnly: false,
  showViewportOnly: false,
  showBoundariesLayer: initialReferenceLayerState.boundaries,
  showRoadsLayer: initialReferenceLayerState.roads,
  shareSheetOpen: false,
  userLocation: null,
  userMarker: null,
  debounceTimer: null,
  shareFeedbackTimer: null
};

function createFallbackMap({ center, zoom }) {
  const sources = new Map();
  const layers = new Map();
  const listeners = new Map();
  const canvas = { style: {} };
  let currentCenter = [...center];
  let currentZoom = zoom;

  function emit(eventName) {
    for (const handler of listeners.get(eventName) || []) handler();
  }

  return {
    isFallback: true,
    loaded: () => true,
    once(_eventName, callback) {
      callback();
    },
    addControl() {},
    addSource(id, source) {
      sources.set(id, {
        ...source,
        data: source.data,
        setData(data) {
          this.data = data;
        },
        getClusterExpansionZoom(_id, callback) {
          callback(null, currentZoom);
        }
      });
    },
    getSource(id) {
      return sources.get(id);
    },
    removeSource(id) {
      sources.delete(id);
    },
    addLayer(layer) {
      layers.set(layer.id, { ...layer, layout: layer.layout ? { ...layer.layout } : {} });
    },
    getLayer(id) {
      return layers.get(id);
    },
    removeLayer(id) {
      layers.delete(id);
    },
    on(eventName, maybeLayer, maybeHandler) {
      const handler = typeof maybeLayer === "function" ? maybeLayer : maybeHandler;
      if (typeof handler !== "function") return;
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(handler);
    },
    off(eventName, maybeLayer, maybeHandler) {
      const handler = typeof maybeLayer === "function" ? maybeLayer : maybeHandler;
      listeners.get(eventName)?.delete(handler);
    },
    easeTo(options = {}) {
      if (Array.isArray(options.center)) currentCenter = [...options.center];
      if (typeof options.zoom === "number") currentZoom = options.zoom;
      emit("moveend");
    },
    fitBounds(bounds, options = {}) {
      const [southWest, northEast] = bounds;
      currentCenter = [(southWest[0] + northEast[0]) / 2, (southWest[1] + northEast[1]) / 2];
      if (typeof options.maxZoom === "number") currentZoom = Math.min(currentZoom, options.maxZoom);
      emit("moveend");
    },
    resize() {},
    getCanvas() {
      return canvas;
    },
    getZoom() {
      return currentZoom;
    },
    getCenter() {
      return { lng: currentCenter[0], lat: currentCenter[1] };
    },
    getBounds() {
      return { contains: () => true };
    },
    setLayoutProperty(id, prop, value) {
      const layer = layers.get(id);
      if (!layer) return;
      if (!layer.layout) layer.layout = {};
      layer.layout[prop] = value;
    },
    getLayoutProperty(id, prop) {
      return layers.get(id)?.layout?.[prop] ?? "none";
    }
  };
}

const map = isMapLibreAvailable
  ? new maplibregl.Map({
      container: "map",
      style: STYLE_MAP,
      center: initialMapView.center,
      zoom: initialMapView.zoom,
      antialias: true
    })
  : createFallbackMap(initialMapView);

if (isMapLibreAvailable) {
  map.addControl(new maplibregl.NavigationControl(), "bottom-right");
}

const popupController = createPopupController({
  map,
  getUserLocation: () => state.userLocation,
  onPopupChange: (feature) => {
    syncSelectedCheckpointToUrl(feature?.properties?.__id || "");
  }
});

const layerController = createCheckpointsLayerController({
  map,
  openPopup: openFeaturePopup
});

function setProgress(percent, text) {
  if (dom.loaderProgressEl) dom.loaderProgressEl.style.width = `${percent}%`;
  if (dom.loaderTextEl && text) dom.loaderTextEl.textContent = text;
}

function hideLoaderOnce() {
  if (!dom.loaderEl) return;

  dom.loaderEl.style.opacity = "0";
  dom.loaderEl.style.pointerEvents = "none";

  setTimeout(() => {
    if (dom.loaderEl && dom.loaderEl.parentNode) {
      dom.loaderEl.parentNode.removeChild(dom.loaderEl);
    }
  }, 250);
}

function syncOfflineStatus() {
  if (!dom.offlineStatusEl) return;

  const isOffline = globalThis.navigator?.onLine === false;
  dom.offlineStatusEl.hidden = !isOffline;
  dom.offlineStatusEl.classList.toggle("is-visible", isOffline);
  dom.offlineStatusEl.textContent = isOffline ? "Офлайн: показываем сохраненную версию карты" : "";
}

function syncMapFallbackStatus() {
  if (!map.isFallback) return;

  dom.mapWrapEl?.classList.add("mapWrap--fallback");
  if (dom.mapFallbackEl) dom.mapFallbackEl.hidden = false;
  dom.styleToggleEl.disabled = true;
  if (dom.boundariesToggleEl) dom.boundariesToggleEl.disabled = true;
  if (dom.roadsToggleEl) dom.roadsToggleEl.disabled = true;
  dom.styleToggleEl.textContent = "Карта недоступна";
}

function renderAll() {
  const nearestOpenFeature = getNearestOpenFeature();

  renderStats({
    statsEl: dom.statsEl,
    allFeatures: state.allFeatures,
    viewFeatures: state.viewFeatures,
    datasetMeta: state.datasetMeta,
    activeFilterCount: getActiveFilterCount(),
    favoriteCount: getFavoriteCount()
  });

  renderList({
    listEl: dom.listEl,
    emptyEl: dom.emptyEl,
    viewFeatures: state.viewFeatures,
    userLocation: state.userLocation,
    favoriteIds: state.favoriteIds,
    compareIds: state.compareIds,
    nearestOpenId: nearestOpenFeature?.properties.__id || "",
    sortMode: dom.sortEl.value,
    onItemClick: focusById,
    onFavoriteToggle: toggleFavorite,
    onCopyCoordinates: copyCheckpointCoordinates,
    onCompareToggle: toggleCompare
  });

  renderRecent({
    recentEl: dom.recentEl,
    recentFeatures: getRecentFeatures(),
    onItemClick: focusById
  });

  renderNearestOpen({
    nearestOpenEl: dom.nearestOpenEl,
    feature: nearestOpenFeature,
    userLocation: state.userLocation,
    onItemClick: focusById
  });

  renderCompare({
    compareEl: dom.compareEl,
    compareFeatures: getCompareFeatures(),
    onItemClick: focusById,
    onRemove: removeCompareItem,
    onClear: clearCompare
  });

  renderShareSheet({
    shareSheetEl: dom.shareSheetEl,
    shareUrl: window.location.href,
    isOpen: state.shareSheetOpen,
    canNativeShare: typeof navigator.share === "function",
    onCopy: copyShareLink,
    onNativeShare: shareViaNavigator,
    onClose: closeShareSheet
  });

  renderDatasetChanges({
    changesEl: dom.datasetChangesEl,
    summary: state.datasetChangeSummary
  });

  syncFavoritesButton();
  syncPresetButtons();
  syncFitResultsButton();
  syncViewportOnlyButton();
  syncExportButtons();
}

function syncCurrentMapView() {
  const mapCenter = map.getCenter();
  const center = Array.isArray(mapCenter) ? mapCenter : [mapCenter?.lng, mapCenter?.lat];

  syncMapViewToUrl({
    center,
    zoom: map.getZoom()
  });

  if (state.showViewportOnly) {
    applyFilters();
  }
}

function isSatelliteVisible() {
  return map.getLayoutProperty(SATELLITE_LAYER_ID, "visibility") === "visible";
}

function syncMapLayerButtons() {
  const satelliteEnabled = isSatelliteVisible();

  dom.styleToggleEl.textContent = satelliteEnabled ? "Спутник включен" : "Схема включена";
  dom.styleToggleEl.classList.toggle("is-active", satelliteEnabled);
  dom.styleToggleEl.setAttribute?.("aria-pressed", satelliteEnabled ? "true" : "false");

  if (dom.boundariesToggleEl) {
    dom.boundariesToggleEl.disabled = !satelliteEnabled || map.isFallback;
    dom.boundariesToggleEl.classList.toggle(
      "is-active",
      satelliteEnabled && state.showBoundariesLayer
    );
    dom.boundariesToggleEl.setAttribute?.(
      "aria-pressed",
      satelliteEnabled && state.showBoundariesLayer ? "true" : "false"
    );
  }

  if (dom.roadsToggleEl) {
    dom.roadsToggleEl.disabled = !satelliteEnabled || map.isFallback;
    dom.roadsToggleEl.classList.toggle("is-active", satelliteEnabled && state.showRoadsLayer);
    dom.roadsToggleEl.setAttribute?.(
      "aria-pressed",
      satelliteEnabled && state.showRoadsLayer ? "true" : "false"
    );
  }
}

function syncMapLayerVisibility() {
  setMapReferenceVisibility(map, {
    satellite: isSatelliteVisible(),
    boundaries: state.showBoundariesLayer,
    roads: state.showRoadsLayer
  });
  syncMapLayerButtons();
}

function setSatelliteMode(enabled, { syncUrl = true } = {}) {
  if (map.isFallback) {
    syncSatelliteModeToUrl(false);
    syncMapFallbackStatus();
    return;
  }

  setMapReferenceVisibility(map, {
    satellite: enabled,
    boundaries: state.showBoundariesLayer,
    roads: state.showRoadsLayer
  });

  syncMapLayerButtons();

  if (syncUrl) {
    syncSatelliteModeToUrl(enabled);
  }
}

function toggleBoundariesLayer() {
  state.showBoundariesLayer = !state.showBoundariesLayer;
  syncMapLayerVisibility();
  syncReferenceLayerStateToUrl({
    boundaries: state.showBoundariesLayer,
    roads: state.showRoadsLayer
  });
}

function toggleRoadsLayer() {
  state.showRoadsLayer = !state.showRoadsLayer;
  syncMapLayerVisibility();
  syncReferenceLayerStateToUrl({
    boundaries: state.showBoundariesLayer,
    roads: state.showRoadsLayer
  });
}

function getActiveFilterCount() {
  const filterValues = [
    dom.searchEl.value.trim(),
    dom.typeEl.value !== "all" ? dom.typeEl.value : "",
    dom.statusEl.value !== "all" ? dom.statusEl.value : "",
    dom.countryEl.value !== "all" ? dom.countryEl.value : "",
    dom.subjectEl.value !== "all" ? dom.subjectEl.value : "",
    state.showFavoritesOnly ? "favorites" : "",
    state.showViewportOnly ? "viewport" : ""
  ].filter(Boolean);

  return filterValues.length;
}

function getFavoriteCount() {
  return state.allFeatures.filter((feature) => state.favoriteIds.has(feature.properties.__id))
    .length;
}

function getRecentFeatures() {
  const featuresById = new Map(
    state.allFeatures.map((feature) => [feature.properties.__id, feature])
  );

  return state.recentIds.map((id) => featuresById.get(id)).filter(Boolean);
}

function getCompareFeatures() {
  const featuresById = new Map(
    state.allFeatures.map((feature) => [feature.properties.__id, feature])
  );

  return state.compareIds.map((id) => featuresById.get(id)).filter(Boolean);
}

function getNearestOpenFeature() {
  if (!state.userLocation) return null;

  return (
    state.viewFeatures
      .filter((feature) => feature.properties.__status === "Действует")
      .sort(
        (a, b) =>
          haversine(state.userLocation, a.geometry.coordinates) -
          haversine(state.userLocation, b.geometry.coordinates)
      )[0] || null
  );
}

function syncFavoritesButton() {
  const favoriteCount = getFavoriteCount();

  dom.favoritesOnlyEl.textContent = `★ Избранные (${favoriteCount})`;
  dom.favoritesOnlyEl.disabled = favoriteCount === 0 && !state.showFavoritesOnly;
  dom.favoritesOnlyEl.classList.toggle("is-active", state.showFavoritesOnly);
  dom.favoritesOnlyEl.setAttribute?.("aria-pressed", state.showFavoritesOnly ? "true" : "false");
}

function setSortMode(value) {
  dom.sortEl.value = value;
  syncFilterStateToUrl(dom);
  renderAll();
}

function getFeatureBounds(features) {
  const coordinates = features
    .map((feature) => feature.geometry?.coordinates)
    .filter(
      (coords) => Array.isArray(coords) && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
    );

  if (!coordinates.length) return null;

  const lngs = coordinates.map((coords) => coords[0]);
  const lats = coordinates.map((coords) => coords[1]);

  return {
    coordinates,
    bounds: [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    ]
  };
}

function fitMapToFeatures(features = state.viewFeatures) {
  const featureBounds = getFeatureBounds(features);
  if (!featureBounds) return;

  if (featureBounds.coordinates.length === 1) {
    map.easeTo({
      center: featureBounds.coordinates[0],
      zoom: Math.max(map.getZoom(), 8)
    });
    return;
  }

  map.fitBounds(featureBounds.bounds, {
    padding: window.matchMedia("(max-width: 900px)").matches
      ? 56
      : { top: 80, right: 80, bottom: 80, left: 460 },
    maxZoom: 8
  });
}

function syncFitResultsButton() {
  dom.fitResultsEl.disabled = state.viewFeatures.length === 0;
}

function syncViewportOnlyButton() {
  dom.viewportOnlyEl.classList.toggle("is-active", state.showViewportOnly);
  dom.viewportOnlyEl.setAttribute?.("aria-pressed", state.showViewportOnly ? "true" : "false");
}

function setSelectIfAllowed(el, value) {
  if (!value) return;
  if (Array.isArray(el.__options) && !el.__options.includes(value)) return;
  el.value = value;
}

function matchesQuickPreset(presetName) {
  const preset = QUICK_FILTER_PRESETS[presetName];
  if (!preset) return false;

  return Object.entries(preset).every(([key, value]) => {
    if (key === "type") return dom.typeEl.value === value;
    if (key === "status") return dom.statusEl.value === value;
    return false;
  });
}

function syncPresetButtons() {
  dom.presetsEl.querySelectorAll("[data-preset]").forEach((button) => {
    button.classList.toggle("is-active", matchesQuickPreset(button.dataset.preset));
  });
}

function applyQuickPreset(presetName) {
  const preset = QUICK_FILTER_PRESETS[presetName];
  if (!preset) return;

  setSelectIfAllowed(dom.typeEl, preset.type);
  setSelectIfAllowed(dom.statusEl, preset.status);
  applyFilters();
}

function applyFilters() {
  const filteredFeatures = filterFeatures(state.allFeatures, {
    query: dom.searchEl.value,
    type: dom.typeEl.value,
    status: dom.statusEl.value,
    country: dom.countryEl.value,
    subject: dom.subjectEl.value
  });

  state.viewFeatures = state.showFavoritesOnly
    ? filteredFeatures.filter((feature) => state.favoriteIds.has(feature.properties.__id))
    : filteredFeatures;

  if (state.showViewportOnly) {
    state.viewFeatures = filterFeaturesToViewport(state.viewFeatures);
  }

  syncMapSourceData();
  closePopupIfHidden();
  syncFilterStateToUrl(dom);
  renderAll();
}

function getMapFeatures(features = state.viewFeatures) {
  return features.map((feature) => {
    const qualityFlags = getQualityFlags(feature);

    return {
      ...feature,
      properties: {
        ...feature.properties,
        __isFavorite: state.favoriteIds.has(feature.properties.__id),
        __hasQualityIssues: qualityFlags.length > 0,
        __hasCriticalQualityIssues: qualityFlags.some((flag) => flag.level === "critical")
      }
    };
  });
}

function syncMapSourceData() {
  layerController.updateSourceData(getMapFeatures());
}

function resetFilters() {
  dom.searchEl.value = "";
  dom.typeEl.value = "all";
  dom.statusEl.value = "all";
  dom.countryEl.value = "all";
  dom.subjectEl.value = "all";
  state.showFavoritesOnly = false;
  state.showViewportOnly = false;
  applyFilters();
}

function filterFeaturesToViewport(features) {
  const bounds = map.getBounds?.();
  if (!bounds?.contains) return features;

  return features.filter((feature) => {
    const coordinates = feature.geometry?.coordinates;
    return Array.isArray(coordinates) && bounds.contains(coordinates);
  });
}

function syncExportButtons() {
  const disabled = state.viewFeatures.length === 0;

  dom.exportCsvEl.disabled = disabled;
  dom.exportGeoJsonEl.disabled = disabled;
}

function exportCurrentView(format) {
  if (!state.viewFeatures.length) return;

  const options = {
    hasFilters: getActiveFilterCount() > 0
  };

  if (format === "csv") {
    exportFeaturesAsCsv(state.viewFeatures, options);
    return;
  }

  exportFeaturesAsGeoJson(state.viewFeatures, options);
}

function getFeatureById(id, features = state.allFeatures) {
  return features.find((item) => item.properties.__id === id) || null;
}

function closePopupIfHidden() {
  const selectedFeature = popupController.getLastPopupFeature();
  if (!selectedFeature) return;

  const isVisible = state.viewFeatures.some(
    (item) => item.properties.__id === selectedFeature.properties.__id
  );

  if (!isVisible) {
    popupController.closePopup();
  }
}

function restoreSelectedCheckpointFromUrl() {
  const selectedId = getSelectedCheckpointIdFromUrl();
  if (!selectedId) return;

  const feature = getFeatureById(selectedId, state.viewFeatures);

  if (!feature) {
    syncSelectedCheckpointToUrl("");
    return;
  }

  openFeaturePopup(feature, feature.geometry.coordinates);
}

function setShareButtonLabel(text) {
  dom.shareLinkEl.textContent = text;

  clearTimeout(state.shareFeedbackTimer);
  state.shareFeedbackTimer = setTimeout(() => {
    dom.shareLinkEl.textContent = "Поделиться ссылкой";
  }, 1800);
}

async function shareCurrentView() {
  state.shareSheetOpen = true;
  await copyShareLink();
  renderAll();
}

async function copyShareLink() {
  const copied = await copyText(window.location.href);
  setShareButtonLabel(copied ? "Ссылка скопирована" : "Скопируйте ссылку вручную");
}

async function shareViaNavigator() {
  if (typeof navigator.share !== "function") return;

  try {
    await navigator.share({
      title: document.title || "КПП РФ",
      url: window.location.href
    });
  } catch (_error) {
    // User cancellation is a normal share-sheet outcome.
  }
}

function closeShareSheet() {
  state.shareSheetOpen = false;
  renderAll();
}

function focusById(id) {
  const feature = getFeatureById(id, state.viewFeatures) || getFeatureById(id, state.allFeatures);

  if (feature) openFeaturePopup(feature, feature.geometry.coordinates);
}

function trackRecentCheckpoint(id) {
  state.recentIds = prependRecentId(state.recentIds, id);
  saveRecentIds(state.recentIds);
}

function openFeaturePopup(feature, lngLat) {
  if (!feature) return;

  trackRecentCheckpoint(feature.properties.__id);
  renderAll();
  popupController.openPopup(feature, lngLat || feature.geometry.coordinates);
}

function toggleFavorite(id) {
  state.favoriteIds = toggleFavoriteId(state.favoriteIds, id);
  saveFavoriteIds(state.favoriteIds);

  if (state.showFavoritesOnly) {
    applyFilters();
    return;
  }

  syncMapSourceData();
  renderAll();
}

function toggleFavoritesOnly() {
  state.showFavoritesOnly = !state.showFavoritesOnly;
  applyFilters();
}

async function copyCheckpointCoordinates(id) {
  const feature = getFeatureById(id, state.allFeatures);
  if (!feature) return false;

  return copyText(feature.properties.__coords || "");
}

function toggleCompare(id) {
  state.compareIds = toggleCompareId(state.compareIds, id);
  renderAll();
}

function removeCompareItem(id) {
  state.compareIds = state.compareIds.filter((item) => item !== id);
  renderAll();
}

function clearCompare() {
  state.compareIds = [];
  renderAll();
}

function toggleViewportOnly() {
  state.showViewportOnly = !state.showViewportOnly;
  applyFilters();
}

function updateUserMarker() {
  if (!state.userLocation) return;
  if (!globalThis.maplibregl?.Marker) return;

  if (state.userMarker) state.userMarker.remove();

  state.userMarker = new maplibregl.Marker({ color: "#f97316" })
    .setLngLat(state.userLocation)
    .addTo(map);
}

function setGeoButtonLoading(isLoading) {
  dom.geoBtnEl.disabled = isLoading;
  dom.nearestBtnEl.disabled = isLoading;
  dom.geoBtnEl.textContent = isLoading ? "Ищем..." : "Гео";
  dom.nearestBtnEl.textContent = isLoading ? "Ищем..." : "Ближайшие";
}

function requestUserLocation({ setDistanceSort = false } = {}) {
  if (!navigator.geolocation) return;

  setGeoButtonLoading(true);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.userLocation = [position.coords.longitude, position.coords.latitude];
      updateUserMarker();

      if (setDistanceSort) {
        setSortMode("distance");
      } else {
        renderAll();
      }

      popupController.refreshPopup();
      setGeoButtonLoading(false);
    },
    () => {
      setGeoButtonLoading(false);
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

function attachUi() {
  map.on("moveend", syncCurrentMapView);
  globalThis.window?.addEventListener?.("online", syncOfflineStatus);
  globalThis.window?.addEventListener?.("offline", syncOfflineStatus);

  dom.searchEl.oninput = () => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(applyFilters, 200);
  };

  dom.typeEl.onchange = applyFilters;
  dom.statusEl.onchange = applyFilters;
  dom.countryEl.onchange = applyFilters;
  dom.subjectEl.onchange = applyFilters;
  dom.presetsEl.onclick = (event) => {
    applyQuickPreset(event.target?.dataset?.preset);
  };
  dom.sortEl.onchange = () => {
    syncFilterStateToUrl(dom);
    renderAll();
  };
  dom.resetFiltersEl.onclick = resetFilters;
  dom.exportCsvEl.onclick = () => exportCurrentView("csv");
  dom.exportGeoJsonEl.onclick = () => exportCurrentView("geojson");
  dom.shareLinkEl.onclick = shareCurrentView;
  dom.nearestBtnEl.onclick = () => requestUserLocation({ setDistanceSort: true });
  dom.favoritesOnlyEl.onclick = toggleFavoritesOnly;
  dom.fitResultsEl.onclick = () => fitMapToFeatures();
  dom.viewportOnlyEl.onclick = toggleViewportOnly;

  dom.styleToggleEl.onclick = () => {
    setSatelliteMode(!isSatelliteVisible());
  };

  if (dom.boundariesToggleEl) {
    dom.boundariesToggleEl.onclick = toggleBoundariesLayer;
  }

  if (dom.roadsToggleEl) {
    dom.roadsToggleEl.onclick = toggleRoadsLayer;
  }

  dom.geoBtnEl.onclick = () => {
    requestUserLocation();
  };

  if (dom.mobileToggleEl) {
    dom.mobileToggleEl.onclick = () => {
      dom.panelEl.classList.toggle("open");
      setTimeout(() => map.resize(), 200);
    };
  }

  if (dom.mobileToggleFloatingEl) {
    dom.mobileToggleFloatingEl.onclick = () => {
      dom.panelEl.classList.add("open");
      setTimeout(() => map.resize(), 200);
    };
  }
}

async function init() {
  syncOfflineStatus();
  syncMapFallbackStatus();

  try {
    setProgress(10, "Подключаем карту...");
    await new Promise((resolve) => (map.loaded() ? resolve() : map.once("load", resolve)));

    ensureSatelliteLayer(map);
    setSatelliteMode(getSatelliteModeFromUrl(true), { syncUrl: false });

    setProgress(25, "Загружаем КПП...");
    state.allFeatures = await loadFeatures({ setProgress });
    state.viewFeatures = state.allFeatures;
    state.datasetMeta = buildDatasetMeta(state.allFeatures);
    const currentSnapshot = buildDatasetSnapshot(state.allFeatures, state.datasetMeta);
    state.datasetChangeSummary = summarizeDatasetChanges(loadDatasetSnapshot(), currentSnapshot);
    saveDatasetSnapshot(currentSnapshot);

    setProgress(55, "Настраиваем интерфейс...");
    buildLegend(dom.legendEl);
    fillFilters({
      allFeatures: state.allFeatures,
      typeEl: dom.typeEl,
      statusEl: dom.statusEl,
      countryEl: dom.countryEl,
      subjectEl: dom.subjectEl
    });
    applyFilterStateFromUrl(dom);
    attachUi();
    syncCurrentMapView();
    applyFilters();

    if (window.matchMedia("(max-width: 900px)").matches) {
      dom.panelEl.classList.add("open");
    }

    setProgress(80, "Строим слои...");
    layerController.rebuildLayers(getMapFeatures());
    restoreSelectedCheckpointFromUrl();

    setProgress(100, "Готово");
    setTimeout(hideLoaderOnce, 150);
  } catch (error) {
    console.error(error);
    setProgress(100, "Ошибка");
    if (dom.loaderTextEl) dom.loaderTextEl.textContent = String(error?.message || error);
  }
}

init();
