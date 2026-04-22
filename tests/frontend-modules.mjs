import { readFile } from "node:fs/promises";
import { filterFeatures } from "../js/data.js";

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
    href: "https://example.test/map?q=test&type=Автомобильный&status=Действует&country=Китай&subject=Приморский%20край&district=east&legal=multi&profile=cargo&corridor=mtk&research=described&sort=distance&lng=200&lat=95&zoom=30&sat=yes"
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
  getReferenceLayerStateFromUrl,
  syncFilterStateToUrl,
  syncMapViewToUrl,
  syncSatelliteModeToUrl,
  syncReferenceLayerStateToUrl
} = await import(new URL("../js/urlState.js", import.meta.url));
const { loadFavoriteIds, saveFavoriteIds, toggleFavoriteId } = await import(
  new URL("../js/favorites.js", import.meta.url)
);
const { registerAppShellServiceWorker } = await import(
  new URL("../js/serviceWorker.js", import.meta.url)
);
const { renderList } = await import(new URL("../js/render.js", import.meta.url));
const { applyFeatureEnrichmentToFeatures, buildCheckpointEnrichmentIndex, getFeatureEnrichment } =
  await import(new URL("../js/enrichment.js", import.meta.url));

const manifest = JSON.parse(
  await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf-8")
);
const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf-8");
const versionsHtml = await readFile(new URL("../versions.html", import.meta.url), "utf-8");
const checkpointEnrichmentPayload = JSON.parse(
  await readFile(new URL("../data/checkpoint_enrichment.json", import.meta.url), "utf-8")
);

assert(manifest.display === "standalone", "PWA manifest should use standalone display.");
assert(manifest.start_url === "./", "PWA manifest should start at the app root.");
assert(manifest.scope === "./", "PWA manifest scope should stay relative for GitHub Pages.");
assert(
  manifest.icons?.some((icon) => icon.purpose === "maskable"),
  "PWA manifest should include a maskable icon."
);
assert(
  indexHtml.includes('rel="manifest"') && versionsHtml.includes('rel="manifest"'),
  "HTML pages should link to the PWA manifest."
);
assert(
  checkpointEnrichmentPayload.importSummary?.matchedDescriptions === 132,
  "Checkpoint descriptions should be imported from the deep research report."
);
assert(
  checkpointEnrichmentPayload.importSummary?.source === "deep-research-report.md",
  "Checkpoint enrichment metadata should not expose a local filesystem path."
);
assert(
  checkpointEnrichmentPayload.records.filter((record) => record.kind === "description").length ===
    132,
  "Checkpoint enrichment should include one description record per matched checkpoint."
);
assert(
  !JSON.stringify(checkpointEnrichmentPayload).match(/[\ue200-\ue2ff]/u),
  "Imported checkpoint descriptions should not contain research citation markup."
);

let registeredWorkerUrl = "";
let registeredWorkerOptions = null;
const serviceWorkerRegistration = await registerAppShellServiceWorker({
  location: { href: "https://example.test/project/index.html?x=1" },
  serviceWorker: {
    register(workerUrl, options) {
      registeredWorkerUrl = String(workerUrl);
      registeredWorkerOptions = options;
      return Promise.resolve({ scope: options.scope });
    }
  }
});

assert(serviceWorkerRegistration?.scope === "/project/", "Service worker registration failed.");
assert(
  registeredWorkerUrl === "https://example.test/project/sw.js",
  "Service worker URL should be resolved from the current app directory."
);
assert(
  registeredWorkerOptions?.scope === "/project/",
  "Service worker scope should stay inside the current app directory."
);
assert(
  (await registerAppShellServiceWorker({
    location: { href: "file:///project/index.html" },
    serviceWorker: {
      register() {
        throw new Error("Service worker should not register on file protocol.");
      }
    }
  })) === null,
  "Service worker registration should be skipped outside http(s)."
);

const dom = {
  searchEl: { value: "" },
  typeEl: createSelect("all", ["Автомобильный", "Воздушный"]),
  statusEl: createSelect("all", ["Действует", "Временно закрыт"]),
  countryEl: createSelect("all", ["Китай"]),
  subjectEl: createSelect("all", ["Приморский край"]),
  districtEl: createSelect("all", ["east"]),
  legalStatusEl: createSelect("all", ["multi"]),
  patternEl: createSelect("all", ["cargo"]),
  corridorEl: createSelect("all", ["mtk"]),
  researchEl: createSelect("all", [
    "described",
    "missing-description",
    "events",
    "missing-events",
    "missing-working-time",
    "quality-issues"
  ]),
  sortEl: createSelect("country", ["country", "name", "distance"])
};

