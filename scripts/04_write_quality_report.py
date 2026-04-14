import json
from pathlib import Path

from pipeline_validation import (
    ValidationError,
    analyze_data_quality,
    build_dataset_snapshot,
    build_dataset_version,
)

GEOJSON_PATH = Path("data/checkpoints.geojson")
QUALITY_REPORT_PATH = Path("data/data_quality_report.json")


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    print("=== STEP 5. Write data quality report ===")
    geojson = load_json(GEOJSON_PATH)
    snapshot = build_dataset_snapshot(geojson.get("features") or [])
    report = analyze_data_quality(geojson)

    if report["errors"]:
        raise ValidationError("Data quality report contains blocking errors.")

    payload = {
        "schemaVersion": 1,
        "datasetVersion": build_dataset_version(snapshot),
        "generatedFrom": GEOJSON_PATH.as_posix(),
        "latestUpdatedAt": snapshot["latestUpdatedAt"],
        "summary": report["summary"],
        "warnings": report["warnings"],
        "errors": report["errors"],
    }

    QUALITY_REPORT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("Quality report:", QUALITY_REPORT_PATH.resolve())
    print("Warnings:", report["summary"]["warningCount"])
    print("Errors:", report["summary"]["errorCount"])
    print("=== STEP 5 completed ===")


if __name__ == "__main__":
    try:
        main()
    except ValidationError as exc:
        print(f"Validation failed: {exc}")
        raise SystemExit(1) from exc
