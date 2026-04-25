import { TYPE_COLORS } from "./config.js";
import { getFreshnessInfo } from "./freshness.js";
import { haversine, mapPointUrl, routeUrl } from "./geo.js";
import { getQualityFlags } from "./quality.js";
import { createQrSvgDataUri } from "./qr.js";
import { buildReportUrl } from "./report.js";

export function buildLegend(legendEl) {
  legendEl.innerHTML = `
    <div class="legend__section">
      <div class="legend__title">Картографическая основа</div>
      <div class="legend__grid legend__grid--special">
        <div class="legend__item">
          <span class="legend__marker legend__marker--imagery" aria-hidden="true"></span>
          Спутниковая подложка
        </div>
        <div class="legend__item">
          <span class="legend__marker legend__marker--reference" aria-hidden="true"></span>
          Границы, города и дороги
        </div>
      </div>
    </div>
    <div class="legend__section">
      <div class="legend__title">Тип КПП</div>
      <div class="legend__grid">
        ${Object.entries(TYPE_COLORS)
          .map(
            ([name, color]) =>
              `<div class="legend__item"><span class="legend__dot" style="background:${color}"></span>${name}</div>`
          )
          .join("")}
      </div>
    </div>
    <div class="legend__section legend__special">
      <div class="legend__title">Особые отметки</div>
      <div class="legend__grid legend__grid--special">
        <div class="legend__item">
          <span class="legend__marker legend__marker--cluster" aria-hidden="true">12</span>
          Кластер КПП
        </div>
        <div class="legend__item">
          <span class="legend__marker legend__marker--favorite" aria-hidden="true"></span>
          Избранное
        </div>
        <div class="legend__item">
          <span class="legend__marker legend__marker--quality" aria-hidden="true"></span>
          Есть вопросы к данным
        </div>
        <div class="legend__item">
          <span class="legend__marker legend__marker--critical" aria-hidden="true"></span>
          Критичные пропуски
        </div>
      </div>
      <p class="legend__note">Ореолы накладываются поверх цвета типа КПП.</p>
    </div>
  `;
}

function fillSelect(el, defaultLabel, values) {
  if (!el) return;

  el.__options = ["all", ...values];
  el.innerHTML =
    `<option value="all">${escapeHtml(defaultLabel)}</option>` +
    values
      .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
      .join("");
}

function uniqueExtraValues(allFeatures, key) {
  return [
    ...new Set(
      allFeatures
        .map((feature) => feature.properties.__extra?.[key])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, "ru"));
}

