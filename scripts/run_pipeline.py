import subprocess
import sys
from pathlib import Path
from datetime import datetime

# Пути к генерируемым файлам
GENERATED_FILES = [
    Path("data/checkpoints_v1.csv"),
    Path("data/checkpoints_v1.geojson"),
    Path("frontend/data/checkpoints.geojson"),
]

# Шаги пайплайна
PIPELINE_STEPS = [
    ("ШАГ 1. Загрузка данных из Росгранстроя", ["python", "scripts/00_fetch_rosgranstroy.py"]),
    ("ШАГ 2. Разбор и нормализация в CSV", ["python", "scripts/01_parse_rosgranstroy.py"]),
    ("ШАГ 3. Формирование GeoJSON и синхронизация с frontend", ["python", "scripts/02_build_geojson.py"]),
]


def remove_old_files():
    print("══════════════════════════════════════════════")
    print("🧹 ПОДГОТОВКА ПАЙПЛАЙНА")
    print("Удаление устаревших сгенерированных данных")
    print("══════════════════════════════════════════════\n")

    removed_any = False

    for file in GENERATED_FILES:
        if file.exists():
            file.unlink()
            print(f"🗑 Удалён файл: {file}")
            removed_any = True
        else:
            print(f"ℹ Файл не найден (нормально): {file}")

    if not removed_any:
        print("\nℹ Старых файлов не обнаружено — очистка не требовалась")

    print("\n🧼 Очистка завершена\n")


def run_step(title, command):
    print("══════════════════════════════════════════════")
    print(f"🚀 {title}")
    print("Команда:", " ".join(command))
    print("══════════════════════════════════════════════\n")

    result = subprocess.run(command)

    if result.returncode != 0:
        print("\n❌ ОШИБКА ВО ВРЕМЯ ВЫПОЛНЕНИЯ ПАЙПЛАЙНА")
        print(f"⛔ Шаг завершился с кодом: {result.returncode}")
        sys.exit(result.returncode)

    print(f"\n✅ {title} — УСПЕШНО ЗАВЕРШЁН\n")


def main():
    start_time = datetime.now()

    print("══════════════════════════════════════════════")
    print("🧠 ЗАПУСК ПОЛНОГО ПАЙПЛАЙНА ОБНОВЛЕНИЯ ДАННЫХ")
    print("Проект: russia-border-checkpoints-map")
    print("Время запуска:", start_time.strftime("%Y-%m-%d %H:%M:%S"))
    print("══════════════════════════════════════════════\n")

    remove_old_files()

    for title, command in PIPELINE_STEPS:
        run_step(title, command)

    end_time = datetime.now()
    duration = end_time - start_time

    print("══════════════════════════════════════════════")
    print("🏁 ПАЙПЛАЙН УСПЕШНО ЗАВЕРШЁН")
    print("Время завершения:", end_time.strftime("%Y-%m-%d %H:%M:%S"))
    print("⏱ Общее время выполнения:", duration)
    print("══════════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
