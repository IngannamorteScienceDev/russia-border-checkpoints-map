const STYLE_MAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const STYLE_SAT = "https://demotiles.maplibre.org/style.json";

let currentStyle = "map";

const map = new maplibregl.Map({
  container: "map",
  style: STYLE_MAP,
  center: [90, 61],
  zoom: 4
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

const loader = document.getElementById("loader");
const geoBtn = document.getElementById("geoBtn");
const styleToggle = document.getElementById("styleToggle");
const listEl = document.getElementById("list");

let all = [];
let userLocation = null;

function staticMapPreview([lng, lat]) {
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v10/static/${lng},${lat},7/300x150?access_token=pk.eyJ1IjoiZGVtbyIsImEiOiJja3Z6Z2k1ZXQwNnppMnZxaXJ3c2ZzYzBzIn0._demo`;
}

fetch("data/checkpoints.geojson", { cache: "no-store" })
  .then(r => r.json())
  .then(d => {
    all = d.features || [];

    map.on("load", () => {
      map.addSource("checkpoints", {
        type: "geojson",
        data: d
      });

      map.addLayer({
        id: "points",
        type: "circle",
        source: "checkpoints",
        paint: {
          "circle-radius": 6,
          "circle-color": "#3b82f6"
        }
      });

      map.on("click", "points", e => {
        const f = e.features[0];
        const c = f.geometry.coordinates;

        const mini = staticMapPreview(c);

        new maplibregl.Popup()
          .setLngLat(c)
          .setHTML(`
            <b>${f.properties.checkpoint_name}</b><br>
            ${f.properties.checkpoint_type}
            <div class="popup-map" style="background-image:url('${mini}')"></div>
            ${userLocation ? `<a href="https://yandex.ru/maps/?rtext=${userLocation[1]},${userLocation[0]}~${c[1]},${c[0]}" target="_blank">🛣 Маршрут</a>` : ""}
          `)
          .addTo(map);
      });

      renderListGrouped();
      loader.remove();
    });
  });

function renderListGrouped() {
  const groups = {};

  all.forEach(f => {
    const c = f.properties.neighbor_country || "—";
    if (!groups[c]) groups[c] = [];
    groups[c].push(f);
  });

  listEl.innerHTML = Object.entries(groups)
    .map(([country, items]) => `
      <div class="group">🌍 ${country} (${items.length})</div>
      ${items.map(f => `
        <div class="item">
          ${f.properties.checkpoint_name}<br>
          <small>${f.properties.checkpoint_type}</small>
        </div>
      `).join("")}
    `).join("");
}

geoBtn.onclick = () => {
  navigator.geolocation.getCurrentPosition(pos => {
    userLocation = [pos.coords.longitude, pos.coords.latitude];
    map.easeTo({ center: userLocation, zoom: 7 });
  });
};

styleToggle.onclick = () => {
  currentStyle = currentStyle === "map" ? "sat" : "map";
  map.setStyle(currentStyle === "map" ? STYLE_MAP : STYLE_SAT);
};
