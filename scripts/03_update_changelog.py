import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

GEOJSON_PATH = Path("data/checkpoints.geojson")
CHANGELOG_PATH = Path("data/dataset_changelog.json")


def load_json(path, default):
    if not path.exists():
        return default

    return json.loads(path.read_text(encoding="utf-8"))


def feature_id(feature):
    props = feature.get("properties") or {}
    return str(props.get("checkpoint_id") or props.get("__id") or "").strip()


def count_by(features, key):
    counts = {}

    for feature in features:
        props = feature.get("properties") or {}
        value = str(props.get(key) or "Не указано").strip() or "Не указано"
        counts[value] = counts.get(value, 0) + 1

    return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))


def build_snapshot(features):
    ids = sorted({feature_id(feature) for feature in features if feature_id(feature)})
    latest_updated_at = max(
        (str((feature.get("properties") or {}).get("last_updated") or "") for feature in features),
        default="",
    )
    ids_hash = hashlib.sha256("\n".join(ids).encode("utf-8")).hexdigest()

    return {
        "total": len(features),
        "ids": ids,
        "idsHash": ids_hash,
        "latestUpdatedAt": latest_updated_at or None,
        "byStatus": count_by(features, "status"),
        "byType": count_by(features, "checkpoint_type"),
    }


def build_version(snapshot):
    date_part = (snapshot["latestUpdatedAt"] or "unknown-date")[:10]
    return f"{date_part}-{snapshot['total']}-{snapshot['idsHash'][:8]}"


def summarize_changes(previous_snapshot, current_snapshot):
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


def main():
    geojson = load_json(GEOJSON_PATH, {"features": []})
    features = geojson.get("features") or []
    changelog = load_json(CHANGELOG_PATH, {"schemaVersion": 1, "entries": []})
    entries = changelog.setdefault("entries", [])
    current_snapshot = build_snapshot(features)
    version = build_version(current_snapshot)

    if entries and entries[0].get("version") == version:
        print(f"Changelog already contains current dataset version: {version}")
        return

    previous_snapshot = entries[0].get("snapshot") if entries else None
    entry = {
        "version": version,
        "date": datetime.now(timezone.utc).date().isoformat(),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": "Automated checkpoint dataset snapshot.",
        "changes": summarize_changes(previous_snapshot, current_snapshot),
        "snapshot": current_snapshot,
    }

    entries.insert(0, entry)
    CHANGELOG_PATH.write_text(
        json.dumps(changelog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Added dataset changelog version: {version}")


if __name__ == "__main__":
    main()
