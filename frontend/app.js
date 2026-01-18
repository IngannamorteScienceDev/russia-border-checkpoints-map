/* ===== Base map (production style, NOT demo) ===== */

const BASE_STYLE = "https://tiles.openfreemap.org/styles/liberty/style.json";

/* ===== КПП colors ===== */

const TYPE_COLORS = {
  "Автомобильный": "#3b82f6",
  "Железнодорожный": "#22c55e",
  "Воздушный": "#a855f7",
  "Морской": "#0ea5e9",
  "Речной": "#14b8a6",
  "Пешеходный": "#f97316"
};

const FALLBACK_COLOR = "#64748b";

/* ===== DOM ===== */

const loaderEl = document.getElementById("loader");
const loaderStepEl = document.getElementById("loaderStep");
const loaderBarEl = document.getElementById("loaderBar");

const searchEl = document.getElementById("searchInput");
const typeEl = document.getElementById("typeFilter");
const statusEl = document.getElementById("statusFilter");

const legendEl = document.getElementById("legend");
const statsEl = document.getElementById("stats");
const emptyEl = document.getElementById("emptyState");
const listEl = document.getElementById("list");
const updateDateEl = document.getElementById("updateDate");

const toggleHeatmapBtn = document.getElementById("toggleHeatmap");
const clearSelectionBtn = document.getElementById("clearSelection");

/* ===== State ===== */

let geo = null;
let allFeatures = [];
let viewFeatures = [];
let selectedIds = new Set();
let heatmapOn = false;

const STATUS_KEYS = ["checkpoint_status", "status", "current_status"];
const TYPE_KEYS = ["checkpoint_type", "type", "transport_type"];
const NAME_KEYS = ["checkpoint_name", "name", "title"];
const SUBJECT_KEYS = ["subject_name", "subject", "region"];
const COUNTRY_KEYS = ["neighbor_country", "country", "border_country"];
const ID_KEYS = ["checkpoint_id", "id", "uid"];

/* ===== Loader helpers ===== */

function setLoader(text, percent) {
  loaderStepEl.textContent = text;
  loaderBarEl.style.width = `${Math.max(6, Math.min(100, percent))}%`;
}

function hideLoader() {
  loaderEl.classList.add("hidden");
}

/* ===== Property helpers ===== */

function pickProp(obj, keys, fallback = "") {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
      return obj[k];
    }
  }
  return fallback;
}

function norm(v) {
  return String(v ?? "").toLowerCase().trim();
}

function getId(f) {
  return String(
    pickProp(f.properties || {}, ID_KEYS, f.id || "")
  );
}

/* ===== Map init (NO intro animation) ===== */

setLoader("Загрузка стиля карты…", 12);

const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: [90, 61],
  zoom: 4,
  antialias: true
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

/* ===== Main init ===== */

(async function init() {
  try {
    setLoader("Загрузка данных КПП…", 28);

    const resp = await fetch("data/checkpoints.geojson", { cache: "no-store" });
    geo = await resp.json();

    allFeatures = (geo.features || [])
      .filter(f => f?.geometry?.type === "Point")
      .map(f => {
        const id = getId(f);
        return {
          ...f,
          id,
          properties: {
            ...(f.properties || {}),
            __id: id,
            __name: pickProp(f.properties, NAME_KEYS, "Без названия"),
            __type: pickProp(f.properties, TYPE_KEYS, "Неизвестно"),
            __status: pickProp(f.properties, STATUS_KEYS, "—"),
            __subject: pickProp(f.properties, SUBJECT_KEYS, "—"),
            __country: pickProp(f.properties, COUNTRY_KEYS, "—")
          }
        };
      })
      .filter(f => f.properties.__id);

    updateDateEl.textContent = new Date().toLocaleDateString("ru-RU");

    buildLegend();
    fillFilters();
    applyFilters();

    setLoader("Подготовка слоёв…", 55);

    await waitForMapLoad();
    addSourcesAndLayers();

    setLoader("Готово", 100);
    hideLoader();

  } catch (e) {
    console.error(e);
    setLoader("Ошибка загрузки карты", 100);
  }
})();

/* ===== Map ready ===== */

function waitForMapLoad() {
  return new Promise(resolve => {
    if (map.isStyleLoaded()) return resolve();
    map.once("load", resolve);
  });
}

/* ===== Legend & filters ===== */

