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

function fillSelect(el, defaultLabel, values) {
  el.innerHTML = `<option value="all">${defaultLabel}</option>` +
    values.map(value => `<option value="${value}">${value}</option>`).join("");
}

export function fillFilters({ allFeatures, typeEl, statusEl, countryEl, subjectEl }) {
  const types = [...new Set(allFeatures.map(feature => feature.properties.__type))]
    .sort((a, b) => a.localeCompare(b, "ru"));
  const statuses = [...new Set(allFeatures.map(feature => feature.properties.__status))]
    .sort((a, b) => a.localeCompare(b, "ru"));
  const countries = [...new Set(allFeatures.map(feature => feature.properties.__country))]
    .sort((a, b) => a.localeCompare(b, "ru"));
  const subjects = [...new Set(allFeatures.map(feature => feature.properties.__subject))]
    .sort((a, b) => a.localeCompare(b, "ru"));

  fillSelect(typeEl, "Все типы", types);
  fillSelect(statusEl, "Все статусы", statuses);
  fillSelect(countryEl, "Все страны", countries);
  fillSelect(subjectEl, "Все субъекты", subjects);
}

export function renderStats({
  statsEl,
  allFeatures,
  viewFeatures,
  datasetMeta,
  activeFilterCount
}) {
  const hiddenCount = Math.max(allFeatures.length - viewFeatures.length, 0);
  const latestUpdatedLabel = datasetMeta?.latestUpdatedLabel || "Дата не указана";
  const filtersLabel = activeFilterCount ? `${activeFilterCount}` : "0";

  statsEl.innerHTML = `
    <div class="stats__grid">
      <div class="stats__card">
        <div class="stats__label">Всего КПП</div>
        <div class="stats__value">${allFeatures.length}</div>
      </div>
      <div class="stats__card">
        <div class="stats__label">Показано</div>
        <div class="stats__value">${viewFeatures.length}</div>
      </div>
      <div class="stats__card">
        <div class="stats__label">Стран</div>
        <div class="stats__value">${datasetMeta?.countryCount || 0}</div>
      </div>
      <div class="stats__card">
        <div class="stats__label">Субъектов РФ</div>
        <div class="stats__value">${datasetMeta?.subjectCount || 0}</div>
      </div>
    </div>
    <div class="stats__meta">
      <span>Обновлено: <b>${latestUpdatedLabel}</b></span>
      <span>Активных фильтров: <b>${filtersLabel}</b></span>
      <span>Скрыто: <b>${hiddenCount}</b></span>
    </div>
  `;
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
  if (!viewFeatures.length) {
    listEl.innerHTML = "";
    emptyEl.innerHTML = `
      <div class="empty__title">Ничего не найдено</div>
      <div class="empty__text">Попробуйте изменить поисковый запрос или сбросить фильтры, чтобы снова показать пункты пропуска.</div>
    `;
    emptyEl.style.display = "block";
    return;
  }

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

  emptyEl.style.display = "none";
}
