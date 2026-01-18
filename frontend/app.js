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
let selected = new Set();
let heatmapOn = false;

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

function setLoader(text, pct) {
  loaderStep.textContent = text;
  loaderBar.style.width = `${pct}%`;
}

setLoader("Загрузка карты…", 15);

const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: [90, 61],
  zoom: 4
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

(async function init() {
  setLoader("Загрузка данных КПП…", 35);

  const resp = await fetch("data/checkpoints.geojson");
  geo = await resp.json();

  allFeatures = geo.features.map(f => {
    const p = f.properties || {};
    return {
      ...f,
      id: p.checkpoint_id || f.id,
      properties: {
        ...p,
        __name: p.checkpoint_name || "Без названия",
        __type: normalizeType(p.checkpoint_type),
        __status: p.current_status || "—",
        __subject: p.subject_name || "—",
        __country: p.neighbor_country || "—"
      }
    };
  });

  updateDateEl.textContent = new Date().toLocaleDateString("ru-RU");

  fillFilters();
  buildLegend();
  applyFilters();

  setLoader("Подготовка слоёв…", 65);

  map.on("load", () => {
    addLayers();
    map.resize();
    setLoader("Готово", 100);
    document.getElementById("loader").style.display = "none";
  });
})();

function fillFilters() {
  typeEl.innerHTML =
    `<option value="all">Все типы</option>` +
    [...new Set(allFeatures.map(f => f.properties.__type))]
      .map(t => `<option value="${t}">${t}</option>`).join("");

  statusEl.innerHTML =
    `<option value="all">Все статусы</option>` +
    [...new Set(allFeatures.map(f => f.properties.__status))]
      .map(s => `<option value="${s}">${s}</option>`).join("");
}

function buildLegend() {
  legendEl.innerHTML = `
    <div class="legend-title">Легенда</div>
    <div class="legend-grid">
      ${Object.entries(TYPE_COLORS).map(
        ([k, c]) => `
          <div class="legend-item">
            <span class="dot" style="background:${c}"></span>${k}
          </div>`
      ).join("")}
    </div>
  `;
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
      f.properties.__subject.toLowerCase().includes(q) ||
      f.properties.__country.toLowerCase().includes(q)
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
    Выбрано: <b>${selected.size}</b>
  `;
}

function renderList() {
  listEl.innerHTML = viewFeatures.slice(0, 200).map(f => `
    <div class="item" data-id="${f.id}">
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
      const f = viewFeatures.find(x => String(x.id) === id);
      if (!f) return;
      toggleSelect(id);
      map.easeTo({ center: f.geometry.coordinates, zoom: 7 });
    };
  });
}

function addLayers() {
  map.addSource("checkpoints", {
    type: "geojson",
    data: { type: "FeatureCollection", features: viewFeatures },
    promoteId: "id",
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
    layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 }
  });

  map.addLayer({
    id: "points",
    type: "circle",
    source: "checkpoints",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": 6,
      "circle-color": ["get", "__type", ["literal", TYPE_COLORS]],
      "circle-stroke-width": 1,
      "circle-stroke-color": "#020617"
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

  map.on("click", "points", e => {
    const f = e.features[0];
    toggleSelect(f.id);
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<b>${f.properties.__name}</b>`)
      .addTo(map);
  });
}

function toggleSelect(id) {
  if (selected.has(id)) {
    selected.delete(id);
    map.setFeatureState({ source: "checkpoints", id }, { selected: false });
  } else {
    selected.add(id);
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
  selected.forEach(id =>
    map.setFeatureState({ source: "checkpoints", id }, { selected: false })
  );
  selected.clear();
  renderStats();
};

searchEl.oninput = applyFilters;
typeEl.onchange = applyFilters;
statusEl.onchange = applyFilters;
