const STYLE_MAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/* STYLE_SAT ОСТАВЛЕН, НО БОЛЬШЕ НЕ ИСПОЛЬЗУЕТСЯ
   (можно удалить позже, сейчас не трогаю) */
const STYLE_SAT = {
  version: 8,
  sources: {
    sat: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256
    }
  },
  layers: [{ id: "sat-base", type: "raster", source: "sat" }]
};

const TYPE_COLORS = {
  Автомобильный: "#3b82f6",
  Железнодорожный: "#22c55e",
  Воздушный: "#a855f7",
  Морской: "#0ea5e9",
  Речной: "#14b8a6",
  Пешеходный: "#f97316",
  Другое: "#64748b"
};

const el = id => document.getElementById(id);

const panelEl = el("panel");
const mobileToggleEl = el("mobileToggle");
const searchEl = el("searchInput");
const typeEl = el("typeFilter");
const statusEl = el("statusFilter");
const legendEl = el("legend");
const statsEl = el("stats");
const listEl = el("list");
const emptyEl = el("emptyState");
const loaderEl = el("loader");
const loaderProgressEl = el("loaderProgress");
const loaderTextEl = el("loaderText");
const styleToggleEl = el("styleToggle");
const geoBtnEl = el("geoBtn");

let allFeatures = [];
let viewFeatures = [];

let currentStyle = "map"; // оставлен, но больше не влияет на карту

let userLocation = null;
let userMarker = null;

let popupRef = null;
let lastPopupFeature = null;

let debounceTimer = null;

const handlers = {
  clustersClick: null,
  pointsClick: null,
  enterPoints: null,
  leavePoints: null
};

