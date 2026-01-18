const BASE_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const searchEl = document.getElementById("searchInput");
const typeEl = document.getElementById("typeFilter");
const statusEl = document.getElementById("statusFilter");
const legendEl = document.getElementById("legend");
const statsEl = document.getElementById("stats");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("emptyState");

const mobileToggle = document.getElementById("mobileToggle");
const panel = document.querySelector(".panel");
const geoBtn = document.getElementById("geoBtn");

let allFeatures = [];
let viewFeatures = [];
let selectedId = null;
let userMarker = null;

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

/* ===== Load data ===== */

fetch("data/checkpoints.geojson", { cache: "no-store" })
  .then(r => r.json())
  .then(data => {
    allFeatures = (data.features || []).filter(
      f => f.geometry && f.geometry.type === "Point"
    );
    viewFeatures = allFeatures;

    map.on("load", () => {
      addLayers();
      map.resize();
    });
  });

/* ===== Layers ===== */

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
      "circle-radius": 18
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
      "circle-color": "#22c55e"
    }
  });
}

/* ===== Geolocation ===== */

geoBtn.onclick = () => {
  if (!navigator.geolocation) {
    alert("Геолокация не поддерживается браузером");
    return;
  }

  geoBtn.textContent = "⏳";

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lng = pos.coords.longitude;
      const lat = pos.coords.latitude;

      if (userMarker) userMarker.remove();

      userMarker = new maplibregl.Marker({ color: "#f97316" })
        .setLngLat([lng, lat])
        .addTo(map);

      map.easeTo({ center: [lng, lat], zoom: 8 });

      geoBtn.textContent = "📍";
    },
    () => {
      alert("Не удалось получить местоположение");
      geoBtn.textContent = "📍";
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
};

/* ===== Mobile ===== */

mobileToggle.onclick = () => {
  panel.classList.toggle("open");
  setTimeout(() => map.resize(), 300);
};
