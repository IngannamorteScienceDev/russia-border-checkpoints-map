const el = id => document.getElementById(id);

export function getDomElements() {
  return {
    panelEl: el("panel"),
    mobileToggleEl: el("mobileToggle"),
    mobileToggleFloatingEl: el("mobileToggleFloating"),
    searchEl: el("searchInput"),
    typeEl: el("typeFilter"),
    statusEl: el("statusFilter"),
    legendEl: el("legend"),
    statsEl: el("stats"),
    listEl: el("list"),
    emptyEl: el("emptyState"),
    loaderEl: el("loader"),
    loaderProgressEl: el("loaderProgress"),
    loaderTextEl: el("loaderText"),
    styleToggleEl: el("styleToggle"),
    geoBtnEl: el("geoBtn")
  };
}
