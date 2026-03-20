"""
Crash Report Generator - Root Cause Analysis Engine
Generates human-readable crash reports from anomaly windows.
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from collections import deque

from app.core.schemas import (
    WindowFeatures, LogEvent, CrashReport, TimelineEntry
)
from app.detect.anomaly import AnomalyDetector


class CrashReportGenerator:
    """
    Generates root cause analysis (RCA) reports from detected crash patterns.
    
    Triggers when:
    - Score >= 81 for >= 3 consecutive windows (crash detection)
    - FATAL cascade + heartbeat missing
    - Service down (0 events for 5+ windows)
    """
    
    def __init__(self, detector: AnomalyDetector = None):
        self.detector = detector
        self.report_history = deque(maxlen=100)  # Keep last 100 reports
        self.service_dependency_map = {}  # service → [dependents]
    
    def generate(
        self,
        window_features: WindowFeatures,
        anomaly_score: float,
        recent_events: Optional[List[LogEvent]] = None,
        service_dependency_map: Optional[Dict[str, List[str]]] = None
    ) -> Dict:
        """
        Generate crash report for detected crash.
        
        Args:
            window_features: Anomalous time window
            anomaly_score: ML detector score (0-100)
            recent_events: Recent LogEvents for timeline
            service_dependency_map: Service dependency relationships
        
        Returns:
            {
                "report_id": "crash-20260320-001",
                "generated_at": "2026-03-20T10:35:12Z",
                "service": "auth-service",
                "first_anomalous_event": {...},
                "probable_root_cause": "...",
                "confidence": 0.87,
                "timeline": [...],
                "affected_services": [...],
                "recommended_actions": [...],
                "evidence": {...}
            }
        """
        
        report_id = f"crash-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"
        
        # Build root cause hypothesis
        root_cause, confidence = self._analyze_root_cause(
            window_features=window_features,
            anomaly_score=anomaly_score,
            recent_events=recent_events
        )
        
        # Build timeline
        timeline = self._build_timeline(window_features, recent_events)
        
        # Identify affected services
        affected_services = self._identify_affected_services(
            window_features, recent_events
        )
        
        # Build dependency map
        if service_dependency_map:
            self.service_dependency_map.update(service_dependency_map)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            root_cause=root_cause,
            window_features=window_features,
            affected_services=affected_services
        )
        
        # Build report
        report = {
            "report_id": report_id,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "service": window_features.service,
            
            # Root Cause
            "first_anomalous_event": {
                "timestamp": window_features.window_start.isoformat(),
                "service": window_features.service,
                "anomaly_score": round(anomaly_score, 2),
                "event_count": window_features.event_count,
                "error_rate": round(window_features.error_rate, 3)
            },
            
            "probable_root_cause": root_cause,
            "confidence": round(confidence, 2),
            
            # Timeline
            "timeline": timeline,
            
            # Impact
            "affected_services": affected_services,
            "service_dependencies": self.service_dependency_map.get(
                window_features.service, []
            ),
            
            # Actions
            "recommended_actions": recommendations,
            
            # Supporting Evidence
            "evidence": {
                "window_features": {
                    "duration_sec": window_features.duration_sec,
                    "event_count": window_features.event_count,
                    "error_count": window_features.error_count,
                    "error_rate": round(window_features.error_rate, 3),
                    "throughput_eps": round(window_features.throughput_eps, 2),
                    "latency_p95": window_features.latency_p95,
                    "latency_p99": window_features.latency_p99,
                    "unique_messages": window_features.unique_messages
                },
                "anomaly_indicators": {
                    "heartbeat_missing": window_features.heartbeat_missing,
                    "error_burst": window_features.error_burst,
                    "volume_spike": window_features.volume_spike,
                    "sequence_anomaly": window_features.sequence_anomaly,
                    "service_down": window_features.service_down
                },
                "top_error_messages": window_features.top_error_messages[:5],
                "level_distribution": window_features.level_distribution
            }
        }
        
        # Store in history
        self.report_history.append(report)
        
        return report
    
    def _analyze_root_cause(
        self,
        window_features: WindowFeatures,
        anomaly_score: float,
        recent_events: Optional[List] = None
    ) -> tuple:
        """
        Analyze anomaly patterns to hypothesize root cause.
        Returns: (root_cause_string, confidence_0_to_1)
        """
        
        confidence = 0.5  # Base confidence
        root_cause_signals = []
        
        # Signal 1: Error Burst
        if window_features.error_rate > 0.20:  # > 20%
            root_cause_signals.append({
                "signal": "Severe Error Rate Increase",
                "rate": window_features.error_rate,
                "confidence_boost": 0.15
            })
            confidence += 0.15
        
        # Signal 2: Volume Spike
        if window_features.volume_spike:
            root_cause_signals.append({
                "signal": "Traffic Volume Spike",
                "confidence_boost": 0.10
            })
            confidence += 0.10
        
        # Signal 3: Heartbeat Missing
        if window_features.heartbeat_missing:
            root_cause_signals.append({
                "signal": "Service Health Check Absent",
                "confidence_boost": 0.12
            })
            confidence += 0.12
        
        # Signal 4: Latency Degradation
        if window_features.latency_p99 and window_features.latency_p99 > 5000:
            root_cause_signals.append({
                "signal": "Critical Latency Degradation (p99 > 5s)",
                "latency_p99": window_features.latency_p99,
                "confidence_boost": 0.10
            })
            confidence += 0.10
        
        # Signal 5: Message Pattern Analysis
        if recent_events:
            # Check for specific error patterns
            connection_errors = sum(
                1 for e in recent_events 
                if 'connection' in str(getattr(e, 'message', '')).lower()
            )
            if connection_errors > len(recent_events) * 0.3:
                root_cause_signals.append({
                    "signal": "Connection/Pool Exhaustion Pattern",
                    "confidence_boost": 0.15
                })
                confidence += 0.15
            
            # Deadlock pattern
            deadlock_errors = sum(
                1 for e in recent_events 
                if 'deadlock' in str(getattr(e, 'message', '')).lower()
            )
            if deadlock_errors > 5:
                root_cause_signals.append({
                    "signal": "Database Deadlock Pattern",
                    "confidence_boost": 0.18
                })
                confidence += 0.18
            
            # Timeout pattern
            timeout_errors = sum(
                1 for e in recent_events 
                if 'timeout' in str(getattr(e, 'message', '')).lower()
            )
            if timeout_errors > len(recent_events) * 0.2:
                root_cause_signals.append({
                    "signal": "Request Timeout Pattern",
                    "confidence_boost": 0.12
                })
                confidence += 0.12
        
        # Build root cause narrative
        if confidence > 0.85:
            if any('Connection' in s.get('signal', '') for s in root_cause_signals):
                root_cause = "Database connection pool exhaustion - cascading timeouts detected"
            elif any('Deadlock' in s.get('signal', '') for s in root_cause_signals):
                root_cause = "Database deadlock - transaction conflicts causing service collapse"
            elif any('Latency' in s.get('signal', '') for s in root_cause_signals):
                root_cause = "Critical latency degradation - possible resource exhaustion or dependency timeout"
            else:
                root_cause = f"Combined anomaly detected: {', '.join(s['signal'] for s in root_cause_signals[:2])}"
        else:
            root_cause = f"Multiple anomaly indicators: {', '.join(s['signal'] for s in root_cause_signals[:3]) if root_cause_signals else 'Unknown pattern'}"
        
        confidence = min(1.0, confidence)
        
        return root_cause, confidence
    
    def _build_timeline(
        self,
        window_features: WindowFeatures,
        recent_events: Optional[List] = None
    ) -> List[Dict]:
        """Build chronological timeline of events leading to crash"""
        
        timeline = []
        
        # Event 1: Anomaly window start
        timeline.append({
            "timestamp": window_features.window_start.isoformat(),
            "event": f"Anomaly window started ({window_features.event_count} events)",
            "severity": "INFO"
        })
        
        # Event 2: Error rate change
        if window_features.error_rate > 0.10:
            timeline.append({
                "timestamp": (window_features.window_start + timedelta(seconds=10)).isoformat(),
                "event": f"Error rate elevated to {window_features.error_rate*100:.1f}%",
                "severity": "WARNING"
            })
        
        # Event 3: Volume indicator
        if window_features.volume_spike:
            timeline.append({
                "timestamp": (window_features.window_start + timedelta(seconds=20)).isoformat(),
                "event": f"Traffic spike detected ({window_features.throughput_eps:.1f} eps)",
                "severity": "WARNING"
            })
        
        # Event 4: Service health
        if window_features.heartbeat_missing:
            timeline.append({
                "timestamp": (window_features.window_start + timedelta(seconds=30)).isoformat(),
                "event": "Health check heartbeat missing - service may be unresponsive",
                "severity": "CRITICAL"
            })
        
        # Event 5: Window end (critical state)
        timeline.append({
            "timestamp": window_features.window_end.isoformat(),
            "event": "Anomaly window ended - sustained anomaly confirmed",
            "severity": "CRITICAL"
        })
        
        return timeline
    
    def _identify_affected_services(
        self,
        window_features: WindowFeatures,
        recent_events: Optional[List] = None
    ) -> List[str]:
        """Identify all services affected by the crash"""
        
        affected = [window_features.service]
        
        # Extract unique services from recent events
        if recent_events:
            for event in recent_events:
                service = getattr(event, 'service', None)
                if service and service != window_features.service and service not in affected:
                    affected.append(service)
        
        # Add dependency-based affected services
        if window_features.service in self.service_dependency_map:
            for dependent in self.service_dependency_map[window_features.service]:
                if dependent not in affected:
                    affected.append(dependent)
        
        return affected[:10]  # Limit to 10
    
    def _generate_recommendations(
        self,
        root_cause: str,
        window_features: WindowFeatures,
        affected_services: List[str]
    ) -> List[str]:
        """Generate actionable recommendations based on root cause"""
        
        recommendations = []
        
        # Normalize root cause text for pattern matching
        cause_lower = root_cause.lower()
        
        if 'connection pool' in cause_lower or 'pool exhaustion' in cause_lower:
            recommendations.extend([
                "IMMEDIATE: Scale database connection pool (increase max connections by 2x)",
                "Investigate long-running queries blocking connection release",
                "Add connection pool monitoring and alerting",
                "Implement circuit breaker pattern for database calls",
                "Review transaction timeout settings"
            ])
        
        if 'deadlock' in cause_lower:
            recommendations.extend([
                "IMMEDIATE: Identify deadlocking transactions in database logs",
                "Review transaction isolation levels and lock ordering",
                "Refactor code to reduce lock contention",
                "Enable database deadlock detection/auto-rollback"
            ])
        
        if 'latency' in cause_lower or 'timeout' in cause_lower:
            recommendations.extend([
                "IMMEDIATE: Investigate slow queries or external service calls",
                "Check database query performance (identify slow queries)",
                "Review timeout thresholds for external dependencies",
                "Add distributed tracing to identify bottleneck components"
            ])
        
        if 'error rate' in cause_lower or 'error' in cause_lower:
            recommendations.extend([
                "Review application error logs for stack traces",
                "Check recently deployed code changes",
                "Validate dependency health (DB, cache, APIs)"
            ])
        
        # Generic recommendations
        if not recommendations:
            recommendations.extend([
                "Review full anomaly window in detailed logs",
                "Check system resource utilization (CPU, memory, disk)",
                "Validate all service dependencies are healthy",
                "Review recent deployments and configuration changes"
            ])
        
        recommendations.extend([
            f"Scale affected services: {', '.join(affected_services[:3])}",
            "Post-incident: Conduct RCA and update runbooks",
            "Implement automated mitigation for this pattern"
        ])
        
        return recommendations[:8]  # Top 8 recommendations
    
    def get_recent_reports(self, limit: int = 50) -> List[Dict]:
        """Retrieve recent crash reports"""
        reports = list(self.report_history)
        return reports[-limit:] if limit else reports
    
    def get_report_by_id(self, report_id: str) -> Optional[Dict]:
        """Retrieve specific crash report by ID"""
        for report in self.report_history:
            if report.get('report_id') == report_id:
                return report
        return None
    
    def set_service_dependencies(self, dependency_map: Dict[str, List[str]]) -> None:
        """Set service dependency relationships"""
        self.service_dependency_map = dependency_map
