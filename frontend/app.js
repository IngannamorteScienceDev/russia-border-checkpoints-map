// =====================================================
// КПП РФ — MapLibre GL (FIXED & STABLE)
// =====================================================

// ─────────────────────────────────────────────────────
// Базовый навигационный стиль (НЕ демо)
// ─────────────────────────────────────────────────────
const BASE_STYLE =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

// Цвета КПП
const COLORS = {
  "Автомобильный": "#3b82f6",
  "Железнодорожный": "#22c55e",
  "Воздушный": "#a855f7",
  "Морской": "#0ea5e9",
  "Речной": "#14b8a6",
};

// ─────────────────────────────────────────────────────
// Состояние
// ─────────────────────────────────────────────────────
let geoData = null;
let filteredFeatures = [];

let nightMode = true;
let roadsMode = false;
let threeDMode = false;

// Слои стиля
let roadLayerIds = [];
let labelLayerIds = [];
let buildingSourceName = null;

// ─────────────────────────────────────────────────────
// UI элементы
// ─────────────────────────────────────────────────────
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const statusFilter = document.getElementById("statusFilter");
const statsEl = document.getElementById("stats");

const btnTheme = document.getElementById("toggleTheme");
const btnRoads = document.getElementById("toggleRoads");
const btn3d = document.getElementById("toggle3D");

// ─────────────────────────────────────────────────────
// Инициализация карты
// ─────────────────────────────────────────────────────
const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: [90, 61],
  zoom: 3.8,
  antialias: true,
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

// ─────────────────────────────────────────────────────
// Загрузка данных
// ─────────────────────────────────────────────────────
fetch("data/checkpoints.geojson")
  .then(r => r.json())
  .then(data => {
    geoData = data;
    filteredFeatures = data.features;

    initUI();

    // ВАЖНО: всё, что связано со слоями — ТОЛЬКО здесь
    map.on("style.load", () => {
      indexStyleLayers();
      addCheckpointsLayer();
      applyTheme();
      applyRoadHighlight();
      if (threeDMode) apply3D();
    });
  });

// ─────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────
function initUI() {
  btnTheme.onclick = () => {
    nightMode = !nightMode;
    btnTheme.classList.toggle("active", nightMode);
    btnTheme.textContent = nightMode ? "🌗 Ночь" : "☀️ День";
    applyTheme();
  };

  btnRoads.onclick = () => {
    roadsMode = !roadsMode;
    btnRoads.classList.toggle("active", roadsMode);
    applyRoadHighlight();
  };

  btn3d.onclick = () => {
    threeDMode = !threeDMode;
    btn3d.classList.toggle("active", threeDMode);
    apply3D();
  };

  const types = uniq(geoData.features.map(f => f.properties.checkpoint_type));
  const statuses = uniq(geoData.features.map(f => f.properties.status));

  fillSelect(typeFilter, types);
  fillSelect(statusFilter, statuses);

  const debounced = debounce(applyFilters, 150);
  typeFilter.onchange = applyFilters;
  statusFilter.onchange = applyFilters;
  searchInput.oninput = debounced;

  btnTheme.textContent = "🌗 Ночь";
  btnTheme.classList.add("active");
}

// ─────────────────────────────────────────────────────
// Слои стиля карты
// ─────────────────────────────────────────────────────
function indexStyleLayers() {
  roadLayerIds = [];
  labelLayerIds = [];
  buildingSourceName = null;

  const style = map.getStyle();
  if (!style) return;

  // Векторные источники
  const sources = style.sources || {};
  const vectorSources = Object.keys(sources).filter(
    k => sources[k].type === "vector"
  );
  buildingSourceName = vectorSources[0] || null;

  for (const layer of style.layers) {
    const id = layer.id.toLowerCase();

    if (
      layer.type === "line" &&
      (id.includes("road") || id.includes("transport"))
    ) {
      roadLayerIds.push(layer.id);
    }

    if (
      layer.type === "symbol" &&
      (id.includes("label") || id.includes("place"))
    ) {
      labelLayerIds.push(layer.id);
    }
  }
}

