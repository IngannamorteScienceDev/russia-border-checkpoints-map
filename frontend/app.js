// =====================================================
// КПП РФ — MapLibre Showcase
// Features: clustering, URL state, share link, export CSV, results list
// =====================================================

const BASE_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const COLORS = {
  "Автомобильный": "#3b82f6",
  "Железнодорожный": "#22c55e",
  "Воздушный": "#a855f7",
  "Морской": "#0ea5e9",
  "Речной": "#14b8a6",
};

const UI = {
  search: document.getElementById("searchInput"),
  type: document.getElementById("typeFilter"),
  status: document.getElementById("statusFilter"),
  stats: document.getElementById("stats"),
  results: document.getElementById("results"),
  resultsCount: document.getElementById("resultsCount"),
  btnTheme: document.getElementById("toggleTheme"),
  btnRoads: document.getElementById("toggleRoads"),
  btn3d: document.getElementById("toggle3D"),
  btnShare: document.getElementById("btnShare"),
  btnClear: document.getElementById("btnClear"),
  btnExport: document.getElementById("btnExport"),
};

let geoData = null;
let filtered = [];

let nightMode = true;
let roadsMode = false;
let threeDMode = false;

let roadLayers = [];
let labelLayers = [];
let buildingSource = null;

const LAYERS = {
  clusters: "clusters",
  clusterCount: "cluster-count",
  points: "points",
  unclustered: "unclustered-point",
  pointsClick: "unclustered-click",
  buildings3d: "3d"
};

// Parse state from URL
const initialState = parseStateFromUrl();

// Map
const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: initialState.center ?? [90, 61],
  zoom: initialState.zoom ?? 4,
  bearing: initialState.bearing ?? 0,
  pitch: initialState.pitch ?? 0,
  antialias: true,
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

// Load data
fetch("data/checkpoints.geojson")
  .then(r => r.json())
  .then(data => {
    geoData = data;
    filtered = data.features;

    initUI();

    // Apply modes from URL if present
    if (typeof initialState.night === "boolean") nightMode = initialState.night;
    if (typeof initialState.roads === "boolean") roadsMode = initialState.roads;
    if (typeof initialState.threeD === "boolean") threeDMode = initialState.threeD;

    map.on("style.load", () => {
      indexStyle();
      addSourcesAndLayers();
      applyTheme();
      applyRoads();
      apply3D();
      renderStatsAndList();
    });

    // Save URL state on map move (throttled)
    map.on("moveend", debounce(() => {
      writeStateToUrl();
    }, 300));
  });

// ─────────────────────────────────────────────────────
// UI init
// ─────────────────────────────────────────────────────
function initUI() {
  // fill selects
  fill(UI.type, uniq(geoData.features.map(f => f.properties.checkpoint_type)));
  fill(UI.status, uniq(geoData.features.map(f => f.properties.status)));

  // restore URL filter state
  if (initialState.q) UI.search.value = initialState.q;
  if (initialState.type) UI.type.value = initialState.type;
  if (initialState.status) UI.status.value = initialState.status;

  UI.btnTheme.classList.toggle("active", nightMode);
  UI.btnRoads.classList.toggle("active", roadsMode);
  UI.btn3d.classList.toggle("active", threeDMode);

  UI.btnTheme.textContent = nightMode ? "🌗 Ночь" : "☀️ День";

  // listeners
  const debounced = debounce(applyFilters, 150);
  UI.search.addEventListener("input", debounced);
  UI.type.addEventListener("change", applyFilters);
  UI.status.addEventListener("change", applyFilters);

  UI.btnTheme.addEventListener("click", () => {
    nightMode = !nightMode;
    UI.btnTheme.classList.toggle("active", nightMode);
    UI.btnTheme.textContent = nightMode ? "🌗 Ночь" : "☀️ День";
    applyTheme();
    writeStateToUrl();
  });

  UI.btnRoads.addEventListener("click", () => {
    roadsMode = !roadsMode;
    UI.btnRoads.classList.toggle("active", roadsMode);
    applyRoads();
    writeStateToUrl();
  });

  UI.btn3d.addEventListener("click", () => {
    threeDMode = !threeDMode;
    UI.btn3d.classList.toggle("active", threeDMode);
    apply3D();
    writeStateToUrl();
  });

  UI.btnClear.addEventListener("click", () => {
    UI.search.value = "";
    UI.type.value = "all";
    UI.status.value = "all";
    applyFilters();
    writeStateToUrl(true);
  });

  UI.btnShare.addEventListener("click", async () => {
    writeStateToUrl();
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast("Ссылка скопирована");
    } catch {
      prompt("Скопируйте ссылку:", url);
    }
  });

  UI.btnExport.addEventListener("click", () => exportCsv(filtered));
}

