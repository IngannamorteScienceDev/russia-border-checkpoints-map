import { UNKNOWN_VALUE } from "./config.js";

const DATA_URL = "./data/checkpoints.geojson";

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value) {
  return cleanText(value).toLowerCase().replaceAll("ё", "е");
}

function firstValue(props, keys) {
  for (const key of keys) {
    const value = props?.[key];
    if (value !== undefined && value !== null && cleanText(value) !== "") {
      return cleanText(value);
    }
  }

  return "";
}

function normalizeType(value) {
  const text = normalized(value);

  if (text.includes("авто")) return "Автомобильный";
  if (text.includes("желез")) return "Железнодорожный";
  if (text.includes("воздуш")) return "Воздушный";
  if (text.includes("морск")) return "Морской";
  if (text.includes("реч")) return "Речной";
  if (text.includes("пеш")) return "Пешеходный";
  return "Другое";
}

function normalizeStatus(value) {
  const text = normalized(value);

  if (!text) return "Статус не указан";
  if (["true", "1", "yes", "да"].includes(text)) return "Действует";
  if (["false", "0", "no", "нет"].includes(text)) return "Не функционирует";
  if (text.includes("не функциониру")) return "Не функционирует";
  if (text.includes("действ") || text.includes("функциониру")) return "Действует";
  if (text.includes("огранич")) return "Ограничен";
  if (text.includes("времен")) return "Временно закрыт";
  if (text.includes("закры")) return "Закрыт";
  return cleanText(value);
}

function extractCountry(props) {
  return (
    firstValue(props, [
      "foreign_country",
      "neighbor_country",
      "neighbour_country",
      "border_country",
      "country",
      "country_name",
      "neighbor_country_name",
      "neighbour_country_name",
      "sopredelnoe_gosudarstvo",
      "sopredelnoe_gosudarstvo_name"
    ]) || UNKNOWN_VALUE
  );
}

function extractSubject(props) {
  return (
    firstValue(props, [
      "subject_name",
      "subject",
      "region_name",
      "region",
      "rf_subject",
      "rf_subject_name"
    ]) || UNKNOWN_VALUE
  );
}

function normalizeFeature(feature, index) {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;

  const [longitude, latitude] = coordinates.map(Number);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  const props = feature.properties || {};
  const id = firstValue(props, ["checkpoint_id", "id", "object_id", "uid"]) || `kpp-${index + 1}`;
  const name =
    firstValue(props, ["checkpoint_name", "name", "title"]) || `КПП ${String(index + 1)}`;
  const type = normalizeType(firstValue(props, ["checkpoint_type", "type", "kind"]));
  const status = normalizeStatus(
    firstValue(props, ["current_status", "operational_status", "status", "state", "condition"]) ||
      props.is_functional
  );

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [longitude, latitude]
    },
    properties: {
      ...props,
      __id: String(id),
      __name: name,
      __type: type,
      __status: status,
      __country: extractCountry(props),
      __subject: extractSubject(props),
      __source: firstValue(props, ["source", "source_url", "url", "href"])
    }
  };
}

export async function loadCheckpoints({ fetchImpl = globalThis.fetch, baseUrl, onProgress } = {}) {
  const pageUrl = baseUrl || globalThis.window?.location?.href || "http://localhost/";
  const url = new URL(DATA_URL, pageUrl).toString();

  onProgress?.(50, "Читаем GeoJSON...");
  const response = await fetchImpl(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить data/checkpoints.geojson (${response.status})`);
  }

  const payload = await response.json();
  const features = (payload.features || [])
    .map(normalizeFeature)
    .filter((feature) => feature?.geometry?.type === "Point");

  if (!features.length) {
    throw new Error("В GeoJSON не найдено ни одной точки КПП.");
  }

  return features;
}

export function buildDatasetSummary(features) {
  const countries = new Set();
  const typeCounts = {};
  const statusCounts = {};

  for (const feature of features) {
    const props = feature.properties || {};
    if (props.__country && props.__country !== UNKNOWN_VALUE) countries.add(props.__country);
    typeCounts[props.__type] = (typeCounts[props.__type] || 0) + 1;
    statusCounts[props.__status] = (statusCounts[props.__status] || 0) + 1;
  }

  return {
    total: features.length,
    countryCount: countries.size,
    typeCounts,
    statusCounts
  };
}

export function formatCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) return "";

  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return "";

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
