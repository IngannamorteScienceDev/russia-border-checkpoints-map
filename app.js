import {
  SATELLITE_LAYER_ID,
  STYLE_MAP
} from "./js/config.js";
import { buildDatasetMeta, loadFeatures, filterFeatures } from "./js/data.js";
import { getDomElements } from "./js/dom.js";
import { exportFeaturesAsCsv, exportFeaturesAsGeoJson } from "./js/export.js";
import { createCheckpointsLayerController, ensureSatelliteLayer } from "./js/mapLayers.js";
import { createPopupController } from "./js/popup.js";
import { buildLegend, fillFilters, renderList, renderStats } from "./js/render.js";
import { copyText } from "./js/share.js";
import {
  applyFilterStateFromUrl,
  getSelectedCheckpointIdFromUrl,
  syncFilterStateToUrl,
  syncSelectedCheckpointToUrl
} from "./js/urlState.js";

const dom = getDomElements();

const state = {
  allFeatures: [],
  viewFeatures: [],
  datasetMeta: null,
  userLocation: null,
  userMarker: null,
  debounceTimer: null,
  shareFeedbackTimer: null
};

const map = new maplibregl.Map({
  container: "map",
  style: STYLE_MAP,
  center: [90, 61],
  zoom: 4,
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
  openPopup: popupController.openPopup
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
  renderStats({
    statsEl: dom.statsEl,
    allFeatures: state.allFeatures,
    viewFeatures: state.viewFeatures,
    datasetMeta: state.datasetMeta,
    activeFilterCount: getActiveFilterCount()
  });

  renderList({
    listEl: dom.listEl,
    emptyEl: dom.emptyEl,
    viewFeatures: state.viewFeatures,
    userLocation: state.userLocation,
    onItemClick: focusById
  });

  syncExportButtons();
}

function getActiveFilterCount() {
  const filterValues = [
    dom.searchEl.value.trim(),
    dom.typeEl.value !== "all" ? dom.typeEl.value : "",
    dom.statusEl.value !== "all" ? dom.statusEl.value : "",
    dom.countryEl.value !== "all" ? dom.countryEl.value : "",
    dom.subjectEl.value !== "all" ? dom.subjectEl.value : ""
  ].filter(Boolean);

  return filterValues.length;
}

function applyFilters() {
  state.viewFeatures = filterFeatures(state.allFeatures, {
    query: dom.searchEl.value,
    type: dom.typeEl.value,
    status: dom.statusEl.value,
    country: dom.countryEl.value,
    subject: dom.subjectEl.value
  });

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
  applyFilters();
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

  popupController.openPopup(feature, feature.geometry.coordinates);
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

  if (feature) popupController.openPopup(feature, feature.geometry.coordinates);
}

function updateUserMarker() {
  if (!state.userLocation) return;

  if (state.userMarker) state.userMarker.remove();

  state.userMarker = new maplibregl.Marker({ color: "#f97316" })
    .setLngLat(state.userLocation)
    .addTo(map);
}

function attachUi() {
  dom.searchEl.oninput = () => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(applyFilters, 200);
  };

  dom.typeEl.onchange = applyFilters;
  dom.statusEl.onchange = applyFilters;
  dom.countryEl.onchange = applyFilters;
  dom.subjectEl.onchange = applyFilters;
  dom.resetFiltersEl.onclick = resetFilters;
  dom.exportCsvEl.onclick = () => exportCurrentView("csv");
  dom.exportGeoJsonEl.onclick = () => exportCurrentView("geojson");
  dom.shareLinkEl.onclick = shareCurrentView;

  dom.styleToggleEl.onclick = () => {
    const visible = map.getLayoutProperty(SATELLITE_LAYER_ID, "visibility") === "visible";

    map.setLayoutProperty(
      SATELLITE_LAYER_ID,
      "visibility",
      visible ? "none" : "visible"
    );

    dom.styleToggleEl.textContent = visible ? "🛰 Спутник" : "🗺 Карта";
  };

  dom.geoBtnEl.onclick = () => {
    if (!navigator.geolocation) return;

    dom.geoBtnEl.disabled = true;
    dom.geoBtnEl.textContent = "⏳";

    navigator.geolocation.getCurrentPosition(
      position => {
        state.userLocation = [position.coords.longitude, position.coords.latitude];
        updateUserMarker();
        renderAll();
        popupController.refreshPopup();
        dom.geoBtnEl.disabled = false;
        dom.geoBtnEl.textContent = "📍 Гео";
      },
      () => {
        dom.geoBtnEl.disabled = false;
        dom.geoBtnEl.textContent = "📍 Гео";
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
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