const map = new maplibregl.Map({
  container: "map",
  style: STYLE_MAP,
  center: [90, 61],
  zoom: 4,
  antialias: true
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

function setProgress(pct, text) {
  if (loaderProgressEl) loaderProgressEl.style.width = `${pct}%`;
  if (loaderTextEl && text) loaderTextEl.textContent = text;
}

function hideLoaderOnce() {
  if (!loaderEl) return;
  loaderEl.style.opacity = "0";
  loaderEl.style.pointerEvents = "none";
  setTimeout(() => {
    if (loaderEl && loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl);
  }, 250);
}

function norm(v) {
  return String(v || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeType(v) {
  const s = norm(v);
  if (s.includes("авто")) return "Автомобильный";
  if (s.includes("желез")) return "Железнодорожный";
  if (s.includes("воздуш")) return "Воздушный";
  if (s.includes("морск")) return "Морской";
  if (s.includes("реч")) return "Речной";
  if (s.includes("пеш")) return "Пешеходный";
  return "Другое";
}

function normalizeStatus(v) {
  const s = norm(v);
  if (s.includes("функцион") || s.includes("действ")) return "Действует";
  if (s.includes("огранич")) return "Ограничен";
  if (s.includes("врем")) return "Временно закрыт";
  if (s.includes("закры")) return "Закрыт";
  return "Неизвестно";
}

function haversine(a, b) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function routeUrl(from, to) {
  return `https://yandex.ru/maps/?rtext=${from[1]},${from[0]}~${to[1]},${to[0]}&rtt=auto`;
}

function dataUrl() {
  return new URL("./data/checkpoints.geojson", window.location.href).toString();
}

function extractCountry(props) {
  const candidates = [
    props.neighbor_country,
    props.neighbour_country,
    props.border_country,
    props.country,
    props.country_name,
    props.neighbor_country_name,
    props.neighbour_country_name,
    props.sopredelnoe_gosudarstvo,
    props.sopredelnoe_gosudarstvo_name
  ].filter(Boolean);

  if (candidates.length) return String(candidates.join(", ")).trim();

  const keys = Object.keys(props || {});
  const guessKeys = keys.filter(k => {
    const kk = norm(k);
    return kk.includes("country") || kk.includes("страна") || kk.includes("сопред");
  });

  const guessed = guessKeys
    .map(k => props[k])
    .filter(v => typeof v === "string" || typeof v === "number")
    .map(v => String(v).trim())
    .filter(Boolean);

  if (guessed.length) return guessed.join(", ");

  return "Не указано";
}

function extractSubject(props) {
  return String(
    props.subject_name ||
    props.subject ||
    props.region_name ||
    props.region ||
    props.rf_subject ||
    props.rf_subject_name ||
    ""
  ).trim();
}

function extractExtra(props) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (props[k] !== undefined && props[k] !== null && String(props[k]).trim() !== "") {
        return String(props[k]).trim();
      }
    }
    return "";
  };

  return {
    checkpointId: pick("checkpoint_id", "id", "object_id", "uid"),
    category: pick("category", "checkpoint_category", "kind", "type_category"),
    mode: pick("transport_mode", "mode", "vid_soobshcheniya", "communication_type"),
    road: pick("road_name", "route", "road", "highway"),
    neighborPoint: pick("neighbor_checkpoint", "neighbor_checkpoint_name", "sopredelnyi_kpp"),
    operator: pick("operator", "agency", "department", "vedomstvo"),
    updatedAt: pick("updated_at", "last_update", "status_updated_at", "date_updated")
  };
}

async function loadData() {
  setProgress(20, "Загружаем данные КПП…");
  const resp = await fetch(dataUrl(), { cache: "no-store" });
  if (!resp.ok) throw new Error(`Не удалось загрузить data/checkpoints.geojson (${resp.status})`);
  const data = await resp.json();

  const features = (data.features || []).filter(f => f?.geometry?.type === "Point");

  allFeatures = features.map(f => {
    const p = f.properties || {};
    const country = extractCountry(p);
    const subject = extractSubject(p);
    const extra = extractExtra(p);

    const name = String(p.checkpoint_name || p.name || p.title || "Без названия").trim();
    const type = normalizeType(p.checkpoint_type || p.type || p.kind || p.transport_type);
    const status = normalizeStatus(p.current_status || p.status || p.state);

    const lng = Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates[0] : null;
    const lat = Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates[1] : null;

    return {
      ...f,
      properties: {
        ...p,
        __id: String(extra.checkpointId || p.checkpoint_id || crypto.randomUUID()),
        __name: name,
        __type: type,
        __status: status,
        __country: country,
        __subject: subject,
        __coords: (lng !== null && lat !== null)
          ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          : "—",
        __extra: extra,
        __search: norm([name, subject, country, type, status].filter(Boolean).join(" | "))
      }
    };
  });

  viewFeatures = allFeatures;
  setProgress(45, `Загружено КПП: ${allFeatures.length}`);
}

function buildLegend() {
  legendEl.innerHTML = `
    <div class="legend__title">Тип КПП</div>
    <div class="legend__grid">
      ${Object.entries(TYPE_COLORS).map(([k, c]) =>
        `<div class="legend__item"><span class="legend__dot" style="background:${c}"></span>${k}</div>`
      ).join("")}
    </div>
  `;
}

function fillFilters() {
  const types = [...new Set(allFeatures.map(f => f.properties.__type))].sort((a,b) => a.localeCompare(b, "ru"));
  const statuses = [...new Set(allFeatures.map(f => f.properties.__status))].sort((a,b) => a.localeCompare(b, "ru"));

  typeEl.innerHTML = `<option value="all">Все типы</option>` +
    types.map(t => `<option value="${t}">${t}</option>`).join("");

  statusEl.innerHTML = `<option value="all">Все статусы</option>` +
    statuses.map(s => `<option value="${s}">${s}</option>`).join("");
}

function renderStats() {
  statsEl.innerHTML = `Всего: <b>${allFeatures.length}</b> · Показано: <b>${viewFeatures.length}</b>`;
}

function groupByCountry(features) {
  const m = new Map();
  for (const f of features) {
    const c = f.properties.__country || "Не указано";
    if (!m.has(c)) m.set(c, []);
    m.get(c).push(f);
  }
  return [...m.entries()].sort((a,b) => a[0].localeCompare(b[0], "ru"));
}

function badgeHtml(type) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.Другое;
  return `<span class="badge"><span class="badge__dot" style="background:${color}"></span>${type}</span>`;
}

function renderList() {
  const grouped = groupByCountry(viewFeatures);

  listEl.innerHTML = grouped.map(([country, items]) => {
    const sorted = items.sort((x,y) =>
      x.properties.__name.localeCompare(y.properties.__name, "ru")
    );

    const block = sorted.map(f => {
      const p = f.properties;
      const dist = userLocation
        ? ` · 📏 ${haversine(userLocation, f.geometry.coordinates).toFixed(1)} км`
        : "";

      return `
        <div class="item" data-id="${p.__id}">
          <div class="item__name">
            ${badgeHtml(p.__type)}
            <span>${p.__name}</span>
          </div>
          <div class="item__meta">
            ${p.__subject || "—"} · ${p.__country || "—"}<br>
            ${p.__type} · ${p.__status}${dist}
          </div>
        </div>
      `;
    }).join("");

    return `<div class="group">🌍 ${country} (${items.length})</div>${block}`;
  }).join("");

  listEl.querySelectorAll(".item").forEach(node => {
    node.onclick = () => focusById(node.dataset.id);
  });

  emptyEl.style.display = viewFeatures.length ? "none" : "block";
}

