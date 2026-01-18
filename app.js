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

const loader = document.getElementById("loader");
const loaderStep = document.getElementById("loaderStep");
const loaderBar = document.getElementById("loaderBar");

const searchEl = document.getElementById("searchInput");
const typeEl = document.getElementById("typeFilter");
const statusEl = document.getElementById("statusFilter");

const legendEl = document.getElementById("legend");
const statsEl = document.getElementById("stats");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("emptyState");
const updateDateEl = document.getElementById("updateDate");

const toggleHeatmapBtn = document.getElementById("toggleHeatmap");
const clearSelectionBtn = document.getElementById("clearSelection");

let geo = null;
let allFeatures = [];
let viewFeatures = [];
let selectedIds = new Set();
let heatmapOn = false;

function setLoader(text, pct) {
  loaderStep.textContent = text;
  loaderBar.style.width = `${pct}%`;
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

setLoader("Загрузка карты…", 10);

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

(async function init() {
  try {
    setLoader("Загрузка данных КПП…", 30);

    const resp = await fetch("data/checkpoints.geojson", { cache: "no-store" });
    geo = await resp.json();

    allFeatures = (geo.features || [])
      .filter(f => f && f.geometry && f.geometry.type === "Point")
      .map(f => {
        const p = f.properties || {};
        return {
          ...f,
          properties: {
            ...p,
            __id: String(p.checkpoint_id || ""),
            __name: p.checkpoint_name || "Без названия",
            __type: normalizeType(p.checkpoint_type),
            __status: normalizeStatus(p.current_status),
            __subject: p.subject_name || "—",
            __country: p.neighbor_country || "—"
          }
        };
      });

    updateDateEl.textContent = new Date().toLocaleDateString("ru-RU");

    fillFilters();
    buildLegend();
    applyFilters();

    map.on("load", () => {
      addLayers();
      setLoader("Готово", 100);
      loader.style.display = "none";
      map.resize();
    });
  } catch (e) {
    console.error(e);
    setLoader("Ошибка загрузки", 100);
  }
})();

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

function applyFilters() {
  const q = (searchEl.value || "").toLowerCase().trim();
  const t = typeEl.value;
  const s = statusEl.value;

  viewFeatures = allFeatures.filter(f => {
    if (t !== "all" && f.properties.__type !== t) return false;
    if (s !== "all" && f.properties.__status !== s) return false;
    if (!q) return true;

    return (
      String(f.properties.__name).toLowerCase().includes(q) ||
      String(f.properties.__subject).toLowerCase().includes(q) ||
      String(f.properties.__country).toLowerCase().includes(q)
    );
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
        ${f.properties.__type} • ${f.properties.__status}
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll(".item").forEach(el => {
    el.onclick = () => {
      const id = el.dataset.id;
      const f = viewFeatures.find(x => x.properties.__id === id);
      if (!f) return;

      map.easeTo({ center: f.geometry.coordinates, zoom: 7 });

      if (window.innerWidth <= 768 && panel) {
        panel.classList.remove("open");
        setTimeout(() => map.resize(), 300);
      }
    };
  });
}

function addLayers() {
  map.addSource("checkpoints", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: viewFeatures
    },
    cluster: true,
    clusterRadius: 48,
    clusterMaxZoom: 10
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "checkpoints",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#3b82f6",
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
        "Автомобильный", TYPE_COLORS["Автомобильный"],
        "Железнодорожный", TYPE_COLORS["Железнодорожный"],
        "Воздушный", TYPE_COLORS["Воздушный"],
        "Морской", TYPE_COLORS["Морской"],
        "Речной", TYPE_COLORS["Речной"],
        "Пешеходный", TYPE_COLORS["Пешеходный"],
        TYPE_COLORS["Другое"]
      ],
      "circle-opacity": [
        "match",
        ["get", "__status"],
        "Действует", 0.95,
        "Ограничен", 0.7,
        "Временно закрыт", 0.45,
        "Закрыт", 0.25,
        0.6
      ],
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#020617"
    }
  });

  map.on("click", "clusters", e => {
    const f = e.features[0];
    map.getSource("checkpoints").getClusterExpansionZoom(
      f.properties.cluster_id,
      (err, zoom) => {
        if (!err) map.easeTo({ center: f.geometry.coordinates, zoom });
      }
    );
  });

  map.on("mouseenter", "points", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "points", () => {
    map.getCanvas().style.cursor = "";
  });

  map.on("click", "points", e => {
    const f = e.features[0];

    new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "90vw"
    })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-title">${f.properties.__name}</div>
        <div class="popup-sub">
          ${f.properties.__subject} • ${f.properties.__country}<br>
          ${f.properties.__type} • ${f.properties.__status}
        </div>
      `)
      .addTo(map);

    if (window.innerWidth <= 768 && panel) {
      panel.classList.remove("open");
      setTimeout(() => map.resize(), 300);
    }
  });
}

/* Buttons */
toggleHeatmapBtn.onclick = () => {
  heatmapOn = !heatmapOn;

  // heatmap layer optional: if you add it later, handle here
  // currently just toggling button appearance for consistency
  toggleHeatmapBtn.classList.toggle("primary", heatmapOn);
};

clearSelectionBtn.onclick = () => {
  selectedIds.clear();
  renderStats();
};

/* Filters */
searchEl.oninput = applyFilters;
typeEl.onchange = applyFilters;
statusEl.onchange = applyFilters;

/* Mobile toggle + обязательный resize */
const mobileToggle = document.getElementById("mobileToggle");
const panel = document.querySelector(".panel");

if (mobileToggle && panel) {
  mobileToggle.onclick = () => {
    panel.classList.toggle("open");
    setTimeout(() => map.resize(), 300);
  };
}
