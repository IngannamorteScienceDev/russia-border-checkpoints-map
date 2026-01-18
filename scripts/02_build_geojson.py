import csv
import json
from pathlib import Path

INPUT_FILE = Path("data/checkpoints_v1.csv")
OUTPUT_FILE = Path("data/checkpoints_v1.geojson")


def is_float(value):
    try:
        float(value)
        return True
    except (TypeError, ValueError):
        return False


def main():
    features = []

    with INPUT_FILE.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            lat = row.get("latitude")
            lon = row.get("longitude")

            if not (is_float(lat) and is_float(lon)):
                continue

            properties = dict(row)
            properties.pop("latitude", None)
            properties.pop("longitude", None)

            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(lon), float(lat)],
                },
                "properties": properties,
            }

            features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    print(f"✅ GeoJSON created: {OUTPUT_FILE}")
    print(f"📍 Features count: {len(features)}")


if __name__ == "__main__":
    main()
