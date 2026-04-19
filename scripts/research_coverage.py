from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from urllib.parse import urlparse

from pipeline_validation import build_dataset_snapshot, build_dataset_version

SCHEMA_VERSION = 1
UNKNOWN_LABEL = "Не указано"
DESCRIPTION_KIND = "description"
VERIFICATION_KIND = "official_verification"


def _clean(value) -> str:
    return str(value or "").strip()


def _is_http_url(value) -> bool:
    parsed = urlparse(_clean(value))
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _pick(properties: dict, *keys: str) -> str:
    for key in keys:
        value = _clean(properties.get(key))
        if value:
            return value
    return ""


def _feature_id(feature: dict) -> str:
    return _pick(feature.get("properties") or {}, "checkpoint_id", "__id", "id")


def _feature_label(feature: dict) -> dict:
    properties = feature.get("properties") or {}
    coordinates = (feature.get("geometry") or {}).get("coordinates") or []

    return {
        "id": _feature_id(feature),
        "name": _pick(properties, "checkpoint_name", "__name", "name") or "Без названия",
        "type": _pick(properties, "checkpoint_type", "__type", "type") or UNKNOWN_LABEL,
        "subject": _pick(properties, "subject_name", "__subject", "subject") or UNKNOWN_LABEL,
        "country": _pick(properties, "foreign_country", "__country", "country") or UNKNOWN_LABEL,
        "coordinates": coordinates if len(coordinates) == 2 else [],
    }


def _has_coordinates(feature: dict) -> bool:
    coordinates = (feature.get("geometry") or {}).get("coordinates") or []
    return (
        len(coordinates) == 2
        and isinstance(coordinates[0], (int, float))
        and isinstance(coordinates[1], (int, float))
    )


def _has_branch_contact(properties: dict) -> bool:
    return bool(_pick(properties, "branch_phone", "branch_email"))


def _coverage_item(covered: int, total: int) -> dict:
    missing = max(total - covered, 0)
    percent = round((covered / total) * 100, 1) if total else 0.0

    return {
        "covered": covered,
        "missing": missing,
        "percent": percent,
    }


def _build_enrichment_index(payload: dict) -> dict:
    records = payload.get("records") if isinstance(payload, dict) else []
    by_checkpoint: dict[str, list[dict]] = {}

    for record in records or []:
        checkpoint_id = _clean(record.get("checkpointId") or record.get("checkpoint_id"))
        if not checkpoint_id:
            continue
        by_checkpoint.setdefault(checkpoint_id, []).append(record)

    described_ids = {
        checkpoint_id
        for checkpoint_id, items in by_checkpoint.items()
        if any(_clean(item.get("kind")) == DESCRIPTION_KIND and _clean(item.get("summary")) for item in items)
    }
    verification_ids = {
        checkpoint_id
        for checkpoint_id, items in by_checkpoint.items()
        if any(_clean(item.get("kind")) == VERIFICATION_KIND for item in items)
    }
    event_ids = {
        checkpoint_id
        for checkpoint_id, items in by_checkpoint.items()
        if any(_clean(item.get("kind")) != DESCRIPTION_KIND for item in items)
    }

    return {
        "records": list(records or []),
        "byCheckpointId": by_checkpoint,
        "describedIds": described_ids,
        "eventIds": event_ids,
        "verificationIds": verification_ids,
    }


def _quality_issues(feature: dict) -> list[str]:
    properties = feature.get("properties") or {}
    issues = []

    if not _is_http_url(_pick(properties, "source", "source_url", "url", "href")):
        issues.append("missing_source")

    if not _pick(properties, "last_updated", "updated_at", "date_updated"):
        issues.append("missing_update_date")

    if not _pick(properties, "is_functional", "condition", "current_status", "operational_status"):
        issues.append("missing_operational_status")

    if not _has_coordinates(feature):
        issues.append("missing_coordinates")

    return issues


