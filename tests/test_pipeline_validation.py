import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from pipeline_validation import (  # noqa: E402
    ValidationError,
    analyze_data_quality,
    build_dataset_snapshot,
    build_dataset_version,
    normalize_coordinate_text,
    parse_coordinate,
    summarize_dataset_changes,
    validate_dataset_changelog,
    validate_data_quality,
    validate_geojson,
    validate_raw_payload,
    validate_rows,
)


def make_row(**overrides):
    row = {
        "checkpoint_id": "101",
        "checkpoint_name": "Погранпереход Тест",
        "checkpoint_type": "Автомобильный",
        "status": "Действует",
        "subject_name": "Приморский край",
        "latitude": "43.100000",
        "longitude": "131.900000",
        "source": "https://example.test/source",
        "confidence_level": "high",
        "last_updated": "2026-01-19T09:56:39.000000Z",
    }
    row.update(overrides)
    return row


def make_feature(**overrides):
    properties = {
        "checkpoint_id": "101",
        "checkpoint_name": "Погранпереход Тест",
        "checkpoint_type": "Автомобильный",
        "status": "Действует",
        "subject_name": "Приморский край",
        "source": "https://example.test/source",
        "confidence_level": "high",
        "last_updated": "2026-01-19T09:56:39.000000Z",
    }
    geometry = {
        "type": "Point",
        "coordinates": [131.9, 43.1],
    }
    feature = {
        "type": "Feature",
        "geometry": geometry,
        "properties": properties,
    }

    if "properties" in overrides:
        properties.update(overrides.pop("properties"))
    if "geometry" in overrides:
        geometry.update(overrides.pop("geometry"))
    feature.update(overrides)
    return feature


def make_changelog(features):
    snapshot = build_dataset_snapshot(features)

    return {
        "schemaVersion": 1,
        "entries": [
            {
                "version": build_dataset_version(snapshot),
                "date": "2026-04-14",
                "generatedAt": "2026-04-14T00:00:00+00:00",
                "summary": "Test checkpoint dataset snapshot.",
                "changes": summarize_dataset_changes(None, snapshot),
                "snapshot": snapshot,
            }
        ],
    }


def make_geojson(features):
    return {
        "type": "FeatureCollection",
        "features": list(features),
    }


class PipelineValidationTests(unittest.TestCase):
    def test_validate_raw_payload_returns_data_object(self):
        data = validate_raw_payload({
            "data": {
                "federal_districts": {
                    "central": [],
                }
            }
        })

        self.assertIn("federal_districts", data)

    def test_validate_raw_payload_rejects_missing_top_level_data(self):
        with self.assertRaisesRegex(ValidationError, "top-level 'data' object"):
            validate_raw_payload({})

    def test_normalize_coordinate_text_wraps_antimeridian_values(self):
        self.assertEqual(
            normalize_coordinate_text("190", field_name="longitude"),
            "-170.000000",
        )

    def test_parse_coordinate_normalizes_longitude(self):
        longitude = parse_coordinate("190", field_name="longitude", checkpoint_id="42")
        self.assertEqual(longitude, -170)

    def test_validate_rows_rejects_duplicate_checkpoint_ids(self):
        rows = [
            make_row(checkpoint_id="200"),
            make_row(checkpoint_id="200", checkpoint_name="Другой КПП"),
        ]

        with self.assertRaisesRegex(ValidationError, "Duplicate checkpoint_id"):
            validate_rows(rows)

    def test_validate_rows_rejects_missing_required_fields(self):
        with self.assertRaisesRegex(ValidationError, "missing required fields"):
            validate_rows([make_row(checkpoint_name="")])

    def test_validate_geojson_accepts_valid_feature_collection(self):
        count = validate_geojson({
            "type": "FeatureCollection",
            "features": [make_feature()],
        })

        self.assertEqual(count, 1)

    def test_validate_geojson_rejects_invalid_latitude(self):
        geojson = {
            "type": "FeatureCollection",
            "features": [make_feature(geometry={"coordinates": [131.9, 97.5]})],
        }

        with self.assertRaisesRegex(ValidationError, "out-of-range latitude"):
            validate_geojson(geojson)

    def test_validate_data_quality_rejects_invalid_source_url(self):
        geojson = make_geojson([make_feature(properties={"source": "not-a-url"})])

        with self.assertRaisesRegex(ValidationError, "source"):
            validate_data_quality(geojson)

    def test_validate_data_quality_rejects_unknown_confidence_level(self):
        geojson = make_geojson([make_feature(properties={"confidence_level": "unknown"})])

        with self.assertRaisesRegex(ValidationError, "confidence_level"):
            validate_data_quality(geojson)

    def test_validate_data_quality_rejects_future_update_timestamp(self):
        future_timestamp = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        geojson = make_geojson([make_feature(properties={"last_updated": future_timestamp})])

        with self.assertRaisesRegex(ValidationError, "future"):
            validate_data_quality(geojson)

    def test_analyze_data_quality_reports_low_precision_coordinates(self):
        geojson = make_geojson(
            [
                make_feature(
                    geometry={"coordinates": [131.9, 43.1]},
                    properties={"checkpoint_type": "Автомобильный пункт пропуска"},
                )
            ]
        )
        report = analyze_data_quality(geojson)

        self.assertEqual(report["summary"]["errorCount"], 0)
        self.assertTrue(
            any("low precision" in warning for warning in report["warnings"])
        )

    def test_analyze_data_quality_reports_duplicate_coordinates(self):
        geojson = make_geojson(
            [
                make_feature(properties={"checkpoint_id": "101"}),
                make_feature(properties={"checkpoint_id": "102"}),
            ]
        )
        report = analyze_data_quality(geojson)

        self.assertTrue(
            any("Duplicate coordinate pair" in warning for warning in report["warnings"])
        )

    def test_validate_dataset_changelog_accepts_current_file(self):
        geojson = json.loads(
            (ROOT / "data/checkpoints.geojson").read_text(encoding="utf-8")
        )
        changelog = json.loads(
            (ROOT / "data/dataset_changelog.json").read_text(encoding="utf-8")
        )

        self.assertGreater(validate_dataset_changelog(changelog, geojson), 0)

    def test_validate_dataset_changelog_rejects_tampered_ids_hash(self):
        geojson = {
            "type": "FeatureCollection",
            "features": [make_feature()],
        }
        changelog = make_changelog(geojson["features"])
        changelog["entries"][0]["snapshot"]["idsHash"] = "bad-hash"

        with self.assertRaisesRegex(ValidationError, "idsHash"):
            validate_dataset_changelog(changelog, geojson)

    def test_validate_dataset_changelog_rejects_stale_snapshot(self):
        geojson = {
            "type": "FeatureCollection",
            "features": [make_feature()],
        }
        stale_geojson = {
            "type": "FeatureCollection",
            "features": [make_feature(properties={"checkpoint_id": "202"})],
        }
        changelog = make_changelog(geojson["features"])

        with self.assertRaisesRegex(ValidationError, "current GeoJSON"):
            validate_dataset_changelog(changelog, stale_geojson)


if __name__ == "__main__":
    unittest.main()
