export function getQualityFlags(feature) {
  const props = feature?.properties || {};
  const extra = props.__extra || {};
  const flags = [];

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