def _task_entry(feature: dict, *, reason: str, issues: list[str] | None = None) -> dict:
    entry = {
        **_feature_label(feature),
        "reason": reason,
    }

    if issues:
        entry["issues"] = issues

    return entry


def _coverage_by(features: list[dict], key: str, described_ids: set[str], event_ids: set[str]) -> list[dict]:
    buckets: dict[str, list[dict]] = {}

    for feature in features:
        properties = feature.get("properties") or {}
        value = _pick(properties, key) or UNKNOWN_LABEL
        buckets.setdefault(value, []).append(feature)

    rows = []
    for label, bucket_features in buckets.items():
        ids = {_feature_id(feature) for feature in bucket_features}
        described = len(ids & described_ids)
        with_events = len(ids & event_ids)
        quality_issues = sum(1 for feature in bucket_features if _quality_issues(feature))
        total = len(bucket_features)

        rows.append(
            {
                "label": label,
                "total": total,
                "described": described,
                "missingDescriptions": total - described,
                "withEvents": with_events,
                "missingEvents": total - with_events,
                "qualityIssues": quality_issues,
                "descriptionPercent": round((described / total) * 100, 1) if total else 0.0,
                "eventPercent": round((with_events / total) * 100, 1) if total else 0.0,
            }
        )

    return sorted(rows, key=lambda item: (-item["missingDescriptions"], -item["total"], item["label"]))


def _top_source_ids(records: list[dict]) -> list[dict]:
    counts = Counter(_clean(record.get("sourceId") or record.get("sourceTitle")) or UNKNOWN_LABEL for record in records)

    return [
        {
            "id": source_id,
            "records": count,
        }
        for source_id, count in counts.most_common()
    ]


