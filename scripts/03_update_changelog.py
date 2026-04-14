import json
from datetime import datetime, timezone
from pathlib import Path

from pipeline_validation import (
    build_dataset_snapshot,
    build_dataset_version,
    summarize_dataset_changes,
    validate_dataset_changelog,
)

GEOJSON_PATH = Path("data/checkpoints.geojson")
CHANGELOG_PATH = Path("data/dataset_changelog.json")


def load_json(path, default):
    if not path.exists():
        return default

    return json.loads(path.read_text(encoding="utf-8"))


def main():
    geojson = load_json(GEOJSON_PATH, {"features": []})
    features = geojson.get("features") or []
    changelog = load_json(CHANGELOG_PATH, {"schemaVersion": 1, "entries": []})
    entries = changelog.setdefault("entries", [])
    current_snapshot = build_dataset_snapshot(features)
    version = build_dataset_version(current_snapshot)

    if entries and entries[0].get("version") == version:
        validate_dataset_changelog(changelog, geojson)
        print(f"Changelog already contains current dataset version: {version}")
        return

    previous_snapshot = entries[0].get("snapshot") if entries else None
    entry = {
        "version": version,
        "date": datetime.now(timezone.utc).date().isoformat(),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": "Automated checkpoint dataset snapshot.",
        "changes": summarize_dataset_changes(previous_snapshot, current_snapshot),
        "snapshot": current_snapshot,
    }

    entries.insert(0, entry)
    validate_dataset_changelog(changelog, geojson)
    CHANGELOG_PATH.write_text(
        json.dumps(changelog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Added dataset changelog version: {version}")


if __name__ == "__main__":
    main()
