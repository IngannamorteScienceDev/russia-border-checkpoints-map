import hashlib
from collections import Counter
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

UNKNOWN_LABEL = "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e"
ALLOWED_CONFIDENCE_LEVELS = {"high", "medium", "low"}
CHECKPOINT_TYPE_MARKER = "\u043f\u0443\u043d\u043a\u0442 \u043f\u0440\u043e\u043f\u0443\u0441\u043a\u0430"
FUTURE_DATE_TOLERANCE = timedelta(days=1)

try:
    from tqdm import tqdm as _tqdm
except ImportError:
    class _TqdmFallback:
        def __init__(self, total=None):
            self.total = total or 0

        def update(self, step=1):
            return None

        def close(self):
            return None

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    def tqdm(iterable=None, total=None, **kwargs):
        if iterable is None:
            return _TqdmFallback(total=total)
        return iterable
else:
    tqdm = _tqdm


class ValidationError(ValueError):
    """Raised when the pipeline detects malformed or inconsistent data."""


def _clean(value):
    return str(value or "").strip()


def _preview(items, limit=5):
    shown = list(items[:limit])
    if not shown:
        return "none"

    preview = ", ".join(shown)
    remainder = len(items) - len(shown)

    if remainder > 0:
        preview += f" (+{remainder} more)"

    return preview


def _parse_iso_datetime(value):
    text = _clean(value)
    if not text:
        return None

    normalized = text.replace("Z", "+00:00")

    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def _is_http_url(value):
    parsed = urlparse(_clean(value))
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _decimal_places(value):
    text = f"{value:.10f}".rstrip("0").rstrip(".")
    if "." not in text:
        return 0

    return len(text.rsplit(".", 1)[1])


def _feature_id(feature):
    properties = feature.get("properties") or {}
    return _clean(properties.get("checkpoint_id") or properties.get("__id"))


def _count_features_by(features, key):
    counts = {}

    for feature in features:
        properties = feature.get("properties") or {}
        value = _clean(properties.get(key)) or UNKNOWN_LABEL
        counts[value] = counts.get(value, 0) + 1

    return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))


def _validate_count_map(counts, total, context):
    if not isinstance(counts, dict):
        raise ValidationError(f"{context} must be an object.")

    invalid_values = [
        key
        for key, value in counts.items()
        if not isinstance(value, int) or isinstance(value, bool) or value < 0
    ]

    if invalid_values:
        raise ValidationError(
            f"{context} contains invalid counts: "
            + _preview([str(key) for key in invalid_values])
        )

    if sum(counts.values()) != total:
        raise ValidationError(f"{context} counts must sum to snapshot total.")


def _validate_changelog_snapshot(snapshot, context):
    if not isinstance(snapshot, dict):
        raise ValidationError(f"{context} snapshot must be an object.")

    total = snapshot.get("total")
    if not isinstance(total, int) or isinstance(total, bool) or total < 0:
        raise ValidationError(f"{context} snapshot total must be a non-negative integer.")

    ids = snapshot.get("ids")
    if not isinstance(ids, list):
        raise ValidationError(f"{context} snapshot ids must be a list.")

    cleaned_ids = [_clean(item) for item in ids]
    if any(not item for item in cleaned_ids):
        raise ValidationError(f"{context} snapshot ids must not contain empty values.")

    if cleaned_ids != ids:
        raise ValidationError(f"{context} snapshot ids must be strings without padding.")

    if cleaned_ids != sorted(cleaned_ids):
        raise ValidationError(f"{context} snapshot ids must be sorted.")

    if len(set(cleaned_ids)) != len(cleaned_ids):
        raise ValidationError(f"{context} snapshot ids must be unique.")

    if total != len(cleaned_ids):
        raise ValidationError(f"{context} snapshot total must match ids length.")

    expected_hash = hashlib.sha256("\n".join(cleaned_ids).encode("utf-8")).hexdigest()
    if snapshot.get("idsHash") != expected_hash:
        raise ValidationError(f"{context} snapshot idsHash does not match ids.")

    latest_updated_at = snapshot.get("latestUpdatedAt")
    if latest_updated_at is not None and not _clean(latest_updated_at):
        raise ValidationError(f"{context} snapshot latestUpdatedAt must be a string or null.")

    _validate_count_map(snapshot.get("byStatus"), total, f"{context} snapshot byStatus")
    _validate_count_map(snapshot.get("byType"), total, f"{context} snapshot byType")


