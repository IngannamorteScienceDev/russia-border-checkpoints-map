import requests
import json

url = "https://rosgranstroy.ru/api/map_data"
resp = requests.get(url)
data = resp.json()  # весь JSON с 361 КПП

with open("raw_data/rosgranstroy_map_data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("✅ Saved JSON — now ready for parsing!")
