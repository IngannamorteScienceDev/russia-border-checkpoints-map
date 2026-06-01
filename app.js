import { TYPE_COLORS } from "./js/config.js";
import { buildDatasetSummary, formatCoordinates, loadCheckpoints } from "./js/checkpoints.js";
import { createCheckpointLayer, createGlobe } from "./js/cesiumGlobe.js";

const dom = {
  loader: document.getElementById("loader"),
  loaderProgress: document.getElementById("loaderProgress"),
  loaderText: document.getElementById("loaderText"),
  map: document.getElementById("map"),
  fallback: document.getElementById("mapFallback"),
  stats: document.getElementById("stats"),
  legend: document.getElementById("legend"),
  inspector: document.getElementById("checkpointInspector")
};

let checkpointLayer = null;

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

function renderStats(summary) {
  dom.stats.innerHTML = `
    <div class="stat">
      <span>КПП</span>
      <b>${summary.total}</b>
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
  dom.legend.innerHTML = `
    <div class="legend__title">Типы КПП</div>
    <div class="legend__items">
      ${Object.entries(TYPE_COLORS)
        .map(
          ([type, color]) => `
            <div class="legend__item">
              <span style="background:${color}" aria-hidden="true"></span>
              ${escapeHtml(type)}
            </div>
          `
        )
        .join("")}
    </div>
  `;
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

async function init() {
  try {
    if (!globalThis.Cesium?.Viewer) {
      showFallback("CesiumJS runtime не загрузился. Проверьте локальные vendor-файлы.");
      hideLoader();
      return;
    }

    setProgress(15, "Запускаем Cesium-глобус...");
    const viewer = createGlobe({ container: dom.map });

    setProgress(45, "Загружаем точки КПП...");
    const features = await loadCheckpoints({ onProgress: setProgress });
    const summary = buildDatasetSummary(features);

    setProgress(75, "Рисуем КПП на глобусе...");
    checkpointLayer = createCheckpointLayer({
      viewer,
      features,
      onSelect: renderInspector
    });

    renderStats(summary);
    renderLegend();
    setProgress(100, "Готово");

    globalThis.__KPP_GLOBE_READY__?.({ viewer, features, checkpointLayer });
    hideLoader();
  } catch (error) {
    console.error(error);
    showFallback(String(error?.message || error));
    setProgress(100, "Ошибка загрузки");
  }
}

init();
