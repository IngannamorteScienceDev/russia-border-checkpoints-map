function toDatasetKey(name) {
  return name.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function createNode(dataset = {}) {
  return {
    dataset,
    style: {},
    textContent: "",
    onclick: null,
    classList: createClassList(),
    addEventListener(eventName, handler) {
      if (eventName === "click") this.onclick = handler;
    }
  };
}

function createClassList() {
  const names = new Set();

  return {
    add(...nextNames) {
      nextNames.forEach((name) => names.add(name));
    },
    remove(...nextNames) {
      nextNames.forEach((name) => names.delete(name));
    },
    toggle(name, force) {
      if (force === true) {
        names.add(name);
        return true;
      }

      if (force === false) {
        names.delete(name);
        return false;
      }

      if (names.has(name)) {
        names.delete(name);
        return false;
      }

      names.add(name);
      return true;
    },
    contains(name) {
      return names.has(name);
    }
  };
}

function parseNodes(html, selector) {
  const selectorMap = {
    ".item": ["div", "item", "id"],
    ".item__favorite": ["button", "item__favorite", "favorite-id"],
    ".item__compare": ["button", "item__compare", "compare-id"],
    ".item__copyCoords": ["button", "item__copyCoords", "copy-coords-id"],
    ".item__route": ["a", "item__route", ""],
    ".recent__item": ["button", "recent__item", "id"],
    ".compare__pill": ["button", "compare__pill", "id"],
    ".nearest-open__card": ["button", "nearest-open__card", "id"],
    ".share-sheet__close": ["button", "share-sheet__close", ""],
    ".checkpoint-passport__close": ["button", "checkpoint-passport__close", ""],
    ".checkpoint-passport__favorite": [
      "button",
      "checkpoint-passport__favorite",
      "passport-favorite-id"
    ],
    ".checkpoint-passport__compare": [
      "button",
      "checkpoint-passport__compare",
      "passport-compare-id"
    ],
    ".checkpoint-passport__copy": ["button", "checkpoint-passport__copy", "passport-copy-id"]
  };

  const selectorConfig = selectorMap[selector];

  if (selectorConfig) {
    const [tagName, className, dataName] = selectorConfig;
    const pattern = new RegExp(`<${tagName}[^>]*class="([^"]*)"[^>]*>`, "g");
    return [...html.matchAll(pattern)]
      .filter((match) => match[1].split(/\s+/).includes(className))
      .map((match) => {
        const dataset = {};
        if (dataName) {
          const dataMatch = match[0].match(new RegExp(`data-${dataName}="([^"]+)"`));
          if (dataMatch) dataset[toDatasetKey(dataName)] = dataMatch[1];
        }

        return createNode(dataset);
      });
  }

  const dataSelector = selector.match(/^\[data-([a-z-]+)\]$/);
  if (dataSelector) {
    const dataName = dataSelector[1];
    const pattern = new RegExp(`<[^>]*data-${dataName}="([^"]+)"[^>]*>`, "g");
    return [...html.matchAll(pattern)].map((match) =>
      createNode({ [toDatasetKey(dataName)]: match[1] })
    );
  }

  return [];
}

function createElement() {
  const element = {
    style: {},
    textContent: "",
    __innerHTML: "",
    __nodeCache: new Map(),
    value: "all",
    disabled: false,
    hidden: false,
    onclick: null,
    onchange: null,
    oninput: null,
    classList: createClassList(),
    parentNode: { removeChild() {} },
    setAttribute() {},
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      if (!this.__nodeCache.has(selector)) {
        this.__nodeCache.set(selector, parseNodes(this.__innerHTML, selector));
      }

      return this.__nodeCache.get(selector);
    }
  };

  Object.defineProperty(element, "innerHTML", {
    get() {
      return this.__innerHTML;
    },
    set(value) {
      this.__innerHTML = String(value);
      this.__nodeCache.clear();
    }
  });

  return element;
}

const elements = new Map();
let lastDownload = null;
let lastClipboardText = "";
let lastMapInstance = null;
let initialMapOptions = null;
let replaceStateCalls = 0;
const storage = new Map();
const windowListeners = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storage.get(key) ?? null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  }
};

globalThis.document = {
  body: {
    appendChild() {},
    removeChild() {}
  },
  getElementById(id) {
    if (!elements.has(id)) {
      const element = createElement();
      if (id === "searchInput") element.value = "";
      elements.set(id, element);
    }

    return elements.get(id);
  },
  createElement(tagName) {
    if (tagName !== "a") {
      return createElement();
    }

    return {
      ...createElement(),
      href: "",
      download: "",
      click() {
        lastDownload = {
          href: this.href,
          download: this.download
        };
      }
    };
  }
};

