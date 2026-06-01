import { access, readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf-8");
const styleCss = await readFile(new URL("../style.css", import.meta.url), "utf-8");
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf-8");

assert(indexHtml.includes('id="map"'), "Main page should include the Cesium container.");
assert(
  indexHtml.includes('id="checkpointInspector"'),
  "Main page should include the checkpoint inspector."
);
assert(indexHtml.includes('id="legend"'), "Main page should include the type legend.");
assert(indexHtml.includes('id="stats"'), "Main page should include minimal stats.");
assert(
  indexHtml.includes("CESIUM_BASE_URL"),
  "Main page should configure the local Cesium base URL."
);
assert(
  indexHtml.includes('src="./js/vendor/cesium/Cesium.js"') &&
    indexHtml.includes('href="./js/vendor/cesium/Widgets/widgets.css"'),
  "Main page should load the local Cesium runtime."
);

for (const removedId of [
  "searchInput",
  "typeFilter",
  "favoritesOnly",
  "shareLink",
  "exportCsv",
  "themeToggle",
  "versions.html"
]) {
  assert(
    !indexHtml.includes(removedId),
    `Old feature should be removed from the shell: ${removedId}`
  );
}

assert(!indexHtml.includes('rel="manifest"'), "Minimal shell should not register as a PWA.");
assert(!indexHtml.includes("map-ui.css"), "Dedicated old map UI stylesheet should be removed.");
assert(styleCss.includes(".globe-shell"), "Styles should define the new globe-first shell.");
assert(styleCss.includes("@media (max-width: 760px)"), "Styles should include a mobile layout.");
assert(!styleCss.includes(".panel"), "Old side-panel styles should be removed.");
assert(appSource.includes("createGlobe"), "App should initialize Cesium directly.");
assert(
  !appSource.includes("createFallbackMap"),
  "App should not keep the old map compatibility facade."
);

await access(new URL("../js/checkpoints.js", import.meta.url));
await access(new URL("../js/cesiumGlobe.js", import.meta.url));
await access(new URL("../data/checkpoints.geojson", import.meta.url));

console.log("layout structure smoke test passed");
