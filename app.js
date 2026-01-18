const BASE_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

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
const geoBtn = document.getElementById("geoBtn");
const mobileToggle = document.getElementById("mobileToggle");
const panel = document.querySelector(".panel");
const loaderEl = document.getElementById("loader");

let allFeatures = [];
let viewFeatures = [];
let selectedId = null;
let debounceTimer = null;
let userMarker = null;

const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: [90, 61],
  zoom: 4
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

function normalizeType(v) {
  v = String(v || "").toLowerCase();
  if (v.includes("авто")) return "Автомобильный";
  if (v.includes("желез")) return "Железнодорожный";
  if (v.includes("воздуш")) return "Воздушный";
  if (v.includes("морск")) return "Морской";
  if (v.includes("речн")) return "Речной";
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

fetch("data/checkpoints.geojson", { cache: "no-store" })
  .then(r => r.json())
  .then(data => {
    allFeatures = (data.features || []).map(f => ({
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

    viewFeatures = allFeatures;
    renderStats();
    renderList();

    map.on("load", () => {
      addLayers();
      map.resize();
      loaderEl.style.opacity = "0";
      setTimeout(() => loaderEl.remove(), 300);
    });
  });

function fillFilters() {
  typeEl.innerHTML = `<option value="all">Все типы</option>` +
    [...new Set(allFeatures.map(f => f.properties.__type))].map(v => `<option>${v}</option>`).join("");

  statusEl.innerHTML = `<option value="all">Все статусы</option>` +
    [...new Set(allFeatures.map(f => f.properties.__status))].map(v => `<option>${v}</option>`).join("");
}

function applyFilters() {
  const q = searchEl.value.toLowerCase();
  const t = typeEl.value;
  const s = statusEl.value;

  viewFeatures = allFeatures.filter(f =>
    (t === "all" || f.properties.__type === t) &&
    (s === "all" || f.properties.__status === s) &&
    (!q || f.properties.__name.toLowerCase().includes(q))
  );

  updateSource();
  renderStats();
  renderList();
  emptyEl.style.display = viewFeatures.length ? "none" : "block";
}

function updateSource() {
  const src = map.getSource("checkpoints");
  if (src) src.setData({ type: "FeatureCollection", features: viewFeatures });
}

function renderStats() {
  statsEl.innerHTML = `Всего: <b>${allFeatures.length}</b><br>Показано: <b>${viewFeatures.length}</b>`;
}

function renderList() {
  listEl.innerHTML = viewFeatures.slice(0, 200).map(f => `
    <div class="item ${f.properties.__id === selectedId ? "active" : ""}" data-id="${f.properties.__id}">
      <div>${f.properties.__name}</div>
      <small>${f.properties.__type} • ${f.properties.__status}</small>
    </div>`).join("");

  listEl.querySelectorAll(".item").forEach(el =>
    el.onclick = () => focusFeature(el.dataset.id)
  );
}

function buildLegend() {
  legendEl.innerHTML = Object.entries(TYPE_COLORS)
    .map(([k, c]) => `<div><span style="color:${c}">●</span> ${k}</div>`).join("");
}

function addLayers() {
  map.addSource("checkpoints", {
    type: "geojson",
    data: { type: "FeatureCollection", features: viewFeatures },
    cluster: true
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "checkpoints",
    filter: ["has", "point_count"],
    paint: { "circle-color": "#3b82f6", "circle-radius": 18 }
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
      "circle-color": ["match", ["get", "__type"],
        "Автомобильный", TYPE_COLORS["Автомобильный"],
        "Железнодорожный", TYPE_COLORS["Железнодорожный"],
        "Воздушный", TYPE_COLORS["Воздушный"],
        "Морской", TYPE_COLORS["Морской"],
        "Речной", TYPE_COLORS["Речной"],
        "Пешеходный", TYPE_COLORS["Пешеходный"],
        TYPE_COLORS["Другое"]
      ]
    }
  });

  map.on("click", "points", e => {
    focusFeature(e.features[0].properties.__id, e.lngLat);
  });
}

function focusFeature(id, coords) {
  const f = viewFeatures.find(x => x.properties.__id === id);
  if (!f) return;

  selectedId = id;
  renderList();

  map.easeTo({ center: coords || f.geometry.coordinates, zoom: 7 });

  new maplibregl.Popup()
    .setLngLat(coords || f.geometry.coordinates)
    .setHTML(`<b>${f.properties.__name}</b><br>${f.properties.__type} • ${f.properties.__status}`)
    .addTo(map);
}

geoBtn.onclick = () => {
  navigator.geolocation.getCurrentPosition(pos => {
    const c = [pos.coords.longitude, pos.coords.latitude];
    if (userMarker) userMarker.remove();
    userMarker = new maplibregl.Marker({ color: "#f97316" }).setLngLat(c).addTo(map);
    map.easeTo({ center: c, zoom: 8 });
  });
};

searchEl.oninput = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilters, 300);
};

typeEl.onchange = applyFilters;
statusEl.onchange = applyFilters;

mobileToggle.onclick = () => {
  panel.classList.toggle("open");
  setTimeout(() => map.resize(), 300);
};