globalThis.window = {
  location: {
    href: "http://localhost:8000/?country=%D0%9A%D0%B8%D1%82%D0%B0%D0%B9&status=%D0%94%D0%B5%D0%B9%D1%81%D1%82%D0%B2%D1%83%D0%B5%D1%82&q=%D1%82%D0%B5%D1%81%D1%82&checkpoint=100&lng=120.50000&lat=50.25000&zoom=5.50&sat=1"
  },
  history: {
    replaceState(_state, _title, nextUrl) {
      replaceStateCalls += 1;
      window.location.href = String(nextUrl);
    }
  },
  addEventListener(eventName, handler) {
    windowListeners.set(eventName, handler);
  },
  matchMedia() {
    return { matches: false };
  }
};

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    onLine: false,
    clipboard: {
      async writeText(text) {
        lastClipboardText = text;
      }
    },
    geolocation: {
      getCurrentPosition(success) {
        success({
          coords: {
            longitude: 87,
            latitude: 53.8
          }
        });
      }
    }
  }
});

globalThis.fetch = async (resource) => ({
  ok: true,
  async json() {
    if (String(resource).includes("checkpoint_enrichment.json")) {
      return {
        schemaVersion: 1,
        generatedAt: "2026-04-15T00:00:00.000Z",
        sources: [],
        records: [
          {
            checkpointId: "100",
            kind: "official_verification",
            title: "Сверено с тестовым перечнем",
            summary: "Запись совпадает с контрольным тестовым источником.",
            date: "2026-04-15",
            sourceTitle: "Минтранс России",
            sourceUrl: "https://mintrans.gov.ru/activities/168",
            confidence: "high",
            tags: ["сверка", "официально"]
          },
          {
            checkpointId: "100",
            kind: "infrastructure",
            title: "Тестовое инфраструктурное событие",
            summary: "Событие привязано к КПП через enrichment-файл и отображается в паспорте.",
            date: "2026-04-10",
            sourceTitle: "ФГКУ Росгранстрой",
            sourceUrl: "https://www.rosgranstroy.ru/press-center/news/test",
            confidence: "medium",
            tags: ["инфраструктура"]
          }
        ]
      };
    }

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [131.9, 43.1]
          },
          properties: {
            checkpoint_id: "100",
            checkpoint_name: "Тестовый КПП",
            checkpoint_type: "автомобильный",
            checkpoint_pattern: "Грузо-пассажирский",
            status: "Многосторонний",
            status_description: "Тестовое описание правового режима",
            is_functional: "True",
            is_published: "True",
            working_time: "круглосуточно",
            address: "Приморский край, тестовый адрес КПП",
            subject_name: "Приморский край",
            federal_district: "Дальневосточный",
            foreign_country: "Китай",
            foreign_checkpoint: "Тестовый сопредельный пункт",
            transport_corridor: "Восток",
            checkpoint_note: "Тестовое примечание КПП",
            near_checkpoint_condition: "0",
            checkpoint_working_mode_id: "3",
            checkpoint_direction_id: "2",
            branch_name: "Дальневосточный филиал",
            branch_phone: "+7(423)000-00-00",
            branch_email: "test@example.test",
            branch_address: "г. Владивосток, тестовый адрес филиала",
            branch_working_time: "по будням с 9:00 до 18:00",
            branch_slug: "dalnevostochniy",
            source: "https://rosgranstroy.ru/api/map_data",
            confidence_level: "high",
            last_updated: "2026-01-19T09:56:39.000000Z"
          }
        },
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [86.95, 53.75]
          },
          properties: {
            checkpoint_id: "101",
            checkpoint_name: "Воздушный тест",
            checkpoint_type: "воздушный",
            checkpoint_pattern: "Пассажирский",
            status: "Двусторонний",
            is_functional: "False",
            working_time: "по факту прибытия рейсов",
            address: "Кемеровская область, тестовый аэропорт",
            subject_name: "Кемеровская область",
            foreign_country: "Не указано"
          }
        }
      ]
    };
  }
});

class FakeMap {
  constructor(options = {}) {
    this.sources = new Map();
    this.layers = new Map();
    this.listeners = new Map();
    this.center = Array.isArray(options.center) ? [...options.center] : [0, 0];
    this.zoom = typeof options.zoom === "number" ? options.zoom : 0;
    initialMapOptions = {
      center: [...this.center],
      zoom: this.zoom
    };
    this.boundsContains = () => true;
    lastMapInstance = this;
  }

  loaded() {
    return true;
  }

  once(_event, cb) {
    cb();
  }

  addControl() {}

  addSource(id, source) {
    this.sources.set(id, {
      ...source,
      setData(data) {
        this.data = data;
      },
      getClusterExpansionZoom(_id, cb) {
        cb(null, 5);
      }
    });
  }

  getSource(id) {
    return this.sources.get(id);
  }

  removeSource(id) {
    this.sources.delete(id);
  }

  addLayer(layer) {
    this.layers.set(layer.id, {
      ...layer,
      layout: layer.layout ? { ...layer.layout } : {}
    });
  }

  getLayer(id) {
    return this.layers.get(id);
  }

  removeLayer(id) {
    this.layers.delete(id);
  }

  on(eventName, maybeLayer, maybeHandler) {
    const handler = typeof maybeLayer === "function" ? maybeLayer : maybeHandler;
    if (typeof handler !== "function") return;

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    this.listeners.get(eventName).add(handler);
  }

