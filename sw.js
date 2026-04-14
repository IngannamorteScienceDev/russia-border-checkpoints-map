const CACHE_NAME = "russia-border-checkpoints-app-shell-v1";

const APP_SHELL_URLS = [
  "./",
  "./index.html",
  "./versions.html",
  "./manifest.webmanifest",
  "./style.css",
  "./app.js",
  "./sw.js",
  "./icons/icon.svg",
  "./icons/maskable-icon.svg",
  "./data/checkpoints.geojson",
  "./data/dataset_changelog.json",
  "./js/compare.js",
  "./js/config.js",
  "./js/data.js",
  "./js/datasetChanges.js",
  "./js/dom.js",
  "./js/export.js",
  "./js/favorites.js",
  "./js/freshness.js",
  "./js/geo.js",
  "./js/mapLayers.js",
  "./js/popup.js",
  "./js/qr.js",
  "./js/quality.js",
  "./js/recent.js",
  "./js/render.js",
  "./js/report.js",
  "./js/serviceWorker.js",
  "./js/share.js",
  "./js/urlState.js",
  "./js/versions.js",
  "./js/vendor/qrcode.mjs"
];

function resolveScopeUrl(path) {
  return new URL(path, globalThis.registration.scope).toString();
}

function isSameOriginRequest(request) {
  return new URL(request.url).origin === globalThis.location.origin;
}

function canCache(response) {
  return response?.ok && response.type !== "opaque";
}

async function cacheResponse(request, response) {
  if (!canCache(response)) return;

  const cache = await globalThis.caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function staleWhileRevalidate(request) {
  const cached = await globalThis.caches.match(request);
  const network = fetch(request)
    .then((response) => {
      cacheResponse(request, response).catch(() => {});
      return response;
    })
    .catch(() => cached);

  return cached || network;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  } catch (_error) {
    return (
      (await globalThis.caches.match(request)) ||
      (await globalThis.caches.match(resolveScopeUrl("./index.html"))) ||
      Response.error()
    );
  }
}

globalThis.addEventListener("install", (event) => {
  event.waitUntil(
    globalThis.caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS.map(resolveScopeUrl)))
      .then(() => globalThis.skipWaiting())
  );
});

globalThis.addEventListener("activate", (event) => {
  event.waitUntil(
    globalThis.caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => globalThis.caches.delete(cacheName))
        )
      )
      .then(() => globalThis.clients.claim())
  );
});

globalThis.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || !isSameOriginRequest(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