applyFilterStateFromUrl(dom);

assert(dom.searchEl.value === "test", "URL query was not applied.");
assert(dom.typeEl.value === "Автомобильный", "URL type filter was not applied.");
assert(dom.statusEl.value === "Действует", "URL status filter was not applied.");
assert(dom.districtEl.value === "east", "URL district filter was not applied.");
assert(dom.legalStatusEl.value === "multi", "URL legal-status filter was not applied.");
assert(dom.patternEl.value === "cargo", "URL checkpoint profile filter was not applied.");
assert(dom.corridorEl.value === "mtk", "URL corridor filter was not applied.");
assert(dom.researchEl.value === "described", "URL research coverage filter was not applied.");
assert(dom.sortEl.value === "distance", "URL sort mode was not applied.");

const mapView = getMapViewStateFromUrl({ center: [90, 61], zoom: 4 });
assert(
  mapView.center[0] === 180 && mapView.center[1] === 90 && mapView.zoom === 22,
  "Map URL state was not clamped."
);
assert(getSatelliteModeFromUrl() === true, "Satellite URL state was not parsed.");
assert(
  getReferenceLayerStateFromUrl({ boundaries: true, roads: true }).boundaries === true,
  "Default reference layer URL state was not parsed."
);

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
assert(
  filterUrl.searchParams.get("district") === "east" &&
    filterUrl.searchParams.get("legal") === "multi" &&
    filterUrl.searchParams.get("profile") === "cargo" &&
    filterUrl.searchParams.get("corridor") === "mtk" &&
    filterUrl.searchParams.get("research") === "described",
  "Advanced filters should be synchronized to URL."
);

syncMapViewToUrl({ center: [37.6176, 55.7558], zoom: 6.5 });
const viewUrl = new URL(replacedUrl);
assert(viewUrl.searchParams.get("lng") === "37.61760", "Map longitude was not serialized.");
assert(viewUrl.searchParams.get("lat") === "55.75580", "Map latitude was not serialized.");
assert(viewUrl.searchParams.get("zoom") === "6.50", "Map zoom was not serialized.");

syncSatelliteModeToUrl(false);
assert(
  new URL(replacedUrl).searchParams.get("sat") === "0",
  "Satellite mode should be stored as disabled."
);

