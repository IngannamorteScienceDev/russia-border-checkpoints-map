import { TYPE_COLORS } from "./config.js";
import { haversine } from "./geo.js";

export function buildLegend(legendEl) {
  legendEl.innerHTML = `
    <div class="legend__title">Тип КПП</div>
    <div class="legend__grid">
      ${Object.entries(TYPE_COLORS).map(([name, color]) =>
        `<div class="legend__item"><span class="legend__dot" style="background:${color}"></span>${name}</div>`
      ).join("")}
    </div>
  `;
}

export function fillFilters({ allFeatures, typeEl, statusEl }) {
  const types = [...new Set(allFeatures.map(feature => feature.properties.__type))]
    .sort((a, b) => a.localeCompare(b, "ru"));
  const statuses = [...new Set(allFeatures.map(feature => feature.properties.__status))]
    .sort((a, b) => a.localeCompare(b, "ru"));

  typeEl.innerHTML = `<option value="all">Все типы</option>` +
    types.map(type => `<option value="${type}">${type}</option>`).join("");

  statusEl.innerHTML = `<option value="all">Все статусы</option>` +
    statuses.map(status => `<option value="${status}">${status}</option>`).join("");
}

export function renderStats({ statsEl, allFeatures, viewFeatures }) {
  statsEl.innerHTML = `Всего: <b>${allFeatures.length}</b> · Показано: <b>${viewFeatures.length}</b>`;
}

function groupByCountry(features) {
  const groups = new Map();

  for (const feature of features) {
    const country = feature.properties.__country || "Не указано";
    if (!groups.has(country)) groups.set(country, []);
    groups.get(country).push(feature);
  }

  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"));
}

function badgeHtml(type) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.Другое;
  return `<span class="badge"><span class="badge__dot" style="background:${color}"></span>${type}</span>`;
}

export function renderList({ listEl, emptyEl, viewFeatures, userLocation, onItemClick }) {
  const grouped = groupByCountry(viewFeatures);

  listEl.innerHTML = grouped.map(([country, items]) => {
    const sorted = [...items].sort((a, b) =>
      a.properties.__name.localeCompare(b.properties.__name, "ru")
    );

    const block = sorted.map(feature => {
      const props = feature.properties;
      const dist = userLocation
        ? ` · 📏 ${haversine(userLocation, feature.geometry.coordinates).toFixed(1)} км`
        : "";

      return `
        <div class="item" data-id="${props.__id}">
          <div class="item__name">
            ${badgeHtml(props.__type)}
            <span>${props.__name}</span>
          </div>
          <div class="item__meta">
            ${props.__subject || "—"} · ${props.__country || "—"}<br>
            ${props.__type} · ${props.__status}${dist}
          </div>
        </div>
      `;
    }).join("");

    return `<div class="group">🌍 ${country} (${items.length})</div>${block}`;
  }).join("");

  listEl.querySelectorAll(".item").forEach(node => {
    node.onclick = () => onItemClick(node.dataset.id);
  });

  emptyEl.style.display = viewFeatures.length ? "none" : "block";
}
