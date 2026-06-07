import {
  CAMERA_PRESETS,
  DEFAULT_IMAGERY_MODE,
  IMAGERY_OPTIONS,
  QUALITY_LEVELS,
  TYPE_COLORS
} from "./js/config.js";
import { buildDatasetSummary, formatCoordinates, loadCheckpoints } from "./js/checkpoints.js";
import {
  analyzeVisibility,
  createCheckpointLayer,
  createGlobe,
  flyToCameraPreset,
  setBuildingsEnabled,
  setImageryMode,
  setTerrainEnabled
} from "./js/cesiumGlobe.js";

const TEXT = {
  allTypes: "\u0412\u0441\u0435 \u0442\u0438\u043f\u044b",
  allStatuses: "\u0412\u0441\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044b",
  shown: "\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u043e",
  total: "\u0412\u0441\u0435\u0433\u043e",
  countries: "\u0421\u0442\u0440\u0430\u043d",
  types: "\u0422\u0438\u043f\u043e\u0432",
  typeLegend: "\u0422\u0438\u043f\u044b \u041a\u041f\u041f",
  qualityLegend:
    "\u041a\u0430\u0447\u0435\u0441\u0442\u0432\u043e \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442",
  legendPanel: "\u041b\u0435\u0433\u0435\u043d\u0434\u0430",
  regionsPanel: "\u0420\u0435\u0433\u0438\u043e\u043d\u044b",
  closePanel: "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c",
  checkpoint: "\u041f\u0443\u043d\u043a\u0442 \u043f\u0440\u043e\u043f\u0443\u0441\u043a\u0430",
  closeCard:
    "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443",
  country:
    "\u0421\u043e\u043f\u0440\u0435\u0434\u0435\u043b\u044c\u043d\u0430\u044f \u0441\u0442\u0440\u0430\u043d\u0430",
  subject: "\u0421\u0443\u0431\u044a\u0435\u043a\u0442 \u0420\u0424",
  coordinates: "\u041a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b",
  address: "\u0410\u0434\u0440\u0435\u0441",
  workingTime: "\u0420\u0435\u0436\u0438\u043c \u0440\u0430\u0431\u043e\u0442\u044b",
  foreignCheckpoint:
    "\u0421\u043e\u043f\u0440\u0435\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u041a\u041f\u041f",
  corridor: "\u041a\u043e\u0440\u0438\u0434\u043e\u0440",
  quality: "\u041a\u0430\u0447\u0435\u0441\u0442\u0432\u043e",
  terrainHeight: "\u0412\u044b\u0441\u043e\u0442\u0430",
  terrainRelief: "\u0420\u0435\u043b\u044c\u0435\u0444",
  heightDelta: "\u041f\u0435\u0440\u0435\u043f\u0430\u0434",
  lineOfSight: "Line of Sight",
  visibleCheckpoints:
    "\u041f\u0440\u044f\u043c\u0430\u044f \u0432\u0438\u0434\u0438\u043c\u043e\u0441\u0442\u044c",
  blockedCheckpoints:
    "\u041f\u0435\u0440\u0435\u043a\u0440\u044b\u0442\u043e \u0440\u0435\u043b\u044c\u0435\u0444\u043e\u043c",
  nearest: "\u0411\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0439 \u041a\u041f\u041f",
  withinRadius: "\u0412 \u0440\u0430\u0434\u0438\u0443\u0441\u0435",
  source:
    "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a",
  notFound:
    "\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e",
  copied:
    "\u0421\u0441\u044b\u043b\u043a\u0430 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0430",
  share: "\u0421\u0441\u044b\u043b\u043a\u0430",
  ready: "\u0413\u043e\u0442\u043e\u0432\u043e",
  terrainReady: "\u0420\u0435\u043b\u044c\u0435\u0444",
  terrainFallback: "\u0420\u0435\u043b\u044c\u0435\u0444: fallback",
  buildingsReady: "3D-\u0437\u0434\u0430\u043d\u0438\u044f",
  buildingsUnavailable:
    "3D-\u0437\u0434\u0430\u043d\u0438\u044f: \u043d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430",
  viewshedLoading: "\u0421\u0447\u0438\u0442\u0430\u0435\u043c viewshed...",
  loadingGlobe:
    "\u0417\u0430\u043f\u0443\u0441\u043a\u0430\u0435\u043c Cesium-\u0433\u043b\u043e\u0431\u0443\u0441...",
  loadingPoints:
    "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0442\u043e\u0447\u043a\u0438 \u041a\u041f\u041f...",
  drawingPoints:
    "\u0420\u0438\u0441\u0443\u0435\u043c \u041a\u041f\u041f \u043d\u0430 \u0433\u043b\u043e\u0431\u0443\u0441\u0435...",
  loadError:
    "\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438",
  cesiumMissing:
    "CesiumJS runtime \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0441\u044f. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 vendor-\u0444\u0430\u0439\u043b\u044b."
};

