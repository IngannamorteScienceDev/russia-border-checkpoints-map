const QUALITY_REPORT_PATH = "./data/data_quality_report.json";

function normalizeCheckpointId(value) {
  return String(value || "").trim();
}

function warningCheckpointIds(message) {
  const text = String(message || "").trim();
  const leadingId = text.match(/^(\d+):/);
  if (leadingId) return [leadingId[1]];

  if (text.includes("Duplicate coordinate pair detected")) {
    return (text.split(":").pop()?.match(/\d+/g) || []).map(normalizeCheckpointId);
  }

  return [];
}

function warningLabel(message, fallbackLabel) {
  const text = String(message || "").toLowerCase();

  if (text.includes("low precision")) return "Низкая точность координат";
  if (text.includes("duplicate coordinate pair")) return "Дублируются координаты";
  return fallbackLabel;
}

function addReportItem(index, message, level) {
  const ids = warningCheckpointIds(message);
  if (!ids.length) return;

  const flag = {
    level,
    label: warningLabel(
      message,
      level === "critical" ? "Ошибка качества данных" : "Предупреждение качества данных"
    ),
    details: String(message || "")
  };

  for (const id of ids) {
    if (!index.has(id)) index.set(id, []);
    index.get(id).push(flag);
  }
}

export function buildQualityWarningIndex(report = {}) {
  const index = new Map();

  for (const warning of report.warnings || []) {
    addReportItem(index, warning, "warning");
  }

  for (const error of report.errors || []) {
    addReportItem(index, error, "critical");
  }

  return index;
}

export function applyQualityReportToFeatures(features = [], report = {}) {
  const warningIndex = buildQualityWarningIndex(report);

  return features.map((feature) => {
    const props = feature.properties || {};
    const checkpointId = normalizeCheckpointId(props.__id || props.checkpoint_id);

    return {
      ...feature,
      properties: {
        ...props,
        __qualityWarnings: warningIndex.get(checkpointId) || []
      }
    };
  });
}

export async function loadDataQualityReport({
  fetchImpl = globalThis.fetch,
  pageUrl = globalThis.window?.location?.href || "http://localhost/"
} = {}) {
  if (typeof fetchImpl !== "function") return {};

  try {
    const response = await fetchImpl(new URL(QUALITY_REPORT_PATH, pageUrl).toString(), {
      cache: "no-store"
    });

    if (!response?.ok) return {};
    return response.json();
  } catch (error) {
    console.warn("Data quality report was not loaded:", error);
    return {};
  }
}

export function getQualityFlags(feature) {
  const props = feature?.properties || {};
  const extra = props.__extra || {};
  const flags = [...(Array.isArray(props.__qualityWarnings) ? props.__qualityWarnings : [])];

  if (!extra.source) {
    flags.push({ level: "warning", label: "Нет источника" });
  }

  if (!extra.updatedAt) {
    flags.push({ level: "warning", label: "Нет даты обновления" });
  }

  if (!props.__status || props.__status === "Неизвестно") {
    flags.push({ level: "warning", label: "Неясный статус" });
  }

  if (!props.__coords || props.__coords === "—") {
    flags.push({ level: "critical", label: "Нет координат" });
  }

  return flags;
}
