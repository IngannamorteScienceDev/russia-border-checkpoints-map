const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

export function registerAppShellServiceWorker(options = {}) {
  const serviceWorker = options.serviceWorker ?? globalThis.navigator?.serviceWorker;
  const currentLocation = options.location ?? globalThis.location ?? globalThis.window?.location;

  if (!serviceWorker || !currentLocation?.href) {
    return Promise.resolve(null);
  }

  const pageUrl = new URL(currentLocation.href);
  if (!SUPPORTED_PROTOCOLS.has(pageUrl.protocol)) {
    return Promise.resolve(null);
  }

  const workerUrl = new URL("./sw.js", pageUrl);
  const scope = new URL("./", pageUrl).pathname;

  return serviceWorker.register(workerUrl, { scope }).catch((error) => {
    console.warn("Service worker registration failed.", error);
    return null;
  });
}
