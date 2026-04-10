const el = id => document.getElementById(id);

export function getDomElements() {
  return {
    panelEl: el("panel"),
    mobileToggleEl: el("mobileToggle"),
    mobileToggleFloatingEl: el("mobileToggleFloating"),
    searchEl: el("searchInput"),
    typeEl: el("typeFilter"),
    statusEl: el("statusFilter"),
    countryEl: el("countryFilter"),
    subjectEl: el("subjectFilter"),
    sortEl: el("sortOrder"),
    nearestBtnEl: el("nearestBtn"),
    favoritesOnlyEl: el("favoritesOnly"),
    resetFiltersEl: el("resetFilters"),
    exportCsvEl: el("exportCsv"),
    exportGeoJsonEl: el("exportGeoJson"),
    shareLinkEl: el("shareLink"),
    recentEl: el("recent"),
    nearestOpenEl: el("nearestOpen"),
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
