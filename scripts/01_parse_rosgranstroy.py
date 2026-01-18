import json
import csv
from pathlib import Path
from tqdm import tqdm

INPUT_FILE = Path("raw_data/rosgranstroy_map_data.json")
OUTPUT_FILE = Path("data/checkpoints_v1.csv")

CSV_COLUMNS = [
    "checkpoint_id",
    "checkpoint_name",
    "checkpoint_slug",
    "checkpoint_type",
    "checkpoint_pattern",
    "status",
    "status_description",
    "is_functional",
    "is_published",
    "working_time",
    "latitude",
    "longitude",
    "address",
    "subject_name",
    "federal_district",
    "foreign_country",
    "foreign_checkpoint",
    "source",
    "confidence_level",
    "last_updated",
]


def safe_get(obj, *keys):
    for key in keys:
        if not isinstance(obj, dict):
            return ""
        obj = obj.get(key)
    return obj if obj is not None else ""


def main():
    print("══════════════════════════════════════════════")
    print("🧩 ШАГ 2. Разбор и нормализация данных Росгранстроя")
    print("Источник:", INPUT_FILE.resolve())
    print("══════════════════════════════════════════════\n")

    raw = json.loads(INPUT_FILE.read_text(encoding="utf-8"))
    data = raw.get("data", {})
    federal_districts = data.get("federal_districts", {})

    print("📂 Обнаружено федеральных округов:", len(federal_districts))

    rows = []

    subjects_total = sum(
        len(subjects)
        for subjects in federal_districts.values()
        if isinstance(subjects, list)
    )

    print("🏘 Всего субъектов РФ в данных:", subjects_total)
    print("\n⏳ Начинаем обработку субъектов и пунктов пропуска…\n")

    with tqdm(total=subjects_total, desc="Обработка субъектов", unit="субъект") as pbar:
        for subjects in federal_districts.values():
            if not isinstance(subjects, list):
                continue

            for subject in subjects:
                subject_name = safe_get(subject, "title", "ru")
                federal_district = safe_get(subject, "federal_district", "title", "ru")

                checkpoints = subject.get("checkpoints", [])
                print(f"➡️  {subject_name}: найдено КПП — {len(checkpoints)}")

                for checkpoint in checkpoints:
                    rows.append({
                        "checkpoint_id": checkpoint.get("id", ""),
                        "checkpoint_name": safe_get(checkpoint, "title", "ru"),
                        "checkpoint_slug": checkpoint.get("slug", ""),
                        "checkpoint_type": safe_get(checkpoint, "checkpoint_type", "title", "ru"),
                        "checkpoint_pattern": safe_get(checkpoint, "checkpoint_pattern", "title", "ru"),
                        "status": safe_get(checkpoint, "status", "title", "ru"),
                        "status_description": safe_get(checkpoint, "status", "description", "ru"),
                        "is_functional": checkpoint.get("condition", ""),
                        "is_published": checkpoint.get("publish", ""),
                        "working_time": safe_get(checkpoint, "working_time", "ru"),
                        "latitude": checkpoint.get("latitude", ""),
                        "longitude": checkpoint.get("longitude", ""),
                        "address": safe_get(checkpoint, "address", "ru"),
                        "subject_name": subject_name,
                        "federal_district": federal_district,
                        "foreign_country": safe_get(checkpoint, "foreign_country", "title", "ru"),
                        "foreign_checkpoint": safe_get(checkpoint, "foreign_checkpoint", "ru"),
                        "source": "https://rosgranstroy.ru/api/map_data",
                        "confidence_level": "high",
                        "last_updated": checkpoint.get("updated_at", ""),
                    })

                pbar.update(1)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print("\n💾 CSV успешно сформирован")
    print("📄 Файл:", OUTPUT_FILE.resolve())
    print("📊 Всего пунктов пропуска:", len(rows))
    print("══════════════════════════════════════════════")
    print("🏁 ШАГ 2 ЗАВЕРШЁН\n")


if __name__ == "__main__":
    main()
