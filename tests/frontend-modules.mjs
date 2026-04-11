function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createSelect(value = "all", options = []) {
  return {
    value,
    __options: ["all", ...options]
  };
}

function createListElement() {
  return {
    innerHTML: "",
    querySelectorAll() {
      return [];
    }
  };
}

function createEmptyElement() {
  return {
    innerHTML: "",
    style: {}
  };
}

let replacedUrl = "";

globalThis.window = {
  location: {
    href: "https://example.test/map?q=test&type=Автомобильный&status=Действует&country=Китай&subject=Приморский%20край&sort=distance&lng=200&lat=95&zoom=30&sat=yes"
  },
  history: {
    replaceState(_state, _title, nextUrl) {
      replacedUrl = String(nextUrl);
      window.location.href = replacedUrl;
    }
  }
};

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {}
});

const {
  applyFilterStateFromUrl,
  getMapViewStateFromUrl,
  getSatelliteModeFromUrl,
  syncFilterStateToUrl,
  syncMapViewToUrl,
  syncSatelliteModeToUrl
} = await import(new URL("../js/urlState.js", import.meta.url));
const { loadFavoriteIds, saveFavoriteIds, toggleFavoriteId } = await import(
  new URL("../js/favorites.js", import.meta.url)
);
const { renderList } = await import(new URL("../js/render.js", import.meta.url));

const dom = {
  searchEl: { value: "" },
  typeEl: createSelect("all", ["Автомобильный", "Воздушный"]),
  statusEl: createSelect("all", ["Действует", "Временно закрыт"]),
  countryEl: createSelect("all", ["Китай"]),
  subjectEl: createSelect("all", ["Приморский край"]),
  sortEl: createSelect("country", ["country", "name", "distance"])
};

applyFilterStateFromUrl(dom);

assert(dom.searchEl.value === "test", "URL query was not applied.");
assert(dom.typeEl.value === "Автомобильный", "URL type filter was not applied.");
assert(dom.statusEl.value === "Действует", "URL status filter was not applied.");
assert(dom.sortEl.value === "distance", "URL sort mode was not applied.");

const mapView = getMapViewStateFromUrl({ center: [90, 61], zoom: 4 });
assert(
  mapView.center[0] === 180 && mapView.center[1] === 90 && mapView.zoom === 22,
  "Map URL state was not clamped."
);
assert(getSatelliteModeFromUrl() === true, "Satellite URL state was not parsed.");

dom.typeEl.value = "all";
dom.sortEl.value = "name";
syncFilterStateToUrl(dom);

const filterUrl = new URL(replacedUrl);
assert(
  filterUrl.searchParams.get("type") === null,
  "Default type filter should be removed from URL."
);
assert(
  filterUrl.searchParams.get("sort") === "name",
  "Non-default sort should be synchronized to URL."
);

syncMapViewToUrl({ center: [37.6176, 55.7558], zoom: 6.5 });
const viewUrl = new URL(replacedUrl);
assert(viewUrl.searchParams.get("lng") === "37.61760", "Map longitude was not serialized.");
assert(viewUrl.searchParams.get("lat") === "55.75580", "Map latitude was not serialized.");
assert(viewUrl.searchParams.get("zoom") === "6.50", "Map zoom was not serialized.");

syncSatelliteModeToUrl(false);
assert(
  new URL(replacedUrl).searchParams.get("sat") === null,
  "Satellite mode should be removed when disabled."
);

const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.get(key) ?? null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  }
};

let favorites = toggleFavoriteId(loadFavoriteIds(localStorage), "101");
favorites = toggleFavoriteId(favorites, "100");
saveFavoriteIds(favorites, localStorage);
assert(loadFavoriteIds(localStorage).has("100"), "Favorite IDs were not persisted.");
assert(
  toggleFavoriteId(loadFavoriteIds(localStorage), "100").has("100") === false,
  "Favorite ID was not toggled off."
);

const features = [
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [10, 10] },
    properties: {
      __id: "beta",
      __name: "Beta",
      __type: "Автомобильный",
      __status: "Действует",
      __country: "Китай",
      __subject: "Регион Б",
      __coords: "10.00000, 10.00000",
      __extra: { updatedAt: "2026-01-01T00:00:00Z" }
    }
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [1, 1] },
    properties: {
      __id: "alpha",
      __name: "Alpha",
      __type: "Воздушный",
      __status: "Временно закрыт",
      __country: "Китай",
      __subject: "Регион А",
      __coords: "1.00000, 1.00000",
      __extra: { updatedAt: "2026-01-01T00:00:00Z" }
    }
  }
];

const listEl = createListElement();
const emptyEl = createEmptyElement();

renderList({
  listEl,
  emptyEl,
  viewFeatures: features,
  userLocation: null,
  favoriteIds: new Set(["alpha"]),
  compareIds: ["beta"],
  sortMode: "name",
  onItemClick() {}
});

assert(
  listEl.innerHTML.indexOf("Alpha") < listEl.innerHTML.indexOf("Beta"),
  "Name sorting did not order checkpoints alphabetically."
);
assert(
  listEl.innerHTML.includes("item__favorite is-favorite"),
  "Favorite rendering was not applied."
);
assert(listEl.innerHTML.includes("item__compare is-active"), "Compare rendering was not applied.");

renderList({
  listEl,
  emptyEl,
  viewFeatures: features,
  userLocation: [0, 0],
  favoriteIds: new Set(),
  compareIds: [],
  sortMode: "distance",
  onItemClick() {}
});

assert(
  listEl.innerHTML.indexOf("Alpha") < listEl.innerHTML.indexOf("Beta"),
  "Distance sorting did not place the closest checkpoint first."
);

console.log("frontend module tests passed");
