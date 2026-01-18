const map = L.map('map').setView([61, 90], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
}).addTo(map);

const typeColors = {
  "Автомобильный": "#2563eb",
  "Железнодорожный": "#16a34a",
  "Воздушный": "#9333ea",
  "Морской": "#0284c7",
  "Речной": "#0d9488",
};

let geoLayer;
let allFeatures = [];

fetch('data/checkpoints.geojson')
  .then(res => res.json())
  .then(data => {
    allFeatures = data.features;
    initFilters(allFeatures);
    renderStats(allFeatures);
    renderLayer(allFeatures);
  });

function getColor(type) {
  return typeColors[type] || "#6b7280";
}

function renderLayer(features) {
  if (geoLayer) geoLayer.remove();

  geoLayer = L.geoJSON(features, {
    pointToLayer: (feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 6,
        fillColor: getColor(feature.properties.checkpoint_type),
        color: "#fff",
        weight: 1,
        fillOpacity: 0.9,
      }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <strong>${p.checkpoint_name}</strong><br/>
        Тип: ${p.checkpoint_type}<br/>
        Статус: ${p.status}<br/>
        Регион: ${p.subject_name}<br/>
        Режим: ${p.working_time || "—"}
      `);
    }
  }).addTo(map);
}

function initFilters(features) {
  const typeSelect = document.getElementById("typeFilter");
  const statusSelect = document.getElementById("statusFilter");

  const types = new Set();
  const statuses = new Set();

  features.forEach(f => {
    types.add(f.properties.checkpoint_type);
    statuses.add(f.properties.status);
  });

  types.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });

  statuses.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    statusSelect.appendChild(opt);
  });

  function applyFilters() {
    const tVal = typeSelect.value;
    const sVal = statusSelect.value;

    const filtered = allFeatures.filter(f =>
      (tVal === "all" || f.properties.checkpoint_type === tVal) &&
      (sVal === "all" || f.properties.status === sVal)
    );

    renderStats(filtered);
    renderLayer(filtered);
  }

  typeSelect.addEventListener("change", applyFilters);
  statusSelect.addEventListener("change", applyFilters);
}

function renderStats(features) {
  const el = document.getElementById("stats");
  el.innerHTML = `
    Всего отображено: <strong>${features.length}</strong>
  `;
}
