from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from app.core.schemas import CrashReport, CrashReportResponse, NormalizedLogEvent, TimelineEvent


def _recommendations_for(root_cause: str) -> list[str]:
	base = [
		"Inspect service logs around the first anomalous event timestamp.",
		"Correlate with deployment/config changes in the same time window.",
	]
	if "heartbeat" in root_cause:
		base.append("Validate scheduler/worker health checks and heartbeat emitter reliability.")
	if "timeout" in root_cause:
		base.append("Check downstream latency, connection pools, and retry policy tuning.")
	if "burst" in root_cause:
		base.append("Apply circuit breaker or rate limiting to contain cascading failures.")
	if "exception" in root_cause:
		base.append("Inspect stack traces and roll back recent risky code paths if needed.")
	return base


def _infer_root_cause(event: NormalizedLogEvent) -> str:
	reasons = {reason.lower() for reason in event.reasons}
	message = event.message.lower()
	if "missing_heartbeat" in reasons:
		return "Probable liveness degradation due to missing heartbeat signals."
	if "error_burst" in reasons:
		return "Probable cascading failure indicated by concentrated error burst."
	if "volume_spike" in reasons:
		return "Probable traffic/load surge causing abnormal log volume spike."
	if "sequence_break" in reasons:
		return "Probable unexpected execution path based on sequence break."
	if "timeout" in message:
		return "Probable downstream dependency timeout or resource starvation."
	if "exception" in message or "panic" in message:
		return "Probable unhandled exception in critical service path."
	return "Probable service instability due to abnormal error pattern."


def build_latest_crash_report(
	scored_events: list[NormalizedLogEvent],
	threshold: int = 75,
) -> CrashReportResponse:
	now = datetime.now(timezone.utc)
	threshold = max(0, min(100, threshold))
	if not scored_events:
		return CrashReportResponse(generated_at=now, report=None)

	ordered = sorted(scored_events, key=lambda item: item.timestamp)
	anomalous = [event for event in ordered if (event.anomaly_score or 0) >= threshold]
	if not anomalous:
		return CrashReportResponse(generated_at=now, report=None)

	first_anomaly = anomalous[0]
	max_score = max((event.anomaly_score or 0) for event in anomalous)
	affected_counter = Counter(event.service for event in anomalous)
	affected_services = [service for service, _ in affected_counter.most_common(5)]

	timeline_source = ordered[-25:]
	timeline = [
		TimelineEvent(
			timestamp=event.timestamp,
			service=event.service,
			level=event.level,
			message=event.message,
			anomaly_score=event.anomaly_score or 0,
		)
		for event in timeline_source
	]

	root_cause = _infer_root_cause(first_anomaly)
	report = CrashReport(
		report_id=f"crash-{int(now.timestamp())}",
		created_at=now,
		status="detected",
		first_anomalous_event=first_anomaly,
		probable_root_cause=root_cause,
		affected_services=affected_services,
		timeline=timeline,
		recommended_fix=_recommendations_for(root_cause.lower()),
		anomaly_threshold=threshold,
		max_anomaly_score=max_score,
	)

	return CrashReportResponse(generated_at=now, report=report)
