const FILTER_PARAM_MAP = {
  query: "q",
  type: "type",
  status: "status",
  country: "country",
  subject: "subject",
  sort: "sort"
};
const CHECKPOINT_PARAM = "checkpoint";
const SATELLITE_PARAM = "sat";
const BOUNDARIES_PARAM = "borders";
const ROADS_PARAM = "roads";
const MAP_PARAM_MAP = {
  lng: "lng",
  lat: "lat",
  zoom: "zoom"
};

function updateUrl(mutator) {
  if (!window.history?.replaceState) return;

  const url = new URL(window.location.href);
  mutator(url);
  window.history.replaceState({}, "", url);
}

function setParam(url, name, value) {
  if (value === null || value === undefined || value === "" || value === "all") {
    url.searchParams.delete(name);
    return;
  }

  url.searchParams.set(name, String(value));
}

function parseFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function parseBooleanParam(value, defaultValue = false) {
  if (value === null || value === undefined) return defaultValue;

  const normalized = String(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  return defaultValue;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hasAllowedValue(el, value) {
  if (!value) return false;
  if (!Array.isArray(el?.__options)) return true;
  return el.__options.includes(value);
}

function setSelectValue(el, value, emptyValue = "all") {
  if (!value || value === emptyValue) {
    el.value = emptyValue;
    return;
  }

  if (hasAllowedValue(el, value)) {
    el.value = value;
  }
}

export function applyFilterStateFromUrl(dom) {
  const url = new URL(window.location.href);

  dom.searchEl.value = url.searchParams.get(FILTER_PARAM_MAP.query) || "";
  setSelectValue(dom.typeEl, url.searchParams.get(FILTER_PARAM_MAP.type));
  setSelectValue(dom.statusEl, url.searchParams.get(FILTER_PARAM_MAP.status));
  setSelectValue(dom.countryEl, url.searchParams.get(FILTER_PARAM_MAP.country));
  setSelectValue(dom.subjectEl, url.searchParams.get(FILTER_PARAM_MAP.subject));
  setSelectValue(dom.sortEl, url.searchParams.get(FILTER_PARAM_MAP.sort), "country");
}

export function syncFilterStateToUrl(dom) {
  updateUrl((url) => {
    const state = {
      query: dom.searchEl.value.trim(),
      type: dom.typeEl.value,
      status: dom.statusEl.value,
      country: dom.countryEl.value,
      subject: dom.subjectEl.value,
      sort: dom.sortEl.value === "country" ? "" : dom.sortEl.value
    };

    for (const [key, param] of Object.entries(FILTER_PARAM_MAP)) {
      setParam(url, param, state[key]);
    }
  });
}

export function getSelectedCheckpointIdFromUrl() {
  return new URL(window.location.href).searchParams.get(CHECKPOINT_PARAM) || "";
}

export function syncSelectedCheckpointToUrl(checkpointId) {
  updateUrl((url) => {
    setParam(url, CHECKPOINT_PARAM, checkpointId);
  });
}

export function getSatelliteModeFromUrl(defaultValue = false) {
  const url = new URL(window.location.href);
  return parseBooleanParam(url.searchParams.get(SATELLITE_PARAM), defaultValue);
}

export function syncSatelliteModeToUrl(isEnabled) {
  updateUrl((url) => {
    setParam(url, SATELLITE_PARAM, isEnabled ? "1" : "0");
  });
}

export function getReferenceLayerStateFromUrl(defaultState = { boundaries: true, roads: true }) {
  const url = new URL(window.location.href);

  return {
    boundaries: parseBooleanParam(url.searchParams.get(BOUNDARIES_PARAM), defaultState.boundaries),
    roads: parseBooleanParam(url.searchParams.get(ROADS_PARAM), defaultState.roads)
  };
}

export function syncReferenceLayerStateToUrl({ boundaries, roads }) {
  updateUrl((url) => {
    setParam(url, BOUNDARIES_PARAM, boundaries ? "1" : "0");
    setParam(url, ROADS_PARAM, roads ? "1" : "0");
  });
}

export function getMapViewStateFromUrl(defaultView) {
  const url = new URL(window.location.href);
  const lng = parseFiniteNumber(url.searchParams.get(MAP_PARAM_MAP.lng));
  const lat = parseFiniteNumber(url.searchParams.get(MAP_PARAM_MAP.lat));
  const zoom = parseFiniteNumber(url.searchParams.get(MAP_PARAM_MAP.zoom));

  return {
    center:
      Number.isFinite(lng) && Number.isFinite(lat)
        ? [clamp(lng, -180, 180), clamp(lat, -90, 90)]
        : [...defaultView.center],
    zoom: Number.isFinite(zoom) ? clamp(zoom, 0, 22) : defaultView.zoom
  };
}

export function syncMapViewToUrl({ center, zoom }) {
  updateUrl((url) => {
    const [lng, lat] = Array.isArray(center) ? center : [null, null];

    setParam(url, MAP_PARAM_MAP.lng, Number.isFinite(lng) ? lng.toFixed(5) : null);
    setParam(url, MAP_PARAM_MAP.lat, Number.isFinite(lat) ? lat.toFixed(5) : null);
    setParam(url, MAP_PARAM_MAP.zoom, Number.isFinite(zoom) ? zoom.toFixed(2) : null);
  });
}
