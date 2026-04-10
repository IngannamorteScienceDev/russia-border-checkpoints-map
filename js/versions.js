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
  return entries.map(([label, count]) => `
    <div class="versions-count">
      <span>${escapeHtml(label)}</span>
      <b>${count}</b>
    </div>
  `).join("");
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
    const datasetMeta = buildDatasetMeta(features);
    const snapshot = buildDatasetSnapshot(features, datasetMeta);
    const freshness = getFreshnessInfo(datasetMeta.latestUpdatedAt);
    const byStatus = countBy(features, feature => feature.properties.__status);
    const byType = countBy(features, feature => feature.properties.__type);
    const versionId = buildVersionId(snapshot);

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
