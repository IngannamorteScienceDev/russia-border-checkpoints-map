const STYLE_MAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const STYLE_SAT = {
  version: 8,
  sources: {
    sat: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics"
    }
  },
  layers: [{ id: "sat-base", type: "raster", source: "sat" }]
};

const TYPE_COLORS = {
  Автомобильный: "#3b82f6",
  Железнодорожный: "#22c55e",
  Воздушный: "#a855f7",
  Морской: "#0ea5e9",
  Речной: "#14b8a6",
  Пешеходный: "#f97316",
  Другое: "#64748b"
};

const searchEl = document.getElementById("searchInput");
const typeEl = document.getElementById("typeFilter");
const statusEl = document.getElementById("statusFilter");
const legendEl = document.getElementById("legend");
const statsEl = document.getElementById("stats");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("emptyState");

const loaderEl = document.getElementById("loader");
const loaderTextEl = document.getElementById("loaderText");
const loaderProgressEl = document.getElementById("loaderProgress");

const geoBtn = document.getElementById("geoBtn");
const styleToggle = document.getElementById("styleToggle");
const mobileToggle = document.getElementById("mobileToggle");
const panel = document.getElementById("panel");
const clearSelectionBtn = document.getElementById("clearSelection");

let allFeatures = [];
let viewFeatures = [];
let selectedId = null;

let userLocation = null;
let userMarker = null;
let popupRef = null;

let currentStyle = "map";
let debounceTimer = null;

