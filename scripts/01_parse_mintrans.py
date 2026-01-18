import csv
import re
from datetime import datetime
from pathlib import Path

RAW_FILE = Path("raw_data/kaspiko_checkpoints_raw.csv")
OUT_FILE = Path("data/checkpoints_v1.csv")

CSV_COLUMNS = [
    "id",
    "name_ru",
    "name_en",
    "type",
    "category",
    "status",
    "region_rf",
    "municipality",
    "border_country",
    "border_section",
    "counterpart_name",
    "latitude",
    "longitude",
    "coord_accuracy",
    "infrastructure",
    "transport_allowed",
    "customs_control",
    "veterinary_control",
    "working_hours",
    "seasonality",
    "weather_dependency",
    "notes",
    "last_update",
    "sources",
    "confidence_level",
]


def detect_type(text: str) -> str:
    t = text.lower()
    if "пешеход" in t:
        return "pedestrian"
    if "железнодорож" in t or "ж/д" in t:
        return "rail"
    if "морск" in t or "порт" in t:
        return "sea"
    if "речн" in t:
        return "river"
    if "аэропорт" in t or "воздуш" in t:
        return "air"
    if "смешан" in t:
        return "mixed"
    return "auto"


def detect_category(text: str) -> str:
    t = text.lower()
    if "многосторон" in t:
        return "international"
    if "двусторон" in t:
        return "bilateral"
    if "местн" in t:
        return "local"
    return ""


def detect_status(text: str) -> str:
    t = text.lower()
    if "не функционирует" in t or "закрыт" in t:
        return "closed"
    if "приостанов" in t:
        return "suspended"
    if "сезон" in t:
        return "seasonal"
    return "active"


def detect_working_hours(text: str) -> str:
    if "круглосуточ" in text.lower():
        return "24/7"
    return ""


def generate_id(region: str, idx: int) -> str:
    region_code = re.sub(r"[^A-Z]", "", region.upper())[:3] or "RUS"
    return f"RUS-{region_code}-{idx:03d}"


def main():
    rows = []

    with RAW_FILE.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=1):
            description = row.get("description", "")
            region = row.get("region", "").strip()

            rows.append({
                "id": generate_id(region, i),
                "name_ru": row.get("name_ru", "").strip(),
                "name_en": "",
                "type": detect_type(description),
                "category": detect_category(description),
                "status": detect_status(description),
                "region_rf": region,
                "municipality": "",
                "border_country": "",
                "border_section": "",
                "counterpart_name": "",
                "latitude": "",
                "longitude": "",
                "coord_accuracy": "",
                "infrastructure": "",
                "transport_allowed": "",
                "customs_control": "",
                "veterinary_control": "",
                "working_hours": detect_working_hours(description),
                "seasonality": "",
                "weather_dependency": "",
                "notes": description.strip(),
                "last_update": datetime.utcnow().date().isoformat(),
                "sources": "https://kaspiko.ru/info/punkty-propuska-cherez-gosgranitsu-rossiyskoy-federatsii/",
                "confidence_level": "medium",
            })

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"✅ Generated {OUT_FILE} ({len(rows)} records)")


if __name__ == "__main__":
    main()