  off(eventName, maybeLayer, maybeHandler) {
    const handler = typeof maybeLayer === "function" ? maybeLayer : maybeHandler;
    if (typeof handler !== "function") return;

    this.listeners.get(eventName)?.delete(handler);
  }

  emit(eventName) {
    for (const handler of this.listeners.get(eventName) || []) {
      handler();
    }
  }

  easeTo(options = {}) {
    if (Array.isArray(options.center)) {
      this.center = [...options.center];
    }

    if (typeof options.zoom === "number") {
      this.zoom = options.zoom;
    }

    this.emit("moveend");
  }

  fitBounds(bounds, options = {}) {
    const [southWest, northEast] = bounds;
    this.center = [(southWest[0] + northEast[0]) / 2, (southWest[1] + northEast[1]) / 2];

    if (typeof options.maxZoom === "number") {
      this.zoom = Math.min(Math.max(this.zoom, 5), options.maxZoom);
    }

    this.emit("moveend");
  }

  resize() {}

  getCanvas() {
    return { style: {} };
  }

  getZoom() {
    return this.zoom;
  }

  getCenter() {
    return {
      lng: this.center[0],
      lat: this.center[1]
    };
  }

  getBounds() {
    return {
      contains: (coordinates) => this.boundsContains(coordinates)
    };
  }

  setLayoutProperty(id, prop, value) {
    const layer = this.layers.get(id);
    if (!layer) return;

    if (!layer.layout) layer.layout = {};
    layer.layout[prop] = value;
  }

  getLayoutProperty(id, prop) {
    return this.layers.get(id)?.layout?.[prop] ?? "none";
  }
}

class FakeMarker {
  setLngLat() {
    return this;
  }

  addTo() {
    return this;
  }

  remove() {}
}

class FakePopup {
  constructor() {
    this.listeners = new Map();
  }

  setLngLat() {
    return this;
  }

  setHTML() {
    return this;
  }

  addTo() {
    return this;
  }

  on(eventName, handler) {
    this.listeners.set(eventName, handler);
    return this;
  }

  remove() {
    this.listeners.get("close")?.();
  }
}

class FakeNavigationControl {}

globalThis.maplibregl = {
  Map: FakeMap,
  Marker: FakeMarker,
  Popup: FakePopup,
  NavigationControl: FakeNavigationControl
};

URL.createObjectURL = () => "blob:test-download";
URL.revokeObjectURL = () => {};

const { FAVORITES_STORAGE_KEY, loadFavoriteIds, saveFavoriteIds, toggleFavoriteId } = await import(
  new URL("../js/favorites.js", import.meta.url)
);
const { toggleCompareId } = await import(new URL("../js/compare.js", import.meta.url));
const { buildDatasetSnapshot, saveDatasetSnapshot, summarizeDatasetChanges } = await import(
  new URL("../js/datasetChanges.js", import.meta.url)
);
const { getFreshnessInfo } = await import(new URL("../js/freshness.js", import.meta.url));
const { getQualityFlags } = await import(new URL("../js/quality.js", import.meta.url));
const { buildReportUrl } = await import(new URL("../js/report.js", import.meta.url));
const { RECENT_STORAGE_KEY, loadRecentIds, prependRecentId, saveRecentIds } = await import(
  new URL("../js/recent.js", import.meta.url)
);

let favoriteIds = loadFavoriteIds();
favoriteIds = toggleFavoriteId(favoriteIds, "100");
saveFavoriteIds(favoriteIds);

if (!loadFavoriteIds().has("100")) {
  throw new Error("Favorite checkpoint IDs were not persisted.");
}

if (toggleFavoriteId(loadFavoriteIds(), "100").has("100")) {
  throw new Error("Favorite checkpoint ID was not toggled off.");
}

storage.set(FAVORITES_STORAGE_KEY, "not-json");
if (loadFavoriteIds().size !== 0) {
  throw new Error("Malformed favorite checkpoint storage should be ignored.");
}

saveFavoriteIds(new Set(["100"]));

let compareIds = toggleCompareId([], "100");
compareIds = toggleCompareId(compareIds, "101");
compareIds = toggleCompareId(compareIds, "102");
if (compareIds.join(",") !== "101,102") {
  throw new Error("Compare checkpoint IDs should keep only the two latest items.");
}

if (toggleCompareId(compareIds, "101").join(",") !== "102") {
  throw new Error("Compare checkpoint IDs should toggle existing items off.");
}

if (getFreshnessInfo("2026-01-01T00:00:00Z", new Date("2026-04-01T00:00:00Z")).level !== "fresh") {
  throw new Error("Freshness helper did not classify recent records.");
}

if (getFreshnessInfo("2024-01-01T00:00:00Z", new Date("2026-04-01T00:00:00Z")).level !== "stale") {
  throw new Error("Freshness helper did not classify stale records.");
}

if (
  getQualityFlags({ properties: { __extra: {}, __status: "Неизвестно", __coords: "—" } }).length < 4
) {
  throw new Error("Quality helper did not flag incomplete records.");
}