// ─────────────────────────────────────────────────────
// КПП
// ─────────────────────────────────────────────────────
function addCheckpointsLayer() {
  if (map.getSource("checkpoints")) return;

  map.addSource("checkpoints", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: filteredFeatures,
    },
    promoteId: "checkpoint_id",
  });

  map.addLayer({
    id: "checkpoints-layer",
    type: "circle",
    source: "checkpoints",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3, 3,
        7, 6,
        10, 10
      ],
      "circle-color": [
        "match",
        ["get", "checkpoint_type"],
        "Автомобильный", COLORS["Автомобильный"],
        "Железнодорожный", COLORS["Железнодорожный"],
        "Воздушный", COLORS["Воздушный"],
        "Морской", COLORS["Морской"],
        "Речной", COLORS["Речной"],
        "#64748b"
      ],
      "circle-stroke-color": "#020617",
      "circle-stroke-width": 1,
      "circle-opacity": 0.9,
    },
  });

  map.on("click", "checkpoints-layer", e => {
    const p = e.features[0].properties;
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(buildPopup(p))
      .addTo(map);
  });

  map.on("mouseenter", "checkpoints-layer", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "checkpoints-layer", () => {
    map.getCanvas().style.cursor = "";
  });

  updateStats(filteredFeatures);
}

// ─────────────────────────────────────────────────────
// Фильтрация
// ─────────────────────────────────────────────────────
function applyFilters() {
  const typeVal = typeFilter.value;
  const statusVal = statusFilter.value;
  const q = searchInput.value.toLowerCase();

  filteredFeatures = geoData.features.filter(f => {
    const p = f.properties;

    const okType = typeVal === "all" || p.checkpoint_type === typeVal;
    const okStatus = statusVal === "all" || p.status === statusVal;

    if (!q) return okType && okStatus;

    const text = [
      p.checkpoint_name,
      p.subject_name,
      p.foreign_country,
      p.address,
    ].join(" ").toLowerCase();

    return okType && okStatus && text.includes(q);
  });

  const src = map.getSource("checkpoints");
  if (src) {
    src.setData({
      type: "FeatureCollection",
      features: filteredFeatures,
    });
  }

  updateStats(filteredFeatures);
}

// ─────────────────────────────────────────────────────
// День / ночь
// ─────────────────────────────────────────────────────
function applyTheme() {
  for (const id of labelLayerIds) {
    try {
      map.setPaintProperty(id, "text-opacity", nightMode ? 0.75 : 1.0);
    } catch {}
  }
  applyRoadHighlight();
}

// ─────────────────────────────────────────────────────
// Подсветка дорог
// ─────────────────────────────────────────────────────
function applyRoadHighlight() {
  for (const id of roadLayerIds) {
    try {
      map.setPaintProperty(
        id,
        "line-opacity",
        roadsMode ? 0.9 : nightMode ? 0.5 : 0.7
      );
      map.setPaintProperty(
        id,
        "line-width",
        roadsMode
          ? ["interpolate", ["linear"], ["zoom"], 4, 1.5, 10, 4]
          : ["interpolate", ["linear"], ["zoom"], 4, 0.8, 10, 2.5]
      );
    } catch {}
  }
}

// ─────────────────────────────────────────────────────
// 3D
// ─────────────────────────────────────────────────────
function apply3D() {
  map.easeTo({
    pitch: threeDMode ? 55 : 0,
    bearing: threeDMode ? -12 : 0,
    duration: 600,
  });

  const layerId = "3d-buildings";

  if (!threeDMode) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    return;
  }

  if (!buildingSourceName || map.getLayer(layerId)) return;

  try {
    map.addLayer({
      id: layerId,
      type: "fill-extrusion",
      source: buildingSourceName,
      "source-layer": "building",
      minzoom: 12,
      paint: {
        "fill-extrusion-color": "rgba(148,163,184,0.45)",
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-opacity": 0.5,
      },
    });
  } catch {}
}

// ─────────────────────────────────────────────────────
// Вспомогательные
// ─────────────────────────────────────────────────────
function fillSelect(select, values) {
  values.filter(Boolean).sort().forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}

function uniq(arr) {
  return [...new Set(arr)];
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function updateStats(features) {
  statsEl.innerHTML = `Отображено КПП: <strong>${features.length}</strong>`;
}

function buildPopup(p) {
  return `
    <strong>${p.checkpoint_name}</strong><br/>
    ${p.checkpoint_type} • ${p.status}<br/>
    ${p.subject_name}<br/>
    <em>${p.working_time || "Режим не указан"}</em>
  `;
}