def build_dataset_snapshot(features):
    ids = sorted({_feature_id(feature) for feature in features if _feature_id(feature)})
    latest_updated_at = max(
        (
            _clean((feature.get("properties") or {}).get("last_updated"))
            for feature in features
        ),
        default="",
    )
    ids_hash = hashlib.sha256("\n".join(ids).encode("utf-8")).hexdigest()

    return {
        "total": len(features),
        "ids": ids,
        "idsHash": ids_hash,
        "latestUpdatedAt": latest_updated_at or None,
        "byStatus": _count_features_by(features, "status"),
        "byType": _count_features_by(features, "checkpoint_type"),
    }


def build_dataset_version(snapshot):
    date_part = (snapshot["latestUpdatedAt"] or "unknown-date")[:10]
    return f"{date_part}-{snapshot['total']}-{snapshot['idsHash'][:8]}"


def summarize_dataset_changes(previous_snapshot, current_snapshot):
    if not previous_snapshot:
        return {
            "totalDelta": current_snapshot["total"],
            "added": current_snapshot["total"],
            "removed": 0,
        }

    previous_ids = set(previous_snapshot.get("ids") or [])
    current_ids = set(current_snapshot.get("ids") or [])

    return {
        "totalDelta": current_snapshot["total"] - int(previous_snapshot.get("total") or 0),
        "added": len(current_ids - previous_ids),
        "removed": len(previous_ids - current_ids),
    }


def normalize_longitude(coordinate):
    if -180 <= coordinate <= 180:
        return coordinate
    return ((coordinate + 180) % 360) - 180


def normalize_coordinate_text(value, *, field_name):
    text = _clean(value)
    if not text:
        return text

    try:
        coordinate = float(text)
    except (TypeError, ValueError):
        return text

    if field_name == "longitude":
        normalized = normalize_longitude(coordinate)
        if normalized != coordinate:
            return f"{normalized:.6f}"

    return text


def validate_raw_payload(raw):
    if not isinstance(raw, dict):
        raise ValidationError("Raw payload must be a JSON object.")

    data = raw.get("data")
    if not isinstance(data, dict):
        raise ValidationError("Raw payload is missing the top-level 'data' object.")

    federal_districts = data.get("federal_districts")
    if not isinstance(federal_districts, dict) or not federal_districts:
        raise ValidationError("Raw payload is missing 'data.federal_districts' or it is empty.")

    return data


def parse_coordinate(value, *, field_name, checkpoint_id):
    text = _clean(value)
    if not text:
        raise ValidationError(f"Checkpoint {checkpoint_id} is missing {field_name}.")

    try:
        coordinate = float(text)
    except (TypeError, ValueError) as exc:
        raise ValidationError(
            f"Checkpoint {checkpoint_id} has invalid {field_name}: {value!r}"
        ) from exc

    if field_name == "latitude" and not -90 <= coordinate <= 90:
        raise ValidationError(
            f"Checkpoint {checkpoint_id} has out-of-range latitude: {coordinate}"
        )

    if field_name == "longitude":
        coordinate = normalize_longitude(coordinate)

    return coordinate


def validate_rows(rows):
    if not rows:
        raise ValidationError("No checkpoint rows were produced.")

    required_fields = (
        "checkpoint_id",
        "checkpoint_name",
        "checkpoint_type",
        "status",
        "subject_name",
        "latitude",
        "longitude",
        "source",
        "confidence_level",
        "last_updated",
    )

    missing_fields = []
    duplicate_ids = Counter()

    for index, row in enumerate(rows, start=1):
        checkpoint_id = _clean(row.get("checkpoint_id")) or f"row {index}"

        for field_name in required_fields:
            if not _clean(row.get(field_name)):
                missing_fields.append(f"{checkpoint_id}: {field_name}")

        if _clean(row.get("checkpoint_id")):
            duplicate_ids[_clean(row["checkpoint_id"])] += 1

    if missing_fields:
        raise ValidationError(
            "Rows are missing required fields: "
            + _preview(missing_fields)
        )

    duplicates = [checkpoint_id for checkpoint_id, count in duplicate_ids.items() if count > 1]
    if duplicates:
        raise ValidationError(
            "Duplicate checkpoint_id values detected: "
            + _preview(duplicates)
        )

    for row in rows:
        checkpoint_id = _clean(row["checkpoint_id"])
        parse_coordinate(row["latitude"], field_name="latitude", checkpoint_id=checkpoint_id)
        parse_coordinate(row["longitude"], field_name="longitude", checkpoint_id=checkpoint_id)

    return len(rows)


