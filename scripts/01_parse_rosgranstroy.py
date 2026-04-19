import json
import csv
from pathlib import Path

from pipeline_validation import (
    ValidationError,
    normalize_coordinate_text,
    tqdm,
    validate_raw_payload,
    validate_rows,
)

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
    "transport_corridor",
    "checkpoint_note",
    "near_checkpoint_condition",
    "checkpoint_working_mode_id",
    "checkpoint_direction_id",
    "branch_name",
    "branch_phone",
    "branch_email",
    "branch_address",
    "branch_working_time",
    "branch_slug",
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
    print("=== STEP 2. Normalize checkpoint data ===")
    print("Input file:", INPUT_FILE.resolve())

    raw = json.loads(INPUT_FILE.read_text(encoding="utf-8"))
    data = validate_raw_payload(raw)
    federal_districts = data["federal_districts"]

    print("Federal districts found:", len(federal_districts))

    rows = []

    subjects_total = sum(
        len(subjects)
        for subjects in federal_districts.values()
        if isinstance(subjects, list)
    )

    print("Subjects found:", subjects_total)
    print("\nProcessing subjects and checkpoints...\n")

    with tqdm(total=subjects_total, desc="Processing subjects", unit="subject") as pbar:
        for subjects in federal_districts.values():
            if not isinstance(subjects, list):
                continue

            for subject in subjects:
                subject_name = safe_get(subject, "title", "ru")
                federal_district = safe_get(subject, "federal_district", "title", "ru")

                checkpoints = subject.get("checkpoints", [])
                print(f"Processing {subject_name}: {len(checkpoints)} checkpoints")

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
                        "latitude": normalize_coordinate_text(
                            checkpoint.get("latitude", ""),
                            field_name="latitude",
                        ),
                        "longitude": normalize_coordinate_text(
                            checkpoint.get("longitude", ""),
                            field_name="longitude",
                        ),
                        "address": safe_get(checkpoint, "address", "ru"),
                        "subject_name": subject_name,
                        "federal_district": federal_district,
                        "foreign_country": safe_get(checkpoint, "foreign_country", "title", "ru"),
                        "foreign_checkpoint": safe_get(checkpoint, "foreign_checkpoint", "ru"),
                        "transport_corridor": safe_get(checkpoint, "direction", "title", "ru"),
                        "checkpoint_note": safe_get(checkpoint, "note", "ru"),
                        "near_checkpoint_condition": checkpoint.get("near_checkpoint_condition", ""),
                        "checkpoint_working_mode_id": checkpoint.get("checkpoint_working_mode_id", ""),
                        "checkpoint_direction_id": checkpoint.get("checkpoint_direction_id", ""),
                        "branch_name": safe_get(checkpoint, "filial", "title", "ru"),
                        "branch_phone": safe_get(checkpoint, "filial", "phone"),
                        "branch_email": safe_get(checkpoint, "filial", "email"),
                        "branch_address": safe_get(checkpoint, "filial", "address", "ru"),
                        "branch_working_time": safe_get(checkpoint, "filial", "working_time", "ru"),
                        "branch_slug": safe_get(checkpoint, "filial", "slug"),
                        "source": "https://rosgranstroy.ru/api/map_data",
                        "confidence_level": "high",
                        "last_updated": checkpoint.get("updated_at", ""),
                    })

                pbar.update(1)

    validate_rows(rows)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print("Validation passed for rows:", len(rows))
    print("\nCSV created successfully.")
    print("Output file:", OUTPUT_FILE.resolve())
    print("Checkpoint rows:", len(rows))
    print("=== STEP 2 completed ===\n")


if __name__ == "__main__":
    try:
        main()
    except ValidationError as exc:
        print(f"Validation failed: {exc}")
        raise SystemExit(1) from exc
