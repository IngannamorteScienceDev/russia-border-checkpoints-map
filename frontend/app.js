/* ===== Base map (NOT demo) ===== */

const BASE_STYLE = "https://tiles.openfreemap.org/styles/liberty"; // :contentReference[oaicite:1]{index=1}

/* ===== КПП colors ===== */

const TYPE_COLORS = {
  "Автомобильный": "#3b82f6",
  "Железнодорожный": "#22c55e",
  "Воздушный": "#a855f7",
  "Морской": "#0ea5e9",
  "Речной": "#14b8a6",
  "Пешеходный": "#f97316"
};

const FALLBACK_COLOR = "#64748b";

/* ===== DOM ===== */

const loaderEl = document.getElementById("loader");
const loaderStepEl = document.getElementById("loaderStep");
const loaderBarEl = document.getElementById("loaderBar");

const searchEl = document.getElementById("searchInput");
const typeEl = document.getElementById("typeFilter");
const statusEl = document.getElementById("statusFilter");

const legendEl = document.getElementById("legend");
const statsEl = document.getElementById("stats");
const emptyEl = document.getElementById("emptyState");
const listEl = document.getElementById("list");
const updateDateEl = document.getElementById("updateDate");

const toggleHeatmapBtn = document.getElementById("toggleHeatmap");
const clearSelectionBtn = document.getElementById("clearSelection");

/* ===== State ===== */

let geo = null;
let allFeatures = [];
let viewFeatures = [];

let selectedIds = new Set();
let heatmapOn = false;

const STATUS_KEYS = ["checkpoint_status", "status", "current_status"];
const TYPE_KEYS = ["checkpoint_type", "type", "transport_type"];
const NAME_KEYS = ["checkpoint_name", "name", "title"];
const SUBJECT_KEYS = ["subject_name", "subject", "region"];
const COUNTRY_KEYS = ["neighbor_country", "country", "border_country"];
const ID_KEYS = ["checkpoint_id", "id", "uid"];

/* ===== Loader steps ===== */

function setLoader(stepText, percent){
  loaderStepEl.textContent = stepText;
  loaderBarEl.style.width = `${Math.max(8, Math.min(100, percent))}%`;
}

function hideLoader(){
  loaderEl.classList.add("hidden");
}

/* ===== Helpers for properties ===== */

function pickProp(obj, keys, fallback = ""){
  for (const k of keys){
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== null && obj[k] !== undefined && String(obj[k]).trim() !== ""){
      return obj[k];
    }
  }
  return fallback;
}

function normalizeString(v){
  return String(v ?? "").toLowerCase().trim();
}

function getId(f){
  const p = f.properties || {};
  const id = pickProp(p, ID_KEYS, "");
  return String(id || f.id || "");
}

function getName(f){
  return pickProp(f.properties || {}, NAME_KEYS, "Без названия");
}

function getType(f){
  return pickProp(f.properties || {}, TYPE_KEYS, "Неизвестно");
}

function getStatus(f){
  return pickProp(f.properties || {}, STATUS_KEYS, "Не указано");
}

function getSubject(f){
  return pickProp(f.properties || {}, SUBJECT_KEYS, "—");
}

function getCountry(f){
  return pickProp(f.properties || {}, COUNTRY_KEYS, "—");
}

/* ===== Map init (NO intro animation) ===== */

setLoader("Загрузка стиля карты…", 18);

const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: [90, 61],
  zoom: 4,
  antialias: true
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

/* ===== Data load ===== */

(async function init(){
  try{
    setLoader("Загрузка данных КПП…", 36);

    const resp = await fetch("data/checkpoints.geojson", { cache: "no-store" });
    geo = await resp.json();

    allFeatures = Array.isArray(geo.features) ? geo.features : [];
    allFeatures = allFeatures
      .filter(f => f && f.geometry && f.geometry.type === "Point" && Array.isArray(f.geometry.coordinates))
      .map(f => {
        const id = getId(f);
        return {
          ...f,
          id: id || f.id || undefined,
          properties: {
            ...(f.properties || {}),
            __id: id,
            __name: getName(f),
            __type: getType(f),
            __status: getStatus(f),
            __subject: getSubject(f),
            __country: getCountry(f),
          }
        };
      })
      .filter(f => (f.properties.__id || f.id));

    const updatedAt = geo?.metadata?.updated_at || geo?.metadata?.generated_at || null;
    updateDateEl.textContent = updatedAt
      ? new Date(updatedAt).toLocaleDateString("ru-RU")
      : new Date().toLocaleDateString("ru-RU");

    buildLegend();
    fillFilters();
    applyFiltersAndRender();

    setLoader("Подготовка слоёв…", 64);

    await waitForStyleReady();
    addSourcesAndLayers();

    setLoader("Готово", 100);
    hideLoader();

  }catch(e){
    console.error(e);
    setLoader("Ошибка загрузки данных. Проверьте консоль.", 100);
  }
})();

/* ===== Map readiness ===== */

