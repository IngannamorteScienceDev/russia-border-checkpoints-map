const SOURCE_PROFILES = [
  {
    id: "rosgranstroy-map-api",
    host: "rosgranstroy.ru",
    pathPrefix: "/api/map_data",
    title: "ФГКУ Росгранстрой",
    badge: "Официальный операционный источник",
    trustLevel: "high",
    trustLabel: "Высокая уверенность",
    summary:
      "Публичный машинно-читаемый слой карты Росгранстроя. Его используем как основной источник координат, статуса, адреса, режима работы и сопредельного пункта.",
    verificationUrl: "https://mintrans.gov.ru/activities/168",
    verificationLabel: "Сверить с перечнем Минтранса"
  },
  {
    id: "mintrans-checkpoints",
    host: "mintrans.gov.ru",
    pathPrefix: "/activities/168",
    title: "Минтранс России",
    badge: "Официальный справочный источник",
    trustLevel: "high",
    trustLabel: "Высокая уверенность",
    summary:
      "Раздел Минтранса с перечнем пунктов пропуска, документами и новостями. Его лучше использовать как контрольный источник существования, классификации и правовых изменений.",
    verificationUrl: "https://mintrans.gov.ru/activities/168/documents",
    verificationLabel: "Открыть документы Минтранса"
  }
];

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function sourceHostname(sourceUrl) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function findSourceProfile(sourceUrl) {
  const safeUrl = safeExternalUrl(sourceUrl);
  if (!safeUrl) return null;

  const url = new URL(safeUrl);
  const host = url.hostname.replace(/^www\./, "");

  return (
    SOURCE_PROFILES.find((profile) => {
      return host === profile.host && url.pathname.startsWith(profile.pathPrefix);
    }) || null
  );
}

function buildEvidenceList(feature) {
  const props = feature?.properties || {};
  const extra = props.__extra || {};
  const evidence = [];

  if (props.__coords && props.__coords !== "—") evidence.push("координаты");
  if (props.__status && props.__status !== "Неизвестно") evidence.push("статус");
  if (props.__type) evidence.push("тип КПП");
  if (props.__subject && props.__subject !== "Не указано") evidence.push("субъект РФ");
  if (props.__country && props.__country !== "Не указано") evidence.push("сопредельная страна");
  if (extra.road) evidence.push("дорога / маршрут");
  if (extra.mode) evidence.push("вид сообщения");
  if (extra.updatedAt) evidence.push("дата обновления");

  return evidence;
}

export function buildFeatureSourceAudit(feature) {
  const props = feature?.properties || {};
  const extra = props.__extra || {};
  const sourceUrl = safeExternalUrl(extra.source);
  const profile = findSourceProfile(sourceUrl);
  const fallbackHost = sourceHostname(sourceUrl);
  const evidence = buildEvidenceList(feature);

  return {
    sourceUrl,
    title: profile?.title || fallbackHost || "Источник не указан",
    badge: profile?.badge || "Источник требует проверки",
    trustLevel: profile?.trustLevel || (sourceUrl ? "medium" : "low"),
    trustLabel: profile?.trustLabel || (sourceUrl ? "Нужна сверка" : "Нет источника"),
    summary:
      profile?.summary ||
      (sourceUrl
        ? "Источник есть в записи, но проект пока не знает его профиль. Такие записи лучше дополнительно сверять вручную."
        : "В записи нет исходной ссылки. Для исследовательского режима такую карточку нужно считать неполной."),
    verificationUrl: profile?.verificationUrl || "https://mintrans.gov.ru/activities/168",
    verificationLabel: profile?.verificationLabel || "Сверить с официальным перечнем",
    evidence: evidence.length ? evidence : ["базовые поля записи"]
  };
}