if (
  !buildReportUrl(
    { properties: { __id: "100", __name: "Тест" } },
    "https://example.test/map"
  ).includes("issues/new")
) {
  throw new Error("Report URL helper did not build a GitHub issue URL.");
}

const datasetSummary = summarizeDatasetChanges(
  { total: 1, ids: ["100"], latestUpdatedAt: null },
  { total: 2, ids: ["100", "101"], latestUpdatedAt: "2026-01-01T00:00:00.000Z" }
);

if (datasetSummary.totalDelta !== 1 || datasetSummary.addedIds[0] !== "101") {
  throw new Error("Dataset change summary did not detect added checkpoints.");
}

saveDatasetSnapshot(
  buildDatasetSnapshot([
    {
      properties: { __id: "100" }
    }
  ])
);

let recentIds = prependRecentId([], "101");
recentIds = prependRecentId(recentIds, "100");
recentIds = prependRecentId(recentIds, "101");

if (recentIds.join(",") !== "101,100") {
  throw new Error("Recently viewed checkpoint IDs were not ordered correctly.");
}

saveRecentIds(recentIds);
if (loadRecentIds().join(",") !== "101,100") {
  throw new Error("Recently viewed checkpoint IDs were not persisted.");
}

storage.set(RECENT_STORAGE_KEY, "not-json");
if (loadRecentIds().length !== 0) {
  throw new Error("Malformed recent checkpoint storage should be ignored.");
}

saveRecentIds(["101"]);

await import(new URL("../app.js", import.meta.url));
await new Promise((resolve) => setTimeout(resolve, 0));

const statsHtml = elements.get("stats")?.innerHTML || "";
const listHtml = elements.get("list")?.innerHTML || "";
const recentHtml = elements.get("recent")?.innerHTML || "";
const compareHtml = elements.get("compare")?.innerHTML || "";
const datasetChangesHtml = elements.get("datasetChanges")?.innerHTML || "";
const legendHtml = elements.get("legend")?.innerHTML || "";
const passportHtml = elements.get("checkpointPassport")?.innerHTML || "";
const countryFilterHtml = elements.get("countryFilter")?.innerHTML || "";
const subjectFilterHtml = elements.get("subjectFilter")?.innerHTML || "";
const typeFilterHtml = elements.get("typeFilter")?.innerHTML || "";
const exportCsvButton = elements.get("exportCsv");
const exportGeoJsonButton = elements.get("exportGeoJson");
const shareLinkButton = elements.get("shareLink");
const nearestButton = elements.get("nearestBtn");
const favoritesOnlyButton = elements.get("favoritesOnly");
const offlineStatus = elements.get("offlineStatus");
const fitResultsButton = elements.get("fitResults");
const viewportOnlyButton = elements.get("viewportOnly");
const passportEl = elements.get("checkpointPassport");
const quickPresets = elements.get("quickPresets");
const searchInput = elements.get("searchInput");
const typeFilter = elements.get("typeFilter");
const statusFilter = elements.get("statusFilter");
const resetFiltersButton = elements.get("resetFilters");
const styleToggleButton = elements.get("styleToggle");
const boundariesToggleButton = elements.get("boundariesToggle");
const roadsToggleButton = elements.get("roadsToggle");
const sortOrder = elements.get("sortOrder");
const panelEl = elements.get("panel");
const mobilePanelButton = elements.get("mobileToggle");
const mobilePanelFab = elements.get("mobileToggleFloating");
const panelScrimButton = elements.get("panelScrim");
const url = new URL(window.location.href);

if (panelEl?.classList.contains("open")) {
  throw new Error("Mobile panel should not be forced open during startup.");
}

mobilePanelFab?.onclick?.();
if (
  !panelEl?.classList.contains("open") ||
  panelScrimButton?.hidden !== false ||
  !panelScrimButton?.classList.contains("is-visible")
) {
  throw new Error("Mobile panel button did not open the panel with a scrim.");
}

panelScrimButton?.onclick?.();
if (panelEl?.classList.contains("open") || panelScrimButton?.hidden !== true) {
  throw new Error("Mobile panel scrim did not close the panel.");
}

mobilePanelButton?.onclick?.();
if (!panelEl?.classList.contains("open")) {
  throw new Error("Inner mobile panel button did not toggle the panel.");
}

mobilePanelButton?.onclick?.();
if (panelEl?.classList.contains("open")) {
  throw new Error("Inner mobile panel button did not close the panel.");
}

if (!statsHtml.includes("Всего КПП") || !statsHtml.includes("Обновлено")) {
  throw new Error("Stats block was not rendered.");
}

if (offlineStatus?.hidden !== false || !offlineStatus?.textContent.includes("Офлайн")) {
  throw new Error("Offline status indicator was not shown while navigator is offline.");
}

navigator.onLine = true;
windowListeners.get("online")?.();

if (offlineStatus?.hidden !== true || offlineStatus?.textContent !== "") {
  throw new Error("Offline status indicator was not hidden after returning online.");
}

