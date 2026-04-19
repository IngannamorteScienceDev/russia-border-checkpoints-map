import json
from pathlib import Path

from research_coverage import build_research_coverage_report, validate_research_coverage_report

GEOJSON_PATH = Path("data/checkpoints.geojson")
ENRICHMENT_PATH = Path("data/checkpoint_enrichment.json")
REPORT_PATH = Path("data/research_coverage_report.json")


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    print("=== STEP 6. Write research coverage report ===")
    geojson = load_json(GEOJSON_PATH)
    enrichment_payload = load_json(ENRICHMENT_PATH)
    report = build_research_coverage_report(geojson, enrichment_payload)

    validate_research_coverage_report(report, geojson, enrichment_payload)

    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    summary = report["summary"]
    print("Research coverage report:", REPORT_PATH.resolve())
    print("Descriptions:", f"{summary['describedCheckpoints']}/{summary['totalCheckpoints']}")
    print("Missing descriptions:", summary["missingDescriptionCount"])
    print("Missing events or verification:", summary["missingEventCoverage"])
    print("=== STEP 6 completed ===")


if __name__ == "__main__":
    main()
