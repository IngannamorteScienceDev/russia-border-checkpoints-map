const FILTER_PARAM_MAP = {
  query: "q",
  type: "type",
  status: "status",
  country: "country",
  subject: "subject"
};

function hasAllowedValue(el, value) {
  if (!value) return false;
  if (!Array.isArray(el?.__options)) return true;
  return el.__options.includes(value);
}

function setSelectValue(el, value) {
  if (!value || value === "all") {
    el.value = "all";
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
}

export function syncFilterStateToUrl(dom) {
  if (!window.history?.replaceState) return;

  const url = new URL(window.location.href);
  const state = {
    query: dom.searchEl.value.trim(),
    type: dom.typeEl.value,
    status: dom.statusEl.value,
    country: dom.countryEl.value,
    subject: dom.subjectEl.value
  };

  for (const [key, param] of Object.entries(FILTER_PARAM_MAP)) {
    const value = state[key];

    if (!value || value === "all") {
      url.searchParams.delete(param);
      continue;
    }

    url.searchParams.set(param, value);
  }

  window.history.replaceState({}, "", url);
}
