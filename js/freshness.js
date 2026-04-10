const DAY_MS = 24 * 60 * 60 * 1000;
const FRESH_DAYS = 180;
const AGING_DAYS = 365;

export function parseFreshnessDate(value) {
  if (!value) return null;

  const raw = String(value).trim();
  const normalized = raw.replace(/\.(\d{3})\d+Z$/, ".$1Z");
  const timestamp = Date.parse(normalized);

  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp);
}

export function getFreshnessInfo(value, now = new Date()) {
  const parsedDate = parseFreshnessDate(value);

  if (!parsedDate) {
    return {
      level: "unknown",
      label: "Дата неизвестна",
      details: "Источник не указал дату обновления"
    };
  }

  const ageDays = Math.max(0, Math.floor((now.getTime() - parsedDate.getTime()) / DAY_MS));

  if (ageDays <= FRESH_DAYS) {
    return {
      level: "fresh",
      label: "Свежие данные",
      details: `Обновлено ${ageDays} дн. назад`
    };
  }

  if (ageDays <= AGING_DAYS) {
    return {
      level: "aging",
      label: "Проверьте дату",
      details: `Обновлено ${ageDays} дн. назад`
    };
  }

  return {
    level: "stale",
    label: "Устаревает",
    details: `Обновлено ${ageDays} дн. назад`
  };
}
