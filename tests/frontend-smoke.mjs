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
  location: { href: "http://localhost:8000/?country=%D0%9A%D0%B8%D1%82%D0%B0%D0%B9&status=%D0%94%D0%B5%D0%B9%D1%81%D1%82%D0%B2%D1%83%D0%B5%D1%82&q=%D1%82%D0%B5%D1%81%D1%82" },
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
  constructor() {
    this.sources = new Map();
    this.layers = new Map();
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

  on() {}

  off() {}

  easeTo() {}

  resize() {}

  getCanvas() {
    return { style: {} };
  }

  getZoom() {
    return 4;
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
  setLngLat() {
    return this;
  }

  setHTML() {
    return this;
  }

  addTo() {
    return this;
  }

  remove() {}
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
const searchInput = elements.get("searchInput");
const statusFilter = elements.get("statusFilter");
const resetFiltersButton = elements.get("resetFilters");

if (!statsHtml.includes("Всего КПП") || !statsHtml.includes("Обновлено")) {
  throw new Error("Stats block was not rendered.");
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

if (typeof exportCsvButton?.onclick !== "function" || typeof exportGeoJsonButton?.onclick !== "function") {
  throw new Error("Export buttons were not wired.");
}

exportCsvButton.onclick();
if (!lastDownload?.download?.endsWith(".csv")) {
  throw new Error("CSV export did not trigger download.");
}

exportGeoJsonButton.onclick();
if (!lastDownload?.download?.endsWith(".geojson")) {
  throw new Error("GeoJSON export did not trigger download.");
}

statusFilter.value = "all";
statusFilter.onchange?.();

if (new URL(window.location.href).searchParams.get("status") !== null) {
  throw new Error("URL was not updated after filter change.");
}

resetFiltersButton.onclick?.();

if (new URL(window.location.href).search) {
  throw new Error("Reset filters did not clear URL state.");
}

if (replaceStateCalls < 2) {
  throw new Error("URL state was not synchronized via history.replaceState.");
}

console.log("frontend smoke test passed");
