import json
import requests
from pathlib import Path
from datetime import datetime

API_URL = "https://rosgranstroy.ru/api/map_data"
OUT_FILE = Path("raw_data/rosgranstroy_map_data.json")


def main():
    print("📡 Fetching data from Rosgranstroy API...")
    response = requests.get(API_URL, timeout=30)
    response.raise_for_status()

    data = response.json()

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(
            {
                "meta": {
                    "source": API_URL,
                    "fetched_at": datetime.utcnow().isoformat(),
                    "count": len(data) if isinstance(data, list) else None,
                },
                "data": data,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    print(f"✅ Saved JSON to {OUT_FILE}")
    if isinstance(data, list):
        print(f"📦 Records count: {len(data)}")
    else:
        print("⚠️ Warning: unexpected JSON structure")


if __name__ == "__main__":
    main()
