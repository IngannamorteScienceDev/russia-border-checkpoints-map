import json
import requests
from pathlib import Path
from datetime import datetime
from tqdm import tqdm

API_URL = "https://rosgranstroy.ru/api/map_data"
OUT_FILE = Path("raw_data/rosgranstroy_map_data.json")


def main():
    print("══════════════════════════════════════════════")
    print("📡 ШАГ 1. Загрузка данных из API Росгранстроя")
    print("Источник:", API_URL)
    print("══════════════════════════════════════════════\n")

    print("⏳ Отправляем HTTP-запрос к официальному API…")

    with tqdm(total=1, desc="Загрузка JSON", unit="запрос") as pbar:
        response = requests.get(API_URL, timeout=30)
        response.raise_for_status()
        data = response.json()
        pbar.update(1)

    print("✅ Ответ от API успешно получен")
    print("📦 Тип полученных данных:", type(data).__name__)

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

    print("\n💾 Данные сохранены на диск")
    print("📄 Файл:", OUT_FILE.resolve())
    print("══════════════════════════════════════════════")
    print("🏁 ШАГ 1 ЗАВЕРШЁН\n")


if __name__ == "__main__":
    main()
