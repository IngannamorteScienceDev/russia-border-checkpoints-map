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
  "cameraDock",
  "dataPanel",
  "exportCsv",
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

for (const removedId of ["favoritesOnly", "themeToggle", "versions.html"]) {
  assert(!indexHtml.includes(removedId), `Old feature should be removed: ${removedId}`);
}

assert(!indexHtml.includes('rel="manifest"'), "Minimal shell should not register as a PWA.");
assert(!indexHtml.includes("map-ui.css"), "Old map UI stylesheet should be removed.");
assert(styleCss.includes(".data-panel"), "Styles should define the checkpoint register.");
assert(styleCss.includes(".control-panel__toggles"), "Styles should define tool toggles.");
assert(styleCss.includes("@media (max-width: 760px)"), "Styles should include mobile layout.");
assert(!styleCss.includes(".panel"), "Old side-panel styles should be removed.");
assert(appSource.includes("setImageryMode"), "App should wire imagery switching.");
assert(appSource.includes("qualityToggle"), "App should wire coordinate quality mode.");
assert(appSource.includes("radiusSelect"), "App should wire radius analysis.");
assert(globeSource.includes("World_Imagery"), "Cesium layer should use HD satellite imagery.");
assert(globeSource.includes("OpenStreetMap"), "Cesium layer should offer an OSM mode.");
assert(globeSource.includes("setAnalysis"), "Cesium layer should expose analysis overlays.");
assert(globeSource.includes("setColorMode"), "Cesium layer should expose quality coloring.");

await access(new URL("../js/checkpoints.js", import.meta.url));
await access(new URL("../js/cesiumGlobe.js", import.meta.url));
await access(new URL("../data/checkpoints.geojson", import.meta.url));

console.log("layout structure smoke test passed");
