export const DATASET_SNAPSHOT_STORAGE_KEY = "russiaBorderCheckpointsMap.datasetSnapshot.v1";

function normalizeId(id) {
  return String(id || "").trim();
}

export function buildDatasetSnapshot(features, datasetMeta = {}) {
  const ids = [...new Set(
    (features || [])
      .map(feature => normalizeId(feature?.properties?.__id))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "ru"));

  return {
    total: ids.length,
    ids,
    latestUpdatedAt: datasetMeta.latestUpdatedAt || null
  };
}

export function loadDatasetSnapshot(storage = globalThis.localStorage) {
  try {
    const rawValue = storage?.getItem?.(DATASET_SNAPSHOT_STORAGE_KEY);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue?.ids)) return null;

    return {
      total: Number.isFinite(parsedValue.total) ? parsedValue.total : parsedValue.ids.length,
      ids: parsedValue.ids.map(normalizeId).filter(Boolean),
      latestUpdatedAt: parsedValue.latestUpdatedAt || null
    };
  } catch {
    return null;
  }
}

export function saveDatasetSnapshot(snapshot, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(DATASET_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage can be unavailable in private mode or locked-down browsers.
  }
}

export function summarizeDatasetChanges(previousSnapshot, currentSnapshot) {
  if (!currentSnapshot) return null;

  if (!previousSnapshot) {
    return {
      isFirstVisit: true,
      total: currentSnapshot.total,
      totalDelta: 0,
      addedIds: [],
      removedIds: [],
      latestUpdatedAt: currentSnapshot.latestUpdatedAt
    };
  }

  const previousIds = new Set(previousSnapshot.ids || []);
  const currentIds = new Set(currentSnapshot.ids || []);
  const addedIds = [...currentIds].filter(id => !previousIds.has(id));
  const removedIds = [...previousIds].filter(id => !currentIds.has(id));

  return {
    isFirstVisit: false,
    total: currentSnapshot.total,
    totalDelta: currentSnapshot.total - (previousSnapshot.total || 0),
    addedIds,
    removedIds,
    latestUpdatedAt: currentSnapshot.latestUpdatedAt
  };
}