// ─────────────────────────────────────────────────────
// Style layers index
// ─────────────────────────────────────────────────────
function indexStyle() {
  const style = map.getStyle();
  roadLayers = [];
  labelLayers = [];

  const sources = style.sources || {};
  buildingSource = Object.keys(sources).find(k => sources[k].type === "vector") ?? null;

  for (const l of style.layers) {
    const id = l.id.toLowerCase();
    if (l.type === "line" && (id.includes("road") || id.includes("transport"))) roadLayers.push(l.id);
    if (l.type === "symbol" && (id.includes("label") || id.includes("place"))) labelLayers.push(l.id);
  }
}

// ─────────────────────────────────────────────────────
// Sources + Layers
// ─────────────────────────────────────────────────────
function addSourcesAndLayers() {
  // Source (with clustering)
  if (!map.getSource("checkpoints")) {
    map.addSource("checkpoints", {
      type: "geojson",
      data: featureCollection(filtered),
      cluster: true,
      clusterRadius: 52,
      clusterMaxZoom: 7,
      promoteId: "checkpoint_id",
    });
  } else {
    map.getSource("checkpoints").setData(featureCollection(filtered));
  }

  // Cluster circles
  if (!map.getLayer(LAYERS.clusters)) {
    map.addLayer({
      id: LAYERS.clusters,
      type: "circle",
      source: "checkpoints",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "rgba(59,130,246,0.18)",
        "circle-stroke-color": "rgba(59,130,246,0.65)",
        "circle-stroke-width": 1.2,
        "circle-radius": [
          "step",
          ["get", "point_count"],
          14, 25,
          18, 60,
          22
        ],
      },
    });

    map.addLayer({
      id: LAYERS.clusterCount,
      type: "symbol",
      source: "checkpoints",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Open Sans Bold"],
        "text-size": 12
      },
      paint: {
        "text-color": "rgba(226,232,240,0.95)"
      }
    });

    // Unclustered points
    map.addLayer({
      id: LAYERS.unclustered,
      type: "circle",
      source: "checkpoints",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3, 3,
          8, 8
        ],
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
        "circle-opacity": 0.9,
      },
    });

    // Cluster click = zoom in
    map.on("click", LAYERS.clusters, async (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [LAYERS.clusters] });
      const clusterId = features[0].properties.cluster_id;
      const source = map.getSource("checkpoints");
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.easeTo({ center: features[0].geometry.coordinates, zoom, duration: 500 });
      });
    });

    // Point click = popup
    map.on("click", LAYERS.unclustered, (e) => {
      const p = e.features[0].properties;
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(buildPopup(p))
        .addTo(map);
    });

    map.on("mouseenter", LAYERS.unclustered, () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", LAYERS.unclustered, () => map.getCanvas().style.cursor = "");
    map.on("mouseenter", LAYERS.clusters, () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", LAYERS.clusters, () => map.getCanvas().style.cursor = "");
  }

  renderStatsAndList();
}

