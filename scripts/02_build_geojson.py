import csv
import json
from pathlib import Path

from pipeline_validation import (
    ValidationError,
    parse_coordinate,
    tqdm,
    validate_geojson,
    validate_rows,
)

INPUT_FILE = Path("data/checkpoints_v1.csv")
OUTPUT_FILE = Path("data/checkpoints.geojson")

def main():
    print("=== STEP 3. Build final GeoJSON ===")
    print("CSV source:", INPUT_FILE.resolve())

    rows = list(csv.DictReader(INPUT_FILE.open(encoding="utf-8")))
    print("Rows in CSV:", len(rows))
    validate_rows(rows)

    features = []

    for row in tqdm(rows, total=len(rows), desc="Building GeoJSON", unit="row"):
        checkpoint_id = str(row["checkpoint_id"]).strip()
        lat = parse_coordinate(row["latitude"], field_name="latitude", checkpoint_id=checkpoint_id)
        lon = parse_coordinate(row["longitude"], field_name="longitude", checkpoint_id=checkpoint_id)

        props = dict(row)
        props.pop("latitude", None)
        props.pop("longitude", None)

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [round(lon, 6), round(lat, 6)],
            },
            "properties": props,
        })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }
    validate_geojson(geojson)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(
        json.dumps(geojson, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("Final file:", OUTPUT_FILE.resolve())
    print("Features written:", len(features))
    print("GeoJSON validation passed.")
    print("=== STEP 3 completed ===")


if __name__ == "__main__":
    try:
        main()
    except ValidationError as exc:
        print(f"Validation failed: {exc}")
        raise SystemExit(1) from exc
