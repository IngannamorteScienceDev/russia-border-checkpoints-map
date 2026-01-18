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

(async function init() {
  try {
    setLoader("Загрузка данных КПП…", 30);

    const resp = await fetch("data/checkpoints.geojson", { cache: "no-store" });
    geo = await resp.json();

    allFeatures = (geo.features || [])
      .filter(f => f && f.geometry && f.geometry.type === "Point")
      .map(f => {
        const p = f.properties || {};
        const id = String(p.checkpoint_id || f.id || "");

        return {
          ...f,
          properties: {
            ...p,
            __id: id,
            __name: p.checkpoint_name || "Без названия",
            __type: normalizeType(p.checkpoint_type),
            __status: normalizeStatus(p.current_status),
            __subject: p.subject_name || "—",
            __country: p.neighbor_country || "—"
          }
        };
      })
      .filter(f => f.properties.__id);

    updateDateEl.textContent = new Date().toLocaleDateString("ru-RU");

    fillFilters();
    buildLegend();
    applyFilters();

    setLoader("Подготовка слоёв…", 65);

    map.on("load", () => {
      addSourcesAndLayers();
      map.resize();
      setLoader("Готово", 100);
      loader.style.display = "none";
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
      ${Object.entries(TYPE_COLORS).map(([k, c]) => `
        <div class="legend-item">
          <span class="dot" style="background:${c}"></span>${k}
        </div>
      `).join("")}
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
      toggleSelect(id);
      map.easeTo({ center: f.geometry.coordinates, zoom: 7 });
    };
  });
}

function addSourcesAndLayers() {
  map.addSource("checkpoints", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: viewFeatures
    },
    promoteId: "__id",
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
      "circle-stroke-width": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        3,
        ["case", ["==", ["get", "__status"], "Закрыт"], 2.5, 1]
      ],
      "circle-stroke-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        "#facc15",
        ["case", ["==", ["get", "__status"], "Закрыт"], "#ef4444", "#020617"]
      ]
    }
  });

  map.addLayer({
    id: "heatmap",
    type: "heatmap",
    source: "checkpoints",
    layout: { visibility: "none" },
    paint: {
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 1.4],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 18, 8, 42],
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, "rgba(0,0,0,0)",
        0.25, "rgba(59,130,246,.9)",
        0.45, "rgba(14,165,233,.95)",
        0.65, "rgba(34,197,94,.95)",
        0.85, "rgba(250,204,21,.95)",
        1, "rgba(239,68,68,.98)"
      ],
      "heatmap-opacity": 0.85
    }
  });

  bindMapEvents();
}

function bindMapEvents() {
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
    toggleSelect(f.properties.__id);

    new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-title">${f.properties.__name}</div>
        <div class="popup-sub">
          ${f.properties.__subject} • ${f.properties.__country}<br>
          ${f.properties.__type} • ${f.properties.__status}
        </div>
      `)
      .addTo(map);
  });
}

function toggleSelect(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    map.setFeatureState({ source: "checkpoints", id }, { selected: false });
  } else {
    selectedIds.add(id);
    map.setFeatureState({ source: "checkpoints", id }, { selected: true });
  }
  renderStats();
}

toggleHeatmapBtn.onclick = () => {
  heatmapOn = !heatmapOn;
  map.setLayoutProperty("heatmap", "visibility", heatmapOn ? "visible" : "none");
  map.setLayoutProperty("clusters", "visibility", heatmapOn ? "none" : "visible");
  map.setLayoutProperty("cluster-count", "visibility", heatmapOn ? "none" : "visible");
  map.setLayoutProperty("points", "visibility", heatmapOn ? "none" : "visible");
  toggleHeatmapBtn.classList.toggle("primary", heatmapOn);
};

clearSelectionBtn.onclick = () => {
  selectedIds.forEach(id =>
    map.setFeatureState({ source: "checkpoints", id }, { selected: false })
  );
  selectedIds.clear();
  renderStats();
};

searchEl.oninput = applyFilters;
typeEl.onchange = applyFilters;
statusEl.onchange = applyFilters;
