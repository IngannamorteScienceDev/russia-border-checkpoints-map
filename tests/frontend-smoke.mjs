import { readFile } from "node:fs/promises";
import {
  buildDatasetSummary,
  formatCoordinates,
  loadCheckpoints,
  repairText
} from "../js/checkpoints.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  repairText("Ð ÑšÐ Â°Ð¡Ð‚Ð Ñ‘Ð¡Ñ“Ð Ñ—Ð Ñ•Ð Â»Ð¡ÐŠ") === "Мариуполь",
  "Mojibake should be repaired."
);

const payload = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [131.9, 43.1] },
      properties: {
        checkpoint_id: "101",
        checkpoint_name: "Погранпереход Тест",
        checkpoint_type: "Автомобильный пункт пропуска",
        status: "Многосторонний",
        is_functional: "True",
        subject_name: "Приморский край",
        foreign_country: "Китай",
        source: "https://example.test/source"
      }
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [37.6, 55.7] },
      properties: {
        checkpoint_id: "202",
        checkpoint_name: "Аэропорт Тест",
        checkpoint_type: "Воздушный",
        is_functional: false,
        subject_name: "Москва"
      }
    }
  ]
};

let requestedUrl = "";
const features = await loadCheckpoints({
  baseUrl: "https://example.test/project/index.html",
  fetchImpl: async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        return payload;
      }
    };
  }
});

assert(
  requestedUrl === "https://example.test/project/data/checkpoints.geojson",
  "GeoJSON URL should be resolved relative to the app."
);
assert(features.length === 2, "Expected two normalized checkpoint features.");
assert(features[0].properties.__id === "101", "Checkpoint id should be normalized.");
assert(features[0].properties.__type === "Автомобильный", "Checkpoint type should be normalized.");
assert(features[0].properties.__status === "Действует", "Functional status should be normalized.");
assert(
  features[1].properties.__status === "Не функционирует",
  "Boolean status should be normalized."
);
assert(
  formatCoordinates(features[0].geometry.coordinates) === "43.10000, 131.90000",
  "Coordinates should be formatted as lat/lng."
);

const summary = buildDatasetSummary(features);
assert(summary.total === 2, "Summary should count all checkpoints.");
assert(summary.countryCount === 1, "Summary should count specified countries only.");
assert(summary.typeCounts.Автомобильный === 1, "Summary should count checkpoint types.");
assert(summary.statusCounts.Действует === 1, "Summary should count checkpoint statuses.");

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf-8");
assert(
  appSource.includes("__KPP_GLOBE_READY__"),
  "App should expose a small readiness hook for visual smoke tests."
);
assert(appSource.includes("applyFilters"), "App should include the new filter pipeline.");
assert(appSource.includes("clusterToggle"), "App should expose Cesium clustering control.");
assert(
  !appSource.includes("localStorage"),
  "Minimal globe should not keep old localStorage features."
);
assert(!appSource.includes("navigator.geolocation"), "Minimal globe should not keep geolocation.");

console.log("frontend smoke test passed");
