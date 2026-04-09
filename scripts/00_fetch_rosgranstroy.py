import json
import requests
from pathlib import Path
from datetime import datetime

from pipeline_validation import tqdm

API_URL = "https://rosgranstroy.ru/api/map_data"
OUT_FILE = Path("raw_data/rosgranstroy_map_data.json")


def main():
    print("=== STEP 1. Fetch Rosgranstroy data ===")
    print("Source:", API_URL)

    print("Requesting data from the official API...")

    with tqdm(total=1, desc="Downloading JSON", unit="request") as pbar:
        response = requests.get(API_URL, timeout=30)
        response.raise_for_status()
        data = response.json()
        pbar.update(1)

    print("API response received successfully.")
    print("Payload type:", type(data).__name__)

    payload = {
        "meta": {
            "source": API_URL,
            "fetched_at_utc": datetime.utcnow().isoformat(),
            "description": "Официальный слепок данных Росгранстроя для карты пунктов пропуска",
        },
        "data": data,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("\nData saved to disk.")
    print("Output file:", OUT_FILE.resolve())
    print("=== STEP 1 completed ===\n")


if __name__ == "__main__":
    main()
