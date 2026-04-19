"""Import checkpoint descriptions from the local deep research markdown report."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path


DEFAULT_GENERATED_AT = "2026-04-19T00:00:00.000Z"
DESCRIPTION_SOURCE_ID = "deep-research-report"
DESCRIPTION_TITLE = "Описание КПП"
DESCRIPTION_SOURCE_TITLE = "Deep research report: карточки КПП"


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_key(value: str, *, keep_parentheses: bool = True) -> str:
    normalized = unicodedata.normalize("NFKC", value).lower().replace("ё", "е")
    if not keep_parentheses:
        normalized = re.sub(r"\s*\([^)]*\)\s*", " ", normalized)

    pattern = r"[^а-яa-z0-9()]+" if keep_parentheses else r"[^а-яa-z0-9]+"
    return normalize_text(re.sub(pattern, " ", normalized))


def clean_report_markup(text: str) -> str:
    def entity_replacement(match: re.Match[str]) -> str:
        try:
            payload = json.loads(match.group(1))
        except json.JSONDecodeError:
            return ""

        return str(payload[1]) if len(payload) > 1 else ""

    text = re.sub(r"\ue200entity\ue202(\[.*?\])\ue201", entity_replacement, text)
    text = re.sub(r"\s*\ue200cite\ue202[^\ue201]+\ue201", "", text)
    return normalize_text(text)


def extract_cards(report_text: str) -> list[dict[str, str]]:
    start_marker = "## Карточки КПП"
    end_marker = "## Примечание по экспорту"

    try:
        start = report_text.index(start_marker) + len(start_marker)
        end = report_text.index(end_marker, start)
    except ValueError as error:
        raise SystemExit("Report does not contain the expected checkpoint card section.") from error

    cards: list[dict[str, str]] = []
    section = report_text[start:end]

    for block in re.split(r"\n\s*\n", section.strip()):
        block = normalize_text(block)
        if not block.startswith("**"):
            continue

        name_end = block.find(".**")
        if name_end == -1:
            continue

        name = block[2:name_end].strip()
        summary = clean_report_markup(block[name_end + 3 :])
        if name and summary:
            cards.append({"name": name, "summary": summary})

    return cards


def build_feature_index(features: list[dict]) -> tuple[dict[str, list[dict]], dict[str, list[dict]]]:
    by_full_name: dict[str, list[dict]] = {}
    by_loose_name: dict[str, list[dict]] = {}

    for feature in features:
        props = feature.get("properties") or {}
        item = {
            "id": str(props.get("checkpoint_id") or props.get("__id") or ""),
            "name": str(props.get("checkpoint_name") or props.get("__name") or props.get("name") or ""),
            "type": str(props.get("checkpoint_type") or props.get("__type") or ""),
            "subject": str(props.get("subject_name") or props.get("__subject") or ""),
            "country": str(props.get("foreign_country") or props.get("__country") or "")
        }

        if not item["id"] or not item["name"]:
            continue

        by_full_name.setdefault(normalize_key(item["name"]), []).append(item)
        by_loose_name.setdefault(normalize_key(item["name"], keep_parentheses=False), []).append(item)

    return by_full_name, by_loose_name


def is_auto_checkpoint(feature: dict) -> bool:
    return "авто" in normalize_key(feature["type"])


def resolve_ambiguous_match(card: dict[str, str], matches: list[dict]) -> dict | None:
    name_key = normalize_key(card["name"], keep_parentheses=False)
    summary_key = normalize_key(card["summary"], keep_parentheses=False)

    if name_key == "пограничный":
        if "калининград" in summary_key:
            return next((item for item in matches if "Калининградская область" in item["subject"]), None)
        if "приморск" in summary_key:
            return next((item for item in matches if "Приморский край" in item["subject"]), None)

    return None


def match_cards_to_features(cards: list[dict[str, str]], features: list[dict]) -> tuple[list[dict], list[dict]]:
    by_full_name, by_loose_name = build_feature_index(features)
    matched: list[dict] = []
    skipped: list[dict] = []

    for card in cards:
        full_matches = by_full_name.get(normalize_key(card["name"]), [])
        loose_matches = by_loose_name.get(normalize_key(card["name"], keep_parentheses=False), [])
        matches = full_matches or loose_matches
        auto_matches = [item for item in matches if is_auto_checkpoint(item)]
        exact_auto_matches = [item for item in full_matches if is_auto_checkpoint(item)]
        candidates = exact_auto_matches or auto_matches or matches

        if len(candidates) == 1:
            feature = candidates[0]
        else:
            feature = resolve_ambiguous_match(card, candidates)

        if feature:
            matched.append({"card": card, "feature": feature})
        else:
            skipped.append(
                {
                    "name": card["name"],
                    "candidateIds": [item["id"] for item in candidates]
                }
            )

    return matched, skipped


def build_description_records(matches: list[dict]) -> list[dict]:
    records = []

    for item in sorted(matches, key=lambda match: int(match["feature"]["id"])):
        records.append(
            {
                "checkpointId": item["feature"]["id"],
                "kind": "description",
                "title": DESCRIPTION_TITLE,
                "summary": item["card"]["summary"],
                "sourceId": DESCRIPTION_SOURCE_ID,
                "sourceTitle": DESCRIPTION_SOURCE_TITLE,
                "confidence": "medium",
                "tags": ["описание", "исследование"]
            }
        )

    return records


def update_enrichment_payload(payload: dict, records: list[dict], skipped: list[dict], report_path: Path) -> dict:
    sources = list(payload.get("sources") or [])
    if not any(source.get("id") == DESCRIPTION_SOURCE_ID for source in sources):
        sources.append(
            {
                "id": DESCRIPTION_SOURCE_ID,
                "title": DESCRIPTION_SOURCE_TITLE,
                "url": "",
                "kind": "research"
            }
        )

    existing_records = [
        record
        for record in payload.get("records", [])
        if not (record.get("kind") == "description" and record.get("sourceId") == DESCRIPTION_SOURCE_ID)
    ]

    return {
        "schemaVersion": int(payload.get("schemaVersion") or 1),
        "generatedAt": DEFAULT_GENERATED_AT,
        "description": (
            "Verified per-checkpoint enrichment records. Includes local research descriptions "
            "extracted from the deep research markdown report."
        ),
        "sources": sources,
        "importSummary": {
            "source": report_path.name,
            "matchedDescriptions": len(records),
            "skippedDescriptions": skipped
        },
        "records": [*existing_records, *records]
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--report",
        default=r"C:\Users\ARSENII\Downloads\deep-research-report.md",
        help="Path to the markdown deep research report."
    )
    parser.add_argument("--geojson", default="data/checkpoints.geojson")
    parser.add_argument("--enrichment", default="data/checkpoint_enrichment.json")
    args = parser.parse_args()

    report_path = Path(args.report)
    geojson_path = Path(args.geojson)
    enrichment_path = Path(args.enrichment)

    report_text = report_path.read_text(encoding="utf-8")
    geojson = json.loads(geojson_path.read_text(encoding="utf-8"))
    payload = json.loads(enrichment_path.read_text(encoding="utf-8"))

    cards = extract_cards(report_text)
    matches, skipped = match_cards_to_features(cards, geojson.get("features", []))
    records = build_description_records(matches)
    next_payload = update_enrichment_payload(payload, records, skipped, report_path)

    enrichment_path.write_text(
        json.dumps(next_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )

    print(
        f"Imported {len(records)} checkpoint descriptions from {len(cards)} report cards; "
        f"skipped {len(skipped)}."
    )
    if skipped:
        print("Skipped cards were recorded in importSummary.")


if __name__ == "__main__":
    main()