def analyze_data_quality(geojson):
    features = geojson.get("features") if isinstance(geojson, dict) else []
    errors = []
    warnings = []
    coordinate_index = {}
    now = datetime.now(timezone.utc)

    for index, feature in enumerate(features or [], start=1):
        properties = feature.get("properties") or {}
        coordinates = (feature.get("geometry") or {}).get("coordinates") or []
        checkpoint_id = _clean(properties.get("checkpoint_id")) or f"feature {index}"

        source = _clean(properties.get("source"))
        if source and not _is_http_url(source):
            errors.append(f"{checkpoint_id}: source must be an http(s) URL")

        confidence_level = _clean(properties.get("confidence_level")).lower()
        if confidence_level and confidence_level not in ALLOWED_CONFIDENCE_LEVELS:
            errors.append(
                f"{checkpoint_id}: confidence_level must be one of "
                + ", ".join(sorted(ALLOWED_CONFIDENCE_LEVELS))
            )

        updated_at = _parse_iso_datetime(properties.get("last_updated"))
        if properties.get("last_updated") and updated_at is None:
            errors.append(f"{checkpoint_id}: last_updated must be an ISO datetime")
        elif updated_at and updated_at > now + FUTURE_DATE_TOLERANCE:
            errors.append(f"{checkpoint_id}: last_updated is unexpectedly in the future")

        if len(coordinates) == 2:
            longitude, latitude = coordinates
            coordinate_key = (round(float(longitude), 5), round(float(latitude), 5))
            coordinate_index.setdefault(coordinate_key, []).append(checkpoint_id)

            if abs(float(latitude)) < 1 and abs(float(longitude)) < 1:
                errors.append(f"{checkpoint_id}: coordinates look like a null island placeholder")

            if _decimal_places(float(latitude)) < 3 or _decimal_places(float(longitude)) < 3:
                warnings.append(f"{checkpoint_id}: coordinates have low precision")

            if not 35 <= float(latitude) <= 83:
                warnings.append(f"{checkpoint_id}: latitude is outside the expected Russia range")

        checkpoint_type = _clean(properties.get("checkpoint_type"))
        if checkpoint_type and CHECKPOINT_TYPE_MARKER not in checkpoint_type.lower():
            warnings.append(f"{checkpoint_id}: checkpoint_type has an unexpected label")

    duplicate_coordinates = [
        f"{coordinate}: {', '.join(ids)}"
        for coordinate, ids in coordinate_index.items()
        if len(ids) > 1
    ]
    warnings.extend(
        f"Duplicate coordinate pair detected: {item}" for item in duplicate_coordinates
    )

    return {
        "errors": errors,
        "warnings": warnings,
        "summary": {
            "checked": len(features or []),
            "errorCount": len(errors),
            "warningCount": len(warnings),
        },
    }


def validate_data_quality(geojson):
    report = analyze_data_quality(geojson)

    if report["errors"]:
        raise ValidationError("Advanced data quality errors: " + _preview(report["errors"]))

    return report


