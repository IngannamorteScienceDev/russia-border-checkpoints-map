function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeType(value) {
  const normalized = norm(value);
  if (normalized.includes("авто")) return "Автомобильный";
  if (normalized.includes("желез")) return "Железнодорожный";
  if (normalized.includes("воздуш")) return "Воздушный";
  if (normalized.includes("морск")) return "Морской";
  if (normalized.includes("реч")) return "Речной";
  if (normalized.includes("пеш")) return "Пешеходный";
  return "Другое";
}

function normalizeBooleanStatus(value) {
  if (typeof value === "boolean") return value ? "Действует" : "Не функционирует";

  const normalized = norm(value);
  if (!normalized) return "";

  if (["true", "1", "yes", "да"].includes(normalized)) return "Действует";
  if (["false", "0", "no", "нет"].includes(normalized)) return "Не функционирует";
  return "";
}

function normalizeBooleanLabel(value) {
  if (typeof value === "boolean") return value ? "Да" : "Нет";

  const normalized = norm(value);
  if (!normalized) return "";

  if (["true", "1", "yes", "да"].includes(normalized)) return "Да";
  if (["false", "0", "no", "нет"].includes(normalized)) return "Нет";
  return String(value).trim();
}

function normalizeStatus(value) {
  const booleanStatus = normalizeBooleanStatus(value);
  if (booleanStatus) return booleanStatus;

  const normalized = norm(value);
  if (!normalized) return "Неизвестно";

  if (normalized.includes("не функционир")) return "Не функционирует";
  if (normalized.includes("функцион") || normalized.includes("действ")) return "Действует";
  if (normalized.includes("огранич")) return "Ограничен";
  if (normalized.includes("врем")) return "Временно закрыт";
  if (normalized.includes("закры")) return "Закрыт";
  return "Неизвестно";
}

function dataUrl() {
  return new URL("./data/checkpoints.geojson", window.location.href).toString();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function extractCountry(props) {
  const candidates = [
    props.foreign_country,
    props.neighbor_country,
    props.neighbour_country,
    props.border_country,
    props.country,
    props.country_name,
    props.neighbor_country_name,
    props.neighbour_country_name,
    props.sopredelnoe_gosudarstvo,
    props.sopredelnoe_gosudarstvo_name
  ].filter(Boolean);

  if (candidates.length) return String(candidates.join(", ")).trim();

  const keys = Object.keys(props || {});
  const guessKeys = keys.filter((key) => {
    const normalized = norm(key);
    return (
      normalized.includes("country") ||
      normalized.includes("страна") ||
      normalized.includes("сопред")
    );
  });

  const guessed = guessKeys
    .map((key) => props[key])
    .filter((value) => typeof value === "string" || typeof value === "number")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (guessed.length) return guessed.join(", ");

  return "Не указано";
}

function extractSubject(props) {
  return (
    String(
      props.subject_name ||
        props.subject ||
        props.region_name ||
        props.region ||
        props.rf_subject ||
        props.rf_subject_name ||
        "Не указано"
    ).trim() || "Не указано"
  );
}

function extractExtra(props) {
  const pick = (...keys) => {
    for (const key of keys) {
      if (props[key] !== undefined && props[key] !== null && String(props[key]).trim() !== "") {
        return String(props[key]).trim();
      }
    }

    return "";
  };

  return {
    checkpointId: pick("checkpoint_id", "id", "object_id", "uid"),
    category: pick(
      "checkpoint_pattern",
      "category",
      "checkpoint_category",
      "kind",
      "type_category"
    ),
    checkpointPattern: pick("checkpoint_pattern", "checkpoint_profile", "profile"),
    mode: pick("transport_mode", "mode", "vid_soobshcheniya", "communication_type"),
    road: pick("road_name", "route", "road", "highway"),
    neighborPoint: pick(
      "foreign_checkpoint",
      "neighbor_checkpoint",
      "neighbor_checkpoint_name",
      "sopredelnyi_kpp"
    ),
    operator: pick("operator", "agency", "department", "vedomstvo"),
    address: pick("address", "checkpoint_address", "location_address"),
    workingTime: pick("working_time", "work_time", "schedule", "hours"),
    federalDistrict: pick("federal_district", "district", "federal_district_name"),
    legalStatus: pick("legal_status", "border_status", "status"),
    legalStatusDescription: pick(
      "status_description",
      "legal_status_description",
      "border_status_description"
    ),
    isFunctional: normalizeBooleanLabel(pick("is_functional", "condition", "functional")),
    isPublished: normalizeBooleanLabel(pick("is_published", "publish")),
    slug: pick("checkpoint_slug", "slug"),
    transportCorridor: pick("transport_corridor", "checkpoint_direction", "direction"),
    checkpointNote: pick("checkpoint_note", "note"),
    nearCheckpointCondition: pick("near_checkpoint_condition"),
    workingModeId: pick("checkpoint_working_mode_id", "working_mode_id"),
    directionId: pick("checkpoint_direction_id", "direction_id"),
    branchName: pick("branch_name", "filial_name", "filial"),
    branchPhone: pick("branch_phone", "filial_phone"),
    branchEmail: pick("branch_email", "filial_email"),
    branchAddress: pick("branch_address", "filial_address"),
    branchWorkingTime: pick("branch_working_time", "filial_working_time"),
    branchSlug: pick("branch_slug", "filial_slug"),
    source: pick("source", "source_url", "url", "href"),
    confidence: pick("confidence_level", "confidence", "data_confidence", "quality"),
    updatedAt: pick(
      "updated_at",
      "last_updated",
      "last_update",
      "status_updated_at",
      "date_updated"
    )
  };
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `feature-${Math.random().toString(36).slice(2, 10)}`;
}

function parseUpdatedAt(value) {
  if (!value) return null;

  const raw = String(value).trim();
  const normalized = raw.replace(/\.(\d{3})\d+Z$/, ".$1Z");
  const timestamp = Date.parse(normalized);

  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp);
}

