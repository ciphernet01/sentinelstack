from __future__ import annotations

from collections import deque
from datetime import datetime

from .models import AnomalyRecord, ParsedLog


class SequenceAnalyzer:
    """Tracks timeline and detects the first anomalous signal before crash-like events."""

    CRASH_KEYWORDS = ("fatal", "panic", "crash", "segmentation fault", "out of memory", "service unavailable")

    def __init__(self, window_size: int = 2000):
        self.window_size = window_size
        self.timeline: deque[dict] = deque(maxlen=window_size)
        self.recent_anomalies: deque[AnomalyRecord] = deque(maxlen=window_size)
        self.first_signal: dict | None = None

    def record(self, log: ParsedLog, anomaly: AnomalyRecord | None) -> dict:
        event = {
            "timestamp": log.timestamp.isoformat(),
            "service": log.service,
            "level": log.level,
            "message": log.message,
            "trace_id": log.trace_id,
            "anomaly_score": anomaly.score if anomaly else 0.0,
            "is_anomaly": anomaly is not None,
        }
        self.timeline.append(event)
        if anomaly:
            self.recent_anomalies.append(anomaly)

        if self.first_signal is None and anomaly is not None:
            self.first_signal = {
                "timestamp": anomaly.timestamp.isoformat(),
                "service": anomaly.service,
                "score": anomaly.score,
                "message": anomaly.message,
            }

        return event

    def detect_first_signal_before_crash(self, log: ParsedLog) -> dict | None:
        lowered = log.message.lower()
        is_crash = log.level == "FATAL" or any(keyword in lowered for keyword in self.CRASH_KEYWORDS)
        if not is_crash:
            return None

        candidate = self.first_signal
        if candidate is None and self.recent_anomalies:
            first = min(self.recent_anomalies, key=lambda item: item.timestamp)
            candidate = {
                "timestamp": first.timestamp.isoformat(),
                "service": first.service,
                "score": first.score,
                "message": first.message,
            }

        return {
            "first_signal": candidate,
            "crash_timestamp": log.timestamp.isoformat(),
            "crash_message": log.message,
            "timeline": list(self.timeline),
        }

    def clear_signal(self) -> None:
        self.first_signal = None

    def get_recent_timeline(self, limit: int = 200) -> list[dict]:
        return list(self.timeline)[-limit:]
