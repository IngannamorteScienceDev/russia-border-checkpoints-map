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

const text = (...codePoints) => String.fromCodePoint(...codePoints);
const mariupolMojibake = text(
  0xd0,
  0xa0,
  0xd1,
  0x161,
  0xd0,
  0xa0,
  0xc2,
  0xb0,
  0xd0,
  0xa1,
  0xd0,
  0x201a,
  0xd0,
  0xa0,
  0xd1,
  0x2018,
  0xd0,
  0xa1,
  0xd1,
  0x201c,
  0xd0,
  0xa0,
  0xd1,
  0x2014,
  0xd0,
  0xa0,
  0xd1,
  0x2022,
  0xd0,
  0xa0,
  0xc2,
  0xbb,
  0xd0,
  0xa1,
  0xd0,
  0x160
);
const mariupol = text(0x41c, 0x430, 0x440, 0x438, 0x443, 0x43f, 0x43e, 0x43b, 0x44c);

assert(repairText(mariupolMojibake) === mariupol, "Mojibake should be repaired.");

const payload = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [131.91234, 43.11234] },
      properties: {
        checkpoint_id: "101",
        checkpoint_name: text(
          0x41f,
          0x43e,
          0x433,
          0x440,
          0x430,
          0x43d,
          0x43f,
          0x435,
          0x440,
          0x435,
          0x445,
          0x43e,
          0x434
        ),
        checkpoint_type: text(0x410, 0x432, 0x442, 0x43e),
        is_functional: "True",
        subject_name: text(0x41f, 0x440, 0x438, 0x43c, 0x43e, 0x440, 0x44c, 0x435),
        foreign_country: text(0x41a, 0x438, 0x442, 0x430, 0x439),
        confidence_level: "high",
        source: "https://example.test/source"
      }
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [37.6, 55.7] },
      properties: {
        checkpoint_id: "202",
        checkpoint_name: "Airport Test",
        checkpoint_type: text(0x412, 0x43e, 0x437, 0x434, 0x443, 0x448, 0x43d, 0x44b, 0x439),
        is_functional: false,
        confidence_level: "low",
        subject_name: text(0x41c, 0x43e, 0x441, 0x43a, 0x432, 0x430)
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
assert(
  features[0].properties.__type ===
    text(0x410, 0x432, 0x442, 0x43e, 0x43c, 0x43e, 0x431, 0x438, 0x43b, 0x44c, 0x43d, 0x44b, 0x439),
  "Checkpoint type should be normalized."
);
assert(
  features[0].properties.__quality.id === "high",
  "High quality coordinates should be detected."
);
assert(
  features[1].properties.__quality.id === "low",
  "Low quality coordinates should be detected."
);
assert(
  formatCoordinates(features[0].geometry.coordinates) === "43.11234, 131.91234",
  "Coordinates should be formatted as lat/lng."
);

const summary = buildDatasetSummary(features);
assert(summary.total === 2, "Summary should count all checkpoints.");
assert(summary.countryCount === 1, "Summary should count specified countries only.");
assert(summary.qualityCounts.high === 1, "Summary should count quality levels.");

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf-8");
assert(appSource.includes("__KPP_GLOBE_READY__"), "App should expose a readiness hook.");
assert(appSource.includes("exportFilteredCsv"), "App should include CSV export.");
assert(appSource.includes("copyShareLink"), "App should include share URL generation.");
assert(appSource.includes("analysisFor"), "App should include checkpoint analysis.");
assert(
  appSource.includes("queueVisibilityAnalysis"),
  "App should queue selected-checkpoint viewshed analysis."
);
assert(appSource.includes("updateAnalyticLayers"), "App should update global GIS overlays.");
assert(appSource.includes("updateTerrainMode"), "App should wire terrain mode changes.");
assert(appSource.includes("updateTilesMode"), "App should wire 3D Tiles mode changes.");
assert(!appSource.includes("localStorage"), "App should not keep old localStorage features.");
assert(!appSource.includes("navigator.geolocation"), "App should not keep geolocation.");

console.log("frontend smoke test passed");
