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

globalThis.document = {
  getElementById(id) {
    if (!elements.has(id)) {
      const element = createElement();
      if (id === "searchInput") element.value = "";
      elements.set(id, element);
    }

    return elements.get(id);
  }
};

globalThis.window = {
  location: { href: "http://localhost:8000/" },
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

await import(new URL("../app.js", import.meta.url));
await new Promise(resolve => setTimeout(resolve, 0));

const statsHtml = elements.get("stats")?.innerHTML || "";
const listHtml = elements.get("list")?.innerHTML || "";
const countryFilterHtml = elements.get("countryFilter")?.innerHTML || "";
const subjectFilterHtml = elements.get("subjectFilter")?.innerHTML || "";
const typeFilterHtml = elements.get("typeFilter")?.innerHTML || "";

if (!statsHtml.includes("Всего КПП") || !statsHtml.includes("Обновлено")) {
  throw new Error("Stats block was not rendered.");
}

if (!listHtml.includes("Тестовый КПП") || !listHtml.includes("Китай")) {
  throw new Error("Checkpoint list was not rendered.");
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

console.log("frontend smoke test passed");
