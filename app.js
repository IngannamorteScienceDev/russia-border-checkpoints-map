const BASE_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const TYPE_COLORS = {
  "Автомобильный": "#3b82f6",
  "Железнодорожный": "#22c55e",
  "Воздушный": "#a855f7",
  "Морской": "#0ea5e9",
  "Речной": "#14b8a6",
  "Пешеходный": "#f97316",
  "Другое": "#64748b"
};

const searchEl = document.getElementById("searchInput");
const typeEl = document.getElementById("typeFilter");
const statusEl = document.getElementById("statusFilter");
const legendEl = document.getElementById("legend");
const statsEl = document.getElementById("stats");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("emptyState");

const toggleHeatmapBtn = document.getElementById("toggleHeatmap");
const clearSelectionBtn = document.getElementById("clearSelection");

const mobileToggle = document.getElementById("mobileToggle");
const panel = document.querySelector(".panel");

let allFeatures = [];
let viewFeatures = [];
let selectedId = null;
let debounceTimer = null;

/* ===== Map ===== */

const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: [90, 61],
  zoom: 4,
  antialias: true
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");
map.touchZoomRotate.enable();
map.dragPan.enable();

/* ===== Utils ===== */

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

/* ===== Load data ===== */

fetch("data/checkpoints.geojson", { cache: "no-store" })
  .then(r => r.json())
  .then(data => {
    allFeatures = (data.features || [])
      .filter(f => f.geometry && f.geometry.type === "Point")
      .map(f => ({
        ...f,
        properties: {
          ...f.properties,
          __id: String(f.properties.checkpoint_id || ""),
          __name: f.properties.checkpoint_name || "Без названия",
          __type: normalizeType(f.properties.checkpoint_type),
          __status: normalizeStatus(f.properties.current_status),
          __subject: f.properties.subject_name || "—",
          __country: f.properties.neighbor_country || "—"
        }
      }));

    fillFilters();
    buildLegend();
    applyFilters();

    map.on("load", () => {
      addLayers();
      map.resize();
    });
  });

/* ===== Filters ===== */

function fillFilters() {
  const types = [...new Set(allFeatures.map(f => f.properties.__type))];
  const statuses = [...new Set(allFeatures.map(f => f.properties.__status))];

  typeEl.innerHTML =
    `<option value="all">Все типы</option>` +
    types.map(t => `<option>${t}</option>`).join("");

  statusEl.innerHTML =
    `<option value="all">Все статусы</option>` +
    statuses.map(s => `<option>${s}</option>`).join("");
}

function applyFilters() {
  const q = searchEl.value.toLowerCase().trim();
  const t = typeEl.value;
  const s = statusEl.value;

  const next = allFeatures.filter(f => {
    if (t !== "all" && f.properties.__type !== t) return false;
    if (s !== "all" && f.properties.__status !== s) return false;
    if (!q) return true;

    return (
      f.properties.__name.toLowerCase().includes(q) ||
      f.properties.__subject.toLowerCase().includes(q) ||
      f.properties.__country.toLowerCase().includes(q)
    );
  });

  if (next.length === viewFeatures.length) return;

  viewFeatures = next;
  updateSource();
  renderStats();
  renderList();
}

function updateSource() {
  const src = map.getSource("checkpoints");
  if (src) {
    src.setData({
      type: "FeatureCollection",
      features: viewFeatures
    });
  }
}

/* ===== UI ===== */

function renderStats() {
  statsEl.innerHTML = `
    Всего: <b>${allFeatures.length}</b><br>
    Показано: <b>${viewFeatures.length}</b>
  `;
}

function renderList() {
  listEl.innerHTML = viewFeatures.slice(0, 200).map(f => `
    <div class="item ${f.properties.__id === selectedId ? "active" : ""}"
         data-id="${f.properties.__id}">
      <div class="item-name">${f.properties.__name}</div>
      <div class="item-sub">
        ${f.properties.__subject} • ${f.properties.__country}<br>
        ${f.properties.__type} • ${f.properties.__status}
      </div>
    </div>
  `).join("");

  emptyEl.style.display = viewFeatures.length ? "none" : "block";

  listEl.querySelectorAll(".item").forEach(el => {
    el.onclick = () => focusFeature(el.dataset.id);
  });
}

function buildLegend() {
  legendEl.innerHTML = `
    <div class="legend-title">Тип КПП</div>
    <div class="legend-grid">
      ${Object.entries(TYPE_COLORS).map(([k, c]) =>
        `<div class="legend-item">
           <span class="dot" style="background:${c}"></span>${k}
         </div>`).join("")}
    </div>
  `;
}

/* ===== Map layers ===== */

function addLayers() {
  map.addSource("checkpoints", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: viewFeatures
    },
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
      "circle-radius": 18,
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
      "circle-radius": [
        "case",
        ["==", ["get", "__id"], selectedId],
        9,
        6
      ],
      "circle-color": [
        "match",
        ["get", "__type"],
        "Автомобильный", TYPE_COLORS["Автомобильный"],
        "Железнодорожный", TYPE_COLORS["Железнодорожный"],
        "Воздушный", TYPE_COLORS["Воздушный"],
        "Морской", TYPE_COLORS["Морской"],
        "Речной", TYPE_COLORS["Речной"],
        "Пешеходный", TYPE_COLORS["Пешеходный"],
        TYPE_COLORS["Другое"]
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#020617"
    }
  });

  map.on("click", "points", e => {
    const f = e.features[0];
    focusFeature(f.properties.__id, e.lngLat);
  });
}

/* ===== Interaction ===== */

function focusFeature(id, lngLatOverride = null) {
  const f = viewFeatures.find(x => x.properties.__id === id);
  if (!f) return;

  selectedId = id;
  renderList();
  updateSource();

  const center = lngLatOverride || f.geometry.coordinates;
  map.easeTo({ center, zoom: 7 });

  new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    maxWidth: "90vw"
  })
    .setLngLat(center)
    .setHTML(`
      <b>${f.properties.__name}</b><br>
      ${f.properties.__subject} • ${f.properties.__country}<br>
      ${f.properties.__type} • ${f.properties.__status}
    `)
    .addTo(map);

  if (window.innerWidth <= 768 && panel) {
    panel.classList.remove("open");
    setTimeout(() => map.resize(), 300);
  }
}

/* ===== Events ===== */

searchEl.oninput = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilters, 300);
};

typeEl.onchange = applyFilters;
statusEl.onchange = applyFilters;

clearSelectionBtn.onclick = () => {
  selectedId = null;
  renderList();
  updateSource();
};

mobileToggle.onclick = () => {
  panel.classList.toggle("open");
  setTimeout(() => map.resize(), 300);
};
