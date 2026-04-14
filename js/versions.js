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

async function loadChangelog() {
  const response = await fetch(new URL("../data/dataset_changelog.json", import.meta.url), {
    cache: "no-store"
  });

  if (!response.ok) return { entries: [] };
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
    const datasetMeta = buildDatasetMeta(features);
    const snapshot = buildDatasetSnapshot(features, datasetMeta);
    const freshness = getFreshnessInfo(datasetMeta.latestUpdatedAt);
    const byStatus = countBy(features, (feature) => feature.properties.__status);
    const byType = countBy(features, (feature) => feature.properties.__type);
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
