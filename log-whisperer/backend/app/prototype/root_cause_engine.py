from __future__ import annotations

from collections import Counter

from .models import AnomalyRecord, CrashReport


class RootCauseEngine:
    """Rule + heuristic root-cause analysis built for fast incident turnaround."""

    ROOT_CAUSE_PATTERNS = {
        "connection refused": "Downstream dependency unavailable",
        "timeout": "Latency escalation or upstream timeout",
        "out of memory": "Memory pressure leading to process instability",
        "database": "Database saturation or query lock contention",
        "rate limit": "Traffic surge triggering throttling",
        "permission denied": "Authorization failure or secret misconfiguration",
        "disk": "Disk I/O or capacity exhaustion",
    }

    def build_report(
        self,
        first_signal: dict | None,
        timeline: list[dict],
        anomalies: list[AnomalyRecord],
    ) -> CrashReport:
        affected_services = sorted({item["service"] for item in timeline if item.get("service")})
        probable_cause = self._infer_root_cause(timeline)
        confidence = self._confidence(first_signal, anomalies, probable_cause)

        first_anomaly_timestamp = ""
        if first_signal and first_signal.get("timestamp"):
            first_anomaly_timestamp = str(first_signal["timestamp"])
        elif anomalies:
            first_anomaly_timestamp = min(anomalies, key=lambda a: a.timestamp).timestamp.isoformat()

        return CrashReport(
            first_anomaly_timestamp=first_anomaly_timestamp,
            root_cause=probable_cause,
            affected_services=affected_services,
            timeline=timeline[-200:],
            confidence_score=confidence,
            suggested_fix="",
            similar_incidents=[],
        )

    def _infer_root_cause(self, timeline: list[dict]) -> str:
        lowered_messages = "\n".join(item.get("message", "") for item in timeline).lower()
        for pattern, cause in self.ROOT_CAUSE_PATTERNS.items():
            if pattern in lowered_messages:
                return cause

        service_counter = Counter(item.get("service", "unknown") for item in timeline)
        hot_service, _ = service_counter.most_common(1)[0] if service_counter else ("unknown", 0)
        return f"Anomaly concentration observed in {hot_service}; likely cascading service degradation"

    @staticmethod
    def _confidence(first_signal: dict | None, anomalies: list[AnomalyRecord], root_cause: str) -> float:
        base = 45.0
        if first_signal:
            base += 20.0
        if len(anomalies) >= 5:
            base += 15.0
        if "likely" not in root_cause.lower():
            base += 10.0
        return float(min(100.0, base))
