const STYLE_MAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const STYLE_SAT = {
  version: 8,
  sources: {
    sat: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256
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

const el = id => document.getElementById(id);

const searchEl = el("searchInput");
const typeEl = el("typeFilter");
const statusEl = el("statusFilter");
const listEl = el("list");
const legendEl = el("legend");
const statsEl = el("stats");
const emptyEl = el("emptyState");
const loaderEl = el("loader");
const loaderProgressEl = el("loaderProgress");
const loaderTextEl = el("loaderText");
const styleToggle = el("styleToggle");

let allFeatures = [];
let viewFeatures = [];
let currentStyle = "map";
let popupRef = null;

const map = new maplibregl.Map({
  container: "map",
  style: STYLE_MAP,
  center: [90, 61],
  zoom: 4
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

function normalize(v) {
  return String(v || "").toLowerCase().trim();
}

function normalizeType(v) {
  v = normalize(v);
  if (v.includes("авто")) return "Автомобильный";
  if (v.includes("желез")) return "Железнодорожный";
  if (v.includes("воздуш")) return "Воздушный";
  if (v.includes("морск")) return "Морской";
  if (v.includes("реч")) return "Речной";
  if (v.includes("пеш")) return "Пешеходный";
  return "Другое";
}

function normalizeStatus(v) {
  v = normalize(v);
  if (v.includes("действ")) return "Действует";
  if (v.includes("огран")) return "Ограничен";
  if (v.includes("врем")) return "Временно закрыт";
  if (v.includes("закры")) return "Закрыт";
  return "Неизвестно";
}

async function loadData() {
  const url = new URL("./data/checkpoints.geojson", location.href);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Не удалось загрузить checkpoints.geojson");

  const data = await res.json();

  allFeatures = data.features.map(f => {
    const p = f.properties || {};
    return {
      ...f,
      properties: {
        ...p,
        __id: String(p.checkpoint_id || crypto.randomUUID()),
        __name: p.checkpoint_name || "Без названия",
        __type: normalizeType(p.checkpoint_type),
        __status: normalizeStatus(p.current_status),
        __subject: p.subject_name || "",
        __country: [
          p.neighbor_country,
          p.country,
          p.border_country
        ].filter(Boolean).join(", ")
      }
    };
  });

  viewFeatures = allFeatures;
}

function buildLegend() {
  legendEl.innerHTML = Object.entries(TYPE_COLORS).map(
    ([k, c]) =>
      `<div style="display:flex;align-items:center;gap:8px;font-size:13px">
        <span style="width:10px;height:10px;border-radius:50%;background:${c}"></span>${k}
      </div>`
  ).join("");
}

function updateSource() {
  if (!map.getSource("checkpoints")) return;
  map.getSource("checkpoints").setData({
    type: "FeatureCollection",
    features: viewFeatures
  });
}

function rebuildLayers() {
  ["points", "points-hit", "clusters", "cluster-count"].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource("checkpoints")) map.removeSource("checkpoints");

  map.addSource("checkpoints", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: viewFeatures
    },
    cluster: true,
    clusterRadius: 50
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "checkpoints",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#3b82f6",
      "circle-radius": 20,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#020617"
    }
  });

  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "checkpoints",
    filter: ["has", "point_count"],
    layout: {
      "text-field": "{point_count_abbreviated}",
      "text-size": 12
    },
    paint: { "text-color": "#fff" }
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
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#020617"
    }
  });

  map.addLayer({
    id: "points-hit",
    type: "circle",
    source: "checkpoints",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": 18,
      "circle-opacity": 0
    }
  });

  map.on("click", "points-hit", e => {
    const f = e.features?.[0];
    if (!f) return;

    if (popupRef) popupRef.remove();
    popupRef = new maplibregl.Popup()
      .setLngLat(f.geometry.coordinates)
      .setHTML(`<b>${f.properties.__name}</b><br>${f.properties.__country}<br>${f.properties.__type}`)
      .addTo(map);
  });
}

function applyFilters() {
  const q = normalize(searchEl.value);
  const t = typeEl.value;
  const s = statusEl.value;

  viewFeatures = allFeatures.filter(f => {
    const p = f.properties;
    if (t !== "all" && p.__type !== t) return false;
    if (s !== "all" && p.__status !== s) return false;
    if (!q) return true;

    return (
      normalize(p.__name).includes(q) ||
      normalize(p.__subject).includes(q) ||
      normalize(p.__country).includes(q)
    );
  });

  updateSource();
  renderList();
}

function renderList() {
  statsEl.innerHTML = `Показано: ${viewFeatures.length}`;
  emptyEl.style.display = viewFeatures.length ? "none" : "block";

  listEl.innerHTML = viewFeatures.map(f =>
    `<div class="item">${f.properties.__name}<br><small>${f.properties.__country}</small></div>`
  ).join("");
}

styleToggle.onclick = () => {
  currentStyle = currentStyle === "map" ? "sat" : "map";
  map.setStyle(currentStyle === "map" ? STYLE_MAP : STYLE_SAT);
  map.once("load", rebuildLayers);
};

searchEl.oninput = applyFilters;
typeEl.onchange = applyFilters;
statusEl.onchange = applyFilters;

async function init() {
  try {
    loaderTextEl.textContent = "Загрузка данных…";
    await loadData();

    buildLegend();
    renderList();

    map.once("load", () => {
      rebuildLayers();
      loaderEl.remove();
    });
  } catch (e) {
    loaderTextEl.textContent = e.message;
  }
}

init();