syncReferenceLayerStateToUrl({ boundaries: false, roads: true });
const referenceUrl = new URL(replacedUrl);
assert(
  referenceUrl.searchParams.get("borders") === "0" &&
    referenceUrl.searchParams.get("roads") === "1",
  "Reference layer state was not synchronized to URL."
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

const indexedFeatures = [
  {
    properties: {
      __search: "100 beta приморский край тестовый адрес круглосуточно дальневосточный филиал",
      __enrichmentSearch: "исследовательское описание электронная очередь",
      __status: "Действует",
      __coords: "10.00000, 10.00000",
      __hasDescription: true,
      __enrichmentEventCount: 1,
      __extra: {
        source: "https://example.test/source",
        updatedAt: "2026-01-01T00:00:00Z",
        workingTime: "круглосуточно",
        federalDistrict: "east",
        legalStatus: "multi",
        checkpointPattern: "cargo",
        transportCorridor: "mtk"
      }
    }
  },
  {
    properties: {
      __search: "101 alpha кемеровская область",
      __status: "Действует",
      __coords: "1.00000, 1.00000",
      __hasDescription: false,
      __enrichmentEventCount: 0,
      __extra: {
        federalDistrict: "west",
        legalStatus: "bilateral",
        checkpointPattern: "passenger",
        transportCorridor: "north"
      }
    }
  }
];

assert(
  filterFeatures(indexedFeatures, {
    query: "101",
    type: "all",
    status: "all",
    country: "all",
    subject: "all"
  }).length === 1,
  "Checkpoint ID search should match the indexed ID."
);

assert(
  filterFeatures(indexedFeatures, {
    query: "круглосуточно",
    type: "all",
    status: "all",
    country: "all",
    subject: "all"
  }).length === 1,
  "Search should match newly indexed hidden checkpoint attributes."
);

assert(
  filterFeatures(indexedFeatures, {
    query: "филиал",
    type: "all",
    status: "all",
    country: "all",
    subject: "all"
  }).length === 1,
  "Search should match indexed branch metadata."
);

assert(
  filterFeatures(indexedFeatures, {
    query: "электронная очередь",
    type: "all",
    status: "all",
    country: "all",
    subject: "all"
  }).length === 1,
  "Search should match indexed enrichment descriptions."
);

assert(
  filterFeatures(indexedFeatures, {
    query: "",
    type: "all",
    status: "all",
    country: "all",
    subject: "all",
    district: "east",
    legalStatus: "multi",
    pattern: "cargo",
    corridor: "mtk"
  }).length === 1,
  "Advanced checkpoint filters should match indexed metadata."
);

assert(
  filterFeatures(indexedFeatures, {
    query: "",
    type: "all",
    status: "all",
    country: "all",
    subject: "all",
    district: "east",
    legalStatus: "bilateral",
    pattern: "cargo",
    corridor: "mtk"
  }).length === 0,
  "Advanced checkpoint filters should combine with AND semantics."
);

assert(
  filterFeatures(indexedFeatures, {
    query: "",
    type: "all",
    status: "all",
    country: "all",
    subject: "all",
    research: "described"
  }).length === 1,
  "Research filter should keep checkpoints with descriptions."
);

assert(
  filterFeatures(indexedFeatures, {
    query: "",
    type: "all",
    status: "all",
    country: "all",
    subject: "all",
    research: "missing-description"
  }).length === 1,
  "Research filter should keep checkpoints missing descriptions."
);

assert(
  filterFeatures(indexedFeatures, {
    query: "",
    type: "all",
    status: "all",
    country: "all",
    subject: "all",
    research: "events"
  }).length === 1,
  "Research filter should keep checkpoints with event enrichment."
);

assert(
  filterFeatures(indexedFeatures, {
    query: "",
    type: "all",
    status: "all",
    country: "all",
    subject: "all",
    research: "missing-events"
  }).length === 1,
  "Research filter should keep checkpoints missing event enrichment."
);

assert(
  filterFeatures(indexedFeatures, {
    query: "",
    type: "all",
    status: "all",
    country: "all",
    subject: "all",
    research: "missing-working-time"
  }).length === 1,
  "Research filter should keep checkpoints missing working time."
);

assert(
  filterFeatures(indexedFeatures, {
    query: "",
    type: "all",
    status: "all",
    country: "all",
    subject: "all",
    research: "quality-issues"
  }).length === 1,
  "Research filter should keep checkpoints with quality issues."
);

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

const enrichmentIndex = buildCheckpointEnrichmentIndex({
  schemaVersion: 1,
  records: [
    {
      checkpointId: "alpha",
      kind: "official_verification",
      title: "Verified alpha",
      summary: "Alpha was matched to an official source.",
      confidence: "high",
      tags: ["official"]
    },
    {
      checkpointId: "alpha",
      kind: "description",
      title: "Alpha description",
      summary: "Research description for alpha.",
      confidence: "medium",
      tags: ["description"]
    },
    {
      checkpointId: "alpha",
      kind: "unexpected_kind",
      title: "Normalized event",
      confidence: "unexpected"
    },
    {
      checkpointId: "",
      title: "Skipped"
    }
  ]
});
const alphaEnrichment = getFeatureEnrichment(enrichmentIndex, features[1]);
const enrichedFeatures = applyFeatureEnrichmentToFeatures(features, enrichmentIndex);
const enrichedAlpha = enrichedFeatures.find((feature) => feature.properties.__id === "alpha");

assert(alphaEnrichment.records.length === 3, "Enrichment records were not grouped by checkpoint.");
assert(
  alphaEnrichment.descriptionRecords.length === 1 &&
    alphaEnrichment.descriptionRecords[0].summary === "Research description for alpha.",
  "Description enrichment records were not exposed separately."
);
assert(
  enrichedAlpha?.properties.__descriptionPreview === "Research description for alpha." &&
    enrichedAlpha?.properties.__enrichmentSearch.includes("research description for alpha"),
  "Description enrichment was not attached to feature search metadata."
);
assert(
  alphaEnrichment.verificationRecords.length === 1 && alphaEnrichment.eventRecords.length === 1,
  "Enrichment records were not split into verification and event groups."
);
assert(
  alphaEnrichment.eventRecords[0].kind === "data_note" &&
    alphaEnrichment.eventRecords[0].confidence === "medium",
  "Unknown enrichment values should fall back to safe defaults."
);

console.log("frontend module tests passed");