function applyFilters() {
  const q = norm(searchEl.value);
  const t = typeEl.value;
  const s = statusEl.value;

  viewFeatures = allFeatures.filter(f => {
    const p = f.properties;
    if (t !== "all" && p.__type !== t) return false;
    if (s !== "all" && p.__status !== s) return false;
    if (!q) return true;
    return p.__search.includes(q);
  });

  updateSourceData();
  renderStats();
  renderList();
}

function updateSourceData() {
  const src = map.getSource("checkpoints");
  if (!src) return;
  src.setData({ type: "FeatureCollection", features: viewFeatures });
}

function safeRemoveLayer(id) {
  if (map.getLayer(id)) map.removeLayer(id);
}

function safeRemoveSource(id) {
  if (map.getSource(id)) map.removeSource(id);
}

function unbindLayerEvents() {
  if (handlers.clustersClick) map.off("click", "clusters", handlers.clustersClick);
  if (handlers.pointsClick) map.off("click", "points-hit", handlers.pointsClick);
  if (handlers.enterPoints) map.off("mouseenter", "points-hit", handlers.enterPoints);
  if (handlers.leavePoints) map.off("mouseleave", "points-hit", handlers.leavePoints);

  handlers.clustersClick = null;
  handlers.pointsClick = null;
  handlers.enterPoints = null;
  handlers.leavePoints = null;
}

function rebuildLayers() {
  unbindLayerEvents();

  ["clusters", "cluster-count", "points", "points-hit"].forEach(safeRemoveLayer);
  safeRemoveSource("checkpoints");

  map.addSource("checkpoints", {
    type: "geojson",
    data: { type: "FeatureCollection", features: viewFeatures },
    cluster: true,
    clusterRadius: 52,
    clusterMaxZoom: 10
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "checkpoints",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#3b82f6",
      "circle-radius": ["step", ["get", "point_count"], 16, 30, 22, 80, 28],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#020617"
    }
  });

  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "checkpoints",
    filter: ["has", "point_count"],
    layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
    paint: { "text-color": "#e5e7eb" }
  });

  map.addLayer({
    id: "points",
    type: "circle",
    source: "checkpoints",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": 6,
      "circle-color": [
        "match",
        ["get", "__type"],
        "Автомобильный", TYPE_COLORS.Автомобильный,
        "Железнодорожный", TYPE_COLORS.Железнодорожный,
        "Воздушный", TYPE_COLORS.Воздушный,
        "Морской", TYPE_COLORS.Морской,
        "Речной", TYPE_COLORS.Речной,
        "Пешеходный", TYPE_COLORS.Пешеходный,
        TYPE_COLORS.Другое
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#020617"
    }
  });

  map.addLayer({
    id: "points-hit",
    type: "circle",
    source: "checkpoints",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": 18,
      "circle-opacity": 0
    }
  });

  handlers.clustersClick = e => {
    const f = e.features?.[0];
    if (!f) return;
    const src = map.getSource("checkpoints");
    src.getClusterExpansionZoom(f.properties.cluster_id, (err, zoom) => {
      if (!err) map.easeTo({ center: f.geometry.coordinates, zoom });
    });
  };

  handlers.enterPoints = () => map.getCanvas().style.cursor = "pointer";
  handlers.leavePoints = () => map.getCanvas().style.cursor = "";
  handlers.pointsClick = e => openPopup(e.features?.[0], e.lngLat);

  map.on("click", "clusters", handlers.clustersClick);
  map.on("mouseenter", "points-hit", handlers.enterPoints);
  map.on("mouseleave", "points-hit", handlers.leavePoints);
  map.on("click", "points-hit", handlers.pointsClick);
}

function buildPopupHtml(feature) {
  const p = feature.properties;
  const coords = feature.geometry.coordinates;

  const dist = userLocation
    ? `${haversine(userLocation, coords).toFixed(1)} км`
    : "включите геолокацию";

  const route = userLocation
    ? `<a href="${routeUrl(userLocation, coords)}" target="_blank" rel="noreferrer">🛣 Маршрут</a>`
    : "";

  const extra = p.__extra || {};
  const lines = [
    { k: "Субъект РФ", v: p.__subject || "—" },
    { k: "Страна", v: p.__country || "—" },
    { k: "Тип", v: p.__type || "—" },
    { k: "Статус", v: p.__status || "—" },
    { k: "Координаты", v: p.__coords || "—" }
  ];

  if (extra.category) lines.push({ k: "Категория", v: extra.category });
  if (extra.mode) lines.push({ k: "Вид сообщения", v: extra.mode });
  if (extra.road) lines.push({ k: "Дорога/маршрут", v: extra.road });
  if (extra.neighborPoint) lines.push({ k: "Сопредельный КПП", v: extra.neighborPoint });
  if (extra.operator) lines.push({ k: "Оператор", v: extra.operator });
  if (extra.updatedAt) lines.push({ k: "Обновлено", v: extra.updatedAt });

  const table = lines.map(x => `
    <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;line-height:1.35;margin:2px 0">
      <span style="opacity:.75">${x.k}</span>
      <span style="font-weight:650;text-align:right">${x.v}</span>
    </div>
  `).join("");

  return `
    <div style="font-weight:900;font-size:16px;margin-bottom:6px">${p.__name}</div>
    <div style="font-size:13px;opacity:.85;margin-bottom:8px">📏 ${dist}</div>

    <div style="border:1px solid rgba(148,163,184,.14);
                border-radius:12px;
                padding:10px;
                background:rgba(15,23,42,.35);
                margin-bottom:10px">
      ${table}
    </div>

    <div style="display:flex;gap:12px;align-items:center;font-size:13px">
      ${route}
    </div>
  `;
}

