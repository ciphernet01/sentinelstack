from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from app.core.schemas import AlertEvent, AlertEvaluationResponse, AlertRuleConfig, NormalizedLogEvent


def evaluate_alert_rules(
    scored_events: list[NormalizedLogEvent],
    rules: AlertRuleConfig,
) -> AlertEvaluationResponse:
    now = datetime.now(timezone.utc)
    threshold = rules.anomaly_threshold
    anomalous = [event for event in scored_events if (event.anomaly_score or 0) >= threshold]

    if not anomalous or len(anomalous) < rules.min_anomalous_events:
        return AlertEvaluationResponse(
            triggered=False,
            evaluation_time=now,
            rules=rules,
            latest_alert=None,
        )

    max_score = max(event.anomaly_score or 0 for event in anomalous)
    service_counter = Counter(event.service for event in anomalous)
    affected_services = [service for service, _ in service_counter.most_common(5)]

    severity = "warning"
    if max_score >= 90:
        severity = "critical"
    elif max_score < 80:
        severity = "info"

    alert = AlertEvent(
        timestamp=now,
        severity=severity,
        message=(
            f"Anomaly threshold crossed: {len(anomalous)} events >= {threshold}. "
            f"Top score={max_score}."
        ),
        threshold=threshold,
        anomalous_events=len(anomalous),
        max_anomaly_score=max_score,
        affected_services=affected_services,
    )

    return AlertEvaluationResponse(
        triggered=True,
        evaluation_time=now,
        rules=rules,
        latest_alert=alert,
    )
