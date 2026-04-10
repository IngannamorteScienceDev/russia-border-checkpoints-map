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
  el.__options = ["all", ...values];
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
  activeFilterCount,
  favoriteCount = 0
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
      <span>Избранных: <b>${favoriteCount}</b></span>
      <span>Скрыто: <b>${hiddenCount}</b></span>
    </div>
  `;
}

export function renderRecent({ recentEl, recentFeatures, onItemClick }) {
  if (!recentFeatures.length) {
    recentEl.innerHTML = "";
    recentEl.style.display = "none";
    return;
  }

  recentEl.innerHTML = `
    <div class="recent__title">Недавно открытые</div>
    <div class="recent__list">
      ${recentFeatures.map(feature => {
        const props = feature.properties;
        return `
          <button class="recent__item" type="button" data-id="${props.__id}">
            <span>${props.__name}</span>
            <small>${props.__country || "—"}</small>
          </button>
        `;
      }).join("")}
    </div>
  `;

  recentEl.querySelectorAll(".recent__item").forEach(node => {
    node.onclick = () => onItemClick(node.dataset.id);
  });

  recentEl.style.display = "block";
}

export function renderNearestOpen({ nearestOpenEl, feature, userLocation, onItemClick }) {
  if (!userLocation) {
    nearestOpenEl.innerHTML = "";
    nearestOpenEl.style.display = "none";
    return;
  }

  if (!feature) {
    nearestOpenEl.innerHTML = `
      <div class="nearest-open__title">Ближайший действующий</div>
      <div class="nearest-open__text">В текущей выборке нет действующих пунктов пропуска.</div>
    `;
    nearestOpenEl.style.display = "block";
    return;
  }

  const props = feature.properties;
  const distance = haversine(userLocation, feature.geometry.coordinates).toFixed(1);

  nearestOpenEl.innerHTML = `
    <div class="nearest-open__title">Ближайший действующий</div>
    <button class="nearest-open__card" type="button" data-id="${props.__id}">
      <span>
        <b>${props.__name}</b>
        <small>${props.__country || "—"} · ${props.__subject || "—"}</small>
      </span>
      <strong>${distance} км</strong>
    </button>
  `;

  nearestOpenEl.querySelector?.(".nearest-open__card")?.addEventListener?.("click", () => {
    onItemClick(props.__id);
  });

  nearestOpenEl.style.display = "block";
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

function compareByName(a, b) {
  return a.properties.__name.localeCompare(b.properties.__name, "ru");
}

function renderItems(features, userLocation, favoriteIds, nearestOpenId) {
  return features.map(feature => {
    const props = feature.properties;
    const isFavorite = favoriteIds.has(String(props.__id));
    const isNearestOpen = nearestOpenId === props.__id;
    const favoriteLabel = isFavorite ? "Убрать из избранного" : "Добавить в избранное";
    const dist = userLocation
      ? ` · 📏 ${haversine(userLocation, feature.geometry.coordinates).toFixed(1)} км`
      : "";

    return `
      <div class="item${isNearestOpen ? " item--nearest-open" : ""}" data-id="${props.__id}">
        <div class="item__name">
          <span class="item__headline">
            ${badgeHtml(props.__type)}
            <span>${props.__name}</span>
          </span>
          <button
            class="item__favorite${isFavorite ? " is-favorite" : ""}"
            type="button"
            data-favorite-id="${props.__id}"
            aria-label="${favoriteLabel}"
            aria-pressed="${isFavorite ? "true" : "false"}"
            title="${favoriteLabel}"
          >★</button>
        </div>
        <div class="item__meta">
          ${props.__subject || "—"} · ${props.__country || "—"}<br>
          ${props.__type} · ${props.__status}${dist}
          ${isNearestOpen ? '<div class="item__note">Ближайший действующий пункт</div>' : ""}
        </div>
      </div>
    `;
  }).join("");
}

function sortByDistance(features, userLocation) {
  return [...features].sort((a, b) => {
    const distanceA = haversine(userLocation, a.geometry.coordinates);
    const distanceB = haversine(userLocation, b.geometry.coordinates);

    if (distanceA !== distanceB) return distanceA - distanceB;
    return compareByName(a, b);
  });
}

export function renderList({
  listEl,
  emptyEl,
  viewFeatures,
  userLocation,
  favoriteIds = new Set(),
  nearestOpenId = "",
  sortMode,
  onItemClick,
  onFavoriteToggle
}) {
  if (!viewFeatures.length) {
    listEl.innerHTML = "";
    emptyEl.innerHTML = `
      <div class="empty__title">Ничего не найдено</div>
      <div class="empty__text">Попробуйте изменить поисковый запрос или сбросить фильтры, чтобы снова показать пункты пропуска.</div>
    `;
    emptyEl.style.display = "block";
    return;
  }

  if (sortMode === "distance" && !userLocation) {
    listEl.innerHTML = "";
    emptyEl.innerHTML = `
      <div class="empty__title">Нужна геолокация</div>
      <div class="empty__text">Нажмите «Ближайшие» или кнопку «Гео», чтобы отсортировать пункты пропуска по расстоянию.</div>
    `;
    emptyEl.style.display = "block";
    return;
  }

  if (sortMode === "name") {
    const sorted = [...viewFeatures].sort(compareByName);
    listEl.innerHTML = `<div class="group">🔤 По названию</div>${renderItems(sorted, userLocation, favoriteIds, nearestOpenId)}`;
  } else if (sortMode === "distance") {
    const sorted = sortByDistance(viewFeatures, userLocation);
    listEl.innerHTML = `<div class="group">📍 Ближайшие КПП</div>${renderItems(sorted, userLocation, favoriteIds, nearestOpenId)}`;
  } else {
    const grouped = groupByCountry(viewFeatures);

    listEl.innerHTML = grouped.map(([country, items]) => {
      const sorted = [...items].sort(compareByName);
      return `<div class="group">🌍 ${country} (${items.length})</div>${renderItems(sorted, userLocation, favoriteIds, nearestOpenId)}`;
    }).join("");
  }

  listEl.querySelectorAll(".item").forEach(node => {
    node.onclick = () => onItemClick(node.dataset.id);
  });

  listEl.querySelectorAll(".item__favorite").forEach(node => {
    node.onclick = event => {
      event?.stopPropagation?.();
      onFavoriteToggle?.(node.dataset.favoriteId);
    };
  });

  emptyEl.style.display = "none";
}
