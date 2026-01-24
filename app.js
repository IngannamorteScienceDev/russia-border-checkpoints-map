const STYLE_MAP = "https://demotiles.maplibre.org/style.json";
const STYLE_SAT = "https://api.maptiler.com/maps/satellite/style.json?key=Get_Your_Own_Key";

let currentStyle = STYLE_MAP;

const map = new maplibregl.Map({
  container: "map",
  style: currentStyle,
  center: [90, 60],
  zoom: 3
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

let data;
let filters = { type: "", country: "", search: "" };

fetch("checkpoints.geojson")
  .then(r => r.json())
  .then(json => {
    data = json;
    init();
  });

function init() {
  addSourceAndLayer();
  buildFilters();
  renderList();
}

function addSourceAndLayer() {
  if (map.getSource("kpp")) return;

  map.addSource("kpp", {
    type: "geojson",
    data
  });

  map.addLayer({
    id: "kpp-points",
    type: "circle",
    source: "kpp",
    paint: {
      "circle-radius": 6,
      "circle-color": ["get", "color"],
      "circle-stroke-width": 1,
      "circle-stroke-color": "#000"
    }
  });

  map.on("click", "kpp-points", e => {
    const f = e.features[0];
    openPopup(f);
  });

  map.on("mouseenter", "kpp-points", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "kpp-points", () => map.getCanvas().style.cursor = "");
}

function openPopup(feature) {
  const c = feature.geometry.coordinates;
  const p = feature.properties;

  const html = `
    <h3>${p.name}</h3>
    <div>Субъект РФ: ${p.region || "—"}</div>
    <div>Страна: ${p.country || "—"}</div>
    <div>Тип: ${p.type}</div>
    <div>Статус: ${p.status || "—"}</div>
    <div>Координаты: ${c[1].toFixed(5)}, ${c[0].toFixed(5)}</div>
    <div style="margin-top:8px;height:160px" id="mini-map"></div>
  `;

  const popup = new maplibregl.Popup({ offset: 12 })
    .setLngLat(c)
    .setHTML(html)
    .addTo(map);

  setTimeout(() => {
    const mini = new maplibregl.Map({
      container: "mini-map",
      style: currentStyle,
      center: c,
      zoom: 10,
      interactive: false
    });
    mini.once("load", () => mini.resize());
  }, 0);
}

function applyFilters() {
  const f = ["all"];

  if (filters.type) f.push(["==", ["get", "type"], filters.type]);
  if (filters.country) f.push(["==", ["get", "country"], filters.country]);
  if (filters.search)
    f.push(["in", filters.search.toLowerCase(), ["downcase", ["get", "name"]]]);

  map.setFilter("kpp-points", f);
}

function buildFilters() {
  const types = new Set();
  const countries = new Set();

  data.features.forEach(f => {
    types.add(f.properties.type);
    if (f.properties.country) countries.add(f.properties.country);
  });

  const ft = document.getElementById("filter-type");
  const fc = document.getElementById("filter-country");

  [...types].sort().forEach(t => ft.innerHTML += `<option>${t}</option>`);
  [...countries].sort().forEach(c => fc.innerHTML += `<option>${c}</option>`);

  ft.onchange = e => { filters.type = e.target.value; applyFilters(); renderList(); };
  fc.onchange = e => { filters.country = e.target.value; applyFilters(); renderList(); };

  document.getElementById("search").oninput = e => {
    filters.search = e.target.value;
    applyFilters();
    renderList();
  };

  document.getElementById("btn-style").onclick = toggleStyle;
}

function toggleStyle() {
  currentStyle = currentStyle === STYLE_MAP ? STYLE_SAT : STYLE_MAP;

  map.setStyle(currentStyle);
  map.once("style.load", () => {
    addSourceAndLayer();
    applyFilters();
  });
}

function renderList() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  data.features
    .filter(f => {
      if (filters.type && f.properties.type !== filters.type) return false;
      if (filters.country && f.properties.country !== filters.country) return false;
      if (filters.search && !f.properties.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    })
    .forEach(f => {
      const d = document.createElement("div");
      d.className = "item";
      d.innerHTML = `<b>${f.properties.name}</b><br>${f.properties.type}`;
      d.onclick = () => {
        map.flyTo({ center: f.geometry.coordinates, zoom: 9 });
        openPopup(f);
      };
      list.appendChild(d);
    });
}
