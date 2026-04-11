export const COMPARE_LIMIT = 2;

function normalizeCompareId(id) {
  return String(id || "").trim();
}

export function toggleCompareId(compareIds, id, limit = COMPARE_LIMIT) {
  const compareId = normalizeCompareId(id);
  const nextIds = [...(compareIds || [])].map(normalizeCompareId).filter(Boolean);

  if (!compareId) return nextIds.slice(0, limit);

  if (nextIds.includes(compareId)) {
    return nextIds.filter((item) => item !== compareId);
  }

  return [...nextIds, compareId].slice(-limit);
}
