import { haversine, routeUrl } from "./geo.js";

function buildPopupHtml(feature, userLocation) {
  const props = feature.properties;
  const coords = feature.geometry.coordinates;

  const dist = userLocation
    ? `${haversine(userLocation, coords).toFixed(1)} км`
    : "включите геолокацию";

  const route = userLocation
    ? `<a href="${routeUrl(userLocation, coords)}" target="_blank" rel="noreferrer">🛣 Маршрут</a>`
    : "";

  const extra = props.__extra || {};
  const lines = [
    { k: "Субъект РФ", v: props.__subject || "—" },
    { k: "Страна", v: props.__country || "—" },
    { k: "Тип", v: props.__type || "—" },
    { k: "Статус", v: props.__status || "—" },
    { k: "Координаты", v: props.__coords || "—" }
  ];

  if (extra.category) lines.push({ k: "Категория", v: extra.category });
  if (extra.mode) lines.push({ k: "Вид сообщения", v: extra.mode });
  if (extra.road) lines.push({ k: "Дорога/маршрут", v: extra.road });
  if (extra.neighborPoint) lines.push({ k: "Сопредельный КПП", v: extra.neighborPoint });
  if (extra.operator) lines.push({ k: "Оператор", v: extra.operator });
  if (extra.updatedAt) lines.push({ k: "Обновлено", v: extra.updatedAt });

  const table = lines.map(line => `
    <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;line-height:1.35;margin:2px 0">
      <span style="opacity:.75">${line.k}</span>
      <span style="font-weight:650;text-align:right">${line.v}</span>
    </div>
  `).join("");

  return `
    <div style="font-weight:900;font-size:16px;margin-bottom:6px">${props.__name}</div>
    <div style="font-size:13px;opacity:.85;margin-bottom:8px">📏 ${dist}</div>

    <div style="border:1px solid rgba(148,163,184,.14);
                border-radius:12px;
                padding:10px;
                background:rgba(15,23,42,.35);
                margin-bottom:10px">
      ${table}
    </div>

    <div style="display:flex;gap:12px;align-items:center;font-size:13px">
      ${route}
    </div>
  `;
}

export function createPopupController({ map, getUserLocation }) {
  let popupRef = null;
  let lastPopupFeature = null;

  function openPopup(feature, lngLat) {
    if (!feature) return;

    lastPopupFeature = feature;

    if (popupRef) popupRef.remove();

    popupRef = new maplibregl.Popup({ maxWidth: "380px", closeButton: true, closeOnClick: true })
      .setLngLat(lngLat || feature.geometry.coordinates)
      .setHTML(buildPopupHtml(feature, getUserLocation()))
      .addTo(map);

    map.easeTo({ center: feature.geometry.coordinates, zoom: Math.max(map.getZoom(), 7) });
  }

  function refreshPopup() {
    if (!lastPopupFeature) return;
    openPopup(lastPopupFeature);
  }

  function getLastPopupFeature() {
    return lastPopupFeature;
  }

  return {
    openPopup,
    refreshPopup,
    getLastPopupFeature
  };
}
