function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function sanitizeFilePart(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "all"
  );
}

function buildBaseName({ count, hasFilters }) {
  const date = new Date().toISOString().slice(0, 10);
  const scope = hasFilters ? "filtered" : "all";
  return `checkpoints-${scope}-${count}-${date}`;
}

function cleanProperties(feature) {
  const props = feature.properties || {};
  const extra = props.__extra || {};
  const coordinates = Array.isArray(feature.geometry?.coordinates)
    ? feature.geometry.coordinates
    : [null, null];

  return {
    checkpoint_id: props.checkpoint_id || props.__id || "",
    checkpoint_name: props.__name || props.checkpoint_name || "",
    checkpoint_type: props.__type || props.checkpoint_type || "",
    status: props.__status || props.status || "",
    legal_status: extra.legalStatus || props.status || "",
    legal_status_description: extra.legalStatusDescription || props.status_description || "",
    is_functional: extra.isFunctional || props.is_functional || "",
    is_published: extra.isPublished || props.is_published || "",
    checkpoint_pattern: extra.checkpointPattern || props.checkpoint_pattern || "",
    subject_name: props.__subject || props.subject_name || "",
    federal_district: extra.federalDistrict || props.federal_district || "",
    country: props.__country || "",
    foreign_checkpoint: extra.neighborPoint || props.foreign_checkpoint || "",
    address: extra.address || props.address || "",
    working_time: extra.workingTime || props.working_time || "",
    latitude: coordinates[1] ?? "",
    longitude: coordinates[0] ?? "",
    coordinates: props.__coords || "",
    last_updated: extra.updatedAt || props.last_updated || "",
    source: props.source || "",
    confidence_level: props.confidence_level || "",
    category: extra.category || "",
    mode: extra.mode || "",
    road: extra.road || "",
    neighbor_checkpoint: extra.neighborPoint || "",
    checkpoint_slug: extra.slug || props.checkpoint_slug || "",
    operator: extra.operator || ""
  };
}

function downloadText(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportFeaturesAsCsv(features, options = {}) {
  const rows = features.map(cleanProperties);
  const headers = Object.keys(
    rows[0] || cleanProperties({ properties: {}, geometry: { coordinates: [] } })
  );
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","))
  ].join("\n");

  const baseName = buildBaseName({
    count: features.length,
    hasFilters: Boolean(options.hasFilters)
  });

  downloadText(`${sanitizeFilePart(baseName)}.csv`, csv, "text/csv;charset=utf-8");
}

export function exportFeaturesAsGeoJson(features, options = {}) {
  const collection = {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [...feature.geometry.coordinates]
      },
      properties: cleanProperties(feature)
    }))
  };

  const baseName = buildBaseName({
    count: features.length,
    hasFilters: Boolean(options.hasFilters)
  });

  downloadText(
    `${sanitizeFilePart(baseName)}.geojson`,
    JSON.stringify(collection, null, 2),
    "application/geo+json;charset=utf-8"
  );
}
