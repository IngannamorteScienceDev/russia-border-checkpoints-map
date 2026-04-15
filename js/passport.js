import { getFreshnessInfo } from "./freshness.js";
import { haversine, mapPointUrl, routeUrl } from "./geo.js";
import { getQualityFlags } from "./quality.js";
import { buildReportUrl } from "./report.js";
import { buildFeatureSourceAudit } from "./sourceTrust.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function metricHtml(label, value, tone = "") {
  return `
    <div class="checkpoint-passport__metric${tone ? ` checkpoint-passport__metric--${tone}` : ""}">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value || "—")}</b>
    </div>
  `;
}

function detailHtml(label, value) {
  if (!value) return "";

  return `
    <div class="checkpoint-passport__detail">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value)}</b>
    </div>
  `;
}

function qualityFlagsHtml(flags) {
  if (!flags.length) {
    return '<span class="checkpoint-passport__flag checkpoint-passport__flag--ok">Критичных замечаний нет</span>';
  }

  return flags
    .map(
      (flag) =>
        `<span class="checkpoint-passport__flag checkpoint-passport__flag--${flag.level}">${escapeHtml(flag.label)}</span>`
    )
    .join("");
}

function sourceEvidenceHtml(items) {
  return items
    .map((item) => `<span class="checkpoint-passport__sourcePill">${escapeHtml(item)}</span>`)
    .join("");
}

function enrichmentConfidenceLabel(value) {
  if (value === "high") return "Подтверждено";
  if (value === "low") return "Низкая уверенность";
  return "Нужна сверка";
}

function enrichmentTagsHtml(tags = []) {
  return tags
    .map((tag) => `<span class="checkpoint-passport__insightTag">${escapeHtml(tag)}</span>`)
    .join("");
}

