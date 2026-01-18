// =====================================================
// КПП РФ — MapLibre GL (roads highlight + 3D + polish)
// Без API-ключей: используем MapLibre demotiles style
// =====================================================

const BASE_STYLE = "https://demotiles.maplibre.org/style.json";

const COLORS = {
  "Автомобильный": getCss("--auto"),
  "Железнодорожный": getCss("--rail"),
  "Воздушный": getCss("--air"),
  "Морской": getCss("--sea"),
  "Речной": getCss("--river"),
};

function getCss(varName){
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// UI refs
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const statusFilter = document.getElementById("statusFilter");
const statsEl = document.getElementById("stats");

const btnTheme = document.getElementById("toggleTheme");
const btnRoads = document.getElementById("toggleRoads");
const btn3d = document.getElementById("toggle3D");

// State
let geoData = null;
let currentFeatures = [];
let nightMode = true;
let roadsMode = false;
let threeDMode = false;

// Cached style layer ids to tweak
let transportationLayerIds = [];
let labelLayerIds = [];
let buildingSourceName = null;

// Map init
const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: [90, 61],
  zoom: 3.8,
  antialias: true,
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

// Load data
fetch("data/checkpoints.geojson")
  .then(r => r.json())
  .then(data => {
    geoData = data;
    currentFeatures = data.features || [];
    initUI();
    map.on("load", () => {
      indexStyleLayers();      // найдём дороги/лейблы/источник зданий
      applyThemeToStyle();     // ночной вид (без смены стиля)
      addCheckpointsLayer();   // слой КПП
      updateStats(currentFeatures);
    });
  })
  .catch(err => {
    statsEl.innerHTML = `Ошибка загрузки GeoJSON: ${escapeHtml(String(err))}`;
  });

function initUI(){
  btnTheme.addEventListener("click", () => {
    nightMode = !nightMode;
    btnTheme.classList.toggle("active", nightMode);
    btnTheme.textContent = nightMode ? "🌗 Ночь" : "☀️ День";
    applyThemeToStyle();
  });

  btnRoads.addEventListener("click", () => {
    roadsMode = !roadsMode;
    btnRoads.classList.toggle("active", roadsMode);
    applyRoadHighlight();
  });

  btn3d.addEventListener("click", () => {
    threeDMode = !threeDMode;
    btn3d.classList.toggle("active", threeDMode);
    apply3D();
  });

  const types = uniq(currentFeatures.map(f => f.properties?.checkpoint_type).filter(Boolean));
  const statuses = uniq(currentFeatures.map(f => f.properties?.status).filter(Boolean));

  fillSelect(typeFilter, types);
  fillSelect(statusFilter, statuses);

  const debounced = debounce(applyFilters, 160);
  typeFilter.addEventListener("change", applyFilters);
  statusFilter.addEventListener("change", applyFilters);
  searchInput.addEventListener("input", debounced);

  // Default button states
  btnTheme.classList.toggle("active", nightMode);
  btnRoads.classList.toggle("active", roadsMode);
  btn3d.classList.toggle("active", threeDMode);
  btnTheme.textContent = "🌗 Ночь";
}

function fillSelect(selectEl, values){
  values.sort().forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function uniq(arr){ return [...new Set(arr)]; }
function debounce(fn, ms){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// -----------------------------------------------------
// STYLE INDEX: find roads, labels, building source
// -----------------------------------------------------
function indexStyleLayers(){
  const style = map.getStyle();
  const layers = style.layers || [];

  transportationLayerIds = [];
  labelLayerIds = [];

  // Find a vector source that likely contains OpenMapTiles layers (building/transportation)
  const sources = style.sources || {};
  const vectorSourceNames = Object.keys(sources).filter(k => sources[k]?.type === "vector");

  // We’ll guess: first vector source is the basemap tiles (demotiles)
  buildingSourceName = vectorSourceNames.length ? vectorSourceNames[0] : null;

  for (const layer of layers){
    const id = layer.id || "";

    // Roads: many styles use source-layer "transportation"
    if (layer["source-layer"] === "transportation" || id.toLowerCase().includes("road") || id.toLowerCase().includes("transportation")){
      if (layer.type === "line") transportationLayerIds.push(id);
    }

    // Labels: keep them a bit muted at night
    if (layer.type === "symbol" && (id.toLowerCase().includes("label") || id.toLowerCase().includes("place") || id.toLowerCase().includes("poi"))){
      labelLayerIds.push(id);
    }
  }
}

// -----------------------------------------------------
// THEME (DAY/NIGHT) via paint tweaks (no style switch)
// -----------------------------------------------------
function applyThemeToStyle(){
  if (!map.isStyleLoaded()) return;

  // Background if exists
  if (map.getLayer("background")){
    map.setPaintProperty("background", "background-color", nightMode ? "#020617" : "#f8fafc");
  }

  // Labels: less contrast at night, more at day
  for (const id of labelLayerIds){
    try{
      const opacity = nightMode ? 0.75 : 1.0;
      if (map.getPaintProperty(id, "text-opacity") !== undefined) map.setPaintProperty(id, "text-opacity", opacity);
      if (map.getPaintProperty(id, "icon-opacity") !== undefined) map.setPaintProperty(id, "icon-opacity", opacity);
    }catch(e){}
  }

  // Roads: slightly muted at night by default; nav mode will override stronger
  applyRoadHighlight();
}

// -----------------------------------------------------
// Roads highlight (Navigation Mode)
// -----------------------------------------------------
function applyRoadHighlight(){
  if (!map.isStyleLoaded()) return;

  // In nav mode: roads brighter + thicker
  const baseOpacity = nightMode ? 0.55 : 0.75;
  const navOpacity = nightMode ? 0.85 : 0.95;

  for (const id of transportationLayerIds){
    try{
      if (!map.getLayer(id)) continue;

      // Opacity
      if (map.getPaintProperty(id, "line-opacity") !== undefined){
        map.setPaintProperty(id, "line-opacity", roadsMode ? navOpacity : baseOpacity);
      }

      // Width bump (safe: only if property exists)
      const cur = map.getPaintProperty(id, "line-width");
      if (cur !== undefined){
        // Instead of trying to parse expression, just apply our own zoom-based width
        map.setPaintProperty(id, "line-width", roadsMode
          ? ["interpolate", ["linear"], ["zoom"], 4, 1.2, 8, 2.8, 12, 5.0]
          : ["interpolate", ["linear"], ["zoom"], 4, 0.9, 8, 2.0, 12, 3.6]
        );
      }

      // Color tweak for nav: lighter roads
      if (map.getPaintProperty(id, "line-color") !== undefined){
        map.setPaintProperty(id, "line-color", roadsMode
          ? (nightMode ? "rgba(226,232,240,0.85)" : "rgba(30,41,59,0.85)")
          : (nightMode ? "rgba(148,163,184,0.65)" : "rgba(71,85,105,0.75)")
        );
      }
    }catch(e){}
  }
}

// -----------------------------------------------------
// 3D: pitch + buildings extrusion if available
// OpenMapTiles schema has "building" layer. :contentReference[oaicite:1]{index=1}
// -----------------------------------------------------
function apply3D(){
  if (!map.isStyleLoaded()) return;

  // Camera pitch
  map.easeTo({
    pitch: threeDMode ? 55 : 0,
    bearing: threeDMode ? -12 : 0,
    duration: 700
  });

  const layerId = "3d-buildings";
  if (!threeDMode){
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    return;
  }

  // Try to add 3D buildings if basemap provides them
  if (!buildingSourceName) return;

  // Some styles already have a building layer; we add our own extrusion above roads
  try{
    if (map.getLayer(layerId)) return;

    map.addLayer({
      id: layerId,
      type: "fill-extrusion",
      source: buildingSourceName,
      "source-layer": "building",
      minzoom: 12,
      paint: {
        "fill-extrusion-color": nightMode ? "rgba(148,163,184,0.45)" : "rgba(51,65,85,0.45)",
        "fill-extrusion-height": [
          "case",
          ["has", "render_height"],
          ["get", "render_height"],
          ["has", "height"],
          ["get", "height"],
          8
        ],
        "fill-extrusion-base": [
          "case",
          ["has", "render_min_height"],
          ["get", "render_min_height"],
          0
        ],
        "fill-extrusion-opacity": nightMode ? 0.55 : 0.45
      }
    });
  }catch(e){
    // If the style does not have "building" source-layer, silently skip
  }
}

// -----------------------------------------------------
// КПП Layer with hover polish (feature-state)
// + optional clustering can be added later, but keep it simple & smooth now
// -----------------------------------------------------
function addCheckpointsLayer(){
  // re-add safe (in case style reload)
  if (map.getSource("checkpoints")) return;

  map.addSource("checkpoints", {
    type: "geojson",
    data: geoData,
    promoteId: "checkpoint_id"
  });

  map.addLayer({
    id: "checkpoints-layer",
    type: "circle",
    source: "checkpoints",
    paint: {
      "circle-radius": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        ["interpolate", ["linear"], ["zoom"], 3, 5, 7, 9, 10, 13],
        ["interpolate", ["linear"], ["zoom"], 3, 3, 7, 6, 10, 10]
      ],
      "circle-color": [
        "match",
        ["get", "checkpoint_type"],
        "Автомобильный", COLORS["Автомобильный"] || "#3b82f6",
        "Железнодорожный", COLORS["Железнодорожный"] || "#22c55e",
        "Воздушный", COLORS["Воздушный"] || "#a855f7",
        "Морской", COLORS["Морской"] || "#0ea5e9",
        "Речной", COLORS["Речной"] || "#14b8a6",
        getCss("--other")
      ],
      "circle-stroke-color": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        "rgba(226,232,240,0.95)",
        "#020617"
      ],
      "circle-stroke-width": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        2,
        1
      ],
      "circle-opacity": 0.92
    }
  });

  // Hover state
  let hoveredId = null;

  map.on("mousemove", "checkpoints-layer", (e) => {
    map.getCanvas().style.cursor = "pointer";
    const f = e.features?.[0];
    if (!f) return;

    const id = f.id ?? f.properties?.checkpoint_id;
    if (id == null) return;

    if (hoveredId !== null){
      map.setFeatureState({ source: "checkpoints", id: hoveredId }, { hover: false });
    }
    hoveredId = id;
    map.setFeatureState({ source: "checkpoints", id: hoveredId }, { hover: true });
  });

  map.on("mouseleave", "checkpoints-layer", () => {
    map.getCanvas().style.cursor = "";
    if (hoveredId !== null){
      map.setFeatureState({ source: "checkpoints", id: hoveredId }, { hover: false });
    }
    hoveredId = null;
  });

  // Popup
  map.on("click", "checkpoints-layer", (e) => {
    const f = e.features?.[0];
    if (!f) return;
    const p = f.properties || {};

    const lngLat = e.lngLat;
    new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(lngLat)
      .setHTML(buildPopup(p))
      .addTo(map);

    map.easeTo({ center: [lngLat.lng, lngLat.lat], duration: 450, zoom: Math.max(map.getZoom(), 6) });
  });
}

