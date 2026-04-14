import { renderShareSheet, renderStats } from "../js/render.js";

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
    <span>Активных фильтров: <b>3</b></span>
    <span>Избранных: <b>1</b></span>
    <span>Скрыто: <b>1</b></span>
  </div>
`);

assert(statsSnapshot === expectedStatsSnapshot, "Stats visual snapshot changed.");

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