navigator.onLine = false;
windowListeners.get("offline")?.();

if (offlineStatus?.hidden !== false) {
  throw new Error("Offline status indicator was not restored after offline event.");
}

if (
  !initialMapOptions ||
  initialMapOptions.center[0] !== 120.5 ||
  initialMapOptions.center[1] !== 50.25 ||
  initialMapOptions.zoom !== 5.5
) {
  throw new Error("Map view was not restored from URL.");
}

if (lastMapInstance?.getLayoutProperty("sat-layer", "visibility") !== "visible") {
  throw new Error("Satellite mode was not restored from URL.");
}

if (!lastMapInstance?.getLayer("favorite-points-halo")) {
  throw new Error("Favorite checkpoint halo layer was not added to the map.");
}

if (!lastMapInstance?.getLayer("quality-points-alert")) {
  throw new Error("Data quality alert layer was not added to the map.");
}

if (
  !lastMapInstance?.getLayer("esri-boundaries-places-layer") ||
  !lastMapInstance?.getLayer("esri-transportation-layer")
) {
  throw new Error("Reference map overlay layers were not added to the map.");
}

if (
  lastMapInstance?.getLayoutProperty("esri-boundaries-places-layer", "visibility") !== "visible" ||
  lastMapInstance?.getLayoutProperty("esri-transportation-layer", "visibility") !== "visible"
) {
  throw new Error("Reference map overlay layers should be visible with satellite mode.");
}

if (
  !legendHtml.includes("legend__special") ||
  !legendHtml.includes("legend__marker--imagery") ||
  !legendHtml.includes("legend__marker--reference") ||
  !legendHtml.includes("legend__marker--favorite") ||
  !legendHtml.includes("legend__marker--quality") ||
  !legendHtml.includes("legend__marker--critical")
) {
  throw new Error("Special marker legend was not rendered.");
}

if (styleToggleButton?.textContent !== "Спутник включен") {
  throw new Error("Satellite toggle label was not updated after restoring URL state.");
}

if (!listHtml.includes("Тестовый КПП") || listHtml.includes("Воздушный тест")) {
  throw new Error("Checkpoint list did not respect URL filters.");
}

if (!listHtml.includes("item__favorite is-favorite") || !listHtml.includes('aria-pressed="true"')) {
  throw new Error("Favorite checkpoint was not rendered as selected.");
}

if (
  !lastMapInstance
    ?.getSource("checkpoints")
    ?.data?.features?.some((feature) => feature.properties.__isFavorite)
) {
  throw new Error("Favorite checkpoint was not decorated in the map source.");
}

if (
  !lastMapInstance
    ?.getSource("checkpoints")
    ?.data?.features?.some(
      (feature) =>
        feature.properties.__id === "100" &&
        feature.properties.__status === "Действует" &&
        feature.properties.__extra?.legalStatus === "Многосторонний" &&
        feature.properties.__extra?.address === "Приморский край, тестовый адрес КПП" &&
        feature.properties.__extra?.branchName === "Дальневосточный филиал" &&
        feature.properties.__extra?.transportCorridor === "Восток"
    )
) {
  throw new Error("Checkpoint legal and hidden attributes were not normalized.");
}

if (
  !listHtml.includes("item__copyCoords") ||
  !listHtml.includes("Координаты") ||
  !listHtml.includes("item__route") ||
  !listHtml.includes("yandex.ru/maps")
) {
  throw new Error("Checkpoint quick actions were not rendered.");
}

if (!listHtml.includes("item__compare") || !listHtml.includes("Сравнить")) {
  throw new Error("Checkpoint compare action was not rendered.");
}

if (!listHtml.includes("freshness freshness--fresh") || !listHtml.includes("Свежие данные")) {
  throw new Error("Freshness badge was not rendered.");
}

if (
  !listHtml.includes("Высокая достоверность") ||
  !listHtml.includes("item__source") ||
  !listHtml.includes("https://rosgranstroy.ru/api/map_data")
) {
  throw new Error("Source and confidence indicators were not rendered.");
}

if (
  !listHtml.includes("Приморский край, тестовый адрес КПП") ||
  !listHtml.includes("Режим: круглосуточно") ||
  !listHtml.includes("Правовой режим: Многосторонний") ||
  !listHtml.includes("МТК: Восток") ||
  !listHtml.includes("Филиал: Дальневосточный филиал")
) {
  throw new Error("Hidden checkpoint attributes were not rendered in the list context.");
}

if (
  !listHtml.includes("item__report") ||
  !listHtml.includes("github.com/IngannamorteScienceDev/russia-border-checkpoints-map/issues/new")
) {
  throw new Error("Report issue action was not rendered.");
}

if (compareHtml !== "") {
  throw new Error("Compare panel should be hidden until checkpoints are selected.");
}

const stopPropagationEvent = { stopPropagation() {} };
const firstFavoriteButton = elements.get("list")?.querySelectorAll(".item__favorite")[0];
firstFavoriteButton?.onclick?.(stopPropagationEvent);

