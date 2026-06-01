import { CAMERA_PRESETS, TYPE_COLORS } from "./js/config.js";
import { buildDatasetSummary, formatCoordinates, loadCheckpoints } from "./js/checkpoints.js";
import { createCheckpointLayer, createGlobe, flyToCameraPreset } from "./js/cesiumGlobe.js";

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
  clusterToggle: document.getElementById("clusterToggle"),
  fitFiltered: document.getElementById("fitFiltered"),
  resetFilters: document.getElementById("resetFilters"),
  searchResults: document.getElementById("searchResults"),
  cameraDock: document.getElementById("cameraDock")
};

const state = {
  features: [],
  filteredFeatures: [],
  query: "",
  type: "all",
  status: "all"
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
    .replaceAll("ё", "е")
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
      props.__address
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

function showFallback(message) {
  if (!dom.fallback) return;

  dom.fallback.hidden = false;
  dom.fallback.querySelector("span").textContent = message;
}

function option(value, label, count) {
  const suffix = Number.isFinite(count) ? ` (${count})` : "";
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}${suffix}</option>`;
}

function populateFilters(features) {
  const summary = buildDatasetSummary(features);
  const typeOptions = Object.entries(summary.typeCounts).sort(([left], [right]) =>
    left.localeCompare(right, "ru")
  );
  const statusOptions = Object.entries(summary.statusCounts).sort(([left], [right]) =>
    left.localeCompare(right, "ru")
  );

  dom.typeFilter.innerHTML = [
    option("all", "Все типы", features.length),
    ...typeOptions.map(([type, count]) => option(type, type, count))
  ].join("");

  dom.statusFilter.innerHTML = [
    option("all", "Все статусы", features.length),
    ...statusOptions.map(([status, count]) => option(status, status, count))
  ].join("");
}

function renderStats(summary, total) {
  dom.stats.innerHTML = `
    <div class="stat">
      <span>Показано</span>
      <b>${summary.total}</b>
    </div>
    <div class="stat">
      <span>Всего</span>
      <b>${total}</b>
    </div>
    <div class="stat">
      <span>Стран</span>
      <b>${summary.countryCount}</b>
    </div>
    <div class="stat">
      <span>Типов</span>
      <b>${Object.keys(summary.typeCounts).length}</b>
    </div>
  `;
}

function renderLegend() {
  const summary = buildDatasetSummary(state.features);

  dom.legend.innerHTML = `
    <div class="legend__title">Типы КПП</div>
    <div class="legend__items">
      ${Object.entries(TYPE_COLORS)
        .map(([type, color]) => {
          const isActive = state.type === type;
          const count = summary.typeCounts[type] || 0;

          return `
            <button class="legend__item${isActive ? " legend__item--active" : ""}" type="button" data-type="${escapeHtml(type)}">
              <span class="legend__dot" style="background:${color}" aria-hidden="true"></span>
              <span class="legend__label">${escapeHtml(type)}</span>
              <b>${count}</b>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

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

function renderInspector(feature) {
  dom.shell?.classList.toggle("globe-shell--inspecting", Boolean(feature));

  if (!feature) {
    dom.inspector.hidden = true;
    dom.inspector.innerHTML = "";
    return;
  }

  const props = feature.properties || {};
  const sourceUrl = safeUrl(props.__source);
  const coords = formatCoordinates(feature.geometry?.coordinates);

  dom.inspector.hidden = false;
  dom.inspector.innerHTML = `
    <article class="inspector__card">
      <button class="inspector__close" type="button" aria-label="Закрыть карточку">×</button>
      <div class="inspector__eyebrow">Пункт пропуска</div>
      <h2>${escapeHtml(props.__name)}</h2>
      <div class="inspector__chips">
        <span>${escapeHtml(props.__type)}</span>
        <span>${escapeHtml(props.__status)}</span>
      </div>
      <div class="inspector__grid">
        ${detailRow("ID", props.__id)}
        ${detailRow("Сопредельная страна", props.__country)}
        ${detailRow("Субъект РФ", props.__subject)}
        ${detailRow("Координаты", coords)}
        ${detailRow("Адрес", props.__address)}
        ${detailRow("Режим работы", props.__workingTime)}
      </div>
      ${
        sourceUrl
          ? `<a class="inspector__source" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Открыть источник</a>`
          : ""
      }
    </article>
  `;

  dom.inspector.querySelector(".inspector__close")?.addEventListener("click", () => {
    checkpointLayer?.clearSelection();
    renderInspector(null);
  });
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
    dom.searchResults.innerHTML = `<div class="search-results__empty">Ничего не найдено</div>`;
    return;
  }

  dom.searchResults.innerHTML = currentResults
    .map((feature, index) => {
      const props = feature.properties || {};

      return `
        <button class="search-result" type="button" data-result="${index}">
          <b>${escapeHtml(props.__name)}</b>
          <span>${escapeHtml([props.__type, props.__country, props.__subject].filter(Boolean).join(" · "))}</span>
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
  dom.cameraDock.innerHTML = CAMERA_PRESETS.map(
    (preset) => `
      <button class="camera-dock__button" type="button" data-camera="${escapeHtml(preset.id)}">
        ${escapeHtml(preset.label)}
      </button>
    `
  ).join("");

  dom.cameraDock.querySelectorAll("[data-camera]").forEach((button) => {
    button.addEventListener("click", () => {
      dom.cameraDock
        .querySelectorAll(".camera-dock__button--active")
        .forEach((activeButton) => activeButton.classList.remove("camera-dock__button--active"));
      button.classList.add("camera-dock__button--active");
      flyToCameraPreset(viewer, button.dataset.camera);
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

function applyFilters({ fit = false } = {}) {
  state.query = normalizeSearch(dom.search.value);
  state.type = dom.typeFilter.value || "all";
  state.status = dom.statusFilter.value || "all";
  state.filteredFeatures = state.features.filter(matchesFilters);

  const summary = buildDatasetSummary(state.filteredFeatures);
  checkpointLayer?.setVisibleFeatures(state.filteredFeatures);
  renderStats(summary, state.features.length);
  renderLegend();
  renderResults(state.filteredFeatures);

  if (fit) checkpointLayer?.flyToFeatures(state.filteredFeatures);
}

function resetFilters() {
  dom.search.value = "";
  dom.typeFilter.value = "all";
  dom.statusFilter.value = "all";
  checkpointLayer?.clearSelection();
  renderInspector(null);
  applyFilters();
  checkpointLayer?.flyHome();
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
  dom.fitFiltered.addEventListener("click", () =>
    checkpointLayer?.flyToFeatures(state.filteredFeatures)
  );
  dom.resetFilters.addEventListener("click", resetFilters);
  dom.clusterToggle.addEventListener("change", () => {
    checkpointLayer?.setClustered(dom.clusterToggle.checked);
  });
}

async function init() {
  try {
    if (!globalThis.Cesium?.Viewer) {
      showFallback("CesiumJS runtime не загрузился. Проверьте локальные vendor-файлы.");
      hideLoader();
      return;
    }

    setProgress(15, "Запускаем Cesium-глобус...");
    viewer = createGlobe({ container: dom.map });

    setProgress(45, "Загружаем точки КПП...");
    state.features = await loadCheckpoints({ onProgress: setProgress });
    state.filteredFeatures = state.features;

    setProgress(75, "Рисуем КПП на глобусе...");
    checkpointLayer = createCheckpointLayer({
      viewer,
      features: state.features,
      onSelect: renderInspector
    });

    populateFilters(state.features);
    renderStats(buildDatasetSummary(state.features), state.features.length);
    renderLegend();
    renderCameraDock();
    bindControls();
    setProgress(100, "Готово");

    globalThis.__KPP_GLOBE_READY__?.({
      viewer,
      features: state.features,
      checkpointLayer,
      applyFilters,
      state
    });
    hideLoader();
  } catch (error) {
    console.error(error);
    showFallback(String(error?.message || error));
    setProgress(100, "Ошибка загрузки");
  }
}

init();