function waitForStyleReady(){
  return new Promise(resolve => {
    if (map.isStyleLoaded()) return resolve();
    map.once("load", () => resolve());
  });
}

/* ===== UI: legend + filters ===== */

function buildLegend(){
  const entries = Object.entries(TYPE_COLORS);
  legendEl.innerHTML = `
    <div class="legend-title">Легенда</div>
    <div class="legend-grid">
      ${entries.map(([t,c]) => `
        <div class="legend-item">
          <span class="dot" style="background:${c}"></span>
          <span>${t}</span>
        </div>
      `).join("")}
      <div class="legend-item">
        <span class="dot" style="background:${FALLBACK_COLOR}"></span>
        <span>Другое</span>
      </div>
    </div>
  `;
}

function fillFilters(){
  const types = new Set();
  const statuses = new Set();

  for (const f of allFeatures){
    types.add(f.properties.__type);
    statuses.add(f.properties.__status);
  }

  const typeList = [...types].sort((a,b) => a.localeCompare(b, "ru"));
  const statusList = [...statuses].sort((a,b) => a.localeCompare(b, "ru"));

  typeEl.innerHTML = `<option value="all">Все типы</option>` + typeList.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  statusEl.innerHTML = `<option value="all">Все статусы</option>` + statusList.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
}

function applyFiltersAndRender(){
  const q = normalizeString(searchEl.value);
  const t = typeEl.value;
  const s = statusEl.value;

  viewFeatures = allFeatures.filter(f => {
    if (t !== "all" && f.properties.__type !== t) return false;
    if (s !== "all" && f.properties.__status !== s) return false;

    if (!q) return true;

    const hay = [
      f.properties.__name,
      f.properties.__subject,
      f.properties.__country,
      f.properties.__type,
      f.properties.__status
    ].map(normalizeString).join(" • ");

    return hay.includes(q);
  });

  renderStats();
  renderList();
  emptyEl.style.display = viewFeatures.length ? "none" : "block";

  if (map.getSource("checkpoints")){
    map.getSource("checkpoints").setData({
      type: "FeatureCollection",
      features: viewFeatures
    });
  }
}

/* ===== Stats + list ===== */

function renderStats(){
  const total = allFeatures.length;
  const shown = viewFeatures.length;
  const selectedShown = viewFeatures.filter(f => selectedIds.has(f.properties.__id)).length;

  const topRegions = topBy(viewFeatures, f => f.properties.__subject, 5);

  statsEl.innerHTML = `
    Всего КПП: <b>${total}</b><br>
    Отображено: <b>${shown}</b><br>
    Выбрано (в фильтре): <b>${selectedShown}</b><br>
    Выбрано (всего): <b>${selectedIds.size}</b>
    <div style="margin-top:10px; font-weight:800; color:rgba(226,232,240,.92)">Топ регионов</div>
    <div style="margin-top:6px">
      ${topRegions.length ? topRegions.map(([k,v]) => `— ${escapeHtml(k)}: <b>${v}</b>`).join("<br>") : "—"}
    </div>
  `;
}

function renderList(){
  const items = viewFeatures.slice(0, 200);

  listEl.innerHTML = items.map(f => {
    const name = f.properties.__name;
    const subject = f.properties.__subject;
    const country = f.properties.__country;
    const type = f.properties.__type;
    const id = f.properties.__id;
    const isSel = selectedIds.has(id);

    return `
      <div class="item" data-id="${escapeHtml(id)}">
        <div class="item-top">
          <div class="item-name">${escapeHtml(name)}</div>
          <div class="badge" style="${isSel ? "background:rgba(250,204,21,.12);border-color:rgba(250,204,21,.35)" : ""}">
            ${escapeHtml(type)}
          </div>
        </div>
        <div class="item-sub">
          ${escapeHtml(subject)} • ${escapeHtml(country)}<br>
          Статус: ${escapeHtml(f.properties.__status)}
        </div>
      </div>
    `;
  }).join("");

  for (const el of listEl.querySelectorAll(".item")){
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      const f = viewFeatures.find(x => x.properties.__id === id);
      if (!f) return;

      toggleSelect(id);
      focusFeature(f);
    });
  }
}

function focusFeature(f){
  const [lon, lat] = f.geometry.coordinates;
  map.easeTo({
    center: [lon, lat],
    zoom: Math.max(map.getZoom(), 7),
    duration: 700
  });

  showPopup(f, [lon, lat]);
}

/* ===== Map: sources & layers ===== */