if (loadFavoriteIds().has("100")) {
  throw new Error("Favorite button click did not remove the checkpoint from localStorage.");
}

if (
  lastMapInstance
    ?.getSource("checkpoints")
    ?.data?.features?.some((feature) => feature.properties.__isFavorite)
) {
  throw new Error("Favorite button click did not update favorite state in the map source.");
}

const secondFavoriteButton = elements.get("list")?.querySelectorAll(".item__favorite")[0];
secondFavoriteButton?.onclick?.(stopPropagationEvent);

if (!loadFavoriteIds().has("100")) {
  throw new Error("Favorite button click did not restore the checkpoint in localStorage.");
}

if (
  !lastMapInstance
    ?.getSource("checkpoints")
    ?.data?.features?.some((feature) => feature.properties.__isFavorite)
) {
  throw new Error("Restored favorite checkpoint was not reflected in the map source.");
}

const compareButton = elements.get("list")?.querySelectorAll(".item__compare")[0];
compareButton?.onclick?.(stopPropagationEvent);

if (!elements.get("compare")?.innerHTML?.includes("Сравнение КПП")) {
  throw new Error("Compare button click did not render the compare panel.");
}

const copyCoordsButton = elements.get("list")?.querySelectorAll(".item__copyCoords")[0];
await copyCoordsButton?.onclick?.(stopPropagationEvent);

if (!lastClipboardText.includes("43.10000, 131.90000")) {
  throw new Error("Copy coordinates action did not write checkpoint coordinates.");
}

if (
  !recentHtml.includes("Недавно открытые") ||
  !recentHtml.includes("Тестовый КПП") ||
  !recentHtml.includes("Воздушный тест")
) {
  throw new Error("Recently viewed checkpoints were not rendered.");
}

if (
  !datasetChangesHtml.includes("Изменения данных") ||
  !datasetChangesHtml.includes("+1") ||
  !datasetChangesHtml.includes("Добавлено: 1")
) {
  throw new Error("Dataset change summary was not rendered.");
}

if (recentHtml.indexOf("Тестовый КПП") > recentHtml.indexOf("Воздушный тест")) {
  throw new Error("Recently viewed checkpoints did not keep newest-first order.");
}

if (!countryFilterHtml.includes("Китай")) {
  throw new Error("Country filter was not populated.");
}

if (!subjectFilterHtml.includes("Приморский край")) {
  throw new Error("Subject filter was not populated.");
}

if (!typeFilterHtml.includes("Автомобильный") || !typeFilterHtml.includes("Воздушный")) {
  throw new Error("Type filter was not populated.");
}

if (searchInput?.value !== "тест") {
  throw new Error("Search query was not restored from URL.");
}

if (statusFilter?.value !== "Действует") {
  throw new Error("Status filter was not restored from URL.");
}

if (sortOrder?.value !== "country") {
  throw new Error("Default sort order was not preserved.");
}

if (url.searchParams.get("checkpoint") !== "100") {
  throw new Error("Selected checkpoint was not preserved in URL.");
}

if (
  url.searchParams.get("lng") !== "131.90000" ||
  url.searchParams.get("lat") !== "43.10000" ||
  url.searchParams.get("zoom") !== "7.00"
) {
  throw new Error("Map view was not synchronized after restoring the checkpoint popup.");
}

const requiredPassportSnippets = [
  "Паспорт КПП",
  "Тестовый КПП",
  "Высокая достоверность",
  "Приморский край, тестовый адрес КПП",
  "круглосуточно",
  "Правовой режим",
  "Многосторонний",
  "Грузо-пассажирский",
  "Дальневосточный",
  "Тестовый сопредельный пункт",
  "Филиал Росгранстроя",
  "Дальневосточный филиал",
  "+7(423)000-00-00",
  "test@example.test",
  "Восток",
  "Тестовое примечание КПП",
  "Откуда данные",
  "ФГКУ Росгранстрой",
  "Сверить с перечнем Минтранса",
  "События и сверка",
  "Сверено с тестовым перечнем",
  "Тестовое инфраструктурное событие",
  "https://www.rosgranstroy.ru/press-center/news/test",
  "checkpoint-passport__favorite is-active",
  "checkpoint-passport__copy",
  "https://rosgranstroy.ru/api/map_data",
  "issues/new"
];
const missingPassportSnippets = requiredPassportSnippets.filter(
  (snippet) => !passportHtml.includes(snippet)
);

if (passportEl?.hidden !== false || missingPassportSnippets.length) {
  throw new Error(
    `Selected checkpoint passport is missing expected content: ${missingPassportSnippets.join(", ")}`
  );
}

if (
  typeof passportEl?.querySelector(".checkpoint-passport__favorite")?.onclick !== "function" ||
  typeof passportEl?.querySelector(".checkpoint-passport__compare")?.onclick !== "function" ||
  typeof passportEl?.querySelector(".checkpoint-passport__copy")?.onclick !== "function" ||
  typeof passportEl?.querySelector(".checkpoint-passport__close")?.onclick !== "function"
) {
  throw new Error("Checkpoint passport actions were not wired.");
}

