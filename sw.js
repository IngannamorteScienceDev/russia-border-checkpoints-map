const LEGACY_CACHE_PREFIX = "russia-border-checkpoints-app-shell-";

async function clearLegacyCaches() {
  const cacheNames = await globalThis.caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(LEGACY_CACHE_PREFIX))
      .map((cacheName) => globalThis.caches.delete(cacheName))
  );
}

globalThis.addEventListener("install", (event) => {
  event.waitUntil(globalThis.skipWaiting());
});

globalThis.addEventListener("activate", (event) => {
  event.waitUntil(
    clearLegacyCaches()
      .then(() => globalThis.clients.claim())
      .then(() => globalThis.registration.unregister())
  );
});
