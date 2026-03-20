from __future__ import annotations

from collections import Counter
from datetime import datetime
import math

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

    LEVEL_WEIGHT = {"DEBUG": 1, "INFO": 2, "WARN": 3, "ERROR": 4, "FATAL": 5}

    def build_report(
        self,
        first_signal: dict | None,
        timeline: list[dict],
        anomalies: list[AnomalyRecord],
    ) -> CrashReport:
        timeline = sorted(timeline, key=lambda item: item.get("timestamp", ""))
        affected_services = sorted({item["service"] for item in timeline if item.get("service")})
        probable_cause = self._infer_root_cause(timeline)
        trace_correlations = self._correlate_by_trace(timeline)
        cascading_failures = self._detect_cascading_failures(trace_correlations)
        causal_chain = self._build_causal_chain(cascading_failures, probable_cause)
        crash_prediction = self._predict_crash_probability(anomalies, timeline)
        confidence, confidence_explanation = self._confidence(
            first_signal=first_signal,
            anomalies=anomalies,
            root_cause=probable_cause,
            cascading_failures=cascading_failures,
            crash_prediction=crash_prediction,
        )

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
            confidence_explanation=confidence_explanation,
            causal_chain=causal_chain,
            cascading_failures=cascading_failures,
            crash_prediction=crash_prediction,
            suggested_fix="",
            similar_incidents=[],
        )

    def _correlate_by_trace(self, timeline: list[dict]) -> dict[str, list[dict]]:
        trace_map: dict[str, list[dict]] = {}
        for item in timeline:
            trace_id = item.get("trace_id")
            if not trace_id:
                continue
            trace_map.setdefault(str(trace_id), []).append(item)

        for trace_id in list(trace_map.keys()):
            trace_map[trace_id] = sorted(trace_map[trace_id], key=lambda x: x.get("timestamp", ""))
            services = {event.get("service") for event in trace_map[trace_id] if event.get("service")}
            if len(services) < 2:
                del trace_map[trace_id]

        return trace_map

    def _detect_cascading_failures(self, trace_correlations: dict[str, list[dict]]) -> list[dict]:
        edges: dict[tuple[str, str], dict] = {}

        for trace_id, events in trace_correlations.items():
            for previous, current in zip(events, events[1:]):
                src = str(previous.get("service") or "unknown")
                dst = str(current.get("service") or "unknown")
                if src == dst:
                    continue

                prev_level = self.LEVEL_WEIGHT.get(str(previous.get("level") or "INFO").upper(), 2)
                curr_level = self.LEVEL_WEIGHT.get(str(current.get("level") or "INFO").upper(), 2)
                severity_shift = curr_level - prev_level

                edge_key = (src, dst)
                if edge_key not in edges:
                    edges[edge_key] = {
                        "from_service": src,
                        "to_service": dst,
                        "count": 0,
                        "severity_shift": 0,
                        "trace_ids": set(),
                    }

                edge = edges[edge_key]
                edge["count"] += 1
                edge["severity_shift"] += severity_shift
                edge["trace_ids"].add(trace_id)

        cascades = []
        for edge in edges.values():
            cascades.append(
                {
                    "from_service": edge["from_service"],
                    "to_service": edge["to_service"],
                    "count": edge["count"],
                    "avg_severity_shift": round(edge["severity_shift"] / max(edge["count"], 1), 2),
                    "trace_count": len(edge["trace_ids"]),
                }
            )

        cascades.sort(key=lambda item: (item["count"], item["trace_count"]), reverse=True)
        return cascades[:10]

    def _build_causal_chain(self, cascading_failures: list[dict], root_cause: str) -> list[str]:
        if cascading_failures:
            primary = cascading_failures[0]
            chain = [primary["from_service"], primary["to_service"]]

            next_links = [item for item in cascading_failures[1:] if item["from_service"] == chain[-1]]
            if next_links:
                chain.append(next_links[0]["to_service"])

            suffix = "DB failure" if "database" in root_cause.lower() else root_cause
            chain.append(suffix)
            return [" -> ".join(chain)]

        if "database" in root_cause.lower():
            return ["app -> service -> DB failure"]
        return [f"service -> {root_cause}"]

    def _predict_crash_probability(self, anomalies: list[AnomalyRecord], timeline: list[dict]) -> dict:
        scores = [float(item.get("anomaly_score", 0.0)) for item in timeline if float(item.get("anomaly_score", 0.0)) > 0]
        if not scores and anomalies:
            scores = [float(a.score) for a in anomalies]

        recent = scores[-20:] if scores else []
        if len(recent) < 3:
            return {
                "window_minutes": 5,
                "probability": 0.0,
                "probability_score": 0.0,
                "trend": "insufficient_data",
                "explanation": "Insufficient anomaly history to estimate crash risk.",
            }

        x_mean = (len(recent) - 1) / 2
        y_mean = sum(recent) / len(recent)
        denom = sum((idx - x_mean) ** 2 for idx in range(len(recent)))
        slope = 0.0 if denom == 0 else sum((idx - x_mean) * (score - y_mean) for idx, score in enumerate(recent)) / denom

        avg_score = y_mean / 100.0
        slope_norm = max(0.0, min(1.0, slope / 10.0))
        signal = (avg_score * 0.7) + (slope_norm * 0.3)
        probability = 1.0 / (1.0 + math.exp(-6 * (signal - 0.45)))

        trend = "rising" if slope > 1.5 else "stable" if slope >= -1.5 else "falling"
        return {
            "window_minutes": 5,
            "probability": round(probability, 4),
            "probability_score": round(probability * 100.0, 2),
            "trend": trend,
            "avg_recent_anomaly_score": round(y_mean, 2),
            "slope": round(slope, 3),
            "explanation": f"Trend is {trend} with average anomaly score {round(y_mean, 2)} over recent events.",
        }

    def _infer_root_cause(self, timeline: list[dict]) -> str:
        lowered_messages = "\n".join(item.get("message", "") for item in timeline).lower()
        for pattern, cause in self.ROOT_CAUSE_PATTERNS.items():
            if pattern in lowered_messages:
                return cause

        service_counter = Counter(item.get("service", "unknown") for item in timeline)
        hot_service, _ = service_counter.most_common(1)[0] if service_counter else ("unknown", 0)
        return f"Anomaly concentration observed in {hot_service}; likely cascading service degradation"

    @staticmethod
    def _confidence(
        first_signal: dict | None,
        anomalies: list[AnomalyRecord],
        root_cause: str,
        cascading_failures: list[dict],
        crash_prediction: dict,
    ) -> tuple[float, str]:
        base = 45.0
        notes = []
        if first_signal:
            base += 20.0
            notes.append("first anomaly signal identified")
        if len(anomalies) >= 5:
            base += 15.0
            notes.append("multiple anomaly samples available")
        if cascading_failures:
            base += 10.0
            notes.append("cross-service cascade evidence detected")
        if (crash_prediction.get("probability") or 0) >= 0.7:
            base += 5.0
            notes.append("short-term crash risk trend is elevated")
        if "likely" not in root_cause.lower():
            base += 10.0
            notes.append("root cause matched known error pattern")

        confidence = float(min(100.0, base))
        explanation = (
            f"Confidence {round(confidence, 1)} based on " + ", ".join(notes)
            if notes
            else f"Confidence {round(confidence, 1)} with limited corroborating signals"
        )
        return confidence, explanation