if (
  typeof exportCsvButton?.onclick !== "function" ||
  typeof exportGeoJsonButton?.onclick !== "function"
) {
  throw new Error("Export buttons were not wired.");
}

if (typeof shareLinkButton?.onclick !== "function") {
  throw new Error("Share button was not wired.");
}

if (typeof nearestButton?.onclick !== "function") {
  throw new Error("Nearest button was not wired.");
}

if (typeof favoritesOnlyButton?.onclick !== "function") {
  throw new Error("Favorites-only button was not wired.");
}

if (typeof fitResultsButton?.onclick !== "function") {
  throw new Error("Fit-results button was not wired.");
}

if (typeof viewportOnlyButton?.onclick !== "function") {
  throw new Error("Viewport-only button was not wired.");
}

if (
  typeof boundariesToggleButton?.onclick !== "function" ||
  typeof roadsToggleButton?.onclick !== "function"
) {
  throw new Error("Reference layer toggles were not wired.");
}

if (typeof quickPresets?.onclick !== "function") {
  throw new Error("Quick presets were not wired.");
}

if (favoritesOnlyButton?.textContent !== "★ Избранные (1)") {
  throw new Error("Favorites counter was not rendered.");
}

exportCsvButton.onclick();
if (!lastDownload?.download?.endsWith(".csv")) {
  throw new Error("CSV export did not trigger download.");
}

exportGeoJsonButton.onclick();
if (!lastDownload?.download?.endsWith(".geojson")) {
  throw new Error("GeoJSON export did not trigger download.");
}

await shareLinkButton.onclick();
if (
  !lastClipboardText.includes("checkpoint=100") ||
  !lastClipboardText.includes("country=") ||
  !lastClipboardText.includes("zoom=7.00") ||
  !lastClipboardText.includes("sat=1")
) {
  throw new Error("Share link did not copy current URL state.");
}

const shareSheetHtml = elements.get("shareSheet")?.innerHTML || "";
if (
  !shareSheetHtml.includes("Поделиться картой") ||
  !shareSheetHtml.includes("data:image/svg+xml") ||
  shareSheetHtml.includes("api.qrserver.com") ||
  !shareSheetHtml.includes("share-sheet__url")
) {
  throw new Error("Share sheet with QR code was not rendered.");
}

styleToggleButton.onclick?.();
if (new URL(window.location.href).searchParams.get("sat") !== "0") {
  throw new Error("Satellite mode was not stored as disabled in URL after toggling off.");
}

if (lastMapInstance?.getLayoutProperty("sat-layer", "visibility") !== "none") {
  throw new Error("Satellite layer was not hidden after toggling off.");
}

if (styleToggleButton?.textContent !== "Схема включена") {
  throw new Error("Satellite toggle label was not restored after turning the layer off.");
}

styleToggleButton.onclick?.();
if (new URL(window.location.href).searchParams.get("sat") !== "1") {
  throw new Error("Satellite mode was not restored in URL after toggling on.");
}

boundariesToggleButton.onclick?.();
if (new URL(window.location.href).searchParams.get("borders") !== "0") {
  throw new Error("Boundaries overlay state was not synchronized to URL.");
}

if (lastMapInstance?.getLayoutProperty("esri-boundaries-places-layer", "visibility") !== "none") {
  throw new Error("Boundaries overlay layer was not hidden after toggling off.");
}

roadsToggleButton.onclick?.();
if (new URL(window.location.href).searchParams.get("roads") !== "0") {
  throw new Error("Roads overlay state was not synchronized to URL.");
}

if (lastMapInstance?.getLayoutProperty("esri-transportation-layer", "visibility") !== "none") {
  throw new Error("Roads overlay layer was not hidden after toggling off.");
}

elements.get("checkpointPassport")?.querySelector(".checkpoint-passport__close")?.onclick?.();
if (new URL(window.location.href).searchParams.get("checkpoint") !== null) {
  throw new Error("Closing checkpoint passport did not clear checkpoint from URL.");
}

if (
  elements.get("checkpointPassport")?.hidden !== true ||
  elements.get("checkpointPassport")?.innerHTML !== ""
) {
  throw new Error("Closing checkpoint passport did not hide the checkpoint passport.");
}

lastMapInstance?.easeTo({ center: [37.6176, 55.7558], zoom: 6.5 });
if (new URL(window.location.href).searchParams.get("lng") !== "37.61760") {
  throw new Error("Map longitude was not synchronized after moving the map.");
}

if (new URL(window.location.href).searchParams.get("lat") !== "55.75580") {
  throw new Error("Map latitude was not synchronized after moving the map.");
}

if (new URL(window.location.href).searchParams.get("zoom") !== "6.50") {
  throw new Error("Map zoom was not synchronized after moving the map.");
}

nearestButton.onclick?.();

if (sortOrder?.value !== "distance") {
  throw new Error("Nearest action did not switch sorting to distance.");
}

