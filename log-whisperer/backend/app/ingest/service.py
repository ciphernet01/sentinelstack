from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
import json

from app.core.schemas import IngestResponse, NormalizedLogEvent, PipelineStatus
from app.parse.parser import parse_log_line, parse_many_lines

MAX_STORED_EVENTS = 10000
_event_store: deque[NormalizedLogEvent] = deque(maxlen=MAX_STORED_EVENTS)
_metrics = {
	"total_ingested": 0,
	"total_failed": 0,
	"last_ingest_at": None,
}


def ingest_text_blob(log_blob: str, source: str = "text") -> IngestResponse:
	lines = [line for line in log_blob.splitlines() if line.strip()]
	parsed_events, failed_lines = parse_many_lines(lines, source_hint=source)
	_event_store.extend(parsed_events)
	_metrics["total_ingested"] += len(parsed_events)
	_metrics["total_failed"] += len(failed_lines)
	_metrics["last_ingest_at"] = datetime.now(timezone.utc).isoformat()

	return IngestResponse(
		ingested_count=len(parsed_events),
		failed_count=len(failed_lines),
		failed_samples=failed_lines[:5],
		source=source,
	)


def ingest_json_records(records: list[dict], source: str = "json") -> IngestResponse:
	parsed_events: list[NormalizedLogEvent] = []
	failed_samples: list[str] = []

	for record in records:
		try:
			parsed_events.append(parse_log_line(json.dumps(record), source_hint=source))
		except Exception:
			failed_samples.append(str(record)[:300])

	_event_store.extend(parsed_events)
	_metrics["total_ingested"] += len(parsed_events)
	_metrics["total_failed"] += len(failed_samples)
	_metrics["last_ingest_at"] = datetime.now(timezone.utc).isoformat()

	return IngestResponse(
		ingested_count=len(parsed_events),
		failed_count=len(failed_samples),
		failed_samples=failed_samples[:5],
		source=source,
	)


def ingest_raw_lines(lines: list[str], source: str = "stream") -> IngestResponse:
	parsed_events, failed_lines = parse_many_lines(lines, source_hint=source)
	_event_store.extend(parsed_events)
	_metrics["total_ingested"] += len(parsed_events)
	_metrics["total_failed"] += len(failed_lines)
	_metrics["last_ingest_at"] = datetime.now(timezone.utc).isoformat()

	return IngestResponse(
		ingested_count=len(parsed_events),
		failed_count=len(failed_lines),
		failed_samples=failed_lines[:5],
		source=source,
	)


def recent_events(limit: int = 100) -> list[NormalizedLogEvent]:
	if limit <= 0:
		return []
	return list(_event_store)[-limit:]


def pipeline_status() -> PipelineStatus:
	return PipelineStatus(
		ingest="ready",
		parse="ready",
		detect="ready-fallback",
		report="ready-fallback",
		metrics={
			"buffered_events": len(_event_store),
			**_metrics,
		},
	)