function formatUpdatedAt(date) {
  if (!date) return "Дата не указана";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function buildDatasetMeta(allFeatures) {
  const countries = new Set();
  const subjects = new Set();
  let latestDate = null;

  for (const feature of allFeatures) {
    const props = feature.properties || {};

    if (props.__country && props.__country !== "Не указано") countries.add(props.__country);
    if (props.__subject && props.__subject !== "Не указано") subjects.add(props.__subject);

    const parsedDate = parseUpdatedAt(props.__extra?.updatedAt);
    if (parsedDate && (!latestDate || parsedDate > latestDate)) {
      latestDate = parsedDate;
    }
  }

  return {
    latestUpdatedAt: latestDate ? latestDate.toISOString() : null,
    latestUpdatedLabel: formatUpdatedAt(latestDate),
    countryCount: countries.size,
    subjectCount: subjects.size
  };
}

export async function loadFeatures({ setProgress }) {
  setProgress(20, "Загружаем данные КПП...");
  const response = await fetch(dataUrl(), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить data/checkpoints.geojson (${response.status})`);
  }

  const data = await response.json();
  const features = (data.features || []).filter((feature) => feature?.geometry?.type === "Point");

  return features.map((feature) => {
    const props = feature.properties || {};
    const country = extractCountry(props);
    const subject = extractSubject(props);
    const extra = extractExtra(props);
    const name = String(
      props.checkpoint_name || props.name || props.title || "Без названия"
    ).trim();
    const type = normalizeType(
      props.checkpoint_type || props.type || props.kind || props.transport_type
    );
    const status = normalizeStatus(
      firstNonEmpty(
        props.current_status,
        props.operational_status,
        props.state,
        props.is_functional,
        props.condition
      )
    );
    const lng = Array.isArray(feature.geometry.coordinates)
      ? feature.geometry.coordinates[0]
      : null;
    const lat = Array.isArray(feature.geometry.coordinates)
      ? feature.geometry.coordinates[1]
      : null;
    const hasCoordinates = Number.isFinite(lng) && Number.isFinite(lat);

    return {
      ...feature,
      properties: {
        ...props,
        __id: String(extra.checkpointId || props.checkpoint_id || createId()),
        __name: name,
        __type: type,
        __status: status,
        __country: country,
        __subject: subject,
        __coords: hasCoordinates ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "—",
        __extra: extra,
        __search: norm(
          [
            extra.checkpointId,
            name,
            subject,
            country,
            type,
            status,
            extra.category,
            extra.mode,
            extra.address,
            extra.workingTime,
            extra.federalDistrict,
            extra.legalStatus,
            extra.neighborPoint,
            extra.slug,
            extra.transportCorridor,
            extra.checkpointNote,
            extra.branchName,
            extra.branchPhone,
            extra.branchEmail,
            extra.branchAddress,
            extra.branchSlug
          ]
            .filter(Boolean)
            .join(" | ")
        )
      }
    };
  });
}

export function filterFeatures(
  allFeatures,
  {
    query,
    type = "all",
    status = "all",
    country = "all",
    subject = "all",
    district = "all",
    legalStatus = "all",
    pattern = "all",
    corridor = "all"
  }
) {
  const normalizedQuery = norm(query);

  return allFeatures.filter((feature) => {
    const props = feature.properties;
    const extra = props.__extra || {};

    if (type !== "all" && props.__type !== type) return false;
    if (status !== "all" && props.__status !== status) return false;
    if (country !== "all" && props.__country !== country) return false;
    if (subject !== "all" && props.__subject !== subject) return false;
    if (district !== "all" && extra.federalDistrict !== district) return false;
    if (legalStatus !== "all" && extra.legalStatus !== legalStatus) return false;
    if (pattern !== "all" && extra.checkpointPattern !== pattern) return false;
    if (corridor !== "all" && extra.transportCorridor !== corridor) return false;
    if (!normalizedQuery) return true;

    return [props.__search, props.__enrichmentSearch]
      .filter(Boolean)
      .some((value) => norm(value).includes(normalizedQuery));
  });
}
