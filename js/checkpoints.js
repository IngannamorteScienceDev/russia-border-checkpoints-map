import { CHECKPOINT_TYPES, QUALITY_LEVELS, UNKNOWN_VALUE } from "./config.js";

const DATA_URL = "./data/checkpoints.geojson";
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });
const WINDOWS_1252_EXTENSIONS = new Map([
  [0x80, String.fromCodePoint(0x20ac)],
  [0x82, String.fromCodePoint(0x201a)],
  [0x83, String.fromCodePoint(0x0192)],
  [0x84, String.fromCodePoint(0x201e)],
  [0x85, String.fromCodePoint(0x2026)],
  [0x86, String.fromCodePoint(0x2020)],
  [0x87, String.fromCodePoint(0x2021)],
  [0x88, String.fromCodePoint(0x02c6)],
  [0x89, String.fromCodePoint(0x2030)],
  [0x8a, String.fromCodePoint(0x0160)],
  [0x8b, String.fromCodePoint(0x2039)],
  [0x8c, String.fromCodePoint(0x0152)],
  [0x8e, String.fromCodePoint(0x017d)],
  [0x91, String.fromCodePoint(0x2018)],
  [0x92, String.fromCodePoint(0x2019)],
  [0x93, String.fromCodePoint(0x201c)],
  [0x94, String.fromCodePoint(0x201d)],
  [0x95, String.fromCodePoint(0x2022)],
  [0x96, String.fromCodePoint(0x2013)],
  [0x97, String.fromCodePoint(0x2014)],
  [0x98, String.fromCodePoint(0x02dc)],
  [0x99, String.fromCodePoint(0x2122)],
  [0x9a, String.fromCodePoint(0x0161)],
  [0x9b, String.fromCodePoint(0x203a)],
  [0x9c, String.fromCodePoint(0x0153)],
  [0x9e, String.fromCodePoint(0x017e)],
  [0x9f, String.fromCodePoint(0x0178)]
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
  const westernMarkers = text.match(/[\u00d0\u00d1\u00c2\ufffd]/g)?.length || 0;
  const cyrillicPairs = text.match(/[\u0420\u0421][\u0400-\u045f\u00a0-\u02ff]/g)?.length || 0;
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
  return cleanText(value).toLocaleLowerCase("ru-RU").replaceAll("\u0451", "\u0435");
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

  if (text.includes("\u0430\u0432\u0442\u043e")) return CHECKPOINT_TYPES.road;
  if (text.includes("\u0436\u0435\u043b\u0435\u0437") || text.includes("\u0436/\u0434")) {
    return CHECKPOINT_TYPES.rail;
  }
  if (
    text.includes("\u0432\u043e\u0437\u0434\u0443\u0448") ||
    text.includes("\u0430\u044d\u0440\u043e\u043f\u043e\u0440\u0442")
  ) {
    return CHECKPOINT_TYPES.air;
  }
  if (text.includes("\u043c\u043e\u0440\u0441\u043a")) return CHECKPOINT_TYPES.sea;
  if (text.includes("\u0440\u0435\u0447")) return CHECKPOINT_TYPES.river;
  if (text.includes("\u043f\u0435\u0448")) return CHECKPOINT_TYPES.pedestrian;
  return CHECKPOINT_TYPES.other;
}

function normalizeStatus(value) {
  const text = normalized(value);

  if (!text)
    return "\u0421\u0442\u0430\u0442\u0443\u0441 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d";
  if (["true", "1", "yes", "\u0434\u0430"].includes(text)) {
    return "\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442";
  }
  if (["false", "0", "no", "\u043d\u0435\u0442"].includes(text)) {
    return "\u041d\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u043e\u043d\u0438\u0440\u0443\u0435\u0442";
  }
  if (
    text.includes("\u043d\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u043e\u043d\u0438\u0440\u0443")
  ) {
    return "\u041d\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u043e\u043d\u0438\u0440\u0443\u0435\u0442";
  }
  if (
    text.includes("\u0434\u0435\u0439\u0441\u0442\u0432") ||
    text.includes("\u0444\u0443\u043d\u043a\u0446\u0438\u043e\u043d\u0438\u0440\u0443")
  ) {
    return "\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442";
  }
  if (text.includes("\u043e\u0433\u0440\u0430\u043d\u0438\u0447"))
    return "\u041e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d";
  if (text.includes("\u0432\u0440\u0435\u043c\u0435\u043d")) {
    return "\u0412\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u0437\u0430\u043a\u0440\u044b\u0442";
  }
  if (text.includes("\u0437\u0430\u043a\u0440\u044b"))
    return "\u0417\u0430\u043a\u0440\u044b\u0442";
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

function decimalPrecision(value) {
  const text = String(value);
  const decimal = text.includes(".") ? text.split(".").at(-1) : "";
  return decimal.replace(/0+$/u, "").length;
}

function coordinateQuality({ longitude, latitude, props }) {
  const precision = Math.min(decimalPrecision(longitude), decimalPrecision(latitude));
  const confidence = normalized(props.confidence_level);
  const hasWeakPrecision = precision < 3;
  const hasMediumPrecision = precision < 5;

  if (confidence.includes("low") || hasWeakPrecision) {
    return {
      ...QUALITY_LEVELS.low,
      precision,
      reason:
        "\u041a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b \u0442\u0440\u0435\u0431\u0443\u044e\u0442 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438"
    };
  }

  if (confidence.includes("medium") || hasMediumPrecision) {
    return {
      ...QUALITY_LEVELS.medium,
      precision,
      reason:
        "\u0421\u0440\u0435\u0434\u043d\u044f\u044f \u0442\u043e\u0447\u043d\u043e\u0441\u0442\u044c \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442"
    };
  }

  return {
    ...QUALITY_LEVELS.high,
    precision,
    reason:
      "\u0412\u044b\u0441\u043e\u043a\u0430\u044f \u0442\u043e\u0447\u043d\u043e\u0441\u0442\u044c \u0434\u043b\u044f \u0433\u043b\u043e\u0431\u0443\u0441\u0430"
  };
}

function normalizeFeature(feature, index) {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;

  const [longitude, latitude] = coordinates.map(Number);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  const props = feature.properties || {};
  const id = firstValue(props, ["checkpoint_id", "id", "object_id", "uid"]) || `kpp-${index + 1}`;
  const name =
    firstValue(props, ["checkpoint_name", "name", "title"]) ||
    `\u041a\u041f\u041f ${String(index + 1)}`;
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
      __foreignCheckpoint: firstValue(props, ["foreign_checkpoint"]),
      __corridor: firstValue(props, ["transport_corridor"]),
      __source: firstValue(props, ["source", "source_url", "url", "href"]),
      __quality: coordinateQuality({ longitude, latitude, props })
    }
  };
}

