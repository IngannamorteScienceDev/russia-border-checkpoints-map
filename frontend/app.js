// ─────────────────────────────────────────────
// Modern КПП РФ Map — clusters + search + hover
// ─────────────────────────────────────────────

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

const map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([61, 90], 4);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap © CARTO'
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

const clusterGroup = L.markerClusterGroup({
  chunkedLoading: true,
  chunkProgress: (processed, total) => {
    // можно сюда вывести прогресс, но пока без лишнего шума
  },
  maxClusterRadius: 52,
});

map.addLayer(clusterGroup);

let allFeatures = [];
let filteredFeatures = [];

// UI
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const statusFilter = document.getElementById("statusFilter");
const statsEl = document.getElementById("stats");
const chipsEl = document.getElementById("typeChips");

// быстрые чипсы типов (toggle)
let activeTypeChip = "all";

fetch("data/checkpoints.geojson")
  .then(r => r.json())
  .then(d => {
    allFeatures = d.features || [];
    initFilters(allFeatures);
    applyFilters();
  })
  .catch(err => {
    statsEl.innerHTML = `Ошибка загрузки GeoJSON: ${err}`;
  });

function initFilters(features){
  const types = uniq(features.map(f => f.properties.checkpoint_type).filter(Boolean));
  const statuses = uniq(features.map(f => f.properties.status).filter(Boolean));

  // Select: types
  types.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeFilter.appendChild(opt);
  });

  // Select: statuses
  statuses.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    statusFilter.appendChild(opt);
  });

  // Chips: types
  const allChip = chip("Все", "all", true);
  chipsEl.appendChild(allChip);

  types.forEach(t => {
    chipsEl.appendChild(chip(t, t, false));
  });

  // listeners
  const debounced = debounce(applyFilters, 140);
  searchInput.addEventListener("input", debounced);
  typeFilter.addEventListener("change", () => {
    activeTypeChip = "all";
    setChipActive("all");
    applyFilters();
  });
  statusFilter.addEventListener("change", applyFilters);
}

function chip(label, value, isActive){
  const el = document.createElement("div");
  el.className = "chip" + (isActive ? " active" : "");
  el.textContent = label;
  el.dataset.value = value;
  el.addEventListener("click", () => {
    activeTypeChip = value;
    setChipActive(value);

    // синхронизируем селект типов: если чип != all, ставим значение
    if (value === "all") typeFilter.value = "all";
    else typeFilter.value = value;

    applyFilters();
  });
  return el;
}

function setChipActive(value){
  [...chipsEl.querySelectorAll(".chip")].forEach(c => {
    c.classList.toggle("active", c.dataset.value === value);
  });
}

function applyFilters(){
  const q = (searchInput.value || "").trim().toLowerCase();
  const typeVal = typeFilter.value;
  const statusVal = statusFilter.value;

  filteredFeatures = allFeatures.filter(f => {
    const p = f.properties || {};
    const matchesType = (typeVal === "all") || (p.checkpoint_type === typeVal);
    const matchesStatus = (statusVal === "all") || (p.status === statusVal);

    if (!q) return matchesType && matchesStatus;

    const hay = [
      p.checkpoint_name,
      p.subject_name,
      p.federal_district,
      p.foreign_country,
      p.foreign_checkpoint,
      p.address,
      p.checkpoint_type,
      p.status,
    ].filter(Boolean).join(" ").toLowerCase();

    return matchesType && matchesStatus && hay.includes(q);
  });

  renderStats(filteredFeatures);
  renderMarkers(filteredFeatures);
}

function renderStats(features){
  const total = features.length;

  // дополнительная полезная статистика: активные/не активные
  let functional = 0;
  let nonFunctional = 0;

  const byType = {};

  for (const f of features){
    const p = f.properties || {};
    const cond = String(p.is_functional || "").toLowerCase();

    // у Росгранстроя "condition" может быть true/false или "Функционирует" — делаем мягко
    if (cond.includes("функц") || cond === "true" || cond === "1") functional++;
    else nonFunctional++;

    const t = p.checkpoint_type || "Прочие";
    byType[t] = (byType[t] || 0) + 1;
  }

  const typeLines = Object.entries(byType)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 6)
    .map(([t, n]) => `<div class="statline"><span>${escapeHtml(t)}</span><strong>${n}</strong></div>`)
    .join("");

  statsEl.innerHTML = `
    <div class="statline"><span>Отображено КПП</span><strong>${total}</strong></div>
    <div class="statline"><span>Условно действующие</span><strong>${functional}</strong></div>
    <div class="statline"><span>Остальные</span><strong>${nonFunctional}</strong></div>
    <div style="height:10px"></div>
    ${typeLines}
  `;
}

function renderMarkers(features){
  clusterGroup.clearLayers();

  // создаём маркеры
  const markers = features.map(f => {
    const [lon, lat] = f.geometry.coordinates;
    const p = f.properties || {};

    const color = COLORS[p.checkpoint_type] || getCss("--other");

    const marker = L.circleMarker([lat, lon], {
      radius: 6,
      color: "#020617",
      weight: 1,
      fillColor: color,
      fillOpacity: 0.92,
    });

    // hover animation: чуть увеличить
    marker.on("mouseover", () => marker.setStyle({ radius: 9, weight: 2, fillOpacity: 1 }));
    marker.on("mouseout", () => marker.setStyle({ radius: 6, weight: 1, fillOpacity: 0.92 }));

    marker.on("click", () => {
      marker.bindPopup(buildPopup(p), { maxWidth: 300 }).openPopup();

      // красивый UX: мягко подцентрировать точку
      map.panTo([lat, lon], { animate: true, duration: 0.5 });
    });

    return marker;
  });

  clusterGroup.addLayers(markers);

  // автофит только при первом рендере или если фильтр сильно сузил
  if (features.length > 0 && features.length < 80){
    const bounds = clusterGroup.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  }
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
        <div class="kv">
          <span class="k">Регион</span>
          <span class="v">${escapeHtml(region)}</span>
        </div>
        <div class="kv">
          <span class="k">Округ</span>
          <span class="v">${escapeHtml(fd)}</span>
        </div>
        <div class="kv">
          <span class="k">Режим</span>
          <span class="v">${escapeHtml(work)}</span>
        </div>
        <div class="kv">
          <span class="k">Страна</span>
          <span class="v">${escapeHtml(country)}</span>
        </div>
        <div class="kv">
          <span class="k">Сопредельный КПП</span>
          <span class="v">${escapeHtml(foreign)}</span>
        </div>
        <div class="kv">
          <span class="k">ID</span>
          <span class="v">${escapeHtml(String(p.checkpoint_id || "—"))}</span>
        </div>
      </div>

      ${addr ? `<div class="popup-note">${escapeHtml(addr)}</div>` : ``}
    </div>
  `;
}

function uniq(arr){
  return [...new Set(arr)];
}

function debounce(fn, ms){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
