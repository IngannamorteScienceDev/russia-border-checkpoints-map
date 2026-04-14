function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createElement(id = "") {
  return {
    id,
    innerHTML: "",
    textContent: "",
    value: id === "searchInput" ? "" : "all",
    disabled: false,
    hidden: id === "mapFallback",
    style: {},
    onclick: null,
    onchange: null,
    oninput: null,
    parentNode: { removeChild() {} },
    classList: { add() {}, toggle() {} },
    setAttribute() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
}

const elements = new Map();
const storage = new Map();

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
  title: "КПП РФ",
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElement(id));
    return elements.get(id);
  },
  createElement(tagName) {
    const element = createElement(tagName);
    element.click = () => {};
    return element;
  }
};

globalThis.window = {
  location: { href: "https://example.test/russia-border-checkpoints-map/" },
  history: {
    replaceState(_state, _title, nextUrl) {
      window.location.href = String(nextUrl);
    }
  },
  addEventListener() {},
  matchMedia() {
    return { matches: false };
  }
};

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    onLine: true,
    clipboard: {
      async writeText() {}
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
          geometry: { type: "Point", coordinates: [131.9, 43.1] },
          properties: {
            checkpoint_id: "100",
            checkpoint_name: "Тестовый КПП",
            checkpoint_type: "Автомобильный пункт пропуска",
            status: "Многосторонний",
            subject_name: "Приморский край",
            foreign_country: "Китай",
            source: "https://example.test/source",
            confidence_level: "high",
            last_updated: "2026-01-19T09:56:39.000000Z"
          }
        }
      ]
    };
  }
});

delete globalThis.maplibregl;
await import(new URL("../app.js", import.meta.url));
await new Promise((resolve) => setTimeout(resolve, 10));

assert(elements.get("mapFallback")?.hidden === false, "Map fallback notice was not shown.");
assert(
  elements.get("styleToggle")?.disabled === true,
  "Satellite toggle should be disabled without MapLibre."
);
assert(
  elements.get("styleToggle")?.textContent.includes("Карта"),
  "Satellite toggle should explain that the map is unavailable."
);
assert(
  elements.get("list")?.innerHTML.includes("Тестовый КПП"),
  "Checkpoint list should render even when MapLibre is unavailable."
);
assert(elements.get("stats")?.innerHTML.includes("1"), "Stats should render without MapLibre.");

console.log("map fallback smoke test passed");
