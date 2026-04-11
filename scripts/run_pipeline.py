import subprocess
import sys
from datetime import datetime
from pathlib import Path

GENERATED_FILES = [
    Path("data/checkpoints_v1.csv"),
    Path("data/checkpoints.geojson"),
]

PIPELINE_STEPS = [
    ("STEP 1. Fetch Rosgranstroy data", ["python", "scripts/00_fetch_rosgranstroy.py"]),
    ("STEP 2. Normalize data to CSV", ["python", "scripts/01_parse_rosgranstroy.py"]),
    ("STEP 3. Build final GeoJSON", ["python", "scripts/02_build_geojson.py"]),
    ("STEP 4. Update dataset changelog", ["python", "scripts/03_update_changelog.py"]),
]


def remove_old_files():
    print("=== Pipeline cleanup ===")

    removed_any = False

    for file in GENERATED_FILES:
        if file.exists():
            file.unlink()
            print(f"Removed file: {file}")
            removed_any = True
        else:
            print(f"File not found, skipping: {file}")

    if not removed_any:
        print("No generated files needed cleanup.")

    print("=== Cleanup completed ===\n")


def run_step(title, command):
    print(f"=== {title} ===")
    print("Command:", " ".join(command))

    result = subprocess.run(command)

    if result.returncode != 0:
        print(f"Pipeline failed on step: {title}")
        print(f"Exit code: {result.returncode}")
        sys.exit(result.returncode)

    print(f"{title} completed successfully.\n")


def main():
    start_time = datetime.now()

    print("=== Full data update pipeline ===")
    print("Project: russia-border-checkpoints-map")
    print("Started at:", start_time.strftime("%Y-%m-%d %H:%M:%S"))

    remove_old_files()

    for title, command in PIPELINE_STEPS:
        run_step(title, command)

    end_time = datetime.now()
    duration = end_time - start_time

    print("=== Pipeline completed ===")
    print("Finished at:", end_time.strftime("%Y-%m-%d %H:%M:%S"))
    print("Duration:", duration)


if __name__ == "__main__":
    main()
