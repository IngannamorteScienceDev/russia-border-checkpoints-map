import { renderResearchQueue, renderShareSheet, renderStats } from "../js/render.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createElement() {
  return {
    innerHTML: "",
    style: {},
    querySelector() {
      return { addEventListener() {} };
    },
    querySelectorAll() {
      return [];
    }
  };
}

function normalize(html) {
  return html
    .replace(/src="data:image\/svg\+xml[^"]+"/, 'src="<qr>"')
    .replace(/\s+/g, " ")
    .replace(/\s+>/g, ">")
    .replace(/> </g, "><")
    .trim();
}

const statsEl = createElement();
renderStats({
  statsEl,
  allFeatures: [{}, {}],
  viewFeatures: [{}],
  datasetMeta: {
    latestUpdatedLabel: "19 января 2026 г.",
    countryCount: 2,
    subjectCount: 1
  },
  activeFilterCount: 3,
  favoriteCount: 1
});

const statsSnapshot = normalize(statsEl.innerHTML);
const expectedStatsSnapshot = normalize(`
  <div class="stats__grid">
    <div class="stats__card">
      <div class="stats__label">Всего КПП</div>
      <div class="stats__value">2</div>
    </div>
    <div class="stats__card">
      <div class="stats__label">Показано</div>
      <div class="stats__value">1</div>
    </div>
    <div class="stats__card">
      <div class="stats__label">Стран</div>
      <div class="stats__value">2</div>
    </div>
    <div class="stats__card">
      <div class="stats__label">Субъектов РФ</div>
      <div class="stats__value">1</div>
    </div>
  </div>
  <div class="stats__meta">
    <span>Обновлено: <b>19 января 2026 г.</b></span>
    <span>Описаний: <b>0/2</b></span>
    <span>Событий: <b>0</b></span>
    <span>Активных фильтров: <b>3</b></span>
    <span>Избранных: <b>1</b></span>
    <span>Скрыто: <b>1</b></span>
  </div>
`);

assert(statsSnapshot === expectedStatsSnapshot, "Stats visual snapshot changed.");

const researchQueueEl = createElement();
renderResearchQueue({
  queueEl: researchQueueEl,
  allFeatures: [
    {
      properties: {
        __hasDescription: true,
        __enrichmentEventCount: 1,
        __status: "Действует",
        __coords: "10.00000, 10.00000",
        __extra: {
          source: "https://example.test/source",
          updatedAt: "2026-01-01T00:00:00Z"
        }
      }
    },
    {
      properties: {
        __hasDescription: false,
        __enrichmentEventCount: 0,
        __status: "Неизвестно",
        __coords: "—",
        __extra: {}
      }
    }
  ],
  viewFeatures: [{}],
  activeResearchFilter: "missing-description",
  onFilter() {}
});

const researchQueueSnapshot = normalize(researchQueueEl.innerHTML);
const expectedResearchQueueSnapshot = normalize(`
  <div class="research-queue__header">
    <div>
      <div class="research-queue__kicker">Исследовательская очередь</div>
      <h2>Что проверить дальше</h2>
    </div>
    <span>1/2</span>
  </div>
  <div class="research-queue__progress" aria-label="Покрытие описаниями">
    <div class="research-queue__progressTop">
      <span>Покрытие описаниями</span>
      <b>50%</b>
    </div>
    <div class="research-queue__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
      <i style="width:50%"></i>
    </div>
  </div>
  <div class="research-queue__tasks">
    <button class="research-queue__task research-queue__task--warning is-active" type="button" data-research-filter="missing-description" aria-pressed="true">
      <span>
        <b>Нужно описание</b>
        <small>КПП без исследовательской карточки</small>
      </span>
      <strong>1</strong>
    </button>
    <button class="research-queue__task research-queue__task--warning" type="button" data-research-filter="missing-events" aria-pressed="false">
      <span>
        <b>Нет событий / сверки</b>
        <small>Нет привязанных новостей, сверок или заметок</small>
      </span>
      <strong>1</strong>
    </button>
    <button class="research-queue__task research-queue__task--danger" type="button" data-research-filter="quality-issues" aria-pressed="false">
      <span>
        <b>Вопросы к данным</b>
        <small>Неполные источник, дата, статус или координаты</small>
      </span>
      <strong>1</strong>
    </button>
    <button class="research-queue__task research-queue__task--good" type="button" data-research-filter="described" aria-pressed="false">
      <span>
        <b>Готово к чтению</b>
        <small>КПП с готовым описанием</small>
      </span>
      <strong>1</strong>
    </button>
  </div>
`);

assert(researchQueueSnapshot === expectedResearchQueueSnapshot, "Research queue snapshot changed.");

const shareSheetEl = createElement();
renderShareSheet({
  shareSheetEl,
  shareUrl: "https://example.test/map?checkpoint=100&zoom=7",
  isOpen: true,
  canNativeShare: true,
  onCopy() {},
  onNativeShare() {},
  onClose() {}
});

const shareSheetSnapshot = normalize(shareSheetEl.innerHTML);
const expectedShareSheetSnapshot = normalize(`
  <div class="share-sheet__header">
    <div>
      <div class="share-sheet__title">Поделиться картой</div>
      <div class="share-sheet__hint">Ссылка сохраняет фильтры, выбранный КПП, ракурс карты и спутниковый слой.</div>
    </div>
    <button class="share-sheet__close" type="button" aria-label="Закрыть">×</button>
  </div>
  <div class="share-sheet__body">
    <img class="share-sheet__qr" src="<qr>" alt="QR-код текущей ссылки" loading="lazy">
    <div class="share-sheet__content">
      <input class="share-sheet__url" type="text" readonly value="https://example.test/map?checkpoint=100&amp;zoom=7">
      <div class="share-sheet__actions">
        <button class="share-sheet__button" type="button" data-share-action="copy">Копировать</button>
        <button class="share-sheet__button" type="button" data-share-action="native">Системное меню</button>
      </div>
      <div class="share-sheet__note">QR генерируется локально в браузере, без внешних сервисов.</div>
    </div>
  </div>
`);

assert(shareSheetSnapshot === expectedShareSheetSnapshot, "Share sheet visual snapshot changed.");

console.log("visual snapshot smoke test passed");
