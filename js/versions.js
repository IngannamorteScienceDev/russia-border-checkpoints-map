import { buildDatasetMeta, loadFeatures } from "./data.js";
import { buildDatasetSnapshot } from "./datasetChanges.js";
import { getFreshnessInfo } from "./freshness.js";

const summaryEl = document.getElementById("versionsSummary");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function countBy(features, getter) {
  const counts = new Map();

  for (const feature of features) {
    const value = getter(feature) || "Не указано";
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "ru");
  });
}

function renderCountList(entries) {
  return entries
    .map(
      ([label, count]) => `
    <div class="versions-count">
      <span>${escapeHtml(label)}</span>
      <b>${count}</b>
    </div>
  `
    )
    .join("");
}

function renderChangelog(entries = []) {
  if (!entries.length) {
    return `
      <section class="versions-changelog">
        <h2>История версий</h2>
        <p>Changelog пока пуст.</p>
      </section>
    `;
  }

  return `
    <section class="versions-changelog">
      <h2>История версий</h2>
      ${entries
        .slice(0, 8)
        .map((entry) => {
          const changes = entry.changes || {};
          const snapshot = entry.snapshot || {};
          const delta = Number(changes.totalDelta || 0);
          const deltaLabel = delta > 0 ? `+${delta}` : String(delta);

          return `
            <article class="versions-changelog__item">
              <div>
                <b>${escapeHtml(entry.version)}</b>
                <span>${escapeHtml(entry.date)} · ${escapeHtml(entry.summary)}</span>
              </div>
              <div class="versions-changelog__stats">
                <span>Всего: ${snapshot.total || 0}</span>
                <span>Дельта: ${deltaLabel}</span>
                <span>Добавлено: ${changes.added || 0}</span>
                <span>Удалено: ${changes.removed || 0}</span>
              </div>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderQualityReport(report = {}) {
  const summary = report.summary || {};
  const warnings = report.warnings || [];
  const errors = report.errors || [];
  const warningPreview = warnings.slice(0, 8);
  const errorCount = Number(summary.errorCount || errors.length || 0);
  const warningCount = Number(summary.warningCount || warnings.length || 0);
  const statusLabel =
    errorCount > 0
      ? "Есть блокирующие ошибки"
      : warningCount > 0
        ? "Есть предупреждения"
        : "Проблем не найдено";
  const statusClass =
    errorCount > 0
      ? "versions-quality--error"
      : warningCount > 0
        ? "versions-quality--warning"
        : "versions-quality--ok";

  return `
    <section class="versions-quality ${statusClass}">
      <div class="versions-quality__header">
        <div>
          <h2>Качество данных</h2>
          <p>${escapeHtml(statusLabel)} · версия ${escapeHtml(report.datasetVersion || "unknown")}</p>
        </div>
        <span>${summary.checked || 0} проверено</span>
      </div>
      <div class="versions-quality__grid">
        <div>
          <span>Ошибки</span>
          <b>${errorCount}</b>
        </div>
        <div>
          <span>Предупреждения</span>
          <b>${warningCount}</b>
        </div>
        <div>
          <span>Источник</span>
          <b>${escapeHtml(report.generatedFrom || "data/checkpoints.geojson")}</b>
        </div>
      </div>
      ${
        warningPreview.length
          ? `
            <div class="versions-quality__warnings">
              <h3>Первые предупреждения</h3>
              ${warningPreview.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}
            </div>
          `
          : '<p class="versions-quality__empty">Предупреждений нет.</p>'
      }
    </section>
  `;
}

async function loadChangelog() {
  const response = await fetch(new URL("../data/dataset_changelog.json", import.meta.url), {
    cache: "no-store"
  });

  if (!response.ok) return { entries: [] };
  return response.json();
}

async function loadQualityReport() {
  const response = await fetch(new URL("../data/data_quality_report.json", import.meta.url), {
    cache: "no-store"
  });

  if (!response.ok) return { summary: { checked: 0, errorCount: 0, warningCount: 0 } };
  return response.json();
}

function buildVersionId(snapshot) {
  const datePart = snapshot.latestUpdatedAt
    ? snapshot.latestUpdatedAt.slice(0, 10)
    : "unknown-date";

  return `${datePart}-${snapshot.total}`;
}

async function initVersionsPage() {
  try {
    const features = await loadFeatures({ setProgress: () => {} });
    const changelog = await loadChangelog();
    const qualityReport = await loadQualityReport();
    const datasetMeta = buildDatasetMeta(features);
    const snapshot = buildDatasetSnapshot(features, datasetMeta);
    const freshness = getFreshnessInfo(datasetMeta.latestUpdatedAt);
    const byStatus = countBy(features, (feature) => feature.properties.__status);
    const byType = countBy(features, (feature) => feature.properties.__type);
    const versionId =
      qualityReport.datasetVersion || changelog.entries?.[0]?.version || buildVersionId(snapshot);

    summaryEl.innerHTML = `
      <div class="versions-card versions-card--wide">
        <span>Текущая версия</span>
        <b>${escapeHtml(versionId)}</b>
        <small>${escapeHtml(freshness.details)}</small>
      </div>
      <div class="versions-card">
        <span>Всего КПП</span>
        <b>${snapshot.total}</b>
      </div>
      <div class="versions-card">
        <span>Последнее обновление</span>
        <b>${escapeHtml(datasetMeta.latestUpdatedLabel)}</b>
      </div>
      <div class="versions-card">
        <span>Стран</span>
        <b>${datasetMeta.countryCount}</b>
      </div>
      <div class="versions-card">
        <span>Субъектов РФ</span>
        <b>${datasetMeta.subjectCount}</b>
      </div>
      <section class="versions-breakdown">
        <h2>По статусам</h2>
        ${renderCountList(byStatus)}
      </section>
      <section class="versions-breakdown">
        <h2>По типам</h2>
        ${renderCountList(byType)}
      </section>
      ${renderQualityReport(qualityReport)}
      ${renderChangelog(changelog.entries || [])}
    `;
  } catch (error) {
    console.error(error);
    summaryEl.innerHTML = `
      <div class="versions-error">
        Не удалось загрузить сводку данных: ${escapeHtml(error?.message || error)}
      </div>
    `;
  }
}

initVersionsPage();
