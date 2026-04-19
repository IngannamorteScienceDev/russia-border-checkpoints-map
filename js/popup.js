import { haversine, routeUrl } from "./geo.js";
import { getFreshnessInfo } from "./freshness.js";
import { getQualityFlags } from "./quality.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function detailRow(label, value) {
  return `
    <div class="checkpoint-popup__row">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value || "—")}</b>
    </div>
  `;
}

function buildPopupHtml(feature, userLocation) {
  const props = feature.properties;
  const coords = feature.geometry.coordinates;
  const extra = props.__extra || {};
  const freshness = getFreshnessInfo(extra.updatedAt);
  const qualityFlags = getQualityFlags(feature);
  const sourceUrl = safeExternalUrl(extra.source);

  const dist = userLocation
    ? `${haversine(userLocation, coords).toFixed(1)} км`
    : "включите геолокацию";

  const route = userLocation
    ? `<a href="${routeUrl(userLocation, coords)}" target="_blank" rel="noreferrer">Маршрут</a>`
    : "";

  const lines = [
    { k: "Субъект РФ", v: props.__subject || "—" },
    { k: "Страна", v: props.__country || "—" },
    { k: "Тип", v: props.__type || "—" },
    { k: "Статус", v: props.__status || "—" },
    { k: "Координаты", v: props.__coords || "—" }
  ];

  if (extra.address) lines.push({ k: "Адрес", v: extra.address });
  if (extra.workingTime) lines.push({ k: "Режим работы", v: extra.workingTime });
  if (extra.legalStatus) lines.push({ k: "Правовой режим", v: extra.legalStatus });
  if (extra.federalDistrict) lines.push({ k: "Федеральный округ", v: extra.federalDistrict });
  if (extra.transportCorridor) lines.push({ k: "Направление МТК", v: extra.transportCorridor });
  if (extra.branchName) lines.push({ k: "Филиал", v: extra.branchName });
  if (extra.branchPhone) lines.push({ k: "Телефон филиала", v: extra.branchPhone });
  if (extra.category) lines.push({ k: "Категория", v: extra.category });
  if (extra.mode) lines.push({ k: "Вид сообщения", v: extra.mode });
  if (extra.road) lines.push({ k: "Дорога/маршрут", v: extra.road });
  if (extra.neighborPoint) lines.push({ k: "Сопредельный КПП", v: extra.neighborPoint });
  if (extra.operator) lines.push({ k: "Оператор", v: extra.operator });
  if (extra.updatedAt) lines.push({ k: "Обновлено", v: extra.updatedAt });

  const qualityHtml = qualityFlags.length
    ? qualityFlags
        .map(
          (flag) =>
            `<span class="checkpoint-popup__flag checkpoint-popup__flag--${flag.level}">${escapeHtml(flag.label)}</span>`
        )
        .join("")
    : '<span class="checkpoint-popup__flag checkpoint-popup__flag--ok">Без критичных замечаний</span>';

  return `
    <article class="checkpoint-popup">
      <header class="checkpoint-popup__header">
        <span class="checkpoint-popup__type">${escapeHtml(props.__type || "КПП")}</span>
        <h3>${escapeHtml(props.__name)}</h3>
        <p>${escapeHtml(props.__status || "Статус не указан")} · расстояние: ${escapeHtml(dist)}</p>
      </header>

      <section class="checkpoint-popup__section">
        ${lines.map((line) => detailRow(line.k, line.v)).join("")}
      </section>

      <section class="checkpoint-popup__section checkpoint-popup__section--quality">
        <div class="checkpoint-popup__qualityTop">
          <span class="freshness freshness--${freshness.level}" title="${escapeHtml(freshness.details)}">${escapeHtml(freshness.label)}</span>
          ${extra.confidence ? `<span class="checkpoint-popup__confidence">${escapeHtml(extra.confidence)}</span>` : ""}
        </div>
        <div class="checkpoint-popup__flags">${qualityHtml}</div>
      </section>

      <footer class="checkpoint-popup__actions">
        ${route}
        ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Источник</a>` : ""}
      </footer>
    </article>
  `;
}

export function createPopupController({
  map,
  getUserLocation,
  onPopupChange,
  showMapPopup = false
}) {
  let popupRef = null;
  let lastPopupFeature = null;
  let suppressCloseNotify = false;

  function notifyPopupChange(feature) {
    if (typeof onPopupChange === "function") {
      onPopupChange(feature);
    }
  }

  function clearPopup({ notify = true } = {}) {
    if (popupRef) {
      const popup = popupRef;
      popupRef = null;
      lastPopupFeature = null;
      suppressCloseNotify = !notify;
      popup.remove();
      suppressCloseNotify = false;
      if (typeof popup.on !== "function" && notify) notifyPopupChange(null);
      return;
    }

    lastPopupFeature = null;
    if (notify) notifyPopupChange(null);
  }

  function openPopup(feature, lngLat) {
    if (!feature) return;

    if (popupRef) {
      clearPopup({ notify: false });
    }

    lastPopupFeature = feature;

    if (!showMapPopup || !globalThis.maplibregl?.Popup) {
      notifyPopupChange(feature);
      map.easeTo({ center: feature.geometry.coordinates, zoom: Math.max(map.getZoom(), 7) });
      return;
    }

    popupRef = new maplibregl.Popup({ maxWidth: "380px", closeButton: true, closeOnClick: true })
      .setLngLat(lngLat || feature.geometry.coordinates)
      .setHTML(buildPopupHtml(feature, getUserLocation()))
      .addTo(map);

    if (typeof popupRef.on === "function") {
      popupRef.on("close", () => {
        popupRef = null;
        lastPopupFeature = null;
        if (suppressCloseNotify) return;
        notifyPopupChange(null);
      });
    }

    notifyPopupChange(feature);

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
    closePopup: () => clearPopup({ notify: true }),
    openPopup,
    refreshPopup,
    getLastPopupFeature
  };
}
