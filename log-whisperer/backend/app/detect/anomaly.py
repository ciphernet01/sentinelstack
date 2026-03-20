from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone

from app.core.schemas import AnomaliesLiveResponse, AnomalyCluster, NormalizedLogEvent


_BASE_LEVEL_SCORE = {
	"TRACE": 2,
	"DEBUG": 4,
	"INFO": 8,
	"WARN": 28,
	"ERROR": 62,
	"FATAL": 86,
}


def _keyword_score(message: str) -> int:
	text = message.lower()
	keywords = {
		"timeout": 12,
		"exception": 14,
		"failed": 10,
		"panic": 20,
		"refused": 10,
		"unavailable": 10,
		"oom": 15,
	}
	return sum(weight for key, weight in keywords.items() if key in text)


def _score_with_rules(events: list[NormalizedLogEvent]) -> list[NormalizedLogEvent]:
	if not events:
		return []

	adjustments: list[int] = [0] * len(events)
	reasons: list[list[str]] = [[] for _ in events]

	total = len(events)
	error_indices = [index for index, event in enumerate(events) if event.is_error]
	error_ratio = len(error_indices) / total
	if total >= 20 and error_ratio >= 0.35:
		for index in error_indices:
			adjustments[index] += 18
			reasons[index].append("error_burst")

	bucket_to_indices: dict[datetime, list[int]] = defaultdict(list)
	for index, event in enumerate(events):
		bucket_to_indices[event.minute_bucket].append(index)  # type: ignore[arg-type]
	buckets = sorted(bucket_to_indices.keys())
	if len(buckets) >= 2:
		latest_bucket = buckets[-1]
		latest_count = len(bucket_to_indices[latest_bucket])
		previous_counts = [len(bucket_to_indices[bucket]) for bucket in buckets[:-1]]
		previous_avg = sum(previous_counts) / max(len(previous_counts), 1)
		if previous_avg > 0 and latest_count >= max(20, int(previous_avg * 2)):
			for index in bucket_to_indices[latest_bucket]:
				adjustments[index] += 14
				reasons[index].append("volume_spike")

	heartbeat_indices = [
		index
		for index, event in enumerate(events)
		if "heartbeat" in event.message.lower() and event.level in {"INFO", "DEBUG"}
	]
	if heartbeat_indices and len(events) >= 20:
		latest_timestamp = events[-1].timestamp
		last_heartbeat = events[heartbeat_indices[-1]].timestamp
		gap_seconds = (latest_timestamp - last_heartbeat).total_seconds()
		if gap_seconds > 120:
			for index in range(max(0, len(events) - 10), len(events)):
				adjustments[index] += 16
				reasons[index].append("missing_heartbeat")

	for index in range(1, len(events)):
		current = events[index]
		previous = events[index - 1]
		if current.service != previous.service:
			continue
		if previous.level in {"INFO", "WARN", "DEBUG"} and current.level in {"ERROR", "FATAL"}:
			delta_seconds = (current.timestamp - previous.timestamp).total_seconds()
			if delta_seconds <= 5:
				adjustments[index] += 10
				reasons[index].append("sequence_break")

	scored: list[NormalizedLogEvent] = []
	for index, event in enumerate(events):
		base = _BASE_LEVEL_SCORE.get(event.level, 8)
		keyword = _keyword_score(event.message)
		score = max(0, min(100, int(base + keyword + adjustments[index])))
		merged_reasons = sorted(set(event.reasons + reasons[index]))
		scored.append(event.model_copy(update={"anomaly_score": score, "reasons": merged_reasons}))

	return scored


def score_events_fallback(events: list[NormalizedLogEvent]) -> list[NormalizedLogEvent]:
	ordered = sorted(events, key=lambda item: item.timestamp)
	return _score_with_rules(ordered)


def build_live_anomaly_response(
	events: list[NormalizedLogEvent],
	threshold: int = 60,
) -> AnomaliesLiveResponse:
	threshold = max(0, min(100, threshold))
	scored_events = score_events_fallback(events)
	anomalous = [event for event in scored_events if (event.anomaly_score or 0) >= threshold]

	cluster_map: dict[str, list[NormalizedLogEvent]] = defaultdict(list)
	for event in anomalous:
		cluster_map[event.service].append(event)

	clusters: list[AnomalyCluster] = []
	for service, service_events in cluster_map.items():
		reason_counter = Counter(reason for event in service_events for reason in event.reasons)
		scores = [event.anomaly_score or 0 for event in service_events]
		clusters.append(
			AnomalyCluster(
				service=service,
				event_count=len(service_events),
				avg_score=round(sum(scores) / len(scores), 2),
				max_score=max(scores),
				reasons=[reason for reason, _ in reason_counter.most_common(3)],
			)
		)

	clusters.sort(key=lambda cluster: (cluster.max_score, cluster.event_count), reverse=True)
	ordered_anomalous = sorted(anomalous, key=lambda event: event.anomaly_score or 0, reverse=True)

	return AnomaliesLiveResponse(
		generated_at=datetime.now(timezone.utc),
		total_events=len(events),
		evaluated_events=len(scored_events),
		anomalous_events=len(ordered_anomalous),
		threshold=threshold,
		events=ordered_anomalous,
		clusters=clusters,
	)