const map = new maplibregl.Map({
  container: "map",
  style: STYLE_MAP,
  center: [90, 61],
  zoom: 4,
  antialias: true
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

/* ===================== UTILS ===================== */

function setProgress(pct, text) {
  if (loaderProgressEl) loaderProgressEl.style.width = `${pct}%`;
  if (loaderTextEl && text) loaderTextEl.textContent = text;
}

function hideLoader() {
  if (!loaderEl) return;
  loaderEl.style.opacity = "0";
  setTimeout(() => loaderEl.remove(), 250);
}

function normalizeType(raw) {
  const v = String(raw || "").toLowerCase();
  if (v.includes("авто")) return "Автомобильный";
  if (v.includes("желез")) return "Железнодорожный";
  if (v.includes("воздуш")) return "Воздушный";
  if (v.includes("морск")) return "Морской";
  if (v.includes("речн")) return "Речной";
  if (v.includes("пеш")) return "Пешеходный";
  return "Другое";
}

function normalizeStatus(raw) {
  const v = String(raw || "").toLowerCase();
  if (v.includes("действ")) return "Действует";
  if (v.includes("огран")) return "Ограничен";
  if (v.includes("врем")) return "Временно закрыт";
  if (v.includes("закры")) return "Закрыт";
  return "Неизвестно";
}

function haversine(a, b) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function buildRouteUrl(from, to) {
  return `https://yandex.ru/maps/?rtext=${from[1]},${from[0]}~${to[1]},${to[0]}&rtt=auto`;
}

function osmStaticPreview([lng, lat]) {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=8&size=320x180&markers=${lat},${lng},lightblue1`;
}

function getDataUrl() {
  return new URL("data/checkpoints.geojson", window.location.href).toString();
}

/* ===================== DATA ===================== */

async function loadData() {
  setProgress(20, "Загружаем данные КПП…");
  const resp = await fetch(getDataUrl(), { cache: "no-store" });
  const data = await resp.json();

  allFeatures = (data.features || [])
    .filter(f => f && f.geometry && f.geometry.type === "Point")
    .map(f => ({
      ...f,
      properties: {
        ...f.properties,
        __id: String(f.properties.checkpoint_id || ""),
        __name: f.properties.checkpoint_name || "Без названия",
        __type: normalizeType(f.properties.checkpoint_type),
        __status: normalizeStatus(f.properties.current_status),
        __subject: f.properties.subject_name || "—",
        __country: f.properties.neighbor_country || "Не указано"
      }
    }));

  viewFeatures = allFeatures;
}

/* ===================== UI BUILD ===================== */

function buildLegend() {
  legendEl.innerHTML = `
    <div class="legend-title">Тип КПП</div>
    <div class="legend-grid">
      ${Object.entries(TYPE_COLORS).map(
        ([k, c]) =>
          `<div class="legend-item"><span class="dot" style="background:${c}"></span>${k}</div>`
      ).join("")}
    </div>
  `;
}

function fillFilters() {
  const types = [...new Set(allFeatures.map(f => f.properties.__type))].sort();
  const statuses = [...new Set(allFeatures.map(f => f.properties.__status))].sort();

  typeEl.innerHTML =
    `<option value="all">Все типы</option>` +
    types.map(t => `<option value="${t}">${t}</option>`).join("");

  statusEl.innerHTML =
    `<option value="all">Все статусы</option>` +
    statuses.map(s => `<option value="${s}">${s}</option>`).join("");
}

function renderStats() {
  statsEl.innerHTML = `Всего: <b>${allFeatures.length}</b><br>Показано: <b>${viewFeatures.length}</b>`;
}

function applyFilters() {
  const q = (searchEl.value || "").toLowerCase().trim();
  const t = typeEl.value;
  const s = statusEl.value;

  viewFeatures = allFeatures.filter(f => {
    if (t !== "all" && f.properties.__type !== t) return false;
    if (s !== "all" && f.properties.__status !== s) return false;
    if (!q) return true;

    return (
      f.properties.__name.toLowerCase().includes(q) ||
      f.properties.__subject.toLowerCase().includes(q) ||
      f.properties.__country.toLowerCase().includes(q)
    );
  });

  updateSource();
  renderStats();
  renderListGrouped();
  emptyEl.style.display = viewFeatures.length ? "none" : "block";
}

function renderListGrouped() {
  const groups = new Map();

  for (const f of viewFeatures) {
    const c = f.properties.__country;
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(f);
  }

  const sorted = [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "ru")
  );

  listEl.innerHTML = sorted.map(([country, items]) => {
    const html = items
      .sort((x, y) => x.properties.__name.localeCompare(y.properties.__name, "ru"))
      .map(f => {
        const dist = userLocation
          ? ` • 📏 ${haversine(userLocation, f.geometry.coordinates).toFixed(1)} км`
          : "";
        const active = f.properties.__id === selectedId ? "active" : "";
        return `
          <div class="item ${active}" data-id="${f.properties.__id}">
            <div>${f.properties.__name}</div>
            <small>${f.properties.__subject} • ${country}<br>${f.properties.__type} • ${f.properties.__status}${dist}</small>
          </div>
        `;
      }).join("");

    return `<div class="group">🌍 ${country} (${items.length})</div>${html}`;
  }).join("");

  listEl.querySelectorAll(".item").forEach(el => {
    el.onclick = () => focusFeature(el.dataset.id);
  });
}

/* ===================== MAP ===================== */

function updateSource() {
  const src = map.getSource("checkpoints");
  if (src) src.setData({ type: "FeatureCollection", features: viewFeatures });
}

function ensureSourcesAndLayers() {
  if (map.getSource("checkpoints")) return;

  map.addSource("checkpoints", {
    type: "geojson",
    data: { type: "FeatureCollection", features: viewFeatures },
    cluster: true,
    clusterRadius: 48
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "checkpoints",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#3b82f6",
      "circle-radius": 18
    }
  });

  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "checkpoints",
    filter: ["has", "point_count"],
    layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
    paint: { "text-color": "#e5e7eb" }
  });

  map.addLayer({
    id: "points",
    type: "circle",
    source: "checkpoints",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": 6,
      "circle-color": [
        "match",
        ["get", "__type"],
        "Автомобильный", TYPE_COLORS.Автомобильный,
        "Железнодорожный", TYPE_COLORS.Железнодорожный,
        "Воздушный", TYPE_COLORS.Воздушный,
        "Морской", TYPE_COLORS.Морской,
        "Речной", TYPE_COLORS.Речной,
        "Пешеходный", TYPE_COLORS.Пешеходный,
        TYPE_COLORS.Другое
      ]
    }
  });

  // 🔴 ВАЖНЫЙ ФИКС КЛИКАБЕЛЬНОСТИ
  map.on("mouseenter", "points", () => {
    map.getCanvas().style.cursor = "pointer";
    map.dragPan.disable();
  });

  map.on("mouseleave", "points", () => {
    map.getCanvas().style.cursor = "";
    map.dragPan.enable();
  });

  map.on("click", "points", e => {
    focusFeature(e.features[0].properties.__id, e.lngLat);
  });
}

function focusFeature(id, lngLatOverride = null) {
  const f = viewFeatures.find(x => x.properties.__id === id);
  if (!f) return;

  selectedId = id;
  renderListGrouped();
  updateSource();

  const center = lngLatOverride || f.geometry.coordinates;
  map.easeTo({ center, zoom: 7 });

  if (popupRef) popupRef.remove();

  const previewUrl = osmStaticPreview(center);
  const dist = userLocation ? haversine(userLocation, center).toFixed(1) : null;

  popupRef = new maplibregl.Popup({ maxWidth: "92vw" })
    .setLngLat(center)
    .setHTML(`
      <div class="popup-title">${f.properties.__name}</div>
      <div class="popup-sub">
        ${f.properties.__subject} • ${f.properties.__country}<br>
        ${f.properties.__type} • ${f.properties.__status}<br>
        ${dist ? `📏 ${dist} км` : `📏 включите геолокацию`}
      </div>
      <div class="popup-map" style="background-image:url('${previewUrl}')"></div>
      ${userLocation ? `<div class="popup-actions">
        <a class="popup-link" href="${buildRouteUrl(userLocation, center)}" target="_blank">🛣 Маршрут</a>
      </div>` : ""}
    `)
    .addTo(map);
}

/* ===================== INIT ===================== */

async function init() {
  setProgress(10, "Подключаем карту…");
  await loadData();

  fillFilters();
  buildLegend();
  renderStats();
  renderListGrouped();

  map.on("load", () => {
    ensureSourcesAndLayers();
    updateSource();
    hideLoader();
  });
}

geoBtn.onclick = () => {
  navigator.geolocation.getCurrentPosition(pos => {
    userLocation = [pos.coords.longitude, pos.coords.latitude];
    if (userMarker) userMarker.remove();
    userMarker = new maplibregl.Marker({ color: "#f97316" })
      .setLngLat(userLocation)
      .addTo(map);
    map.easeTo({ center: userLocation, zoom: 8 });
    renderListGrouped();
  });
};

styleToggle.onclick = () => {
  currentStyle = currentStyle === "map" ? "sat" : "map";
  const next = currentStyle === "map" ? STYLE_MAP : STYLE_SAT;
  const state = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch()
  };

  map.setStyle(next);
  map.once("styledata", () => {
    map.jumpTo(state);
    ensureSourcesAndLayers();
    updateSource();
    if (userLocation) {
      userMarker = new maplibregl.Marker({ color: "#f97316" })
        .setLngLat(userLocation)
        .addTo(map);
    }
  });
};

searchEl.oninput = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilters, 250);
};

typeEl.onchange = applyFilters;
statusEl.onchange = applyFilters;

clearSelectionBtn.onclick = () => {
  selectedId = null;
  if (popupRef) popupRef.remove();
  updateSource();
  renderListGrouped();
};

mobileToggle.onclick = () => {
  panel.classList.toggle("open");
  setTimeout(() => map.resize(), 300);
};

init();
