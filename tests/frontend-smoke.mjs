function createElement() {
  return {
    style: {},
    textContent: "",
    innerHTML: "",
    value: "all",
    disabled: false,
    onclick: null,
    onchange: null,
    oninput: null,
    classList: { add() {}, toggle() {} },
    parentNode: { removeChild() {} },
    querySelectorAll() {
      return [];
    }
  };
}

const elements = new Map();
let lastDownload = null;
let lastClipboardText = "";
let lastMapInstance = null;
let lastPopupRef = null;
let initialMapOptions = null;
let replaceStateCalls = 0;

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
  location: { href: "http://localhost:8000/?country=%D0%9A%D0%B8%D1%82%D0%B0%D0%B9&status=%D0%94%D0%B5%D0%B9%D1%81%D1%82%D0%B2%D1%83%D0%B5%D1%82&q=%D1%82%D0%B5%D1%81%D1%82&checkpoint=100&lng=120.50000&lat=50.25000&zoom=5.50&sat=1" },
  history: {
    replaceState(_state, _title, nextUrl) {
      replaceStateCalls += 1;
      window.location.href = String(nextUrl);
    }
  },
  matchMedia() {
    return { matches: false };
  }
};

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    clipboard: {
      async writeText(text) {
        lastClipboardText = text;
      }
    },
    geolocation: {
      getCurrentPosition() {}
    }
  }
});

globalThis.fetch = async () => ({
  ok: true,
  async json() {
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
            status: "функционирует",
            subject_name: "Приморский край",
            foreign_country: "Китай",
            source: "https://example.test/source",
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
            status: "временно закрыт",
            subject_name: "Кемеровская область",
            foreign_country: "Не указано",
            source: "https://example.test/source",
            confidence_level: "high",
            last_updated: "2025-12-01T00:00:00.000000Z"
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
    lastPopupRef = this;
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

await import(new URL("../app.js", import.meta.url));
await new Promise(resolve => setTimeout(resolve, 0));

const statsHtml = elements.get("stats")?.innerHTML || "";
const listHtml = elements.get("list")?.innerHTML || "";
const countryFilterHtml = elements.get("countryFilter")?.innerHTML || "";
const subjectFilterHtml = elements.get("subjectFilter")?.innerHTML || "";
const typeFilterHtml = elements.get("typeFilter")?.innerHTML || "";
const exportCsvButton = elements.get("exportCsv");
const exportGeoJsonButton = elements.get("exportGeoJson");
const shareLinkButton = elements.get("shareLink");
const searchInput = elements.get("searchInput");
const statusFilter = elements.get("statusFilter");
const resetFiltersButton = elements.get("resetFilters");
const styleToggleButton = elements.get("styleToggle");
const url = new URL(window.location.href);

if (!statsHtml.includes("Всего КПП") || !statsHtml.includes("Обновлено")) {
  throw new Error("Stats block was not rendered.");
}

if (!initialMapOptions || initialMapOptions.center[0] !== 120.5 || initialMapOptions.center[1] !== 50.25 || initialMapOptions.zoom !== 5.5) {
  throw new Error("Map view was not restored from URL.");
}

if (lastMapInstance?.getLayoutProperty("sat-layer", "visibility") !== "visible") {
  throw new Error("Satellite mode was not restored from URL.");
}

if (styleToggleButton?.textContent !== "🗺 Карта") {
  throw new Error("Satellite toggle label was not updated after restoring URL state.");
}

if (!listHtml.includes("Тестовый КПП") || listHtml.includes("Воздушный тест")) {
  throw new Error("Checkpoint list did not respect URL filters.");
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

if (url.searchParams.get("checkpoint") !== "100") {
  throw new Error("Selected checkpoint was not preserved in URL.");
}

if (url.searchParams.get("lng") !== "131.90000" || url.searchParams.get("lat") !== "43.10000" || url.searchParams.get("zoom") !== "7.00") {
  throw new Error("Map view was not synchronized after restoring the checkpoint popup.");
}

if (typeof exportCsvButton?.onclick !== "function" || typeof exportGeoJsonButton?.onclick !== "function") {
  throw new Error("Export buttons were not wired.");
}

if (typeof shareLinkButton?.onclick !== "function") {
  throw new Error("Share button was not wired.");
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
if (!lastClipboardText.includes("checkpoint=100") || !lastClipboardText.includes("country=") || !lastClipboardText.includes("zoom=7.00") || !lastClipboardText.includes("sat=1")) {
  throw new Error("Share link did not copy current URL state.");
}

styleToggleButton.onclick?.();
if (new URL(window.location.href).searchParams.get("sat") !== null) {
  throw new Error("Satellite mode was not cleared from URL after toggling off.");
}

if (lastMapInstance?.getLayoutProperty("sat-layer", "visibility") !== "none") {
  throw new Error("Satellite layer was not hidden after toggling off.");
}

if (styleToggleButton?.textContent !== "🛰 Спутник") {
  throw new Error("Satellite toggle label was not restored after turning the layer off.");
}

styleToggleButton.onclick?.();
if (new URL(window.location.href).searchParams.get("sat") !== "1") {
  throw new Error("Satellite mode was not restored in URL after toggling on.");
}

lastPopupRef?.remove();
if (new URL(window.location.href).searchParams.get("checkpoint") !== null) {
  throw new Error("Closing popup did not clear checkpoint from URL.");
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

statusFilter.value = "all";
statusFilter.onchange?.();

if (new URL(window.location.href).searchParams.get("status") !== null) {
  throw new Error("URL was not updated after filter change.");
}

resetFiltersButton.onclick?.();

const finalUrl = new URL(window.location.href);

if (finalUrl.searchParams.get("q") !== null || finalUrl.searchParams.get("country") !== null || finalUrl.searchParams.get("status") !== null || finalUrl.searchParams.get("checkpoint") !== null) {
  throw new Error("Reset filters did not clear filter state from URL.");
}

if (finalUrl.searchParams.get("lng") !== "37.61760" || finalUrl.searchParams.get("lat") !== "55.75580" || finalUrl.searchParams.get("zoom") !== "6.50") {
  throw new Error("Reset filters should preserve the current map view in URL.");
}

if (finalUrl.searchParams.get("sat") !== "1") {
  throw new Error("Reset filters should preserve satellite mode in URL.");
}

if (replaceStateCalls < 6) {
  throw new Error("URL state was not synchronized via history.replaceState.");
}

console.log("frontend smoke test passed");
