import json
import requests
from pathlib import Path
from datetime import datetime
from tqdm import tqdm

API_URL = "https://rosgranstroy.ru/api/map_data"
OUT_FILE = Path("raw_data/rosgranstroy_map_data.json")


def main():
    print("📡 Fetching data from Rosgranstroy API")

    with tqdm(total=1, desc="Downloading JSON") as pbar:
        response = requests.get(API_URL, timeout=30)
        response.raise_for_status()
        data = response.json()
        pbar.update(1)

    payload = {
        "meta": {
            "source": API_URL,
            "fetched_at": datetime.utcnow().isoformat(),
        },
        "data": data,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"✅ Saved raw JSON → {OUT_FILE}")


if __name__ == "__main__":
    main()