function openPopup(feature, lngLat) {
  if (!feature) return;

  lastPopupFeature = feature;

  if (popupRef) popupRef.remove();

  popupRef = new maplibregl.Popup({ maxWidth: "380px", closeButton: true, closeOnClick: true })
    .setLngLat(lngLat || feature.geometry.coordinates)
    .setHTML(buildPopupHtml(feature))
    .addTo(map);

  map.easeTo({ center: feature.geometry.coordinates, zoom: Math.max(map.getZoom(), 7) });
}

function focusById(id) {
  const f = viewFeatures.find(x => x.properties.__id === id) ||
            allFeatures.find(x => x.properties.__id === id);
  if (f) openPopup(f, f.geometry.coordinates);
}

function updateUserMarker() {
  if (!userLocation) return;
  if (userMarker) userMarker.remove();
  userMarker = new maplibregl.Marker({ color: "#f97316" })
    .setLngLat(userLocation)
    .addTo(map);
}

function attachUi() {
  searchEl.oninput = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 200);
  };

  typeEl.onchange = applyFilters;
  statusEl.onchange = applyFilters;

  // ✅ ПЕРЕКЛЮЧЕНИЕ СПУТНИКА ЧЕРЕЗ VISIBILITY
  styleToggleEl.onclick = () => {
    const visible = map.getLayoutProperty("sat-layer", "visibility") === "visible";

    map.setLayoutProperty(
      "sat-layer",
      "visibility",
      visible ? "none" : "visible"
    );

    styleToggleEl.textContent = visible ? "🛰 Спутник" : "🗺 Карта";
  };

  geoBtnEl.onclick = () => {
    if (!navigator.geolocation) return;

    geoBtnEl.disabled = true;
    geoBtnEl.textContent = "⏳";

    navigator.geolocation.getCurrentPosition(
      pos => {
        userLocation = [pos.coords.longitude, pos.coords.latitude];
        updateUserMarker();
        renderStats();
        renderList();
        if (lastPopupFeature) openPopup(lastPopupFeature);
        geoBtnEl.disabled = false;
        geoBtnEl.textContent = "📍 Гео";
      },
      () => {
        geoBtnEl.disabled = false;
        geoBtnEl.textContent = "📍 Гео";
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  if (mobileToggleEl) {
    mobileToggleEl.onclick = () => {
      panelEl.classList.toggle("open");
      setTimeout(() => map.resize(), 200);
    };
  }
}

async function init() {
  try {
    setProgress(10, "Подключаем карту…");
    await new Promise(resolve => (map.loaded() ? resolve() : map.once("load", resolve)));

    /* === ДОБАВЛЕНИЕ СПУТНИКА КАК RASTER LAYER === */
    map.addSource("sat", {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256
    });

    const layers = map.getStyle().layers;
    const bgIndex = layers.findIndex(l => l.type === "background");
    const beforeId = layers[bgIndex + 1]?.id;

    map.addLayer(
      {
        id: "sat-layer",
        type: "raster",
        source: "sat",
        layout: { visibility: "none" }
      },
      beforeId
    );

    setProgress(25, "Загружаем КПП…");
    await loadData();

    setProgress(55, "Настраиваем интерфейс…");
    buildLegend();
    fillFilters();
    renderStats();
    renderList();
    attachUi();

    setProgress(80, "Строим слои…");
    rebuildLayers();
    updateSourceData();

    setProgress(100, "Готово");
    setTimeout(hideLoaderOnce, 150);
  } catch (err) {
    console.error(err);
    setProgress(100, "Ошибка");
    if (loaderTextEl) loaderTextEl.textContent = String(err?.message || err);
  }
}

init();
