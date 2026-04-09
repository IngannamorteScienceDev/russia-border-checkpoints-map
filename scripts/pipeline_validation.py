from collections import Counter

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

    return len(features)
