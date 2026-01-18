const map = L.map('map', { zoomControl: false }).setView([61, 90], 4);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

const colors = {
  "Автомобильный": "#3b82f6",
  "Железнодорожный": "#22c55e",
  "Воздушный": "#a855f7",
  "Морской": "#0ea5e9",
  "Речной": "#14b8a6",
};

let all = [];
let layer;

fetch("data/checkpoints.geojson")
  .then(r => r.json())
  .then(d => {
    all = d.features;
    initFilters();
    render(all);
    updateStats(all);
  });

function render(features) {
  if (layer) layer.remove();

  layer = L.geoJSON(features, {
    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: 6,
        color: "#020617",
        weight: 1,
        fillColor: colors[f.properties.checkpoint_type] || "#64748b",
        fillOpacity: 0.9
      }),
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.bindPopup(`
        <div style="font-size:14px">
          <strong>${p.checkpoint_name}</strong><br/>
          <span style="color:#94a3b8">${p.checkpoint_type}</span><br/>
          <span>${p.subject_name}</span><br/>
          <em>${p.working_time || "Режим не указан"}</em>
        </div>
      `);
    }
  }).addTo(map);
}

function initFilters() {
  const t = document.getElementById("typeFilter");
  const s = document.getElementById("statusFilter");

  [...new Set(all.map(f => f.properties.checkpoint_type))].forEach(v => {
    t.innerHTML += `<option>${v}</option>`;
  });

  [...new Set(all.map(f => f.properties.status))].forEach(v => {
    s.innerHTML += `<option>${v}</option>`;
  });

  function apply() {
    const tf = t.value;
    const sf = s.value;
    const f = all.filter(x =>
      (tf === "all" || x.properties.checkpoint_type === tf) &&
      (sf === "all" || x.properties.status === sf)
    );
    render(f);
    updateStats(f);
  }

  t.onchange = s.onchange = apply;
}

function updateStats(f) {
  document.getElementById("stats").innerHTML =
    `Отображено КПП: <strong>${f.length}</strong>`;
}
