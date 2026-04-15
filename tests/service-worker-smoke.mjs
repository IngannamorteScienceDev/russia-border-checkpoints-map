import { access, readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const swSource = await readFile(new URL("../sw.js", import.meta.url), "utf-8");
const appShellMatch = swSource.match(/const APP_SHELL_URLS = \[([\s\S]*?)\];/);

assert(appShellMatch, "Service worker should declare APP_SHELL_URLS.");

const appShellUrls = [...appShellMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);

assert(appShellUrls.includes("./"), "App shell should include the app root.");
assert(appShellUrls.includes("./index.html"), "App shell should include index.html.");
assert(appShellUrls.includes("./versions.html"), "App shell should include versions.html.");
assert(appShellUrls.includes("./manifest.webmanifest"), "App shell should include PWA manifest.");
assert(
  appShellUrls.includes("./data/checkpoints.geojson"),
  "App shell should include GeoJSON data."
);
assert(
  appShellUrls.includes("./data/checkpoint_enrichment.json"),
  "App shell should include checkpoint enrichment data."
);
assert(
  appShellUrls.includes("./data/dataset_changelog.json"),
  "App shell should include dataset changelog."
);
assert(
  appShellUrls.includes("./icons/maskable-icon.svg"),
  "App shell should include the maskable PWA icon."
);

for (const appShellUrl of appShellUrls) {
  assert(!/^https?:\/\//.test(appShellUrl), `App shell URL should be local: ${appShellUrl}`);
  if (appShellUrl === "./") continue;

  await access(new URL(`..${appShellUrl.slice(1)}`, import.meta.url));
}

assert(swSource.includes('addEventListener("install"'), "Service worker should handle install.");
assert(swSource.includes("cache.addAll"), "Service worker should precache the app shell.");
assert(
  swSource.includes('request.mode === "navigate"'),
  "Service worker should handle navigation."
);
assert(
  swSource.includes('addEventListener("fetch"'),
  "Service worker should handle same-origin fetches."
);

console.log("service worker smoke test passed");