// ─────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────
function applyFilters() {
  const q = (UI.search.value || "").trim().toLowerCase();
  const t = UI.type.value;
  const s = UI.status.value;

  filtered = geoData.features.filter(f => {
    const p = f.properties || {};
    const okType = t === "all" || p.checkpoint_type === t;
    const okStatus = s === "all" || p.status === s;

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
  if (src) src.setData(featureCollection(filtered));

  renderStatsAndList();
  writeStateToUrl();
}

// ─────────────────────────────────────────────────────
// Theme / Roads / 3D
// ─────────────────────────────────────────────────────
function applyTheme() {
  for (const id of labelLayers) {
    try { map.setPaintProperty(id, "text-opacity", nightMode ? 0.72 : 1); } catch {}
    try { map.setPaintProperty(id, "icon-opacity", nightMode ? 0.72 : 1); } catch {}
  }
  applyRoads();
}

function applyRoads() {
  for (const id of roadLayers) {
    try {
      map.setPaintProperty(
        id,
        "line-opacity",
        roadsMode ? 0.95 : (nightMode ? 0.55 : 0.75)
      );
      map.setPaintProperty(
        id,
        "line-width",
        roadsMode
          ? ["interpolate", ["linear"], ["zoom"], 4, 1.6, 10, 4.2]
          : ["interpolate", ["linear"], ["zoom"], 4, 0.9, 10, 2.6]
      );
    } catch {}
  }
}

function apply3D() {
  map.easeTo({
    pitch: threeDMode ? 55 : 0,
    bearing: threeDMode ? -12 : 0,
    duration: 600
  });

  const id = LAYERS.buildings3d;

  if (!threeDMode) {
    if (map.getLayer(id)) map.removeLayer(id);
    return;
  }

  if (!buildingSource || map.getLayer(id)) return;

  try {
    map.addLayer({
      id,
      type: "fill-extrusion",
      source: buildingSource,
      "source-layer": "building",
      minzoom: 12,
      paint: {
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 12],
        "fill-extrusion-color": nightMode ? "rgba(148,163,184,.45)" : "rgba(51,65,85,.40)",
        "fill-extrusion-opacity": nightMode ? 0.55 : 0.45
      }
    });
  } catch {}
}

// ─────────────────────────────────────────────────────
// Stats + Results list
// ─────────────────────────────────────────────────────
function renderStatsAndList() {
  // stats
  const byType = {};
  for (const f of filtered) {
    const t = f.properties?.checkpoint_type || "Прочие";
    byType[t] = (byType[t] || 0) + 1;
  }

  const top = Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0, 6);
  UI.stats.innerHTML = `
    <div class="statline"><span>Отображено КПП</span><strong>${filtered.length}</strong></div>
    <div style="height:10px"></div>
    ${top.map(([k,v])=>`<div class="statline"><span>${esc(k)}</span><strong>${v}</strong></div>`).join("")}
  `;

  // list
  UI.resultsCount.textContent = `${filtered.length}`;
  UI.results.innerHTML = filtered
    .slice(0, 120) // не засоряем UI
    .map((f, idx) => {
      const p = f.properties || {};
      return `
        <div class="result" data-idx="${idx}">
          <div class="t">${esc(p.checkpoint_name || "Без названия")}</div>
          <div class="s">${esc([p.checkpoint_type, p.subject_name, p.foreign_country].filter(Boolean).join(" • "))}</div>
        </div>
      `;
    })
    .join("");

  // click on list: fly to checkpoint
  [...UI.results.querySelectorAll(".result")].forEach(el => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.idx);
      const f = filtered[idx];
      if (!f) return;
      const [lng, lat] = f.geometry.coordinates;
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 7), duration: 650 });
      const p = f.properties || {};
      new maplibregl.Popup()
        .setLngLat([lng, lat])
        .setHTML(buildPopup(p))
        .addTo(map);
    });
  });
}

// ─────────────────────────────────────────────────────
// CSV Export
// ─────────────────────────────────────────────────────
function exportCsv(features) {
  const headers = [
    "checkpoint_id",
    "checkpoint_name",
    "checkpoint_type",
    "status",
    "subject_name",
    "federal_district",
    "foreign_country",
    "foreign_checkpoint",
    "working_time",
    "address",
    "lat",
    "lon"
  ];

  const rows = features.map(f => {
    const p = f.properties || {};
    const [lon, lat] = f.geometry?.coordinates || [null, null];
    return [
      p.checkpoint_id,
      p.checkpoint_name,
      p.checkpoint_type,
      p.status,
      p.subject_name,
      p.federal_district,
      p.foreign_country,
      p.foreign_checkpoint,
      p.working_time,
      p.address,
      lat,
      lon
    ].map(v => csvCell(v));
  });

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  downloadText(csv, `checkpoints_export_${dateStamp()}.csv`, "text/csv;charset=utf-8");
  toast("CSV выгружен");
}

function csvCell(v){
  const s = (v === null || v === undefined) ? "" : String(v);
  // escape quotes
  const escaped = s.replaceAll('"', '""');
  return `"${escaped}"`;
}