export async function loadCheckpoints({ fetchImpl = globalThis.fetch, baseUrl, onProgress } = {}) {
  const pageUrl = baseUrl || globalThis.window?.location?.href || "http://localhost/";
  const url = new URL(DATA_URL, pageUrl).toString();

  onProgress?.(50, "\u0427\u0438\u0442\u0430\u0435\u043c GeoJSON...");
  const response = await fetchImpl(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(
      `\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c data/checkpoints.geojson (${response.status})`
    );
  }

  const payload = await response.json();
  const features = (payload.features || [])
    .map(normalizeFeature)
    .filter((item) => item?.geometry?.type === "Point");

  if (!features.length) {
    throw new Error(
      "\u0412 GeoJSON \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e \u043d\u0438 \u043e\u0434\u043d\u043e\u0439 \u0442\u043e\u0447\u043a\u0438 \u041a\u041f\u041f."
    );
  }

  return features;
}

export function buildDatasetSummary(features) {
  const countries = new Set();
  const typeCounts = {};
  const statusCounts = {};
  const qualityCounts = {};

  for (const feature of features) {
    const props = feature.properties || {};
    if (props.__country && props.__country !== UNKNOWN_VALUE) countries.add(props.__country);
    typeCounts[props.__type] = (typeCounts[props.__type] || 0) + 1;
    statusCounts[props.__status] = (statusCounts[props.__status] || 0) + 1;
    qualityCounts[props.__quality.id] = (qualityCounts[props.__quality.id] || 0) + 1;
  }

  return {
    total: features.length,
    countryCount: countries.size,
    typeCounts,
    statusCounts,
    qualityCounts
  };
}

export function formatCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) return "";

  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return "";

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
