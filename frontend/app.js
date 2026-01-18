const BASE_STYLE =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const COLORS = {
  "Автомобильный": "#3b82f6",
  "Железнодорожный": "#22c55e",
  "Воздушный": "#a855f7",
  "Морской": "#0ea5e9",
  "Речной": "#14b8a6",
};

let geoData;
let filtered = [];

let nightMode = true;
let roadsMode = false;
let threeDMode = false;

let roadLayers = [];
let labelLayers = [];
let buildingSource = null;

const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: [90, 61],
  zoom: 4,
  antialias: true,
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

fetch("data/checkpoints.geojson")
  .then(r => r.json())
  .then(data => {
    geoData = data;
    filtered = data.features;

    initUI();

    map.on("style.load", () => {
      indexStyle();
      addCheckpoints();
      applyTheme();
      applyRoads();
      if (threeDMode) apply3D();
    });

    map.once("load", () => {
      map.easeTo({ zoom: 4.6, pitch: 30, bearing: -10, duration: 1600 });
    });
  });

function initUI() {
  const typeFilter = document.getElementById("typeFilter");
  const statusFilter = document.getElementById("statusFilter");
  const searchInput = document.getElementById("searchInput");

  const types = [...new Set(geoData.features.map(f => f.properties.checkpoint_type))];
  const statuses = [...new Set(geoData.features.map(f => f.properties.status))];

  fill(typeFilter, types);
  fill(statusFilter, statuses);

  typeFilter.onchange = filter;
  statusFilter.onchange = filter;
  searchInput.oninput = debounce(filter, 150);

  document.getElementById("toggleTheme").onclick = () => {
    nightMode = !nightMode;
    applyTheme();
  };

  document.getElementById("toggleRoads").onclick = () => {
    roadsMode = !roadsMode;
    applyRoads();
  };

  document.getElementById("toggle3D").onclick = () => {
    threeDMode = !threeDMode;
    apply3D();
  };
}

function indexStyle() {
  const style = map.getStyle();
  roadLayers = [];
  labelLayers = [];

  const sources = style.sources || {};
  buildingSource = Object.keys(sources).find(k => sources[k].type === "vector");

  for (const l of style.layers) {
    const id = l.id.toLowerCase();
    if (l.type === "line" && id.includes("road")) roadLayers.push(l.id);
    if (l.type === "symbol" && id.includes("label")) labelLayers.push(l.id);
  }
}

function addCheckpoints() {
  if (map.getSource("checkpoints")) return;

  map.addSource("checkpoints", {
    type: "geojson",
    data: { type: "FeatureCollection", features: filtered },
    promoteId: "checkpoint_id"
  });

  map.addLayer({
    id: "checkpoints-layer",
    type: "circle",
    source: "checkpoints",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, 8, 8],
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
    }
  });

  map.on("click", "checkpoints-layer", e => {
    const p = e.features[0].properties;
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<b>${p.checkpoint_name}</b><br>${p.checkpoint_type}<br>${p.subject_name}`)
      .addTo(map);
  });

  updateStats(filtered);
}

function filter() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const t = document.getElementById("typeFilter").value;
  const s = document.getElementById("statusFilter").value;

  filtered = geoData.features.filter(f => {
    const p = f.properties;
    return (
      (t === "all" || p.checkpoint_type === t) &&
      (s === "all" || p.status === s) &&
      (!q || `${p.checkpoint_name} ${p.subject_name}`.toLowerCase().includes(q))
    );
  });

  map.getSource("checkpoints").setData({
    type: "FeatureCollection",
    features: filtered
  });

  updateStats(filtered);
}

function applyTheme() {
  for (const id of labelLayers) {
    try { map.setPaintProperty(id, "text-opacity", nightMode ? 0.7 : 1); } catch {}
  }
}

function applyRoads() {
  for (const id of roadLayers) {
    try {
      map.setPaintProperty(id, "line-width",
        roadsMode ? ["interpolate",["linear"],["zoom"],4,1.5,10,4]
                  : ["interpolate",["linear"],["zoom"],4,0.8,10,2.5]);
    } catch {}
  }
}

function apply3D() {
  map.easeTo({ pitch: threeDMode ? 55 : 0, bearing: threeDMode ? -12 : 0 });

  if (!threeDMode && map.getLayer("3d")) map.removeLayer("3d");
  if (!threeDMode || !buildingSource || map.getLayer("3d")) return;

  map.addLayer({
    id: "3d",
    type: "fill-extrusion",
    source: buildingSource,
    "source-layer": "building",
    minzoom: 12,
    paint: {
      "fill-extrusion-height": ["get", "height"],
      "fill-extrusion-color": "rgba(148,163,184,.45)",
      "fill-extrusion-opacity": 0.5
    }
  });
}

function fill(select, arr) {
  arr.filter(Boolean).sort().forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}

function debounce(fn, ms) {
  let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); };
}

function updateStats(arr) {
  document.getElementById("stats").innerHTML =
    `Отображено КПП: <b>${arr.length}</b>`;
}