function downloadText(text, filename, mime){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function dateStamp(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}${mm}${dd}`;
}

// ─────────────────────────────────────────────────────
// Shareable URL state
// ─────────────────────────────────────────────────────
function writeStateToUrl(resetFilters=false){
  const c = map.getCenter();
  const state = {
    z: round(map.getZoom(), 2),
    lat: round(c.lat, 5),
    lng: round(c.lng, 5),
    b: round(map.getBearing(), 1),
    p: round(map.getPitch(), 1),
    night: nightMode ? 1 : 0,
    roads: roadsMode ? 1 : 0,
    d3: threeDMode ? 1 : 0,
    q: resetFilters ? "" : (UI.search.value || ""),
    type: resetFilters ? "" : (UI.type.value || ""),
    status: resetFilters ? "" : (UI.status.value || ""),
  };

  const params = new URLSearchParams();
  for (const [k,v] of Object.entries(state)){
    if (v === "" || v === null || v === undefined) continue;
    params.set(k, String(v));
  }

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", newUrl);
}

function parseStateFromUrl(){
  const p = new URLSearchParams(window.location.search);
  const z = num(p.get("z"));
  const lat = num(p.get("lat"));
  const lng = num(p.get("lng"));
  const b = num(p.get("b"));
  const pitch = num(p.get("p"));

  const night = bool01(p.get("night"));
  const roads = bool01(p.get("roads"));
  const threeD = bool01(p.get("d3"));

  const q = p.get("q") || "";
  const type = p.get("type") || "";
  const status = p.get("status") || "";

  const center = (isFinite(lat) && isFinite(lng)) ? [lng, lat] : null;

  return {
    zoom: isFinite(z) ? z : null,
    center,
    bearing: isFinite(b) ? b : null,
    pitch: isFinite(pitch) ? pitch : null,
    night,
    roads,
    threeD,
    q,
    type,
    status
  };
}

function num(v){ return v === null ? NaN : Number(v); }
function bool01(v){
  if (v === null) return null;
  return v === "1" || v === "true";
}
function round(n, d){ const k = Math.pow(10,d); return Math.round(n*k)/k; }

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────
function featureCollection(features){
  return { type: "FeatureCollection", features };
}

function fill(select, values){
  values.filter(Boolean).sort().forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}

function uniq(arr){ return [...new Set(arr)]; }

function debounce(fn, ms){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
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
    <div>
      <div style="font-weight:800;font-size:15px;margin-bottom:6px;">${esc(name)}</div>
      <div style="color:rgba(148,163,184,.9);margin-bottom:10px;">${esc(sub || "—")}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="border:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.55);padding:8px;border-radius:12px;">
          <div style="font-size:11px;color:rgba(148,163,184,.9);margin-bottom:3px;">Регион</div>
          <div style="font-weight:650;font-size:12px;">${esc(region)}</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.55);padding:8px;border-radius:12px;">
          <div style="font-size:11px;color:rgba(148,163,184,.9);margin-bottom:3px;">Округ</div>
          <div style="font-weight:650;font-size:12px;">${esc(fd)}</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.55);padding:8px;border-radius:12px;">
          <div style="font-size:11px;color:rgba(148,163,184,.9);margin-bottom:3px;">Режим</div>
          <div style="font-weight:650;font-size:12px;">${esc(work)}</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.55);padding:8px;border-radius:12px;">
          <div style="font-size:11px;color:rgba(148,163,184,.9);margin-bottom:3px;">Страна</div>
          <div style="font-weight:650;font-size:12px;">${esc(country)}</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.55);padding:8px;border-radius:12px;">
          <div style="font-size:11px;color:rgba(148,163,184,.9);margin-bottom:3px;">Сопредельный КПП</div>
          <div style="font-weight:650;font-size:12px;">${esc(foreign)}</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.55);padding:8px;border-radius:12px;">
          <div style="font-size:11px;color:rgba(148,163,184,.9);margin-bottom:3px;">ID</div>
          <div style="font-weight:650;font-size:12px;">${esc(p.checkpoint_id || "—")}</div>
        </div>
      </div>
      ${addr ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(148,163,184,.14);font-size:12px;color:rgba(226,232,240,.9);">${esc(addr)}</div>` : ``}
    </div>
  `;
}

// Simple toast
function toast(text){
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.bottom = "24px";
  el.style.left = "50%";
  el.style.transform = "translateX(-50%)";
  el.style.background = "rgba(15,23,42,.92)";
  el.style.border = "1px solid rgba(148,163,184,.2)";
  el.style.borderRadius = "14px";
  el.style.padding = "10px 14px";
  el.style.color = "rgba(226,232,240,.95)";
  el.style.fontSize = "13px";
  el.style.zIndex = "50";
  el.style.boxShadow = "0 12px 40px rgba(0,0,0,.4)";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}