// -----------------------------------------------------
// Filters: rebuild the GeoJSON source data (fast enough for ~361 points)
// -----------------------------------------------------
function applyFilters(){
  const q = (searchInput.value || "").trim().toLowerCase();
  const tVal = typeFilter.value;
  const sVal = statusFilter.value;

  const filtered = (geoData.features || []).filter(f => {
    const p = f.properties || {};
    const okType = (tVal === "all") || (p.checkpoint_type === tVal);
    const okStatus = (sVal === "all") || (p.status === sVal);

    if (!q) return okType && okStatus;

    const hay = [
      p.checkpoint_name,
      p.subject_name,
      p.federal_district,
      p.foreign_country,
      p.foreign_checkpoint,
      p.address,
      p.checkpoint_type,
      p.status
    ].filter(Boolean).join(" ").toLowerCase();

    return okType && okStatus && hay.includes(q);
  });

  const src = map.getSource("checkpoints");
  if (src) src.setData({ type: "FeatureCollection", features: filtered });

  updateStats(filtered);
}

function updateStats(features){
  const total = features.length;
  const byType = {};
  for (const f of features){
    const t = f.properties?.checkpoint_type || "Прочие";
    byType[t] = (byType[t] || 0) + 1;
  }

  const top = Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0, 6);

  statsEl.innerHTML = `
    <div class="statline"><span>Отображено КПП</span><strong>${total}</strong></div>
    <div style="height:10px"></div>
    ${top.map(([k,v]) => `<div class="statline"><span>${escapeHtml(k)}</span><strong>${v}</strong></div>`).join("")}
  `;
}

