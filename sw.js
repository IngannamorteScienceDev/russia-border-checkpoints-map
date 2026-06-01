const CACHE_NAME = "russia-border-checkpoints-app-shell-v16";

const APP_SHELL_URLS = [
  "./",
  "./index.html",
  "./versions.html",
  "./manifest.webmanifest",
  "./style.css",
  "./map-ui.css",
  "./app.js",
  "./sw.js",
  "./icons/icon.svg",
  "./icons/maskable-icon.svg",
  "./data/checkpoints.geojson",
  "./data/checkpoint_enrichment.json",
  "./data/research_coverage_report.json",
  "./data/dataset_changelog.json",
  "./data/data_quality_report.json",
  "./js/compare.js",
  "./js/config.js",
  "./js/data.js",
  "./js/datasetChanges.js",
  "./js/dom.js",
  "./js/enrichment.js",
  "./js/export.js",
  "./js/favorites.js",
  "./js/freshness.js",
  "./js/geo.js",
  "./js/mapLayers.js",
  "./js/passport.js",
  "./js/popup.js",
  "./js/qr.js",
  "./js/quality.js",
  "./js/recent.js",
  "./js/render.js",
  "./js/report.js",
  "./js/serviceWorker.js",
  "./js/share.js",
  "./js/sourceTrust.js",
  "./js/theme.js",
  "./js/urlState.js",
  "./js/versions.js",
  "./js/cesiumGlobe.js",
  "./js/vendor/cesium/Cesium.js",
  "./js/vendor/cesium/LICENSE.md",
  "./js/vendor/cesium/Widgets/widgets.css",
  "./js/vendor/cesium/Assets/approximateTerrainHeights.json",
  "./js/vendor/cesium/Assets/IAU2006_XYS/IAU2006_XYS_18.json",
  "./js/vendor/cesium/Assets/Images/ion-credit.png",
  "./js/vendor/cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg",
  "./js/vendor/cesium/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg",
  "./js/vendor/cesium/Assets/Textures/SkyBox/tycho2t3_80_py.jpg",
  "./js/vendor/cesium/Assets/Textures/SkyBox/tycho2t3_80_my.jpg",
  "./js/vendor/cesium/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg",
  "./js/vendor/cesium/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/tilemapresource.xml",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/0/0/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/0/1/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/1/0/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/1/0/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/1/1/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/1/1/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/1/2/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/1/2/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/1/3/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/1/3/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/0/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/0/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/0/2.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/0/3.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/1/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/1/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/1/2.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/1/3.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/2/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/2/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/2/2.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/2/3.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/3/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/3/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/3/2.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/3/3.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/4/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/4/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/4/2.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/4/3.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/5/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/5/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/5/2.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/5/3.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/6/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/6/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/6/2.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/6/3.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/7/0.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/7/1.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/7/2.jpg",
  "./js/vendor/cesium/Assets/Textures/NaturalEarthII/2/7/3.jpg",
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
