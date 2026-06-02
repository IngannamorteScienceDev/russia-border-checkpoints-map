import { access, readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf-8");
const styleCss = await readFile(new URL("../style.css", import.meta.url), "utf-8");
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf-8");
const globeSource = await readFile(new URL("../js/cesiumGlobe.js", import.meta.url), "utf-8");

for (const id of [
  "map",
  "checkpointInspector",
  "legend",
  "stats",
  "checkpointSearch",
  "typeFilter",
  "statusFilter",
  "imageryMode",
  "radiusSelect",
  "clusterToggle",
  "qualityToggle",
  "terrainToggle",
  "viewshedToggle",
  "analysisStatus",
  "cameraDock",
  "fitFiltered",
  "resetFilters",
  "copyShare"
]) {
  assert(indexHtml.includes(`id="${id}"`), `Main page should include #${id}.`);
}

assert(indexHtml.includes("&#1050;&#1055;&#1055;"), "Static Russian UI should use safe entities.");
assert(indexHtml.includes("CESIUM_BASE_URL"), "Main page should configure local Cesium.");
assert(
  indexHtml.includes('src="./js/vendor/cesium/Cesium.js"') &&
    indexHtml.includes('href="./js/vendor/cesium/Widgets/widgets.css"'),
  "Main page should load the local Cesium runtime."
);

for (const removedId of [
  "favoritesOnly",
  "themeToggle",
  "versions.html",
  "corridorsToggle",
  "flowsToggle",
  "heatmapToggle",
  "tilesToggle",
  "tilesetUrl",
  "dataPanel",
  "exportCsv",
  "tableToggle"
]) {
  assert(!indexHtml.includes(removedId), `Old feature should be removed: ${removedId}`);
}

assert(!indexHtml.includes('rel="manifest"'), "Minimal shell should not register as a PWA.");
assert(!indexHtml.includes("map-ui.css"), "Old map UI stylesheet should be removed.");
assert(styleCss.includes(".ambient-backdrop"), "Styles should define the modern backdrop.");
assert(styleCss.includes(".control-panel__toggles"), "Styles should define tool toggles.");
assert(styleCss.includes(".analysis-status"), "Styles should define GIS analysis status chips.");
assert(
  styleCss.includes(".globe-shell--inspecting .control-panel"),
  "Styles should prevent the inspector and controls from overlapping."
);
assert(styleCss.includes("@media (max-width: 760px)"), "Styles should include mobile layout.");
assert(!styleCss.includes(".panel"), "Old side-panel styles should be removed.");
assert(!styleCss.includes(".data-panel"), "Checkpoint register styles should be removed.");
assert(!styleCss.includes(".checkpoint-table"), "Checkpoint table styles should be removed.");
assert(!styleCss.includes(".checkpoint-row"), "Checkpoint row styles should be removed.");
assert(appSource.includes("setImageryMode"), "App should wire imagery switching.");
assert(appSource.includes("qualityToggle"), "App should wire coordinate quality mode.");
assert(appSource.includes("radiusSelect"), "App should wire radius analysis.");
assert(appSource.includes("analyzeVisibility"), "App should wire viewshed analysis.");
assert(appSource.includes("updateTerrainMode"), "App should wire terrain mode changes.");
assert(!appSource.includes("setInfrastructureTiles"), "App should not keep decorative 3D Tiles.");
assert(!appSource.includes("exportFilteredCsv"), "App should not keep CSV export.");
assert(!appSource.includes("updateAnalyticLayers"), "App should not keep decorative overlays.");
assert(!appSource.includes("updateTilesMode"), "App should not keep 3D Tiles controls.");
assert(globeSource.includes("World_Imagery"), "Cesium layer should use HD satellite imagery.");
assert(globeSource.includes("OpenStreetMap"), "Cesium layer should offer an OSM mode.");
assert(
  globeSource.includes("createWorldTerrainAsync"),
  "Cesium layer should request real terrain."
);
assert(
  globeSource.includes("sampleTerrainMostDetailed"),
  "Cesium layer should sample terrain heights."
);
assert(globeSource.includes("setAnalysis"), "Cesium layer should expose analysis overlays.");
assert(globeSource.includes("setColorMode"), "Cesium layer should expose quality coloring.");
for (const removedCesiumFeature of [
  "Cesium3DTileset.fromUrl",
  "PolylineArrowMaterialProperty",
  "HEATMAP_SOURCE_ID",
  "FLOW_SOURCE_ID",
  "CORRIDOR_SOURCE_ID",
  "INFRASTRUCTURE_SOURCE_ID"
]) {
  assert(
    !globeSource.includes(removedCesiumFeature),
    `Decorative Cesium feature should be removed: ${removedCesiumFeature}`
  );
}

await access(new URL("../js/checkpoints.js", import.meta.url));
await access(new URL("../js/cesiumGlobe.js", import.meta.url));
await access(new URL("../data/checkpoints.geojson", import.meta.url));

console.log("layout structure smoke test passed");