function buildPopup(p){
  const name = p.checkpoint_name || "Без названия";
  const sub = [p.checkpoint_type, p.status].filter(Boolean).join(" • ");

  const region = p.subject_name || "—";
  const fd = p.federal_district || "—";
  const work = p.working_time || "—";
  const country = p.foreign_country || "—";
  const foreign = p.foreign_checkpoint || "—";
  const addr = p.address || "";

  return `
    <div class="popup-card">
      <div class="popup-title">${escapeHtml(name)}</div>
      <div class="popup-sub">${escapeHtml(sub || "—")}</div>

      <div class="popup-grid">
        <div class="kv"><span class="k">Регион</span><span class="v">${escapeHtml(region)}</span></div>
        <div class="kv"><span class="k">Округ</span><span class="v">${escapeHtml(fd)}</span></div>
        <div class="kv"><span class="k">Режим</span><span class="v">${escapeHtml(work)}</span></div>
        <div class="kv"><span class="k">Страна</span><span class="v">${escapeHtml(country)}</span></div>
        <div class="kv"><span class="k">Сопредельный КПП</span><span class="v">${escapeHtml(foreign)}</span></div>
        <div class="kv"><span class="k">ID</span><span class="v">${escapeHtml(String(p.checkpoint_id || "—"))}</span></div>
      </div>

      ${addr ? `<div class="popup-note">${escapeHtml(addr)}</div>` : ``}
    </div>
  `;
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
