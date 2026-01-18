import csv
import json
import shutil
from pathlib import Path
from tqdm import tqdm

INPUT_FILE = Path("data/checkpoints_v1.csv")
OUTPUT_FILE = Path("data/checkpoints_v1.geojson")
FRONTEND_COPY = Path("frontend/data/checkpoints.geojson")


def is_float(value):
    try:
        float(value)
        return True
    except Exception:
        return False


def main():
    print("══════════════════════════════════════════════")
    print("🗺 ШАГ 3. Формирование GeoJSON для карты")
    print("Источник CSV:", INPUT_FILE.resolve())
    print("══════════════════════════════════════════════\n")

    rows = list(csv.DictReader(INPUT_FILE.open(encoding="utf-8")))
    print("📊 Записей в CSV:", len(rows))

    features = []
    skipped = 0

    print("\n⏳ Преобразование записей в GeoJSON…\n")

    with tqdm(total=len(rows), desc="Создание геообъектов", unit="КПП") as pbar:
        for row in rows:
            lat, lon = row.get("latitude"), row.get("longitude")

            if not (is_float(lat) and is_float(lon)):
                skipped += 1
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

    FRONTEND_COPY.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OUTPUT_FILE, FRONTEND_COPY)

    print("\n💾 GeoJSON успешно создан")
    print("📄 Основной файл:", OUTPUT_FILE.resolve())
    print("🔁 Копия для frontend:", FRONTEND_COPY.resolve())
    print("📍 Геообъектов создано:", len(features))
    print("⚠️ Пропущено без координат:", skipped)
    print("══════════════════════════════════════════════")
    print("🏁 ШАГ 3 ЗАВЕРШЁН\n")


if __name__ == "__main__":
    main()
