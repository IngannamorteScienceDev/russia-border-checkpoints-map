import { UNKNOWN_VALUE } from "./config.js";

const DATA_URL = "./data/checkpoints.geojson";
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });
const WINDOWS_1252_EXTENSIONS = new Map([
  [0x80, "€"],
  [0x82, "‚"],
  [0x83, "ƒ"],
  [0x84, "„"],
  [0x85, "…"],
  [0x86, "†"],
  [0x87, "‡"],
  [0x88, "ˆ"],
  [0x89, "‰"],
  [0x8a, "Š"],
  [0x8b, "‹"],
  [0x8c, "Œ"],
  [0x8e, "Ž"],
  [0x91, "‘"],
  [0x92, "’"],
  [0x93, "“"],
  [0x94, "”"],
  [0x95, "•"],
  [0x96, "–"],
  [0x97, "—"],
  [0x98, "˜"],
  [0x99, "™"],
  [0x9a, "š"],
  [0x9b, "›"],
  [0x9c, "œ"],
  [0x9e, "ž"],
  [0x9f, "Ÿ"]
]);
const WINDOWS_1251_BYTES = createByteMap("windows-1251");
const WINDOWS_1252_BYTES = createByteMap("windows-1252");

function createByteMap(encoding) {
  const decoder = new TextDecoder(encoding);
  const map = new Map();

  for (let byte = 0; byte <= 255; byte += 1) {
    map.set(decoder.decode(Uint8Array.of(byte)), byte);
  }

  if (encoding === "windows-1252") {
    for (const [byte, character] of WINDOWS_1252_EXTENSIONS) {
      map.set(character, byte);
    }
  }

  return map;
}

function encodeWithMap(text, byteMap) {
  const bytes = [];

  for (const character of text) {
    const byte = byteMap.get(character);
    if (byte === undefined) return null;
    bytes.push(byte);
  }

  return Uint8Array.from(bytes);
}

function decodeAsUtf8(text, byteMap) {
  const bytes = encodeWithMap(text, byteMap);
  if (!bytes) return "";

  return UTF8_DECODER.decode(bytes);
}

function mojibakeScore(text) {
  const westernMarkers = text.match(/[ÐÑÂ�]/g)?.length || 0;
  const cyrillicPairs = text.match(/[РС][\u0400-\u045f\u00a0-\u02ff]/g)?.length || 0;
  const replacementMarkers = text.match(/\uFFFD/g)?.length || 0;

  return westernMarkers * 3 + cyrillicPairs + replacementMarkers * 8;
}

function isBetterRepair(candidate, current) {
  if (!candidate || candidate === current || candidate.includes("\uFFFD")) return false;

  return mojibakeScore(candidate) < mojibakeScore(current);
}

export function repairText(value) {
  let current = String(value ?? "");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const windows1252 = decodeAsUtf8(current, WINDOWS_1252_BYTES);
    if (isBetterRepair(windows1252, current)) {
      current = windows1252;
      continue;
    }

    const windows1251 = decodeAsUtf8(current, WINDOWS_1251_BYTES);
    if (isBetterRepair(windows1251, current)) {
      current = windows1251;
      continue;
    }

    break;
  }

  return current;
}

function cleanText(value) {
  return repairText(value).replace(/\s+/g, " ").trim();
}

function normalized(value) {
  return cleanText(value).toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
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
  if (text.includes("желез") || text.includes("ж/д")) return "Железнодорожный";
  if (text.includes("воздуш") || text.includes("аэропорт")) return "Воздушный";
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

function extractOperationalStatus(props) {
  const explicitStatus = firstValue(props, [
    "current_status",
    "operational_status",
    "state",
    "condition"
  ]);

  if (explicitStatus) return explicitStatus;
  if (props.is_functional !== undefined && props.is_functional !== null) return props.is_functional;

  return firstValue(props, ["status"]);
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
  const status = normalizeStatus(extractOperationalStatus(props));

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
      __address: firstValue(props, ["address", "checkpoint_address"]),
      __workingTime: firstValue(props, ["working_time", "work_time", "schedule"]),
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
