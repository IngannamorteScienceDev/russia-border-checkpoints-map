const ISSUES_NEW_URL =
  "https://github.com/IngannamorteScienceDev/russia-border-checkpoints-map/issues/new";

export function buildReportUrl(feature, pageUrl = globalThis.window?.location?.href || "") {
  const props = feature?.properties || {};
  const title = `Проверить данные КПП: ${props.__name || props.__id || "без названия"}`;
  const body = [
    "### КПП",
    `- ID: ${props.__id || "не указан"}`,
    `- Название: ${props.__name || "не указано"}`,
    `- Страна: ${props.__country || "не указана"}`,
    `- Субъект РФ: ${props.__subject || "не указан"}`,
    `- Тип: ${props.__type || "не указан"}`,
    `- Статус: ${props.__status || "не указан"}`,
    `- Координаты: ${props.__coords || "не указаны"}`,
    "",
    "### Что исправить",
    "Опишите, что именно выглядит неверно или чего не хватает.",
    "",
    "### Ссылка на карту",
    pageUrl || "не указана"
  ].join("\n");

  const url = new URL(ISSUES_NEW_URL);
  url.searchParams.set("title", title);
  url.searchParams.set("body", body);
  url.searchParams.set("labels", "data");

  return url.toString();
}
