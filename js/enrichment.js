const ENRICHMENT_PATH = "./data/checkpoint_enrichment.json";
const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);
const KNOWN_KINDS = new Set([
  "official_verification",
  "news",
  "infrastructure",
  "data_note",
  "map_context",
  "manual_review"
]);

const KIND_LABELS = {
  official_verification: "Сверка",
  news: "Новость",
  infrastructure: "Инфраструктура",
  data_note: "Данные",
  map_context: "Геоконтекст",
  manual_review: "Проверка"
};

function emptyIndex(meta = {}) {
  return {
    meta: {
      schemaVersion: Number(meta.schemaVersion) || 1,
      generatedAt: String(meta.generatedAt || ""),
      description: String(meta.description || ""),
      sources: Array.isArray(meta.sources) ? meta.sources : []
    },
    records: [],
    byCheckpointId: new Map()
  };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];

  return value.map(normalizeText).filter(Boolean).slice(0, 8);
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object") return null;

  const checkpointId = normalizeText(record.checkpointId || record.checkpoint_id);
  const title = normalizeText(record.title);
  const summary = normalizeText(record.summary);

  if (!checkpointId || !title) return null;

  const kind = KNOWN_KINDS.has(record.kind) ? record.kind : "data_note";
  const confidence = VALID_CONFIDENCE.has(record.confidence) ? record.confidence : "medium";

  return {
    checkpointId,
    kind,
    kindLabel: KIND_LABELS[kind],
    title,
    summary,
    date: normalizeText(record.date || record.sourceDate),
    sourceTitle: normalizeText(record.sourceTitle),
    sourceUrl: safeExternalUrl(record.sourceUrl),
    confidence,
    tags: normalizeTags(record.tags)
  };
}

export function buildCheckpointEnrichmentIndex(payload = {}) {
  const index = emptyIndex(payload);
  const records = Array.isArray(payload.records)
    ? payload.records.map(normalizeRecord).filter(Boolean)
    : [];

  for (const record of records) {
    index.records.push(record);

    if (!index.byCheckpointId.has(record.checkpointId)) {
      index.byCheckpointId.set(record.checkpointId, []);
    }

    index.byCheckpointId.get(record.checkpointId).push(record);
  }

  return index;
}

export async function loadCheckpointEnrichment({
  fetchImpl = globalThis.fetch,
  pageUrl = globalThis.window?.location?.href || "http://localhost/"
} = {}) {
  if (typeof fetchImpl !== "function") return emptyIndex();

  try {
    const response = await fetchImpl(new URL(ENRICHMENT_PATH, pageUrl).toString(), {
      cache: "no-store"
    });

    if (!response?.ok) return emptyIndex();

    return buildCheckpointEnrichmentIndex(await response.json());
  } catch (error) {
    console.warn("Checkpoint enrichment was not loaded:", error);
    return emptyIndex();
  }
}

export function getFeatureEnrichment(index, feature) {
  const checkpointId = normalizeText(feature?.properties?.__id);
  const records = checkpointId ? index?.byCheckpointId?.get(checkpointId) || [] : [];

  return {
    meta: index?.meta || emptyIndex().meta,
    records,
    verificationRecords: records.filter((record) => record.kind === "official_verification"),
    eventRecords: records.filter((record) => record.kind !== "official_verification"),
    hasRecords: records.length > 0
  };
}
