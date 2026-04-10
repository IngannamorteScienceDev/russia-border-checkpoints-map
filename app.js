import {
  SATELLITE_LAYER_ID,
  STYLE_MAP
} from "./js/config.js";
import { buildDatasetMeta, loadFeatures, filterFeatures } from "./js/data.js";
import { getDomElements } from "./js/dom.js";
import { exportFeaturesAsCsv, exportFeaturesAsGeoJson } from "./js/export.js";
import { loadFavoriteIds, saveFavoriteIds, toggleFavoriteId } from "./js/favorites.js";
import { haversine } from "./js/geo.js";
import { createCheckpointsLayerController, ensureSatelliteLayer } from "./js/mapLayers.js";
import { createPopupController } from "./js/popup.js";
import { buildLegend, fillFilters, renderList, renderNearestOpen, renderRecent, renderStats } from "./js/render.js";
import { loadRecentIds, prependRecentId, saveRecentIds } from "./js/recent.js";
import { copyText } from "./js/share.js";
import {
  applyFilterStateFromUrl,
  getMapViewStateFromUrl,
  getSelectedCheckpointIdFromUrl,
  syncFilterStateToUrl,
  syncMapViewToUrl,
  syncSelectedCheckpointToUrl,
  getSatelliteModeFromUrl,
  syncSatelliteModeToUrl
} from "./js/urlState.js";

const dom = getDomElements();
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

const state = {
  allFeatures: [],
  viewFeatures: [],
  datasetMeta: null,
  favoriteIds: loadFavoriteIds(),
  recentIds: loadRecentIds(),
  showFavoritesOnly: false,
  showViewportOnly: false,
  userLocation: null,
  userMarker: null,
  debounceTimer: null,
  shareFeedbackTimer: null
};

const map = new maplibregl.Map({
  container: "map",
  style: STYLE_MAP,
  center: initialMapView.center,
  zoom: initialMapView.zoom,
  antialias: true
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

const popupController = createPopupController({
  map,
  getUserLocation: () => state.userLocation,
  onPopupChange: feature => {
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
    nearestOpenId: nearestOpenFeature?.properties.__id || "",
    sortMode: dom.sortEl.value,
    onItemClick: focusById,
    onFavoriteToggle: toggleFavorite,
    onCopyCoordinates: copyCheckpointCoordinates
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

  syncFavoritesButton();
  syncPresetButtons();
  syncFitResultsButton();
  syncViewportOnlyButton();
  syncExportButtons();
}

function syncCurrentMapView() {
  const mapCenter = map.getCenter();
  const center = Array.isArray(mapCenter)
    ? mapCenter
    : [mapCenter?.lng, mapCenter?.lat];

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

function setSatelliteMode(enabled) {
  map.setLayoutProperty(
    SATELLITE_LAYER_ID,
    "visibility",
    enabled ? "visible" : "none"
  );

  dom.styleToggleEl.textContent = enabled ? "🗺 Карта" : "🛰 Спутник";
  syncSatelliteModeToUrl(enabled);
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
  return state.allFeatures.filter(feature =>
    state.favoriteIds.has(feature.properties.__id)
  ).length;
}

function getRecentFeatures() {
  const featuresById = new Map(
    state.allFeatures.map(feature => [feature.properties.__id, feature])
  );

  return state.recentIds
    .map(id => featuresById.get(id))
    .filter(Boolean);
}

function getNearestOpenFeature() {
  if (!state.userLocation) return null;

  return state.viewFeatures
    .filter(feature => feature.properties.__status === "Действует")
    .sort((a, b) =>
      haversine(state.userLocation, a.geometry.coordinates) -
      haversine(state.userLocation, b.geometry.coordinates)
    )[0] || null;
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
    .map(feature => feature.geometry?.coordinates)
    .filter(coords =>
      Array.isArray(coords) &&
      Number.isFinite(coords[0]) &&
      Number.isFinite(coords[1])
    );

  if (!coordinates.length) return null;

  const lngs = coordinates.map(coords => coords[0]);
  const lats = coordinates.map(coords => coords[1]);

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
  dom.presetsEl.querySelectorAll("[data-preset]").forEach(button => {
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
    ? filteredFeatures.filter(feature => state.favoriteIds.has(feature.properties.__id))
    : filteredFeatures;

  if (state.showViewportOnly) {
    state.viewFeatures = filterFeaturesToViewport(state.viewFeatures);
  }

  layerController.updateSourceData(state.viewFeatures);
  closePopupIfHidden();
  syncFilterStateToUrl(dom);
  renderAll();
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

  return features.filter(feature => {
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
  return features.find(item => item.properties.__id === id) || null;
}

function closePopupIfHidden() {
  const selectedFeature = popupController.getLastPopupFeature();
  if (!selectedFeature) return;

  const isVisible = state.viewFeatures.some(
    item => item.properties.__id === selectedFeature.properties.__id
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
  const copied = await copyText(window.location.href);
  setShareButtonLabel(copied ? "Ссылка скопирована" : "Скопируйте ссылку вручную");
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

function toggleViewportOnly() {
  state.showViewportOnly = !state.showViewportOnly;
  applyFilters();
}

function updateUserMarker() {
  if (!state.userLocation) return;

  if (state.userMarker) state.userMarker.remove();

  state.userMarker = new maplibregl.Marker({ color: "#f97316" })
    .setLngLat(state.userLocation)
    .addTo(map);
}

function setGeoButtonLoading(isLoading) {
  dom.geoBtnEl.disabled = isLoading;
  dom.nearestBtnEl.disabled = isLoading;
  dom.geoBtnEl.textContent = isLoading ? "⏳" : "📍 Гео";
  dom.nearestBtnEl.textContent = isLoading ? "Ищем..." : "Ближайшие";
}

function requestUserLocation({ setDistanceSort = false } = {}) {
  if (!navigator.geolocation) return;

  setGeoButtonLoading(true);

  navigator.geolocation.getCurrentPosition(
    position => {
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

  dom.searchEl.oninput = () => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(applyFilters, 200);
  };

  dom.typeEl.onchange = applyFilters;
  dom.statusEl.onchange = applyFilters;
  dom.countryEl.onchange = applyFilters;
  dom.subjectEl.onchange = applyFilters;
  dom.presetsEl.onclick = event => {
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
  try {
    setProgress(10, "Подключаем карту...");
    await new Promise(resolve => (map.loaded() ? resolve() : map.once("load", resolve)));

    ensureSatelliteLayer(map);
    setSatelliteMode(getSatelliteModeFromUrl());

    setProgress(25, "Загружаем КПП...");
    state.allFeatures = await loadFeatures({ setProgress });
    state.viewFeatures = state.allFeatures;
    state.datasetMeta = buildDatasetMeta(state.allFeatures);

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
    layerController.rebuildLayers(state.viewFeatures);
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