function buildLegend() {
  legendEl.innerHTML = `
    <div class="legend-title">Легенда</div>
    <div class="legend-grid">
      ${Object.entries(TYPE_COLORS).map(
        ([t, c]) => `
          <div class="legend-item">
            <span class="dot" style="background:${c}"></span>
            <span>${t}</span>
          </div>
        `
      ).join("")}
      <div class="legend-item">
        <span class="dot" style="background:${FALLBACK_COLOR}"></span>
        <span>Другое</span>
      </div>
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

/* ===== Filtering ===== */

function applyFilters() {
  const q = norm(searchEl.value);
  const t = typeEl.value;
  const s = statusEl.value;

  viewFeatures = allFeatures.filter(f => {
    if (t !== "all" && f.properties.__type !== t) return false;
    if (s !== "all" && f.properties.__status !== s) return false;
    if (!q) return true;

    return [
      f.properties.__name,
      f.properties.__subject,
      f.properties.__country
    ].some(v => norm(v).includes(q));
  });

  renderStats();
  renderList();

  emptyEl.style.display = viewFeatures.length ? "none" : "block";

  if (map.getSource("checkpoints")) {
    map.getSource("checkpoints").setData({
      type: "FeatureCollection",
      features: viewFeatures
    });
  }
}

/* ===== Stats & list ===== */

function renderStats() {
  statsEl.innerHTML = `
    Всего КПП: <b>${allFeatures.length}</b><br>
    Отображено: <b>${viewFeatures.length}</b><br>
    Выбрано: <b>${selectedIds.size}</b>
  `;
}

function renderList() {
  listEl.innerHTML = viewFeatures.slice(0, 200).map(f => `
    <div class="item" data-id="${f.properties.__id}">
      <div class="item-name">${f.properties.__name}</div>
      <div class="item-sub">
        ${f.properties.__subject} • ${f.properties.__country}<br>
        ${f.properties.__type}, ${f.properties.__status}
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll(".item").forEach(el => {
    el.onclick = () => {
      const id = el.dataset.id;
      const f = viewFeatures.find(x => x.properties.__id === id);
      if (!f) return;
      toggleSelect(id);
      focusFeature(f);
    };
  });
}

/* ===== Map layers ===== */

function addSourcesAndLayers() {
  map.addSource("checkpoints", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: viewFeatures
    },
    promoteId: "__id",
    cluster: true,
    clusterRadius: 48
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "checkpoints",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "rgba(59,130,246,.55)",
      "circle-radius": ["step", ["get", "point_count"], 16, 30, 22, 80, 28],
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
    }
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
        ...Object.entries(TYPE_COLORS).flat(),
        FALLBACK_COLOR
      ],
      "circle-stroke-width": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        3, 1
      ],
      "circle-stroke-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        "#facc15",
        "#020617"
      ]
    }
  });

  map.addLayer({
    id: "heatmap",
    type: "heatmap",
    source: "checkpoints",
    layout: { visibility: "none" },
    paint: {
      "heatmap-radius": 40,
      "heatmap-intensity": 1,
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, "rgba(0,0,0,0)",
        0.4, "#3b82f6",
        0.7, "#facc15",
        1, "#ef4444"
      ]
    }
  });

  bindMapEvents();
}

/* ===== Map events ===== */

function bindMapEvents() {
  map.on("click", "clusters", e => {
    const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
    map.getSource("checkpoints").getClusterExpansionZoom(
      f.properties.cluster_id,
      (err, zoom) => {
        if (!err) {
          map.easeTo({ center: f.geometry.coordinates, zoom });
        }
      }
    );
  });

  map.on("click", "points", e => {
    const f = e.features[0];
    toggleSelect(f.properties.__id);
    showPopup(f, e.lngLat);
  });

  map.on("mouseenter", "points", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "points", () => map.getCanvas().style.cursor = "");
}

/* ===== Selection ===== */

function toggleSelect(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    map.setFeatureState({ source: "checkpoints", id }, { selected: false });
  } else {
    selectedIds.add(id);
    map.setFeatureState({ source: "checkpoints", id }, { selected: true });
  }
  renderStats();
  renderList();
}

/* ===== Heatmap toggle ===== */

toggleHeatmapBtn.onclick = () => {
  heatmapOn = !heatmapOn;
  map.setLayoutProperty("heatmap", "visibility", heatmapOn ? "visible" : "none");
  map.setLayoutProperty("clusters", "visibility", heatmapOn ? "none" : "visible");
  map.setLayoutProperty("cluster-count", "visibility", heatmapOn ? "none" : "visible");
  map.setLayoutProperty("points", "visibility", heatmapOn ? "none" : "visible");
};

/* ===== Filters ===== */

searchEl.addEventListener("input", () => applyFilters());
typeEl.addEventListener("change", () => applyFilters());
statusEl.addEventListener("change", () => applyFilters());

/* ===== Popup ===== */

function showPopup(f, lngLat) {
  new maplibregl.Popup()
    .setLngLat(lngLat)
    .setHTML(`
      <b>${f.properties.__name}</b><br>
      ${f.properties.__subject} • ${f.properties.__country}<br>
      ${f.properties.__type}, ${f.properties.__status}
    `)
    .addTo(map);
}