function addSourcesAndLayers(){
  map.addSource("checkpoints", {
    type: "geojson",
    data: { type: "FeatureCollection", features: viewFeatures },
    promoteId: "__id",
    cluster: true,
    clusterRadius: 46,
    clusterMaxZoom: 9
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "checkpoints",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "step",
        ["get", "point_count"],
        "rgba(59,130,246,.55)",
        20, "rgba(34,197,94,.55)",
        60, "rgba(250,204,21,.55)",
        120, "rgba(239,68,68,.55)"
      ],
      "circle-radius": [
        "step",
        ["get", "point_count"],
        16,
        20, 20,
        60, 26,
        120, 32
      ],
      "circle-stroke-color": "rgba(2,6,23,.85)",
      "circle-stroke-width": 2,
      "circle-blur": 0.25
    }
  });

  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "checkpoints",
    filter: ["has", "point_count"],
    layout: {
      "text-field": "{point_count_abbreviated}",
      "text-size": 12,
      "text-font": ["Open Sans Bold", "Noto Sans Bold"]
    },
    paint: {
      "text-color": "rgba(226,232,240,.95)"
    }
  });

  map.addLayer({
    id: "points",
    type: "circle",
    source: "checkpoints",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 8, 7, 12, 9],
      "circle-color": [
        "match",
        ["get", "__type"],
        ...Object.entries(TYPE_COLORS).flat(),
        FALLBACK_COLOR
      ],
      "circle-opacity": 0.95,
      "circle-stroke-width": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        3, 1
      ],
      "circle-stroke-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        "#facc15",
        "rgba(2,6,23,.9)"
      ],
      "circle-blur": 0.35
    }
  });

  map.addLayer({
    id: "heatmap",
    type: "heatmap",
    source: "checkpoints",
    layout: { visibility: "none" },
    paint: {
      "heatmap-weight": 1,
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.55, 7, 1.2],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 18, 7, 44],
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, "rgba(0,0,0,0)",
        0.25, "rgba(59,130,246,.85)",
        0.45, "rgba(14,165,233,.90)",
        0.65, "rgba(34,197,94,.95)",
        0.82, "rgba(250,204,21,.95)",
        1, "rgba(239,68,68,.98)"
      ],
      "heatmap-opacity": 0.85
    }
  });

  bindMapInteractions();
}

/* ===== Map interactions ===== */

function bindMapInteractions(){
  map.on("click", "clusters", (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
    const clusterId = features[0].properties.cluster_id;
    map.getSource("checkpoints").getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: features[0].geometry.coordinates, zoom, duration: 600 });
    });
  });

  map.on("click", "points", (e) => {
    const f = e.features && e.features[0];
    if (!f) return;

    const id = f.properties.__id;
    toggleSelect(id);
    showPopup(f, e.lngLat);
  });

  map.on("mouseenter", "points", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "points", () => map.getCanvas().style.cursor = "");

  map.on("mouseenter", "clusters", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "clusters", () => map.getCanvas().style.cursor = "");
}

/* ===== Popup ===== */

function showPopup(f, lngLat){
  const p = f.properties || {};
  const html = `
    <div style="font-weight:800">${escapeHtml(p.__name || "КПП")}</div>
    <div style="margin-top:6px; color:rgba(148,163,184,.9)">
      ${escapeHtml(p.__subject || "—")} • ${escapeHtml(p.__country || "—")}
    </div>
    <div style="margin-top:8px; color:rgba(226,232,240,.92)">
      Тип: <b>${escapeHtml(p.__type || "—")}</b><br>
      Статус: <b>${escapeHtml(p.__status || "—")}</b>
    </div>
  `;

  new maplibregl.Popup({ closeButton: true, closeOnClick: true })
    .setLngLat(lngLat)
    .setHTML(html)
    .addTo(map);
}

/* ===== Selection ===== */

function toggleSelect(id){
  if (!id) return;

  if (selectedIds.has(id)){
    selectedIds.delete(id);
    setSelectedState(id, false);
  }else{
    selectedIds.add(id);
    setSelectedState(id, true);
  }

  renderStats();
  renderList();
}

function setSelectedState(id, value){
  try{
    map.setFeatureState({ source: "checkpoints", id }, { selected: value });
  }catch{}
}

/* ===== Heatmap toggle ===== */

toggleHeatmapBtn.addEventListener("click", () => {
  heatmapOn = !heatmapOn;

  map.setLayoutProperty("heatmap", "visibility", heatmapOn ? "visible" : "none");
  map.setLayoutProperty("clusters", "visibility", heatmapOn ? "none" : "visible");
  map.setLayoutProperty("cluster-count", "visibility", heatmapOn ? "none" : "visible");
  map.setLayoutProperty("points", "visibility", heatmapOn ? "none" : "visible");

  toggleHeatmapBtn.classList.toggle("primary", heatmapOn);
});

/* ===== Clear selection ===== */

clearSelectionBtn.addEventListener("click", () => {
  for (const id of selectedIds){
    setSelectedState(id, false);
  }
  selectedIds.clear();
  renderStats();
  renderList();
});

/* ===== Filter bindings ===== */

searchEl.addEventListener("input", debounce(() => applyFiltersAndRender(), 120));
typeEl.addEventListener("change", () => applyFiltersAndRender());
statusEl.addEventListener("change", () => applyFiltersAndRender());

/* ===== Utils ===== */

function topBy(arr, keyFn, limit){
  const m = new Map();
  for (const x of arr){
    const k = keyFn(x) || "—";
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a,b) => b[1] - a[1]).slice(0, limit);
}

function debounce(fn, ms){
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