const nearestOpenHtml = elements.get("nearestOpen")?.innerHTML || "";
if (
  !nearestOpenHtml.includes("Ближайший действующий") ||
  !nearestOpenHtml.includes("Тестовый КПП")
) {
  throw new Error("Nearest open checkpoint summary was not rendered.");
}

const nearestListHtml = elements.get("list")?.innerHTML || "";
if (
  !nearestListHtml.includes("item--nearest-open") ||
  !nearestListHtml.includes("Ближайший действующий пункт")
) {
  throw new Error("Nearest open checkpoint was not highlighted in the list.");
}

if (new URL(window.location.href).searchParams.get("sort") !== "distance") {
  throw new Error("Distance sorting was not synchronized to URL.");
}

statusFilter.value = "all";
statusFilter.onchange?.();

if (new URL(window.location.href).searchParams.get("status") !== null) {
  throw new Error("URL was not updated after filter change.");
}

resetFiltersButton.onclick?.();

const finalUrl = new URL(window.location.href);

if (
  finalUrl.searchParams.get("q") !== null ||
  finalUrl.searchParams.get("country") !== null ||
  finalUrl.searchParams.get("status") !== null ||
  finalUrl.searchParams.get("checkpoint") !== null
) {
  throw new Error("Reset filters did not clear filter state from URL.");
}

if (
  finalUrl.searchParams.get("lng") !== "37.61760" ||
  finalUrl.searchParams.get("lat") !== "55.75580" ||
  finalUrl.searchParams.get("zoom") !== "6.50"
) {
  throw new Error("Reset filters should preserve the current map view in URL.");
}

if (finalUrl.searchParams.get("sat") !== "1") {
  throw new Error("Reset filters should preserve satellite mode in URL.");
}

const finalListHtml = elements.get("list")?.innerHTML || "";
if (
  finalListHtml.indexOf("Воздушный тест") === -1 ||
  finalListHtml.indexOf("Тестовый КПП") === -1
) {
  throw new Error("Rendered list is missing expected checkpoints after resetting filters.");
}

if (
  !finalListHtml.includes("item--quality-warning") ||
  !finalListHtml.includes("Нет источника") ||
  !finalListHtml.includes("Нет даты обновления")
) {
  throw new Error("Incomplete checkpoint markers were not rendered.");
}

if (
  !lastMapInstance
    ?.getSource("checkpoints")
    ?.data?.features?.some((feature) => feature.properties.__hasQualityIssues)
) {
  throw new Error("Incomplete checkpoint marker was not reflected in the map source.");
}

if (finalListHtml.indexOf("Воздушный тест") > finalListHtml.indexOf("Тестовый КПП")) {
  throw new Error("Distance sorting did not place the closest checkpoint first.");
}

if (finalUrl.searchParams.get("sort") !== "distance") {
  throw new Error("Reset filters should preserve the current sort mode in URL.");
}

lastMapInstance.boundsContains = (coordinates) => coordinates[0] < 100;
viewportOnlyButton.onclick?.();

const viewportOnlyListHtml = elements.get("list")?.innerHTML || "";
if (
  !viewportOnlyListHtml.includes("Воздушный тест") ||
  viewportOnlyListHtml.includes("Тестовый КПП")
) {
  throw new Error("Viewport-only filter did not limit the rendered list to visible checkpoints.");
}

if (new URL(window.location.href).searchParams.get("viewport") !== null) {
  throw new Error("Viewport-only filter should not be synchronized to shared URL state.");
}

viewportOnlyButton.onclick?.();
lastMapInstance.boundsContains = () => true;

fitResultsButton.onclick?.();

const fitUrl = new URL(window.location.href);
if (
  fitUrl.searchParams.get("lng") !== "109.42500" ||
  fitUrl.searchParams.get("lat") !== "48.42500"
) {
  throw new Error("Fit-results action did not center the map on rendered checkpoints.");
}

favoritesOnlyButton.onclick?.();

const favoriteOnlyListHtml = elements.get("list")?.innerHTML || "";
if (
  !favoriteOnlyListHtml.includes("Тестовый КПП") ||
  favoriteOnlyListHtml.includes("Воздушный тест")
) {
  throw new Error("Favorites-only filter did not limit the rendered list.");
}

if (new URL(window.location.href).searchParams.get("favorites") !== null) {
  throw new Error("Local favorites filter should not be synchronized to shared URL state.");
}

favoritesOnlyButton.onclick?.();
quickPresets.onclick?.({ target: { dataset: { preset: "air" } } });

if (typeFilter?.value !== "Воздушный") {
  throw new Error("Quick preset did not update the type filter.");
}

if (new URL(window.location.href).searchParams.get("type") !== "Воздушный") {
  throw new Error("Quick preset was not synchronized to URL filters.");
}

const presetListHtml = elements.get("list")?.innerHTML || "";
if (!presetListHtml.includes("Воздушный тест") || presetListHtml.includes("Тестовый КПП")) {
  throw new Error("Quick preset did not filter the rendered list.");
}

if (replaceStateCalls < 7) {
  throw new Error("URL state was not synchronized via history.replaceState.");
}

console.log("frontend smoke test passed");
