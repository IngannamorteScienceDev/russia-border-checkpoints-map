import { TYPE_COLORS } from "./config.js";
import { getFreshnessInfo } from "./freshness.js";
import { haversine, mapPointUrl, routeUrl } from "./geo.js";
import { getQualityFlags } from "./quality.js";

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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderShareSheet({
  shareSheetEl,
  shareUrl,
  isOpen,
  canNativeShare,
  onCopy,
  onNativeShare,
  onClose
}) {
  if (!isOpen) {
    shareSheetEl.innerHTML = "";
    shareSheetEl.style.display = "none";
    return;
  }

  const safeShareUrl = escapeHtml(shareUrl);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(shareUrl)}`;

  shareSheetEl.innerHTML = `
    <div class="share-sheet__header">
      <div>
        <div class="share-sheet__title">Поделиться картой</div>
        <div class="share-sheet__hint">Ссылка сохраняет фильтры, выбранный КПП, ракурс карты и спутниковый слой.</div>
      </div>
      <button class="share-sheet__close" type="button" aria-label="Закрыть">×</button>
    </div>
    <div class="share-sheet__body">
      <img class="share-sheet__qr" src="${qrUrl}" alt="QR-код текущей ссылки" loading="lazy">
      <div class="share-sheet__content">
        <input class="share-sheet__url" type="text" readonly value="${safeShareUrl}">
        <div class="share-sheet__actions">
          <button class="share-sheet__button" type="button" data-share-action="copy">Копировать</button>
          ${canNativeShare ? '<button class="share-sheet__button" type="button" data-share-action="native">Системное меню</button>' : ""}
        </div>
        <div class="share-sheet__note">QR формируется внешним сервисом, поэтому для него нужен доступ к сети.</div>
      </div>
    </div>
  `;

  shareSheetEl.querySelector?.(".share-sheet__close")?.addEventListener?.("click", onClose);
  shareSheetEl.querySelectorAll("[data-share-action]").forEach(node => {
    node.onclick = () => {
      if (node.dataset.shareAction === "copy") onCopy();
      if (node.dataset.shareAction === "native") onNativeShare();
    };
  });

  shareSheetEl.style.display = "block";
}

export function renderDatasetChanges({ changesEl, summary }) {
  if (!summary) {
    changesEl.innerHTML = "";
    changesEl.style.display = "none";
    return;
  }

  const deltaLabel = summary.totalDelta > 0
    ? `+${summary.totalDelta}`
    : String(summary.totalDelta);
  const addedLabel = summary.addedIds.length ? `Добавлено: ${summary.addedIds.length}` : "Новых нет";
  const removedLabel = summary.removedIds.length ? `Убрано: ${summary.removedIds.length}` : "Удаленных нет";

  changesEl.innerHTML = `
    <div class="dataset-changes__title">Изменения данных</div>
    <div class="dataset-changes__grid">
      <div>
        <span>${summary.isFirstVisit ? "Первый просмотр" : "С прошлого визита"}</span>
        <b>${summary.isFirstVisit ? summary.total : deltaLabel}</b>
      </div>
      <div>
        <span>Всего КПП</span>
        <b>${summary.total}</b>
      </div>
    </div>
    <div class="dataset-changes__meta">
      <span>${addedLabel}</span>
      <span>${removedLabel}</span>
    </div>
  `;

  changesEl.style.display = "block";
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

function compareValue(feature, key) {
  const props = feature.properties;
  const extra = props.__extra || {};

  if (key === "country") return props.__country || "—";
  if (key === "subject") return props.__subject || "—";
  if (key === "type") return props.__type || "—";
  if (key === "status") return props.__status || "—";
  if (key === "coords") return props.__coords || "—";
  if (key === "road") return extra.road || "—";
  if (key === "updatedAt") return extra.updatedAt || "—";

  return "—";
}

export function renderCompare({ compareEl, compareFeatures, onItemClick, onRemove, onClear }) {
  if (!compareFeatures.length) {
    compareEl.innerHTML = "";
    compareEl.style.display = "none";
    return;
  }

  const rows = [
    ["Страна", "country"],
    ["Субъект", "subject"],
    ["Тип", "type"],
    ["Статус", "status"],
    ["Координаты", "coords"],
    ["Дорога/маршрут", "road"],
    ["Обновлено", "updatedAt"]
  ];

  compareEl.innerHTML = `
    <div class="compare__header">
      <div>
        <div class="compare__title">Сравнение КПП</div>
        <div class="compare__hint">${compareFeatures.length < 2 ? "Выберите второй пункт, чтобы увидеть различия." : "Два пункта рядом, без табличной акробатики."}</div>
      </div>
      <button class="compare__clear" type="button">Сбросить</button>
    </div>
    <div class="compare__items">
      ${compareFeatures.map(feature => {
        const props = feature.properties;
        return `
          <button class="compare__pill" type="button" data-id="${props.__id}">
            <span>${props.__name}</span>
            <small>${props.__country || "—"}</small>
            <i data-remove-compare-id="${props.__id}" aria-label="Убрать из сравнения">×</i>
          </button>
        `;
      }).join("")}
    </div>
    ${compareFeatures.length === 2 ? `
      <div class="compare__table">
        ${rows.map(([label, key]) => `
          <div class="compare__row">
            <b>${label}</b>
            <span>${compareValue(compareFeatures[0], key)}</span>
            <span>${compareValue(compareFeatures[1], key)}</span>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;

  compareEl.querySelectorAll(".compare__pill").forEach(node => {
    node.onclick = () => onItemClick(node.dataset.id);
  });

  compareEl.querySelectorAll("[data-remove-compare-id]").forEach(node => {
    node.onclick = event => {
      event?.stopPropagation?.();
      onRemove(node.dataset.removeCompareId);
    };
  });

  compareEl.querySelector?.(".compare__clear")?.addEventListener?.("click", onClear);
  compareEl.style.display = "block";
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

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function confidenceInfo(value) {
  const normalized = String(value || "").toLowerCase();

  if (normalized.includes("high") || normalized.includes("выс")) {
    return { level: "high", label: "Высокая достоверность" };
  }

  if (normalized.includes("medium") || normalized.includes("сред")) {
    return { level: "medium", label: "Средняя достоверность" };
  }

  if (normalized.includes("low") || normalized.includes("низ")) {
    return { level: "low", label: "Низкая достоверность" };
  }

  return { level: "unknown", label: value ? `Достоверность: ${value}` : "Достоверность не указана" };
}

function compareByName(a, b) {
  return a.properties.__name.localeCompare(b.properties.__name, "ru");
}

function renderItems(features, userLocation, favoriteIds, compareIds, nearestOpenId) {
  return features.map(feature => {
    const props = feature.properties;
    const freshness = getFreshnessInfo(props.__extra?.updatedAt);
    const confidence = confidenceInfo(props.__extra?.confidence);
    const qualityFlags = getQualityFlags(feature);
    const hasQualityFlags = qualityFlags.length > 0;
    const sourceUrl = safeExternalUrl(props.__extra?.source);
    const isFavorite = favoriteIds.has(String(props.__id));
    const isComparing = compareIds.includes(String(props.__id));
    const isNearestOpen = nearestOpenId === props.__id;
    const favoriteLabel = isFavorite ? "Убрать из избранного" : "Добавить в избранное";
    const dist = userLocation
      ? ` · 📏 ${haversine(userLocation, feature.geometry.coordinates).toFixed(1)} км`
      : "";
    const routeHref = userLocation
      ? routeUrl(userLocation, feature.geometry.coordinates)
      : mapPointUrl(feature.geometry.coordinates);

    return `
      <div class="item${isNearestOpen ? " item--nearest-open" : ""}${hasQualityFlags ? " item--quality-warning" : ""}" data-id="${props.__id}">
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
          <div class="item__badges">
            <span class="freshness freshness--${freshness.level}" title="${freshness.details}">${freshness.label}</span>
            <span class="confidence confidence--${confidence.level}">${confidence.label}</span>
            ${qualityFlags.map(flag => `<span class="quality-flag quality-flag--${flag.level}">${flag.label}</span>`).join("")}
          </div>
          ${isNearestOpen ? '<div class="item__note">Ближайший действующий пункт</div>' : ""}
        </div>
        <div class="item__actions">
          <button class="item__action item__compare${isComparing ? " is-active" : ""}" type="button" data-compare-id="${props.__id}">Сравнить</button>
          <button class="item__action item__copyCoords" type="button" data-copy-coords-id="${props.__id}">Координаты</button>
          <a class="item__action item__route" href="${routeHref}" target="_blank" rel="noreferrer">Маршрут</a>
          ${sourceUrl ? `<a class="item__action item__source" href="${sourceUrl}" target="_blank" rel="noreferrer">Источник</a>` : ""}
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
  compareIds = [],
  nearestOpenId = "",
  sortMode,
  onItemClick,
  onFavoriteToggle,
  onCopyCoordinates,
  onCompareToggle
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
    listEl.innerHTML = `<div class="group">🔤 По названию</div>${renderItems(sorted, userLocation, favoriteIds, compareIds, nearestOpenId)}`;
  } else if (sortMode === "distance") {
    const sorted = sortByDistance(viewFeatures, userLocation);
    listEl.innerHTML = `<div class="group">📍 Ближайшие КПП</div>${renderItems(sorted, userLocation, favoriteIds, compareIds, nearestOpenId)}`;
  } else {
    const grouped = groupByCountry(viewFeatures);

    listEl.innerHTML = grouped.map(([country, items]) => {
      const sorted = [...items].sort(compareByName);
      return `<div class="group">🌍 ${country} (${items.length})</div>${renderItems(sorted, userLocation, favoriteIds, compareIds, nearestOpenId)}`;
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

  listEl.querySelectorAll(".item__compare").forEach(node => {
    node.onclick = event => {
      event?.stopPropagation?.();
      onCompareToggle?.(node.dataset.compareId);
    };
  });

  listEl.querySelectorAll(".item__copyCoords").forEach(node => {
    node.onclick = async event => {
      event?.stopPropagation?.();
      const copied = await onCopyCoordinates?.(node.dataset.copyCoordsId);
      if (!copied) return;

      node.textContent = "Скопировано";
      setTimeout(() => {
        node.textContent = "Координаты";
      }, 1400);
    };
  });

  listEl.querySelectorAll(".item__route").forEach(node => {
    node.onclick = event => {
      event?.stopPropagation?.();
    };
  });

  emptyEl.style.display = "none";
}