def validate_geojson(geojson):
    if not isinstance(geojson, dict):
        raise ValidationError("GeoJSON output must be a JSON object.")

    if geojson.get("type") != "FeatureCollection":
        raise ValidationError("GeoJSON output must have type 'FeatureCollection'.")

    features = geojson.get("features")
    if not isinstance(features, list) or not features:
        raise ValidationError("GeoJSON output must contain a non-empty 'features' list.")

    required_properties = (
        "checkpoint_id",
        "checkpoint_name",
        "checkpoint_type",
        "status",
        "subject_name",
        "source",
        "confidence_level",
        "last_updated",
    )

    missing_properties = []
    duplicate_ids = Counter()

    for index, feature in enumerate(features, start=1):
        if feature.get("type") != "Feature":
            raise ValidationError(f"Feature {index} is missing type 'Feature'.")

        geometry = feature.get("geometry")
        if not isinstance(geometry, dict):
            raise ValidationError(f"Feature {index} is missing a geometry object.")

        if geometry.get("type") != "Point":
            raise ValidationError(f"Feature {index} must use Point geometry.")

        coordinates = geometry.get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) != 2:
            raise ValidationError(f"Feature {index} must contain two coordinates.")

        properties = feature.get("properties")
        if not isinstance(properties, dict):
            raise ValidationError(f"Feature {index} is missing a properties object.")

        checkpoint_id = _clean(properties.get("checkpoint_id")) or f"feature {index}"

        for field_name in required_properties:
            if not _clean(properties.get(field_name)):
                missing_properties.append(f"{checkpoint_id}: {field_name}")

        if _clean(properties.get("checkpoint_id")):
            duplicate_ids[_clean(properties["checkpoint_id"])] += 1

        parse_coordinate(coordinates[1], field_name="latitude", checkpoint_id=checkpoint_id)
        parse_coordinate(coordinates[0], field_name="longitude", checkpoint_id=checkpoint_id)

    if missing_properties:
        raise ValidationError(
            "GeoJSON features are missing required properties: "
            + _preview(missing_properties)
        )

    duplicates = [checkpoint_id for checkpoint_id, count in duplicate_ids.items() if count > 1]
    if duplicates:
        raise ValidationError(
            "GeoJSON contains duplicate checkpoint_id values: "
            + _preview(duplicates)
        )

    validate_data_quality(geojson)

    return len(features)


def validate_dataset_changelog(changelog, geojson=None):
    if not isinstance(changelog, dict):
        raise ValidationError("Dataset changelog must be a JSON object.")

    if changelog.get("schemaVersion") != 1:
        raise ValidationError("Dataset changelog schemaVersion must be 1.")

    entries = changelog.get("entries")
    if not isinstance(entries, list) or not entries:
        raise ValidationError("Dataset changelog must contain a non-empty entries list.")

    seen_versions = set()

    for index, entry in enumerate(entries, start=1):
        context = f"Dataset changelog entry {index}"

        if not isinstance(entry, dict):
            raise ValidationError(f"{context} must be an object.")

        version = _clean(entry.get("version"))
        if not version:
            raise ValidationError(f"{context} is missing version.")

        if version in seen_versions:
            raise ValidationError(f"Dataset changelog contains duplicate version: {version}")
        seen_versions.add(version)

        for field_name in ("date", "generatedAt", "summary"):
            if not _clean(entry.get(field_name)):
                raise ValidationError(f"{context} is missing {field_name}.")

        snapshot = entry.get("snapshot")
        _validate_changelog_snapshot(snapshot, context)

        expected_version = build_dataset_version(snapshot)
        if version != expected_version:
            raise ValidationError(
                f"{context} version does not match snapshot: "
                f"expected {expected_version}, got {version}"
            )

        changes = entry.get("changes")
        if not isinstance(changes, dict):
            raise ValidationError(f"{context} changes must be an object.")

        required_change_fields = ("totalDelta", "added", "removed")
        for field_name in required_change_fields:
            value = changes.get(field_name)
            if not isinstance(value, int) or isinstance(value, bool):
                raise ValidationError(f"{context} changes.{field_name} must be an integer.")

        previous_snapshot = entries[index].get("snapshot") if index < len(entries) else None
        expected_changes = summarize_dataset_changes(previous_snapshot, snapshot)

        for field_name, expected_value in expected_changes.items():
            if changes[field_name] != expected_value:
                raise ValidationError(
                    f"{context} changes.{field_name} does not match snapshots: "
                    f"expected {expected_value}, got {changes[field_name]}"
                )

    if geojson is not None:
        if not isinstance(geojson, dict):
            raise ValidationError("GeoJSON input for changelog validation must be an object.")

        features = geojson.get("features")
        if not isinstance(features, list):
            raise ValidationError("GeoJSON input for changelog validation is missing features.")

        current_snapshot = build_dataset_snapshot(features)
        current_entry = entries[0]

        if current_entry.get("snapshot") != current_snapshot:
            raise ValidationError(
                "Dataset changelog first entry snapshot does not match current GeoJSON."
            )

        expected_version = build_dataset_version(current_snapshot)
        if current_entry.get("version") != expected_version:
            raise ValidationError(
                "Dataset changelog first entry version does not match current GeoJSON."
            )

    return len(entries)