def build_research_coverage_report(
    geojson: dict,
    enrichment_payload: dict,
    *,
    generated_at: str | None = None,
) -> dict:
    features = list(geojson.get("features") or [])
    total = len(features)
    snapshot = build_dataset_snapshot(features)
    enrichment = _build_enrichment_index(enrichment_payload)
    feature_ids = {_feature_id(feature) for feature in features}
    described_ids = enrichment["describedIds"] & feature_ids
    event_ids = enrichment["eventIds"] & feature_ids
    verification_ids = enrichment["verificationIds"] & feature_ids
    missing_description_features = [
        feature for feature in features if _feature_id(feature) not in described_ids
    ]
    missing_event_features = [feature for feature in features if _feature_id(feature) not in event_ids]
    quality_issue_features = [
        (feature, _quality_issues(feature)) for feature in features if _quality_issues(feature)
    ]
    records = enrichment["records"]
    description_records = [
        record for record in records if _clean(record.get("kind")) == DESCRIPTION_KIND
    ]
    event_records = [
        record for record in records if _clean(record.get("kind")) != DESCRIPTION_KIND
    ]
    verification_records = [
        record for record in records if _clean(record.get("kind")) == VERIFICATION_KIND
    ]

    if not generated_at:
        generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": generated_at,
        "datasetVersion": build_dataset_version(snapshot),
        "generatedFrom": {
            "geojson": "data/checkpoints.geojson",
            "enrichment": "data/checkpoint_enrichment.json",
        },
        "summary": {
            "totalCheckpoints": total,
            "describedCheckpoints": len(described_ids),
            "missingDescriptionCount": total - len(described_ids),
            "descriptionCoveragePercent": _coverage_item(len(described_ids), total)["percent"],
            "withEventCoverage": len(event_ids),
            "missingEventCoverage": total - len(event_ids),
            "eventCoveragePercent": _coverage_item(len(event_ids), total)["percent"],
            "officialVerificationCoverage": len(verification_ids),
            "qualityIssueCount": len(quality_issue_features),
            "enrichmentRecordCount": len(records),
            "descriptionRecordCount": len(description_records),
            "eventRecordCount": len(event_records),
            "officialVerificationRecordCount": len(verification_records),
        },
        "coverage": {
            "description": _coverage_item(len(described_ids), total),
            "eventsOrVerification": _coverage_item(len(event_ids), total),
            "officialVerification": _coverage_item(len(verification_ids), total),
            "source": _coverage_item(
                sum(
                    1
                    for feature in features
                    if _is_http_url(_pick(feature.get("properties") or {}, "source", "source_url", "url", "href"))
                ),
                total,
            ),
            "lastUpdated": _coverage_item(
                sum(1 for feature in features if _pick(feature.get("properties") or {}, "last_updated", "updated_at")),
                total,
            ),
            "coordinates": _coverage_item(sum(1 for feature in features if _has_coordinates(feature)), total),
            "address": _coverage_item(
                sum(1 for feature in features if _pick(feature.get("properties") or {}, "address", "checkpoint_address")),
                total,
            ),
            "workingTime": _coverage_item(
                sum(1 for feature in features if _pick(feature.get("properties") or {}, "working_time", "work_time")),
                total,
            ),
            "operationalStatus": _coverage_item(
                sum(
                    1
                    for feature in features
                    if _pick(feature.get("properties") or {}, "is_functional", "condition", "current_status")
                ),
                total,
            ),
            "neighborCheckpoint": _coverage_item(
                sum(
                    1
                    for feature in features
                    if _pick(feature.get("properties") or {}, "foreign_checkpoint", "neighbor_checkpoint")
                ),
                total,
            ),
            "transportCorridor": _coverage_item(
                sum(1 for feature in features if _pick(feature.get("properties") or {}, "transport_corridor")),
                total,
            ),
            "branchContact": _coverage_item(
                sum(1 for feature in features if _has_branch_contact(feature.get("properties") or {})),
                total,
            ),
        },
        "byCountry": _coverage_by(features, "foreign_country", described_ids, event_ids),
        "bySubject": _coverage_by(features, "subject_name", described_ids, event_ids),
        "byType": _coverage_by(features, "checkpoint_type", described_ids, event_ids),
        "queues": {
            "missingDescriptions": [
                _task_entry(feature, reason="missing_description")
                for feature in missing_description_features
            ],
            "missingEvents": [
                _task_entry(feature, reason="missing_events_or_verification")
                for feature in missing_event_features
            ],
            "qualityIssues": [
                _task_entry(feature, reason="quality_issue", issues=issues)
                for feature, issues in quality_issue_features
            ],
            "missingWorkingTime": [
                _task_entry(feature, reason="missing_working_time")
                for feature in features
                if not _pick(feature.get("properties") or {}, "working_time", "work_time")
            ],
        },
        "enrichmentSources": _top_source_ids(records),
        "importSummary": enrichment_payload.get("importSummary") or {},
    }


def validate_research_coverage_report(report: dict, geojson: dict, enrichment_payload: dict) -> int:
    if not isinstance(report, dict):
        raise ValueError("Research coverage report must be an object.")

    if report.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(f"Research coverage report schemaVersion must be {SCHEMA_VERSION}.")

    features = list(geojson.get("features") or [])
    total = len(features)
    summary = report.get("summary") or {}
    queues = report.get("queues") or {}

    if summary.get("totalCheckpoints") != total:
        raise ValueError("Research coverage totalCheckpoints does not match GeoJSON.")

    if summary.get("missingDescriptionCount") != len(queues.get("missingDescriptions") or []):
        raise ValueError("Research coverage missingDescriptions queue does not match summary.")

    if summary.get("missingEventCoverage") != len(queues.get("missingEvents") or []):
        raise ValueError("Research coverage missingEvents queue does not match summary.")

    expected = build_research_coverage_report(
        geojson,
        enrichment_payload,
        generated_at=report.get("generatedAt") or "validation",
    )
    expected_summary = dict(expected["summary"])
    actual_summary = dict(summary)

    if actual_summary != expected_summary:
        raise ValueError("Research coverage summary does not match current inputs.")

    return total