function enrichmentRecordHtml(record) {
  const sourceUrl = safeExternalUrl(record.sourceUrl);
  const dateLabel = record.date ? `<span>${escapeHtml(record.date)}</span>` : "";
  const tagsHtml = enrichmentTagsHtml(record.tags);
  const sourceHtml = sourceUrl
    ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(record.sourceTitle || "Открыть источник")}</a>`
    : record.sourceTitle
      ? `<span>${escapeHtml(record.sourceTitle)}</span>`
      : "";

  return `
    <article class="checkpoint-passport__insight checkpoint-passport__insight--${record.confidence}">
      <div class="checkpoint-passport__insightTop">
        <span>${escapeHtml(record.kindLabel)}</span>
        ${dateLabel}
        <strong>${escapeHtml(enrichmentConfidenceLabel(record.confidence))}</strong>
      </div>
      <h3>${escapeHtml(record.title)}</h3>
      ${record.summary ? `<p>${escapeHtml(record.summary)}</p>` : ""}
      ${tagsHtml ? `<div class="checkpoint-passport__insightTags">${tagsHtml}</div>` : ""}
      ${sourceHtml ? `<div class="checkpoint-passport__insightSource">${sourceHtml}</div>` : ""}
    </article>
  `;
}

function enrichmentHtml(enrichment) {
  const records = enrichment?.records || [];

  if (!records.length) {
    return `
      <section class="checkpoint-passport__enrichment" aria-label="События и сверка">
        <div class="checkpoint-passport__sectionTitle">События и сверка</div>
        <div class="checkpoint-passport__emptyInsight">
          <b>Подтвержденных событий пока нет</b>
          <p>Файл обогащений подключен. Сюда будут попадать реконструкции, электронные очереди, официальные сверки и другие факты только после привязки к источнику.</p>
        </div>
      </section>
    `;
  }

  const verificationRecords = enrichment.verificationRecords || [];
  const eventRecords = enrichment.eventRecords || [];

  return `
    <section class="checkpoint-passport__enrichment" aria-label="События и сверка">
      <div class="checkpoint-passport__sectionTitle">События и сверка</div>
      <div class="checkpoint-passport__insights">
        ${verificationRecords.map(enrichmentRecordHtml).join("")}
        ${eventRecords.map(enrichmentRecordHtml).join("")}
      </div>
    </section>
  `;
}

function buildDetailRows(props, extra) {
  return [
    ["ID", props.__id],
    ["Субъект РФ", props.__subject],
    ["Сопредельная страна", props.__country],
    ["Категория", extra.category],
    ["Вид сообщения", extra.mode],
    ["Дорога / маршрут", extra.road],
    ["Сопредельный КПП", extra.neighborPoint],
    ["Оператор", extra.operator],
    ["Обновлено", extra.updatedAt]
  ]
    .map(([label, value]) => detailHtml(label, value))
    .join("");
}

export function renderCheckpointPassport({
  passportEl,
  feature,
  userLocation,
  enrichment,
  favoriteIds = new Set(),
  compareIds = [],
  onClose,
  onFavoriteToggle,
  onCopyCoordinates,
  onCompareToggle
}) {
  if (!passportEl) return;

  if (!feature) {
    passportEl.innerHTML = "";
    passportEl.hidden = true;
    passportEl.style.display = "none";
    return;
  }

  const props = feature.properties || {};
  const extra = props.__extra || {};
  const coords = feature.geometry?.coordinates || [];
  const sourceUrl = safeExternalUrl(extra.source);
  const freshness = getFreshnessInfo(extra.updatedAt);
  const confidence = confidenceInfo(extra.confidence);
  const qualityFlags = getQualityFlags(feature);
  const sourceAudit = buildFeatureSourceAudit(feature);
  const distance = userLocation
    ? `${haversine(userLocation, coords).toFixed(1)} км`
    : "Гео не включена";
  const isFavorite = favoriteIds.has(String(props.__id));
  const isComparing = compareIds.includes(String(props.__id));
  const routeHref = userLocation ? routeUrl(userLocation, coords) : mapPointUrl(coords);
  const reportHref = buildReportUrl(feature);

  passportEl.hidden = false;
  passportEl.style.display = "block";
  passportEl.innerHTML = `
    <article class="checkpoint-passport__card" aria-label="Паспорт выбранного КПП">
      <header class="checkpoint-passport__header">
        <div>
          <div class="checkpoint-passport__eyebrow">Паспорт КПП</div>
          <h2>${escapeHtml(props.__name || "Без названия")}</h2>
          <p>${escapeHtml(props.__subject || "Субъект не указан")} · ${escapeHtml(props.__country || "Страна не указана")}</p>
        </div>
        <button class="checkpoint-passport__close" type="button" aria-label="Закрыть паспорт">×</button>
      </header>

      <div class="checkpoint-passport__chips" aria-label="Основные признаки КПП">
        <span>${escapeHtml(props.__type || "Тип не указан")}</span>
        <span>${escapeHtml(props.__status || "Статус не указан")}</span>
        <span class="freshness freshness--${freshness.level}" title="${escapeHtml(freshness.details)}">${escapeHtml(freshness.label)}</span>
      </div>

      <section class="checkpoint-passport__metrics" aria-label="Ключевые показатели">
        ${metricHtml("Координаты", props.__coords)}
        ${metricHtml("Расстояние", distance)}
        ${metricHtml("Данные", confidence.label, confidence.level)}
      </section>

      <section class="checkpoint-passport__quality" aria-label="Качество данных">
        <div class="checkpoint-passport__sectionTitle">Качество данных</div>
        <div class="checkpoint-passport__flags">${qualityFlagsHtml(qualityFlags)}</div>
      </section>

      <section class="checkpoint-passport__source" aria-label="Происхождение данных">
        <div class="checkpoint-passport__sectionTitle">Откуда данные</div>
        <div class="checkpoint-passport__sourceCard checkpoint-passport__sourceCard--${sourceAudit.trustLevel}">
          <div class="checkpoint-passport__sourceTop">
            <div>
              <b>${escapeHtml(sourceAudit.title)}</b>
              <span>${escapeHtml(sourceAudit.badge)}</span>
            </div>
            <strong>${escapeHtml(sourceAudit.trustLabel)}</strong>
          </div>
          <p>${escapeHtml(sourceAudit.summary)}</p>
          <div class="checkpoint-passport__sourceEvidence">${sourceEvidenceHtml(sourceAudit.evidence)}</div>
          <div class="checkpoint-passport__sourceLinks">
            ${
              sourceAudit.sourceUrl
                ? `<a href="${escapeHtml(sourceAudit.sourceUrl)}" target="_blank" rel="noreferrer">Открыть источник</a>`
                : "<span>Исходная ссылка отсутствует</span>"
            }
            <a href="${escapeHtml(sourceAudit.verificationUrl)}" target="_blank" rel="noreferrer">${escapeHtml(sourceAudit.verificationLabel)}</a>
          </div>
        </div>
      </section>

      ${enrichmentHtml(enrichment)}

      <section class="checkpoint-passport__details" aria-label="Атрибуты КПП">
        <div class="checkpoint-passport__sectionTitle">Атрибуты</div>
        ${buildDetailRows(props, extra)}
      </section>

      <footer class="checkpoint-passport__actions" aria-label="Действия с КПП">
        <button
          class="checkpoint-passport__action checkpoint-passport__favorite${isFavorite ? " is-active" : ""}"
          type="button"
          data-passport-favorite-id="${escapeHtml(props.__id)}"
          aria-pressed="${isFavorite ? "true" : "false"}"
        >${isFavorite ? "★ В избранном" : "☆ В избранное"}</button>
        <button
          class="checkpoint-passport__action checkpoint-passport__compare${isComparing ? " is-active" : ""}"
          type="button"
          data-passport-compare-id="${escapeHtml(props.__id)}"
        >${isComparing ? "В сравнении" : "Сравнить"}</button>
        <button
          class="checkpoint-passport__action checkpoint-passport__copy"
          type="button"
          data-passport-copy-id="${escapeHtml(props.__id)}"
        >Координаты</button>
        <a class="checkpoint-passport__action" href="${escapeHtml(routeHref)}" target="_blank" rel="noreferrer">Маршрут</a>
        ${
          sourceUrl
            ? `<a class="checkpoint-passport__action" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Источник</a>`
            : '<span class="checkpoint-passport__action checkpoint-passport__action--muted">Нет источника</span>'
        }
        <a class="checkpoint-passport__action checkpoint-passport__report" href="${escapeHtml(reportHref)}" target="_blank" rel="noreferrer">Сообщить</a>
      </footer>
    </article>
  `;

  passportEl.querySelector?.(".checkpoint-passport__close")?.addEventListener?.("click", () => {
    onClose?.();
  });

  passportEl.querySelector?.(".checkpoint-passport__favorite")?.addEventListener?.("click", () => {
    onFavoriteToggle?.(String(props.__id));
  });

  passportEl.querySelector?.(".checkpoint-passport__compare")?.addEventListener?.("click", () => {
    onCompareToggle?.(String(props.__id));
  });

  const copyButton = passportEl.querySelector?.(".checkpoint-passport__copy");
  copyButton?.addEventListener?.("click", async () => {
    const copied = await onCopyCoordinates?.(String(props.__id));
    if (!copied) return;

    copyButton.textContent = "Скопировано";
    setTimeout(() => {
      copyButton.textContent = "Координаты";
    }, 1400);
  });
}
