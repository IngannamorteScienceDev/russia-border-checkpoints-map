import csv
import json
from pathlib import Path

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable=None, total=None, **kwargs):
        if iterable is None:
            return range(total or 0)
        return iterable

INPUT_FILE = Path("data/checkpoints_v1.csv")
OUTPUT_FILE = Path("data/checkpoints.geojson")


def is_float(value):
    try:
        float(value)
        return True
    except Exception:
        return False


def main():
    print("=== STEP 3. Build final GeoJSON ===")
    print("CSV source:", INPUT_FILE.resolve())

    rows = list(csv.DictReader(INPUT_FILE.open(encoding="utf-8")))
    print("Rows in CSV:", len(rows))

    features = []
    skipped = 0

    for row in tqdm(rows, total=len(rows), desc="Building GeoJSON", unit="row"):
        lat, lon = row.get("latitude"), row.get("longitude")

        if not (is_float(lat) and is_float(lon)):
            skipped += 1
            continue

        props = dict(row)
        props.pop("latitude", None)
        props.pop("longitude", None)

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(lon), float(lat)],
            },
            "properties": props,
        })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(
        json.dumps(geojson, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("Final file:", OUTPUT_FILE.resolve())
    print("Features written:", len(features))
    print("Skipped without coordinates:", skipped)
    print("=== STEP 3 completed ===")


if __name__ == "__main__":
    main()
