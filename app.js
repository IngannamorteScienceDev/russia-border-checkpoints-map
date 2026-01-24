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

function setProgress(pct, text) {
  if (loaderProgressEl) loaderProgressEl.style.width = `${pct}%`;
  if (loaderTextEl && text) loaderTextEl.textContent = text;
}

function hideLoader() {
  if (!loaderEl) return;
  loaderEl.style.opacity = "0";
  setTimeout(() => loaderEl.remove(), 300);
}

function normalizeType(v) {
  v = String(v || "").toLowerCase();
  if (v.includes("авто")) return "Автомобильный";
  if (v.includes("желез")) return "Железнодорожный";
  if (v.includes("воздуш")) return "Воздушный";
  if (v.includes("морск")) return "Морской";
  if (v.includes("реч")) return "Речной";
  if (v.includes("пеш")) return "Пешеходный";
  return "Другое";
}

function normalizeStatus(v) {
  v = String(v || "").toLowerCase();
  if (v.includes("действ")) return "Действует";
  if (v.includes("огран")) return "Ограничен";
  if (v.includes("врем")) return "Временно закрыт";
  if (v.includes("закры")) return "Закрыт";
  return "Неизвестно";
}

function haversine(a, b) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function routeUrl(from, to) {
  return `https://yandex.ru/maps/?rtext=${from[1]},${from[0]}~${to[1]},${to[0]}&rtt=auto`;
}

function staticMap([lng, lat]) {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=8&size=320x180&markers=${lat},${lng},blue`;
}

async function loadData() {
  setProgress(25, "Загружаем данные КПП…");
  const r = await fetch("data/checkpoints.geojson", { cache: "no-store" });
  const d = await r.json();

  allFeatures = d.features.map(f => ({
    ...f,
    properties: {
      ...f.properties,
      __id: String(f.properties.checkpoint_id),
      __name: f.properties.checkpoint_name || "Без названия",
      __type: normalizeType(f.properties.checkpoint_type),
      __status: normalizeStatus(f.properties.current_status),
      __country: f.properties.neighbor_country || "Не указано",
      __subject: f.properties.subject_name || "—"
    }
  }));

  viewFeatures = allFeatures;
}

function buildLegend() {
  legendEl.innerHTML = Object.entries(TYPE_COLORS).map(
    ([k, c]) => `<div><span style="background:${c}"></span>${k}</div>`
  ).join("");
}

function applyFilters() {
  const q = searchEl.value.toLowerCase();
  const t = typeEl.value;
  const s = statusEl.value;

  viewFeatures = allFeatures.filter(f => {
    if (t !== "all" && f.properties.__type !== t) return false;
    if (s !== "all" && f.properties.__status !== s) return false;
    if (!q) return true;
    return (
      f.properties.__name.toLowerCase().includes(q) ||
      f.properties.__country.toLowerCase().includes(q)
    );
  });

  updateSource();
  renderList();
}

function renderList() {
  const groups = {};
  viewFeatures.forEach(f => {
    const c = f.properties.__country;
    groups[c] = groups[c] || [];
    groups[c].push(f);
  });

  listEl.innerHTML = Object.entries(groups).map(([c, items]) => {
    return `<div class="group">${c}</div>` + items.map(f => {
      const d = userLocation
        ? ` • ${haversine(userLocation, f.geometry.coordinates).toFixed(1)} км`
        : "";
      return `
        <div class="item" data-id="${f.properties.__id}">
          <b>${f.properties.__name}</b><br>
          <small>${f.properties.__type} • ${f.properties.__status}${d}</small>
        </div>
      `;
    }).join("");
  }).join("");

  listEl.querySelectorAll(".item").forEach(el => {
    el.onclick = () => focus(el.dataset.id);
  });
}

function ensureLayers() {
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
    paint: { "circle-color": "#2563eb", "circle-radius": 18 }
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
      "circle-color": ["match", ["get", "__type"],
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

  map.on("mouseenter", "points", () => {
    map.getCanvas().style.cursor = "pointer";
    map.dragPan.disable();
  });

  map.on("mouseleave", "points", () => {
    map.getCanvas().style.cursor = "";
    map.dragPan.enable();
  });

  map.on("click", e => {
    const feats = map.queryRenderedFeatures(e.point, { layers: ["points"] });
    if (!feats.length) return;
    focus(feats[0].properties.__id, e.lngLat);
  });
}

function updateSource() {
  const s = map.getSource("checkpoints");
  if (s) s.setData({ type: "FeatureCollection", features: viewFeatures });
}

function focus(id, lngLat) {
  const f = viewFeatures.find(x => x.properties.__id === id);
  if (!f) return;

  const c = lngLat || f.geometry.coordinates;
  map.easeTo({ center: c, zoom: 7 });

  if (popupRef) popupRef.remove();

  popupRef = new maplibregl.Popup({ maxWidth: "92vw" })
    .setLngLat(c)
    .setHTML(`
      <b>${f.properties.__name}</b><br>
      ${f.properties.__type} • ${f.properties.__status}<br>
      ${userLocation ? `📏 ${haversine(userLocation, c).toFixed(1)} км` : ""}
      <div style="margin-top:8px;background:url('${staticMap(c)}');height:180px;border-radius:8px"></div>
      ${userLocation ? `<a href="${routeUrl(userLocation, c)}" target="_blank">🛣 Маршрут</a>` : ""}
    `)
    .addTo(map);
}

async function init() {
  setProgress(10, "Подключаем карту…");
  await loadData();
  buildLegend();
  renderList();

  map.on("load", () => {
    ensureLayers();
    updateSource();
    hideLoader();
  });
}

geoBtn.onclick = () => {
  navigator.geolocation.getCurrentPosition(pos => {
    userLocation = [pos.coords.longitude, pos.coords.latitude];
    if (userMarker) userMarker.remove();
    userMarker = new maplibregl.Marker({ color: "#f97316" }).setLngLat(userLocation).addTo(map);
    map.easeTo({ center: userLocation, zoom: 8 });
    renderList();
  });
};

styleToggle.onclick = () => {
  currentStyle = currentStyle === "map" ? "sat" : "map";
  const next = currentStyle === "map" ? STYLE_MAP : STYLE_SAT;
  const state = map.getCenter();
  const zoom = map.getZoom();

  map.setStyle(next);
  map.once("styledata", () => {
    map.jumpTo({ center: state, zoom });
    ensureLayers();
    updateSource();
    if (userLocation) {
      userMarker = new maplibregl.Marker({ color: "#f97316" }).setLngLat(userLocation).addTo(map);
    }
  });
};

searchEl.oninput = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilters, 250);
};

typeEl.onchange = applyFilters;
statusEl.onchange = applyFilters;
mobileToggle.onclick = () => panel.classList.toggle("open");

init();