const dom = {
  loader: document.getElementById("loader"),
  loaderProgress: document.getElementById("loaderProgress"),
  loaderText: document.getElementById("loaderText"),
  map: document.getElementById("map"),
  fallback: document.getElementById("mapFallback"),
  stats: document.getElementById("stats"),
  legend: document.getElementById("legend"),
  inspector: document.getElementById("checkpointInspector"),
  shell: document.querySelector(".globe-shell"),
  search: document.getElementById("checkpointSearch"),
  typeFilter: document.getElementById("typeFilter"),
  statusFilter: document.getElementById("statusFilter"),
  imageryMode: document.getElementById("imageryMode"),
  radiusSelect: document.getElementById("radiusSelect"),
  clusterToggle: document.getElementById("clusterToggle"),
  qualityToggle: document.getElementById("qualityToggle"),
  terrainToggle: document.getElementById("terrainToggle"),
  viewshedToggle: document.getElementById("viewshedToggle"),
  buildingsToggle: document.getElementById("buildingsToggle"),
  analysisStatus: document.getElementById("analysisStatus"),
  fitFiltered: document.getElementById("fitFiltered"),
  copyShare: document.getElementById("copyShare"),
  resetFilters: document.getElementById("resetFilters"),
  searchResults: document.getElementById("searchResults"),
  cameraDock: document.getElementById("cameraDock"),
  closeControls: document.getElementById("closeControls"),
  mobileBackdrop: document.getElementById("mobileBackdrop"),
  mobileToolbar: document.getElementById("mobileToolbar")
};

const state = {
  features: [],
  filteredFeatures: [],
  selectedFeature: null,
  query: "",
  type: "all",
  status: "all",
  colorMode: "type",
  visibilityAnalysis: null,
  visibilityToken: 0,
  terrainStatus: null,
  buildingsStatus: null,
  mobilePanel: null
};

let viewer = null;
let checkpointLayer = null;
let currentResults = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeSearch(value) {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("\u0451", "\u0435")
    .trim();
}

function featureSearchText(feature) {
  const props = feature.properties || {};
  return normalizeSearch(
    [
      props.__id,
      props.__name,
      props.__type,
      props.__status,
      props.__country,
      props.__subject,
      props.__address,
      props.__foreignCheckpoint,
      props.__corridor
    ].join(" ")
  );
}

function setProgress(percent, text) {
  if (dom.loaderProgress) dom.loaderProgress.style.width = `${percent}%`;
  if (dom.loaderText && text) dom.loaderText.textContent = text;
}

function hideLoader() {
  if (!dom.loader) return;

  dom.loader.classList.add("loader--hidden");
  setTimeout(() => dom.loader?.remove(), 260);
}

function isMobileLayout() {
  return globalThis.matchMedia?.("(max-width: 760px)").matches ?? false;
}

function syncMobilePanels() {
  const panel = isMobileLayout() ? state.mobilePanel : null;

  for (const name of ["controls", "regions", "legend"]) {
    dom.shell?.classList.toggle(`mobile-sheet--${name}`, panel === name);
  }

  dom.mobileToolbar?.querySelectorAll("[data-mobile-panel]").forEach((button) => {
    const active = button.dataset.mobilePanel === panel;
    button.classList.toggle("mobile-toolbar__button--active", active);
    button.setAttribute("aria-expanded", String(active));
  });

  if (dom.mobileBackdrop) {
    dom.mobileBackdrop.hidden = !isMobileLayout() || (!panel && !state.selectedFeature);
  }
}

function setMobilePanel(panel, { focusSearch = false } = {}) {
  state.mobilePanel = state.mobilePanel === panel ? null : panel;
  syncMobilePanels();

  if (state.mobilePanel === "controls" && focusSearch) {
    setTimeout(() => dom.search?.focus(), 180);
  }
}

