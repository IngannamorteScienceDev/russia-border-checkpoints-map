import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function indexOfOrThrow(source, needle, message) {
  const index = source.indexOf(needle);
  assert(index !== -1, message);
  return index;
}

const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf-8");
const styleCss = await readFile(new URL("../style.css", import.meta.url), "utf-8");
const mapUiCss = await readFile(new URL("../map-ui.css", import.meta.url), "utf-8");
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf-8");
const swSource = await readFile(new URL("../sw.js", import.meta.url), "utf-8");

const sharedStyleIndex = indexOfOrThrow(
  indexHtml,
  'href="./style.css"',
  "Main page should load the shared stylesheet."
);
const mapUiStyleIndex = indexOfOrThrow(
  indexHtml,
  'href="./map-ui.css"',
  "Main page should load the dedicated map UI stylesheet."
);

assert(
  sharedStyleIndex < mapUiStyleIndex,
  "Dedicated map UI stylesheet should load after the shared stylesheet."
);

const panelStart = indexOfOrThrow(indexHtml, '<aside id="panel"', "Main panel should exist.");
const panelEnd = indexOfOrThrow(indexHtml, "</aside>", "Main panel should close.");
const mainStart = indexOfOrThrow(indexHtml, '<main id="mapWrap"', "Map wrapper should exist.");
const mainEnd = indexOfOrThrow(indexHtml, "</main>", "Map wrapper should close.");
const panelHtml = indexHtml.slice(panelStart, panelEnd);
const mapHtml = indexHtml.slice(mainStart, mainEnd);

assert(panelHtml.includes('id="controls"'), "Search controls should stay in the left panel.");
assert(panelHtml.includes('id="stats"'), "Stats should stay in the left panel.");
assert(
  panelHtml.includes('id="researchQueue"'),
  "Research coverage queue should stay in the left panel."
);
assert(
  panelHtml.includes('<details id="help"'),
  "Help content should stay available but collapsed by default."
);
assert(panelHtml.includes('class="results-shell"'), "Results should stay in the left panel.");
assert(!panelHtml.includes('id="layers"'), "Layer controls should not live in the left panel.");
assert(!panelHtml.includes('id="tools"'), "Tool controls should not live in the left panel.");
assert(!panelHtml.includes('id="legend"'), "Legend should not live in the left panel.");
assert(!panelHtml.includes('id="themeToggle"'), "Theme toggle should not live in the left panel.");
assert(
  !panelHtml.includes('id="checkpointPassport"'),
  "Checkpoint passport should not live in the left panel."
);

assert(mapHtml.includes('class="map-side"'), "Map tools dock should live inside the map wrapper.");
assert(mapHtml.includes('id="layers"'), "Layer controls should live in the map tools dock.");
assert(mapHtml.includes('id="tools"'), "Tool controls should live in the map tools dock.");
assert(mapHtml.includes('id="legend"'), "Legend should live in the map tools dock.");
assert(mapHtml.includes('id="themeToggle"'), "Theme toggle should live in the map tools dock.");
assert(mapHtml.includes('id="panelScrim"'), "Mobile panel scrim should live in the map wrapper.");
assert(
  mapHtml.includes('id="checkpointPassport"'),
  "Checkpoint passport should live in the map wrapper."
);
assert(
  mapHtml.indexOf('class="map-side"') < mapHtml.indexOf('id="map"'),
  "Map dock should render before the map canvas."
);

assert(
  !styleCss.includes("Focused layout repair") && !styleCss.includes(".app--research .map-side"),
  "Main map layout overrides should not remain in the shared stylesheet."
);
assert(
  mapUiCss.includes(".app--research .map-side") &&
    mapUiCss.includes(".app--research .tool-grid") &&
    mapUiCss.includes(".app--research .checkpoint-passport") &&
    mapUiCss.includes('html[data-theme="dark"]') &&
    mapUiCss.includes("@media (max-width: 900px)"),
  "Dedicated map UI stylesheet should own desktop and mobile map layout."
);
assert(
  !/(^|\n)\.btn\s*\{/.test(mapUiCss),
  "Dedicated map UI stylesheet should avoid unscoped global button rules."
);
assert(swSource.includes('"./map-ui.css"'), "Service worker should precache map-ui.css.");
assert(
  !appSource.includes('dom.panelEl.classList.add("open")'),
  "Mobile panel should not force-open over the map on startup."
);
assert(swSource.includes('"./js/theme.js"'), "Service worker should precache theme.js.");
assert(swSource.includes('"./js/passport.js"'), "Service worker should precache passport.js.");
assert(swSource.includes('"./js/enrichment.js"'), "Service worker should precache enrichment.js.");
assert(
  swSource.includes('"./js/sourceTrust.js"'),
  "Service worker should precache sourceTrust.js."
);
assert(
  swSource.includes('"./data/checkpoint_enrichment.json"'),
  "Service worker should precache checkpoint enrichment data."
);
assert(
  swSource.includes('"./data/research_coverage_report.json"'),
  "Service worker should precache research coverage data."
);

console.log("layout structure smoke test passed");
