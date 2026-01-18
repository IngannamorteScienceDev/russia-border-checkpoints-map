/* ===== Configuration ===== */

const BASE_STYLE =
  "https://raw.githubusercontent.com/maplibre/demotiles/gh-pages/style.json";

const COLORS = {
  "Автомобильный": "#3b82f6",
  "Железнодорожный": "#22c55e",
  "Воздушный": "#a855f7",
  "Морской": "#0ea5e9",
  "Речной": "#14b8a6",
};

/* ===== State ===== */

let geoData = null;
let selectedIds = new Set();
let heatmapEnabled = false;

/* ===== DOM ===== */

const loader = document.getElementById("loader");
const statsEl = document.getElementById("stats");
const updateDateEl = document.getElementById("updateDate");

/* ===== Map init ===== */

const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: [90, 61],
  zoom: 4,
  antialias: true,
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

map.once("load", () => {
  loader.classList.add("hidden");
});

/* ===== Data loading ===== */

fetch("data/checkpoints.geojson")
  .then(r => r.json())
  .then(data => {
    geoData = data;
    updateDateEl.textContent = new Date().toLocaleDateString("ru-RU");
    addSource();
    addPointLayer();
    addHeatmapLayer();
    updateStats();
  });

/* ===== Sources ===== */

function addSource() {
  map.addSource("checkpoints", {
    type: "geojson",
    data: geoData,
    promoteId: "checkpoint_id",
  });
}

/* ===== Layers ===== */

function addPointLayer() {
  map.addLayer({
    id: "points",
    type: "circle",
    source: "checkpoints",
    paint: {
      "circle-radius": 6,
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
      "circle-stroke-width": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        3, 1
      ],
      "circle-stroke-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        "#facc15", "#020617"
      ]
    }
  });

  map.on("click", "points", e => {
    const f = e.features[0];
    const id = f.id ?? f.properties.checkpoint_id;
    toggleSelect(id);

    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `<b>${f.properties.checkpoint_name}</b><br>${f.properties.subject_name}`
      )
      .addTo(map);
  });
}

function addHeatmapLayer() {
  map.addLayer({
    id: "heatmap",
    type: "heatmap",
    source: "checkpoints",
    layout: { visibility: "none" },
    paint: {
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 18, 7, 40],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 7, 1.2],
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, "rgba(0,0,0,0)",
        0.3, "#3b82f6",
        0.6, "#22c55e",
        0.85, "#facc15",
        1, "#ef4444"
      ]
    }
  });
}

/* ===== UI ===== */

document.getElementById("toggleHeatmap").onclick = () => {
  heatmapEnabled = !heatmapEnabled;
  map.setLayoutProperty("points", "visibility", heatmapEnabled ? "none" : "visible");
  map.setLayoutProperty("heatmap", "visibility", heatmapEnabled ? "visible" : "none");
};

document.getElementById("btnExport").onclick = () => {
  const rows = geoData.features
    .filter(f => selectedIds.has(f.properties.checkpoint_id))
    .map(f => {
      const p = f.properties;
      const [lon, lat] = f.geometry.coordinates;
      return `"${p.checkpoint_name}","${p.subject_name}",${lat},${lon}`;
    });

  if (!rows.length) {
    alert("Нет выбранных КПП");
    return;
  }

  const csv = "name,region,lat,lon\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "selected_checkpoints.csv";
  a.click();
};

/* ===== Helpers ===== */

function toggleSelect(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    map.setFeatureState({ source: "checkpoints", id }, { selected: false });
  } else {
    selectedIds.add(id);
    map.setFeatureState({ source: "checkpoints", id }, { selected: true });
  }
  updateStats();
}

function updateStats() {
  statsEl.innerHTML =
    `Всего КПП: <b>${geoData.features.length}</b><br>
     Выбрано КПП: <b>${selectedIds.size}</b>`;
}
