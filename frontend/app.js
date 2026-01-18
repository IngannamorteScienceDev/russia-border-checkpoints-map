// =====================================================
// КПП РФ — MapLibre GL
// =====================================================

const DAY_STYLE = "https://demotiles.maplibre.org/style.json";
const NIGHT_STYLE = "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json";

let currentStyle = "night";
let geoData = null;

// ─────────────────────────────────────────────────────
// Инициализация карты
// ─────────────────────────────────────────────────────

const map = new maplibregl.Map({
  container: "map",
  style: NIGHT_STYLE,
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
    map.on("load", initMap);
    initUI();
  });

// ─────────────────────────────────────────────────────
// Карта и слой КПП
// ─────────────────────────────────────────────────────

function initMap() {
  if (map.getSource("checkpoints")) return;

  map.addSource("checkpoints", {
    type: "geojson",
    data: geoData,
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
        "Автомобильный", "#3b82f6",
        "Железнодорожный", "#22c55e",
        "Воздушный", "#a855f7",
        "Морской", "#0ea5e9",
        "Речной", "#14b8a6",
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

  updateStats(geoData.features);
}

// ─────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────

function initUI() {
  document.getElementById("toggleTheme").onclick = toggleTheme;

  const types = uniq(geoData.features.map(f => f.properties.checkpoint_type));
  const statuses = uniq(geoData.features.map(f => f.properties.status));

  fillSelect("typeFilter", types);
  fillSelect("statusFilter", statuses);

  document.getElementById("typeFilter").onchange = applyFilters;
  document.getElementById("statusFilter").onchange = applyFilters;
  document.getElementById("searchInput").oninput = debounce(applyFilters, 150);
}

// ─────────────────────────────────────────────────────
// Переключение темы
// ─────────────────────────────────────────────────────

function toggleTheme() {
  currentStyle = currentStyle === "day" ? "night" : "day";
  map.setStyle(currentStyle === "day" ? DAY_STYLE : NIGHT_STYLE);

  map.once("styledata", () => {
    initMap();
  });
}

// ─────────────────────────────────────────────────────
// Фильтрация
// ─────────────────────────────────────────────────────

function applyFilters() {
  const typeVal = document.getElementById("typeFilter").value;
  const statusVal = document.getElementById("statusFilter").value;
  const q = document.getElementById("searchInput").value.toLowerCase();

  const filtered = geoData.features.filter(f => {
    const p = f.properties;

    const matchesType = typeVal === "all" || p.checkpoint_type === typeVal;
    const matchesStatus = statusVal === "all" || p.status === statusVal;

    const text = [
      p.checkpoint_name,
      p.subject_name,
      p.foreign_country,
      p.address,
    ].join(" ").toLowerCase();

    return matchesType && matchesStatus && (!q || text.includes(q));
  });

  map.getSource("checkpoints").setData({
    type: "FeatureCollection",
    features: filtered,
  });

  updateStats(filtered);
}

// ─────────────────────────────────────────────────────
// Вспомогательные
// ─────────────────────────────────────────────────────

function fillSelect(id, values) {
  const el = document.getElementById(id);
  values.filter(Boolean).sort().forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    el.appendChild(o);
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
  document.getElementById("stats").innerHTML =
    `Отображено КПП: <strong>${features.length}</strong>`;
}

function buildPopup(p) {
  return `
    <div class="popup-card">
      <strong>${p.checkpoint_name}</strong><br/>
      ${p.checkpoint_type} • ${p.status}<br/>
      ${p.subject_name}<br/>
      <em>${p.working_time || "Режим не указан"}</em>
    </div>
  `;
}
