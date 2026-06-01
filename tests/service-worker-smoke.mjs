import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const swSource = await readFile(new URL("../sw.js", import.meta.url), "utf-8");

assert(
  swSource.includes("LEGACY_CACHE_PREFIX"),
  "Service worker should only exist to clean previous app-shell caches."
);
assert(swSource.includes("caches.keys"), "Service worker should enumerate legacy caches.");
assert(swSource.includes("registration.unregister"), "Service worker should unregister itself.");
assert(!swSource.includes("APP_SHELL_URLS"), "Minimal app should not precache an app shell.");
assert(!swSource.includes('addEventListener("fetch"'), "Minimal app should not intercept fetches.");

console.log("service worker smoke test passed");
