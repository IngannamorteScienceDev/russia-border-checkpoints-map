export const RECENT_STORAGE_KEY = "russiaBorderCheckpointsMap.recentCheckpointIds.v1";
export const RECENT_LIMIT = 6;

function normalizeRecentId(id) {
  return String(id || "").trim();
}

function normalizeRecentIds(recentIds, limit = RECENT_LIMIT) {
  const uniqueIds = [];

  for (const rawId of recentIds || []) {
    const id = normalizeRecentId(rawId);
    if (!id || uniqueIds.includes(id)) continue;
    uniqueIds.push(id);
    if (uniqueIds.length >= limit) break;
  }

  return uniqueIds;
}

export function loadRecentIds(storage = globalThis.localStorage) {
  try {
    const rawValue = storage?.getItem?.(RECENT_STORAGE_KEY);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];

    return normalizeRecentIds(parsedValue);
  } catch {
    return [];
  }
}

export function saveRecentIds(recentIds, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(RECENT_STORAGE_KEY, JSON.stringify(normalizeRecentIds(recentIds)));
  } catch {
    // localStorage can be unavailable in private mode or locked-down browsers.
  }
}

export function prependRecentId(recentIds, id, limit = RECENT_LIMIT) {
  const recentId = normalizeRecentId(id);
  if (!recentId) return normalizeRecentIds(recentIds, limit);

  return normalizeRecentIds([recentId, ...(recentIds || [])], limit);
}
