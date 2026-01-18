const BASE_STYLE =
  "https://raw.githubusercontent.com/maplibre/demotiles/gh-pages/style.json";

const COLORS = {
  "Автомобильный": "#3b82f6",
  "Железнодорожный": "#22c55e",
  "Воздушный": "#a855f7",
  "Морской": "#0ea5e9",
  "Речной": "#14b8a6",
};

let geoData;
let nightMode = true;
let roadsMode = false;
let threeDMode = false;
let tourMode = false;
let tourTimer = null;

const TOUR_POINTS = [
  { center: [20.5, 54.7], zoom: 6 },
  { center: [44.5, 43.7], zoom: 6 },
  { center: [66, 52], zoom: 5 },
  { center: [86, 51], zoom: 6 },
  { center: [132, 47], zoom: 5 },
];

const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: [90, 61],
  zoom: 4,
  pitch: 35,
  bearing: -10,
  antialias: true,
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

map.on("error", e => console.error("Map error:", e.error));

fetch("data/checkpoints.geojson")
  .then(r => r.json())
  .then(data => {
    geoData = data;

    map.on("style.load", () => {
      document.body.classList.toggle("night", nightMode);
      applyFog();
      addLayers();
    });
  });

function applyFog() {
  try {
    map.setFog({
      range: nightMode ? [0.8, 8] : [0.6, 10],
      color: nightMode ? "rgb(2,6,23)" : "rgb(226,232,240)",
      "high-color": nightMode ? "rgb(15,23,42)" : "rgb(248,250,252)",
      "space-color": nightMode ? "rgb(2,6,23)" : "rgb(226,232,240)",
      "horizon-blend": 0.25,
      starIntensity: nightMode ? 0.15 : 0.0
    });
  } catch {}
}

function addLayers() {
  if (map.getSource("checkpoints")) return;

  map.addSource("checkpoints", {
    type: "geojson",
    data: geoData,
    cluster: true,
    clusterRadius: 60,
    clusterMaxZoom: 9,
    promoteId: "checkpoint_id",
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "checkpoints",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "rgba(59,130,246,0.18)",
      "circle-stroke-color": "rgba(59,130,246,0.7)",
      "circle-radius": ["step", ["get", "point_count"], 16, 25, 22, 60, 28],
    },
  });

  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "checkpoints",
    filter: ["has", "point_count"],
    layout: {
      "text-field": "{point_count_abbreviated}",
      "text-size": 12
    },
    paint: {
      "text-color": "#e5e7eb"
    }
  });

  map.addLayer({
    id: "points",
    type: "circle",
    source: "checkpoints",
    filter: ["!", ["has", "point_count"]],
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
      "circle-opacity": 0.95,
      "circle-blur": 0.4,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#020617"
    }
  });

  map.on("mouseenter", "points", () => {
    map.getCanvas().style.cursor = "pointer";
    map.setPaintProperty("points", "circle-blur", 0.7);
  });

  map.on("mouseleave", "points", () => {
    map.getCanvas().style.cursor = "";
    map.setPaintProperty("points", "circle-blur", 0.4);
  });

  map.on("click", "clusters", e => {
    const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
    const clusterId = features[0].properties.cluster_id;
    map.getSource("checkpoints").getClusterExpansionZoom(clusterId, (err, zoom) => {
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    });
  });
}

// UI buttons
document.getElementById("toggleTheme").onclick = () => {
  nightMode = !nightMode;
  document.body.classList.toggle("night", nightMode);
  applyFog();
};

document.getElementById("toggleTour").onclick = () => {
  tourMode = !tourMode;
  tourMode ? startTour() : stopTour();
};

function startTour() {
  let i = 0;
  stopTour();
  tourTimer = setInterval(() => {
    const p = TOUR_POINTS[i++ % TOUR_POINTS.length];
    map.easeTo({
      center: p.center,
      zoom: p.zoom,
      pitch: 55,
      bearing: -15,
      duration: 3500
    });
  }, 4200);
}

function stopTour() {
  if (tourTimer) clearInterval(tourTimer);
}
