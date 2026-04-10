export const FAVORITES_STORAGE_KEY = "russiaBorderCheckpointsMap.favoriteIds.v1";

function normalizeFavoriteId(id) {
  return String(id || "").trim();
}

export function loadFavoriteIds(storage = globalThis.localStorage) {
  try {
    const rawValue = storage?.getItem?.(FAVORITES_STORAGE_KEY);
    if (!rawValue) return new Set();

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return new Set();

    return new Set(parsedValue.map(normalizeFavoriteId).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function saveFavoriteIds(favoriteIds, storage = globalThis.localStorage) {
  try {
    const normalizedIds = [...(favoriteIds || [])]
      .map(normalizeFavoriteId)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "ru"));

    storage?.setItem?.(FAVORITES_STORAGE_KEY, JSON.stringify(normalizedIds));
  } catch {
    // localStorage can be unavailable in private mode or locked-down browsers.
  }
}

export function toggleFavoriteId(favoriteIds, id) {
  const favoriteId = normalizeFavoriteId(id);
  const nextFavoriteIds = new Set(favoriteIds || []);

  if (!favoriteId) return nextFavoriteIds;

  if (nextFavoriteIds.has(favoriteId)) {
    nextFavoriteIds.delete(favoriteId);
  } else {
    nextFavoriteIds.add(favoriteId);
  }

  return nextFavoriteIds;
}
