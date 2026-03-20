from __future__ import annotations

from collections import Counter, deque

import numpy as np
from sklearn.ensemble import IsolationForest

from .models import AnomalyRecord, ParsedLog


class AnomalyDetector:
    """IsolationForest-based detector with error-rate spike awareness."""

    LEVEL_MAP = {"DEBUG": 0, "INFO": 1, "WARN": 2, "ERROR": 3, "FATAL": 4}

    def __init__(self, history_size: int = 5000):
        self.history_size = history_size
        self.model = IsolationForest(
            n_estimators=120,
            contamination=0.05,
            random_state=42,
            n_jobs=-1,
        )
        self.feature_history: deque[np.ndarray] = deque(maxlen=history_size)
        self.error_rate_history: deque[float] = deque(maxlen=120)
        self.message_counter: Counter[str] = Counter()
        self._trained = False

    def score_logs(self, logs: list[ParsedLog]) -> list[AnomalyRecord]:
        if not logs:
            return []

        vectors = np.array([self._extract_features(log) for log in logs], dtype=np.float64)

        for vec in vectors:
            self.feature_history.append(vec)

        if len(self.feature_history) >= 300 and (not self._trained or len(self.feature_history) % 50 == 0):
            training_data = np.array(self.feature_history, dtype=np.float64)
            self.model.fit(training_data)
            self._trained = True

        if self._trained:
            decisions = self.model.decision_function(vectors)
            scores = self._normalize_scores(decisions)
        else:
            scores = np.array([self._cold_start_score(log) for log in logs], dtype=np.float64)

        error_ratio = self._window_error_rate(logs)
        self.error_rate_history.append(error_ratio)
        spike_detected = self._is_error_spike(error_ratio)

        anomalies: list[AnomalyRecord] = []
        for log, score in zip(logs, scores):
            is_error_like = log.level in {"ERROR", "FATAL"}
            threshold = 65 if is_error_like else 75
            if spike_detected and is_error_like:
                threshold -= 10
            if float(score) >= threshold:
                reason = "error_rate_spike" if spike_detected and is_error_like else "isolation_forest_outlier"
                anomalies.append(
                    AnomalyRecord(
                        timestamp=log.timestamp,
                        service=log.service,
                        level=log.level,
                        message=log.message,
                        score=float(round(score, 2)),
                        reason=reason,
                    )
                )

        return anomalies

    def _extract_features(self, log: ParsedLog) -> np.ndarray:
        level_val = self.LEVEL_MAP.get(log.level, 1)
        msg_len = float(len(log.message))
        message_key = log.message.lower()[:120]
        self.message_counter[message_key] += 1
        frequency = float(self.message_counter[message_key])
        has_trace = 1.0 if log.trace_id else 0.0
        return np.array([level_val, msg_len, np.log1p(frequency), has_trace], dtype=np.float64)

    @staticmethod
    def _normalize_scores(decisions: np.ndarray) -> np.ndarray:
        low, high = float(np.min(decisions)), float(np.max(decisions))
        if abs(high - low) < 1e-9:
            return np.full_like(decisions, 50.0)
        scaled = (high - decisions) / (high - low)
        return np.clip(scaled * 100.0, 0, 100)

    def _cold_start_score(self, log: ParsedLog) -> float:
        base = 10.0
        if log.level == "WARN":
            base += 20
        elif log.level == "ERROR":
            base += 45
        elif log.level == "FATAL":
            base += 65

        lowered = log.message.lower()
        for keyword, bump in {
            "timeout": 15,
            "connection refused": 20,
            "out of memory": 30,
            "crash": 25,
            "panic": 25,
        }.items():
            if keyword in lowered:
                base += bump

        return float(min(100.0, base))

    @staticmethod
    def _window_error_rate(logs: list[ParsedLog]) -> float:
        if not logs:
            return 0.0
        err = sum(1 for item in logs if item.level in {"ERROR", "FATAL"})
        return err / len(logs)

    def _is_error_spike(self, current_error_rate: float) -> bool:
        if len(self.error_rate_history) < 10:
            return False
        baseline = float(np.mean(list(self.error_rate_history)[-10:]))
        return current_error_rate > baseline * 1.8 and current_error_rate > 0.2