function closeMobileOverlay() {
  if (state.selectedFeature) {
    checkpointLayer?.clearSelection();
    handleSelection(null);
    return;
  }

  state.mobilePanel = null;
  syncMobilePanels();
}

function showFallback(message) {
  if (!dom.fallback) return;

  dom.fallback.hidden = false;
  dom.fallback.querySelector("span").textContent = message;
}

function option(value, label, count) {
  const suffix = Number.isFinite(count) ? ` (${count})` : "";
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}${suffix}</option>`;
}

function populateControls(features) {
  const summary = buildDatasetSummary(features);
  const typeOptions = Object.entries(summary.typeCounts).sort(([left], [right]) =>
    left.localeCompare(right, "ru")
  );
  const statusOptions = Object.entries(summary.statusCounts).sort(([left], [right]) =>
    left.localeCompare(right, "ru")
  );

  dom.typeFilter.innerHTML = [
    option("all", TEXT.allTypes, features.length),
    ...typeOptions.map(([type, count]) => option(type, type, count))
  ].join("");

  dom.statusFilter.innerHTML = [
    option("all", TEXT.allStatuses, features.length),
    ...statusOptions.map(([status, count]) => option(status, status, count))
  ].join("");

  dom.imageryMode.innerHTML = IMAGERY_OPTIONS.map((item) => option(item.id, item.label)).join("");
  dom.imageryMode.value = DEFAULT_IMAGERY_MODE;
}

function renderStats(summary, total) {
  dom.stats.innerHTML = `
    <div class="stat"><span>${TEXT.shown}</span><b>${summary.total}</b></div>
    <div class="stat"><span>${TEXT.total}</span><b>${total}</b></div>
    <div class="stat"><span>${TEXT.countries}</span><b>${summary.countryCount}</b></div>
    <div class="stat"><span>${TEXT.types}</span><b>${Object.keys(summary.typeCounts).length}</b></div>
  `;
}

function renderLegend() {
  const summary = buildDatasetSummary(state.features);
  const isQuality = state.colorMode === "quality";
  const title = isQuality ? TEXT.qualityLegend : TEXT.typeLegend;
  const entries = isQuality
    ? Object.values(QUALITY_LEVELS).map((level) => ({
        id: level.id,
        label: level.label,
        color: level.color,
        count: summary.qualityCounts[level.id] || 0
      }))
    : Object.entries(TYPE_COLORS).map(([type, color]) => ({
        id: type,
        label: type,
        color,
        count: summary.typeCounts[type] || 0
      }));

  dom.legend.innerHTML = `
    <div class="sheet-header">
      <div>
        <span class="sheet-header__eyebrow">${TEXT.legendPanel}</span>
        <b>${title}</b>
      </div>
      <button class="sheet-header__close" type="button" data-close-sheet aria-label="${TEXT.closePanel}">\u00d7</button>
    </div>
    <div class="legend__title">${title}</div>
    <div class="legend__items">
      ${entries
        .map((entry) => {
          const isActive = !isQuality && state.type === entry.id;

          return `
            <button class="legend__item${isActive ? " legend__item--active" : ""}" type="button" data-type="${escapeHtml(entry.id)}" ${isQuality ? "disabled" : ""}>
              <span class="legend__dot" style="background:${entry.color}" aria-hidden="true"></span>
              <span class="legend__label">${escapeHtml(entry.label)}</span>
              <b>${entry.count}</b>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  dom.legend.querySelector("[data-close-sheet]")?.addEventListener("click", () => {
    state.mobilePanel = null;
    syncMobilePanels();
  });

  if (isQuality) return;

  dom.legend.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.type = state.type === button.dataset.type ? "all" : button.dataset.type;
      dom.typeFilter.value = state.type;
      applyFilters();
    });
  });
}

function detailRow(label, value) {
  if (!value) return "";

  return `
    <div class="inspector__row">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value)}</b>
    </div>
  `;
}

function radians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(featureA, featureB) {
  const a = featureA.geometry.coordinates;
  const b = featureB.geometry.coordinates;
  const earthRadiusKm = 6371.0088;
  const deltaLat = radians(b[1] - a[1]);
  const deltaLon = radians(b[0] - a[0]);
  const latA = radians(a[1]);
  const latB = radians(b[1]);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistance(value) {
  if (!Number.isFinite(value)) return "";
  if (value < 10) return `${value.toFixed(1)} \u043a\u043c`;

  return `${Math.round(value)} \u043a\u043c`;
}

function formatMeters(value, { signed = false } = {}) {
  if (!Number.isFinite(value)) return "";

  const rounded = Math.round(value);
  const prefix = signed && rounded > 0 ? "+" : "";
  return `${prefix}${rounded} \u043c`;
}

function analysisFor(feature) {
  if (!feature) {
    return {
      nearest: [],
      withinRadius: 0,
      radiusKm: Number(dom.radiusSelect.value)
    };
  }

  const radiusKm = Number(dom.radiusSelect.value);
  const distances = state.filteredFeatures
    .filter((item) => item.properties.__id !== feature.properties.__id)
    .map((item) => ({ feature: item, distance: distanceKm(feature, item) }))
    .sort((left, right) => left.distance - right.distance);

  return {
    nearest: distances.slice(0, 3),
    withinRadius: distances.filter((item) => item.distance <= radiusKm).length,
    radiusKm
  };
}

function visibilityFor(feature) {
  if (!feature) return null;
  if (state.visibilityAnalysis?.featureId !== feature.properties.__id) return null;
  return state.visibilityAnalysis.result || null;
}

function visibilityKey(feature, analysis) {
  const candidates = analysis.nearest
    .slice(0, 10)
    .map((item) => item.feature.properties.__id)
    .join(",");

  return [
    feature.properties.__id,
    analysis.radiusKm,
    viewer?.kppTerrainStatus?.mode || "ellipsoid",
    candidates
  ].join(":");
}

function renderAnalysisStatus() {
  if (!dom.analysisStatus) return;

  const items = [];
  if (state.terrainStatus) {
    items.push(state.terrainStatus.enabled ? TEXT.terrainReady : TEXT.terrainFallback);
  }

  if (state.buildingsStatus && dom.buildingsToggle.checked) {
    items.push(state.buildingsStatus.enabled ? TEXT.buildingsReady : TEXT.buildingsUnavailable);
  }

  if (state.visibilityAnalysis?.loading) items.push(TEXT.viewshedLoading);

  dom.analysisStatus.hidden = !items.length;
  dom.analysisStatus.innerHTML = items.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function queueVisibilityAnalysis(feature, analysis) {
  if (!viewer || !feature || !dom.viewshedToggle.checked) return;

  const targets = analysis.nearest.slice(0, 10).map((item) => item.feature);
  const key = visibilityKey(feature, analysis);

  if (state.visibilityAnalysis?.key === key) return;

  const token = state.visibilityToken + 1;
  state.visibilityToken = token;
  state.visibilityAnalysis = {
    key,
    featureId: feature.properties.__id,
    loading: true,
    result: null
  };
  renderAnalysisStatus();

  analyzeVisibility(viewer, feature, targets, {
    radiusKm: analysis.radiusKm,
    rayCount: isMobileLayout() ? 36 : 48,
    sampleCount: isMobileLayout() ? 24 : 32,
    observerHeightMeters: 8,
    targetHeightMeters: 4
  })
    .then((result) => {
      if (state.visibilityToken !== token) return;
      if (state.selectedFeature?.properties.__id !== feature.properties.__id) return;

      state.visibilityAnalysis = {
        key,
        featureId: feature.properties.__id,
        loading: false,
        result
      };
      checkpointLayer?.setAnalysis({
        feature,
        nearestFeature: analysis.nearest[0]?.feature,
        radiusKm: analysis.radiusKm,
        visibility: result
      });
      renderInspector(feature);
      renderAnalysisStatus();
    })
    .catch((error) => {
      console.error(error);
      if (state.visibilityToken !== token) return;
      state.visibilityAnalysis = {
        key,
        featureId: feature.properties.__id,
        loading: false,
        result: null
      };
      renderAnalysisStatus();
    });
}

function updateSelectedAnalysis() {
  const analysis = analysisFor(state.selectedFeature);
  const visibility = visibilityFor(state.selectedFeature);
  checkpointLayer?.setAnalysis({
    feature: state.selectedFeature,
    nearestFeature: analysis.nearest[0]?.feature,
    radiusKm: analysis.radiusKm,
    visibility
  });
  if (state.selectedFeature) queueVisibilityAnalysis(state.selectedFeature, analysis);
  return analysis;
}

function renderInspector(feature) {
  dom.shell?.classList.toggle("globe-shell--inspecting", Boolean(feature));
  if (feature) state.mobilePanel = null;
  syncMobilePanels();

  if (!feature) {
    dom.inspector.hidden = true;
    dom.inspector.innerHTML = "";
    return;
  }

  const props = feature.properties || {};
  const sourceUrl = safeUrl(props.__source);
  const coords = formatCoordinates(feature.geometry?.coordinates);
  const analysis = updateSelectedAnalysis();
  const nearest = analysis.nearest[0];
  const visibility = visibilityFor(feature);
  const nearestVisibility = nearest
    ? visibility?.targets?.find((target) => target.featureId === nearest.feature.properties.__id)
    : null;
  const visibleCount = visibility?.targets?.filter((target) => target.visible).length;
  const blockedCount = visibility?.targets?.filter((target) => !target.visible).length;
  const heightDelta =
    nearestVisibility && Number.isFinite(nearestVisibility.targetHeightMeters)
      ? nearestVisibility.targetHeightMeters - visibility.originHeightMeters
      : null;

  dom.inspector.hidden = false;
  dom.inspector.innerHTML = `
    <article class="inspector__card">
      <button class="inspector__close" type="button" aria-label="${TEXT.closeCard}">\u00d7</button>
      <div class="inspector__eyebrow">${TEXT.checkpoint}</div>
      <h2>${escapeHtml(props.__name)}</h2>
      <div class="inspector__chips">
        <span>${escapeHtml(props.__type)}</span>
        <span>${escapeHtml(props.__status)}</span>
        <span>${escapeHtml(props.__quality.label)}</span>
      </div>
      <div class="inspector__grid">
        ${detailRow("ID", props.__id)}
        ${detailRow(TEXT.country, props.__country)}
        ${detailRow(TEXT.subject, props.__subject)}
        ${detailRow(TEXT.coordinates, coords)}
        ${detailRow(TEXT.address, props.__address)}
        ${detailRow(TEXT.workingTime, props.__workingTime)}
        ${detailRow(TEXT.foreignCheckpoint, props.__foreignCheckpoint)}
        ${detailRow(TEXT.corridor, props.__corridor)}
        ${detailRow(TEXT.quality, `${props.__quality.label}: ${props.__quality.reason}`)}
        ${visibility ? detailRow(TEXT.terrainHeight, formatMeters(visibility.originHeightMeters)) : ""}
        ${visibility ? detailRow(TEXT.terrainRelief, formatMeters(visibility.reliefMeters)) : ""}
        ${Number.isFinite(heightDelta) ? detailRow(TEXT.heightDelta, formatMeters(heightDelta, { signed: true })) : ""}
        ${
          visibility
            ? detailRow(TEXT.visibleCheckpoints, `${visibleCount}/${visibility.targets.length}`)
            : state.visibilityAnalysis?.loading
              ? detailRow(TEXT.lineOfSight, TEXT.viewshedLoading)
              : ""
        }
        ${visibility ? detailRow(TEXT.blockedCheckpoints, String(blockedCount)) : ""}
        ${nearest ? detailRow(TEXT.nearest, `${nearest.feature.properties.__name} \u00b7 ${formatDistance(nearest.distance)}`) : ""}
        ${detailRow(`${TEXT.withinRadius} ${analysis.radiusKm} \u043a\u043c`, String(analysis.withinRadius))}
      </div>
      ${
        sourceUrl
          ? `<a class="inspector__source" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${TEXT.source}</a>`
          : ""
      }
    </article>
  `;

  dom.inspector.querySelector(".inspector__close")?.addEventListener("click", () => {
    checkpointLayer?.clearSelection();
    handleSelection(null);
  });
}

function handleSelection(feature) {
  state.selectedFeature = feature;
  if (!feature) {
    state.visibilityToken += 1;
    state.visibilityAnalysis = null;
    renderAnalysisStatus();
  }
  renderInspector(feature);
  syncMobilePanels();
}

function renderResults(features) {
  const shouldShow = state.query.length >= 2;
  currentResults = shouldShow ? features.slice(0, 8) : [];

  if (!shouldShow) {
    dom.searchResults.hidden = true;
    dom.searchResults.innerHTML = "";
    return;
  }

  dom.searchResults.hidden = false;

  if (!currentResults.length) {
    dom.searchResults.innerHTML = `<div class="search-results__empty">${TEXT.notFound}</div>`;
    return;
  }

  dom.searchResults.innerHTML = currentResults
    .map((feature, index) => {
      const props = feature.properties || {};

      return `
        <button class="search-result" type="button" data-result="${index}">
          <b>${escapeHtml(props.__name)}</b>
          <span>${escapeHtml([props.__type, props.__country, props.__subject].filter(Boolean).join(" \u00b7 "))}</span>
        </button>
      `;
    })
    .join("");

  dom.searchResults.querySelectorAll("[data-result]").forEach((button) => {
    button.addEventListener("click", () => {
      const feature = currentResults[Number(button.dataset.result)];
      if (!feature) return;

      checkpointLayer?.selectFeature(feature);
      dom.searchResults.hidden = true;
      dom.searchResults.innerHTML = "";
    });
  });
}

function renderCameraDock() {
  dom.cameraDock.innerHTML = `
    <div class="sheet-header">
      <div>
        <span class="sheet-header__eyebrow">Camera</span>
        <b>${TEXT.regionsPanel}</b>
      </div>
      <button class="sheet-header__close" type="button" data-close-sheet aria-label="${TEXT.closePanel}">\u00d7</button>
    </div>
    <div class="camera-dock__items">
      ${CAMERA_PRESETS.map(
        (preset) => `
          <button class="camera-dock__button" type="button" data-camera="${escapeHtml(preset.id)}">
            ${escapeHtml(preset.label)}
          </button>
        `
      ).join("")}
    </div>
  `;

  dom.cameraDock.querySelector("[data-close-sheet]")?.addEventListener("click", () => {
    state.mobilePanel = null;
    syncMobilePanels();
  });

  dom.cameraDock.querySelectorAll("[data-camera]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = CAMERA_PRESETS.find((item) => item.id === button.dataset.camera);
      if (!preset) return;

      dom.cameraDock
        .querySelectorAll(".camera-dock__button--active")
        .forEach((activeButton) => activeButton.classList.remove("camera-dock__button--active"));
      button.classList.add("camera-dock__button--active");
      flyToCameraPreset(viewer, preset);
      if (isMobileLayout()) {
        state.mobilePanel = null;
        syncMobilePanels();
      }
    });
  });

  dom.cameraDock
    .querySelector('[data-camera="overview"]')
    ?.classList.add("camera-dock__button--active");
}

function matchesFilters(feature) {
  const props = feature.properties || {};
  const query = state.query;

  if (state.type !== "all" && props.__type !== state.type) return false;
  if (state.status !== "all" && props.__status !== state.status) return false;
  if (query && !featureSearchText(feature).includes(query)) return false;

  return true;
}

async function updateTerrainMode() {
  if (!viewer) return;

  state.terrainStatus = await setTerrainEnabled(viewer, dom.terrainToggle.checked);
  state.visibilityToken += 1;
  state.visibilityAnalysis = null;
  if (state.selectedFeature) renderInspector(state.selectedFeature);
  renderAnalysisStatus();
}

async function updateBuildingsMode() {
  if (!viewer) return;

  state.buildingsStatus = await setBuildingsEnabled(viewer, dom.buildingsToggle.checked);
  renderAnalysisStatus();
}

function applyFilters({ fit = false } = {}) {
  state.query = normalizeSearch(dom.search.value);
  state.type = dom.typeFilter.value || "all";
  state.status = dom.statusFilter.value || "all";
  state.filteredFeatures = state.features.filter(matchesFilters);

  const selectedStillVisible =
    !state.selectedFeature ||
    state.filteredFeatures.some(
      (feature) => feature.properties.__id === state.selectedFeature.properties.__id
    );

  if (!selectedStillVisible) {
    checkpointLayer?.clearSelection();
    handleSelection(null);
  }

  const summary = buildDatasetSummary(state.filteredFeatures);
  checkpointLayer?.setVisibleFeatures(state.filteredFeatures);
  renderStats(summary, state.features.length);
  renderLegend();
  renderResults(state.filteredFeatures);
  if (state.selectedFeature) renderInspector(state.selectedFeature);

  if (fit) checkpointLayer?.flyToFeatures(state.filteredFeatures);
}

function resetFilters() {
  dom.search.value = "";
  dom.typeFilter.value = "all";
  dom.statusFilter.value = "all";
  dom.qualityToggle.checked = false;
  dom.terrainToggle.checked = true;
  dom.viewshedToggle.checked = true;
  dom.buildingsToggle.checked = false;
  state.colorMode = "type";
  state.visibilityToken += 1;
  state.visibilityAnalysis = null;
  checkpointLayer?.setColorMode("type");
  checkpointLayer?.clearSelection();
  handleSelection(null);
  applyFilters();
  checkpointLayer?.flyHome();
  updateTerrainMode().catch((error) => console.error(error));
  updateBuildingsMode().catch((error) => console.error(error));
}

function shareUrl() {
  const url = new URL(globalThis.location.href);
  url.searchParams.set("q", dom.search.value.trim());
  url.searchParams.set("type", state.type);
  url.searchParams.set("status", state.status);
  url.searchParams.set("imagery", dom.imageryMode.value);
  url.searchParams.set("radius", dom.radiusSelect.value);
  if (dom.qualityToggle.checked) url.searchParams.set("quality", "1");
  else url.searchParams.delete("quality");
  if (!dom.terrainToggle.checked) url.searchParams.set("terrain", "0");
  else url.searchParams.delete("terrain");
  if (!dom.viewshedToggle.checked) url.searchParams.set("viewshed", "0");
  else url.searchParams.delete("viewshed");
  if (dom.buildingsToggle.checked) url.searchParams.set("buildings", "1");
  else url.searchParams.delete("buildings");
  if (state.selectedFeature) {
    url.searchParams.set("checkpoint", state.selectedFeature.properties.__id);
  } else {
    url.searchParams.delete("checkpoint");
  }

  for (const key of [...url.searchParams.keys()]) {
    if (["", "all", DEFAULT_IMAGERY_MODE, "100"].includes(url.searchParams.get(key))) {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}

async function copyShareLink() {
  const value = shareUrl();

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
  } else {
    globalThis.prompt("Share URL", value);
  }

  const previous = dom.copyShare.textContent;
  dom.copyShare.textContent = TEXT.copied;
  setTimeout(() => {
    dom.copyShare.textContent = previous || TEXT.share;
  }, 1200);
}

function readUrlState() {
  const params = new URLSearchParams(globalThis.location.search);
  return {
    q: params.get("q") || "",
    type: params.get("type") || "all",
    status: params.get("status") || "all",
    imagery: params.get("imagery") || DEFAULT_IMAGERY_MODE,
    radius: params.get("radius") || "100",
    quality: params.get("quality") === "1",
    terrain: params.get("terrain") !== "0",
    viewshed: params.get("viewshed") !== "0",
    buildings: params.get("buildings") === "1",
    checkpoint: params.get("checkpoint") || ""
  };
}

function applyUrlState() {
  const urlState = readUrlState();
  dom.search.value = urlState.q;
  if ([...dom.typeFilter.options].some((optionItem) => optionItem.value === urlState.type)) {
    dom.typeFilter.value = urlState.type;
  }
  if ([...dom.statusFilter.options].some((optionItem) => optionItem.value === urlState.status)) {
    dom.statusFilter.value = urlState.status;
  }
  if (IMAGERY_OPTIONS.some((item) => item.id === urlState.imagery)) {
    dom.imageryMode.value = urlState.imagery;
    setImageryMode(viewer, urlState.imagery);
  }
  if ([...dom.radiusSelect.options].some((optionItem) => optionItem.value === urlState.radius)) {
    dom.radiusSelect.value = urlState.radius;
  }
  dom.qualityToggle.checked = urlState.quality;
  dom.terrainToggle.checked = urlState.terrain;
  dom.viewshedToggle.checked = urlState.viewshed;
  dom.buildingsToggle.checked = urlState.buildings;
  state.colorMode = urlState.quality ? "quality" : "type";
  checkpointLayer?.setColorMode(state.colorMode);

  applyFilters();
  updateTerrainMode().catch((error) => console.error(error));
  updateBuildingsMode().catch((error) => console.error(error));

  const selected = state.features.find(
    (feature) => feature.properties.__id === urlState.checkpoint
  );
  if (selected) checkpointLayer?.selectFeature(selected);
}

function bindControls() {
  dom.search.addEventListener("input", () => applyFilters());
  dom.search.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && currentResults[0]) {
      event.preventDefault();
      checkpointLayer?.selectFeature(currentResults[0]);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      dom.search.value = "";
      applyFilters();
    }
  });

  dom.typeFilter.addEventListener("change", () => applyFilters());
  dom.statusFilter.addEventListener("change", () => applyFilters());
  dom.imageryMode.addEventListener("change", () => setImageryMode(viewer, dom.imageryMode.value));
  dom.radiusSelect.addEventListener("change", () => {
    state.visibilityToken += 1;
    state.visibilityAnalysis = null;
    if (state.selectedFeature) renderInspector(state.selectedFeature);
  });
  dom.fitFiltered.addEventListener("click", () =>
    checkpointLayer?.flyToFeatures(state.filteredFeatures)
  );
  dom.copyShare.addEventListener("click", () => {
    copyShareLink().catch((error) => console.error(error));
  });
  dom.resetFilters.addEventListener("click", resetFilters);
  dom.clusterToggle.addEventListener("change", () => {
    checkpointLayer?.setClustered(dom.clusterToggle.checked);
  });
  dom.qualityToggle.addEventListener("change", () => {
    state.colorMode = dom.qualityToggle.checked ? "quality" : "type";
    checkpointLayer?.setColorMode(state.colorMode);
    renderLegend();
  });
  dom.terrainToggle.addEventListener("change", () => {
    updateTerrainMode().catch((error) => console.error(error));
  });
  dom.viewshedToggle.addEventListener("change", () => {
    state.visibilityToken += 1;
    state.visibilityAnalysis = null;
    if (state.selectedFeature) renderInspector(state.selectedFeature);
    renderAnalysisStatus();
  });
  dom.buildingsToggle.addEventListener("change", () => {
    updateBuildingsMode().catch((error) => console.error(error));
  });
  dom.closeControls.addEventListener("click", () => {
    state.mobilePanel = null;
    syncMobilePanels();
  });
  dom.mobileToolbar.querySelectorAll("[data-mobile-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      setMobilePanel(button.dataset.mobilePanel, {
        focusSearch: button.dataset.mobilePanel === "controls"
      });
    });
  });
  dom.mobileBackdrop.addEventListener("click", closeMobileOverlay);
  globalThis.matchMedia?.("(max-width: 760px)").addEventListener("change", () => {
    if (!isMobileLayout()) state.mobilePanel = null;
    syncMobilePanels();
  });
}

async function init() {
  try {
    if (!globalThis.Cesium?.Viewer) {
      showFallback(TEXT.cesiumMissing);
      hideLoader();
      return;
    }

    setProgress(15, TEXT.loadingGlobe);
    viewer = createGlobe({ container: dom.map });
    viewer.kppTerrainPromise
      ?.then((status) => {
        state.terrainStatus = status;
        state.visibilityToken += 1;
        state.visibilityAnalysis = null;
        if (state.selectedFeature) renderInspector(state.selectedFeature);
        renderAnalysisStatus();
      })
      .catch((error) => console.error(error));

    setProgress(45, TEXT.loadingPoints);
    state.features = await loadCheckpoints({ onProgress: setProgress });
    state.filteredFeatures = state.features;

    setProgress(75, TEXT.drawingPoints);
    checkpointLayer = createCheckpointLayer({
      viewer,
      features: state.features,
      onSelect: handleSelection
    });

    populateControls(state.features);
    renderCameraDock();
    bindControls();
    syncMobilePanels();
    applyUrlState();
    setProgress(100, TEXT.ready);
    hideLoader();

    try {
      globalThis.__KPP_GLOBE_READY__?.({
        viewer,
        features: state.features,
        checkpointLayer,
        applyFilters,
        copyShareLink,
        updateBuildingsMode,
        updateTerrainMode,
        state
      });
    } catch (error) {
      console.error(error);
    }
  } catch (error) {
    console.error(error);
    showFallback(String(error?.message || error));
    setProgress(100, TEXT.loadError);
  }
}

init();