export function fillFilters({
  allFeatures,
  typeEl,
  statusEl,
  countryEl,
  subjectEl,
  districtEl,
  legalStatusEl,
  patternEl,
  corridorEl
}) {
  const types = [...new Set(allFeatures.map((feature) => feature.properties.__type))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );
  const statuses = [...new Set(allFeatures.map((feature) => feature.properties.__status))].sort(
    (a, b) => a.localeCompare(b, "ru")
  );
  const countries = [...new Set(allFeatures.map((feature) => feature.properties.__country))].sort(
    (a, b) => a.localeCompare(b, "ru")
  );
  const subjects = [...new Set(allFeatures.map((feature) => feature.properties.__subject))].sort(
    (a, b) => a.localeCompare(b, "ru")
  );

  fillSelect(typeEl, "Все типы", types);
  fillSelect(statusEl, "Все статусы", statuses);
  fillSelect(countryEl, "Все страны", countries);
  fillSelect(subjectEl, "Все субъекты", subjects);
  fillSelect(districtEl, "Все округа", uniqueExtraValues(allFeatures, "federalDistrict"));
  fillSelect(legalStatusEl, "Все режимы", uniqueExtraValues(allFeatures, "legalStatus"));
  fillSelect(patternEl, "Все профили", uniqueExtraValues(allFeatures, "checkpointPattern"));
  fillSelect(corridorEl, "Все направления", uniqueExtraValues(allFeatures, "transportCorridor"));
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
  const describedCount = allFeatures.filter(
    (feature) => feature.properties?.__hasDescription
  ).length;
  const eventCount = allFeatures.filter(
    (feature) => Number(feature.properties?.__enrichmentEventCount) > 0
  ).length;

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
      <span>Обновлено: <b>${escapeHtml(latestUpdatedLabel)}</b></span>
      <span>Описаний: <b>${describedCount}/${allFeatures.length}</b></span>
      <span>Событий: <b>${eventCount}</b></span>
      <span>Активных фильтров: <b>${filtersLabel}</b></span>
      <span>Избранных: <b>${favoriteCount}</b></span>
      <span>Скрыто: <b>${hiddenCount}</b></span>
    </div>
  `;
}

function percentOf(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function renderResearchQueue({
  queueEl,
  allFeatures = [],
  viewFeatures = [],
  activeResearchFilter = "all",
  onFilter
}) {
  if (!queueEl) return;

  if (!allFeatures.length) {
    queueEl.innerHTML = "";
    queueEl.style.display = "none";
    return;
  }

  const total = allFeatures.length;
  const describedCount = allFeatures.filter(
    (feature) => feature.properties?.__hasDescription
  ).length;
  const eventCount = allFeatures.filter(
    (feature) => Number(feature.properties?.__enrichmentEventCount) > 0
  ).length;
  const qualityIssueCount = allFeatures.filter((feature) => getQualityFlags(feature).length).length;
  const missingDescriptionCount = total - describedCount;
  const missingEventCount = total - eventCount;
  const missingWorkingTimeCount = allFeatures.filter(
    (feature) => !feature.properties?.__extra?.workingTime
  ).length;
  const descriptionPercent = percentOf(describedCount, total);

  const tasks = [
    {
      id: "missing-description",
      label: "Нужно описание",
      count: missingDescriptionCount,
      hint: "КПП без исследовательской карточки",
      tone: "warning"
    },
    {
      id: "missing-events",
      label: "Нет событий / сверки",
      count: missingEventCount,
      hint: "Нет привязанных новостей, сверок или заметок",
      tone: "warning"
    },
    {
      id: "missing-working-time",
      label: "Нет режима работы",
      count: missingWorkingTimeCount,
      hint: "Карточка не показывает, когда КПП принимает транспорт",
      tone: "warning"
    },
    {
      id: "quality-issues",
      label: "Вопросы к данным",
      count: qualityIssueCount,
      hint: "Неполные источник, дата, статус или координаты",
      tone: "danger"
    },
    {
      id: "described",
      label: "Готово к чтению",
      count: describedCount,
      hint: "КПП с готовым описанием",
      tone: "good"
    }
  ];

  queueEl.innerHTML = `
    <div class="research-queue__header">
      <div>
        <div class="research-queue__kicker">Исследовательская очередь</div>
        <h2>Что проверить дальше</h2>
      </div>
      <span>${viewFeatures.length}/${total}</span>
    </div>
    <div class="research-queue__progress" aria-label="Покрытие описаниями">
      <div class="research-queue__progressTop">
        <span>Покрытие описаниями</span>
        <b>${descriptionPercent}%</b>
      </div>
      <div class="research-queue__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${descriptionPercent}">
        <i style="width:${descriptionPercent}%"></i>
      </div>
    </div>
    <div class="research-queue__tasks">
      ${tasks
        .map(
          (task) => `
        <button
          class="research-queue__task research-queue__task--${task.tone}${activeResearchFilter === task.id ? " is-active" : ""}"
          type="button"
          data-research-filter="${task.id}"
          aria-pressed="${activeResearchFilter === task.id ? "true" : "false"}"
        >
          <span>
            <b>${task.label}</b>
            <small>${task.hint}</small>
          </span>
          <strong>${task.count}</strong>
        </button>
      `
        )
        .join("")}
    </div>
  `;

  queueEl.querySelectorAll("[data-research-filter]").forEach((node) => {
    node.onclick = () => onFilter?.(node.dataset.researchFilter);
  });

  queueEl.style.display = "block";
}

function escapeHtml(value) {
  return String(value ?? "")
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
  const qrUrl = escapeHtml(createQrSvgDataUri(shareUrl));

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
        <div class="share-sheet__note">QR генерируется локально в браузере, без внешних сервисов.</div>
      </div>
    </div>
  `;

  shareSheetEl.querySelector?.(".share-sheet__close")?.addEventListener?.("click", onClose);
  shareSheetEl.querySelectorAll("[data-share-action]").forEach((node) => {
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

  const deltaLabel = summary.totalDelta > 0 ? `+${summary.totalDelta}` : String(summary.totalDelta);
  const addedLabel = summary.addedIds.length
    ? `Добавлено: ${summary.addedIds.length}`
    : "Новых нет";
  const removedLabel = summary.removedIds.length
    ? `Убрано: ${summary.removedIds.length}`
    : "Удаленных нет";

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
      ${recentFeatures
        .map((feature) => {
          const props = feature.properties;
          return `
          <button class="recent__item" type="button" data-id="${escapeHtml(props.__id)}">
            <span>${escapeHtml(props.__name)}</span>
            <small>${escapeHtml(props.__country || "—")}</small>
          </button>
        `;
        })
        .join("")}
    </div>
  `;

  recentEl.querySelectorAll(".recent__item").forEach((node) => {
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
    <button class="nearest-open__card" type="button" data-id="${escapeHtml(props.__id)}">
      <span>
        <b>${escapeHtml(props.__name)}</b>
        <small>${escapeHtml(props.__country || "—")} · ${escapeHtml(props.__subject || "—")}</small>
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
  if (key === "address") return extra.address || "—";
  if (key === "workingTime") return extra.workingTime || "—";
  if (key === "legalStatus") return extra.legalStatus || "—";
  if (key === "transportCorridor") return extra.transportCorridor || "—";
  if (key === "branch") return extra.branchName || "—";
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
    ["Адрес", "address"],
    ["Режим работы", "workingTime"],
    ["Правовой режим", "legalStatus"],
    ["Направление МТК", "transportCorridor"],
    ["Филиал", "branch"],
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
      ${compareFeatures
        .map((feature) => {
          const props = feature.properties;
          return `
          <button class="compare__pill" type="button" data-id="${escapeHtml(props.__id)}">
            <span>${escapeHtml(props.__name)}</span>
            <small>${escapeHtml(props.__country || "—")}</small>
            <i data-remove-compare-id="${escapeHtml(props.__id)}" aria-label="Убрать из сравнения">×</i>
          </button>
        `;
        })
        .join("")}
    </div>
    ${
      compareFeatures.length === 2
        ? `
      <div class="compare__table">
        ${rows
          .map(
            ([label, key]) => `
          <div class="compare__row">
            <b>${label}</b>
            <span>${escapeHtml(compareValue(compareFeatures[0], key))}</span>
            <span>${escapeHtml(compareValue(compareFeatures[1], key))}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `
        : ""
    }
  `;

  compareEl.querySelectorAll(".compare__pill").forEach((node) => {
    node.onclick = () => onItemClick(node.dataset.id);
  });

  compareEl.querySelectorAll("[data-remove-compare-id]").forEach((node) => {
    node.onclick = (event) => {
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
  return `<span class="badge"><span class="badge__dot" style="background:${color}"></span>${escapeHtml(type)}</span>`;
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

  return {
    level: "unknown",
    label: value ? `Достоверность: ${value}` : "Достоверность не указана"
  };
}

function compareByName(a, b) {
  return a.properties.__name.localeCompare(b.properties.__name, "ru");
}

function renderItems(features, userLocation, favoriteIds, compareIds, nearestOpenId) {
  return features
    .map((feature) => {
      const props = feature.properties;
      const extra = props.__extra || {};
      const freshness = getFreshnessInfo(props.__extra?.updatedAt);
      const confidence = confidenceInfo(props.__extra?.confidence);
      const qualityFlags = getQualityFlags(feature);
      const hasQualityFlags = qualityFlags.length > 0;
      const sourceUrl = safeExternalUrl(extra.source);
      const isFavorite = favoriteIds.has(String(props.__id));
      const isComparing = compareIds.includes(String(props.__id));
      const isNearestOpen = nearestOpenId === props.__id;
      const favoriteLabel = isFavorite ? "Убрать из избранного" : "Добавить в избранное";
      const descriptionPreview = props.__descriptionPreview || "";
      const context = [
        extra.address ? `Адрес: ${escapeHtml(extra.address)}` : "",
        extra.workingTime ? `Режим: ${escapeHtml(extra.workingTime)}` : "",
        extra.legalStatus ? `Правовой режим: ${escapeHtml(extra.legalStatus)}` : "",
        extra.transportCorridor ? `МТК: ${escapeHtml(extra.transportCorridor)}` : "",
        extra.branchName ? `Филиал: ${escapeHtml(extra.branchName)}` : ""
      ]
        .filter(Boolean)
        .join(" · ");
      const dist = userLocation
        ? ` · 📏 ${haversine(userLocation, feature.geometry.coordinates).toFixed(1)} км`
        : "";
      const routeHref = userLocation
        ? routeUrl(userLocation, feature.geometry.coordinates)
        : mapPointUrl(feature.geometry.coordinates);
      const reportHref = buildReportUrl(feature);
      const safeId = escapeHtml(props.__id);
      const safeFavoriteLabel = escapeHtml(favoriteLabel);
      const safeSourceUrl = escapeHtml(sourceUrl);
      const safeRouteHref = escapeHtml(routeHref);
      const safeReportHref = escapeHtml(reportHref);
      const safeFreshnessDetails = escapeHtml(freshness.details);

      return `
      <div class="item${isNearestOpen ? " item--nearest-open" : ""}${hasQualityFlags ? " item--quality-warning" : ""}" data-id="${safeId}">
        <div class="item__name">
          <span class="item__headline">
            ${badgeHtml(props.__type)}
            <span>${escapeHtml(props.__name)}</span>
          </span>
          <button
            class="item__favorite${isFavorite ? " is-favorite" : ""}"
            type="button"
            data-favorite-id="${safeId}"
            aria-label="${safeFavoriteLabel}"
            aria-pressed="${isFavorite ? "true" : "false"}"
            title="${safeFavoriteLabel}"
          >★</button>
        </div>
        <div class="item__meta">
          ${escapeHtml(props.__subject || "—")} · ${escapeHtml(props.__country || "—")}<br>
          ${escapeHtml(props.__type)} · ${escapeHtml(props.__status)}${escapeHtml(dist)}
          ${context ? `<div class="item__context">${context}</div>` : ""}
          ${descriptionPreview ? `<div class="item__description">${escapeHtml(descriptionPreview)}</div>` : ""}
          <div class="item__badges">
            <span class="freshness freshness--${freshness.level}" title="${safeFreshnessDetails}">${escapeHtml(freshness.label)}</span>
            <span class="confidence confidence--${confidence.level}">${escapeHtml(confidence.label)}</span>
            ${qualityFlags.map((flag) => `<span class="quality-flag quality-flag--${flag.level}">${escapeHtml(flag.label)}</span>`).join("")}
          </div>
          ${isNearestOpen ? '<div class="item__note">Ближайший действующий пункт</div>' : ""}
        </div>
        <div class="item__actions">
          <button class="item__action item__compare${isComparing ? " is-active" : ""}" type="button" data-compare-id="${safeId}">Сравнить</button>
          <button class="item__action item__copyCoords" type="button" data-copy-coords-id="${safeId}">Координаты</button>
          <a class="item__action item__route" href="${safeRouteHref}" target="_blank" rel="noreferrer">Маршрут</a>
          ${sourceUrl ? `<a class="item__action item__source" href="${safeSourceUrl}" target="_blank" rel="noreferrer">Источник</a>` : ""}
          <a class="item__action item__report" href="${safeReportHref}" target="_blank" rel="noreferrer">Сообщить</a>
        </div>
      </div>
    `;
    })
    .join("");
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

    listEl.innerHTML = grouped
      .map(([country, items]) => {
        const sorted = [...items].sort(compareByName);
        return `<div class="group">🌍 ${escapeHtml(country)} (${items.length})</div>${renderItems(sorted, userLocation, favoriteIds, compareIds, nearestOpenId)}`;
      })
      .join("");
  }

  listEl.querySelectorAll(".item").forEach((node) => {
    node.onclick = () => onItemClick(node.dataset.id);
  });

  listEl.querySelectorAll(".item__favorite").forEach((node) => {
    node.onclick = (event) => {
      event?.stopPropagation?.();
      onFavoriteToggle?.(node.dataset.favoriteId);
    };
  });

  listEl.querySelectorAll(".item__compare").forEach((node) => {
    node.onclick = (event) => {
      event?.stopPropagation?.();
      onCompareToggle?.(node.dataset.compareId);
    };
  });

  listEl.querySelectorAll(".item__copyCoords").forEach((node) => {
    node.onclick = async (event) => {
      event?.stopPropagation?.();
      const copied = await onCopyCoordinates?.(node.dataset.copyCoordsId);
      if (!copied) return;

      node.textContent = "Скопировано";
      setTimeout(() => {
        node.textContent = "Координаты";
      }, 1400);
    };
  });

  listEl.querySelectorAll(".item__route").forEach((node) => {
    node.onclick = (event) => {
      event?.stopPropagation?.();
    };
  });

  emptyEl.style.display = "none";
}
