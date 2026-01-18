import csv
import json
import shutil
from pathlib import Path
from tqdm import tqdm

INPUT_FILE = Path("data/checkpoints_v1.csv")
OUTPUT_FILE = Path("data/checkpoints_v1.geojson")
FRONTEND_COPY = Path("frontend/data/checkpoints.geojson")


def is_float(v):
    try:
        float(v)
        return True
    except Exception:
        return False


def main():
    features = []

    rows = list(csv.DictReader(INPUT_FILE.open(encoding="utf-8")))

    print("🗺 Building GeoJSON")

    with tqdm(total=len(rows), desc="Processing checkpoints") as pbar:
        for row in rows:
            lat, lon = row.get("latitude"), row.get("longitude")

            if not (is_float(lat) and is_float(lon)):
                pbar.update(1)
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

            pbar.update(1)

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(
        json.dumps(geojson, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # 🔁 Автокопирование во frontend
    FRONTEND_COPY.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OUTPUT_FILE, FRONTEND_COPY)

    print(f"✅ GeoJSON saved → {OUTPUT_FILE}")
    print(f"🔁 Copied to frontend → {FRONTEND_COPY}")
    print(f"📍 Features count: {len(features)}")


if __name__ == "__main__":
    main()
