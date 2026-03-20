"""
Enhancement Integration Module - Wires all Phase 1-5 enhancements into detection pipeline
Orchestrates ensemble detection, online learning, forecasting, causal RCA, and NLP
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime
import numpy as np

from app.core.schemas import WindowFeatures, LogEvent
from app.enhance.ensemble_detector import EnsembleAnomalyDetector
from app.enhance.arima_baseline import ARIMABaselineManager
from app.enhance.online_learning import AdaptiveBaselineManager, ActiveLearningFeedback, ConceptDriftDetector
from app.enhance.forecasting import CrashForecastingEngine, ResourceForecastingEngine
from app.enhance.causal_rca import CausalRCAEngine
from app.enhance.service_dependency import ServiceDependencyGraph
from app.enhance.error_nlp import ErrorMessageAnalyzer, BehavioralAnomalyDetector


# ============================================================================
# ENHANCEMENT INTEGRATION ENGINE
# ============================================================================

class EnhancementIntegrationEngine:
    """
    Orchestrates all Phase 1-5 enhancements:
    - Phase 1: 5-model ensemble + autoencoder + ARIMA
    - Phase 2: Causal RCA + service dependency
    - Phase 3: Online learning + concept drift
    - Phase 4: Crash & resource forecasting
    - Phase 5: NLP error analysis + behavioral detection
    """
    
    def __init__(self):
        """Initialize all enhancement modules"""
        
        # Phase 1: Detection Ensemble
        self.ensemble_detector = EnsembleAnomalyDetector()
        self.arima_baseline = ARIMABaselineManager()
        
        # Phase 2: RCA & Dependency
        self.causal_rca = CausalRCAEngine()
        self.service_dependency = ServiceDependencyGraph()
        
        # Phase 3: Online Learning
        self.adaptive_baseline = AdaptiveBaselineManager()
        self.active_learning = ActiveLearningFeedback()
        self.drift_detector = ConceptDriftDetector()
        
        # Phase 4: Forecasting
        self.crash_forecaster = CrashForecastingEngine()
        self.resource_forecaster = ResourceForecastingEngine()
        
        # Phase 5: NLP & Behavior
        self.nlp_analyzer = ErrorMessageAnalyzer()
        self.behavior_detector = BehavioralAnomalyDetector()
        
        # State
        self.history = []  # Keep recent windows for forecasting
        self.max_history = 100
    
    def enhance_score(
        self,
        original_score: float,
        window_features: WindowFeatures,
        recent_events: Optional[List[LogEvent]] = None,
    ) -> Dict:
        """
        Enhance ML score with ensemble voting + ARIMA trend + online learning
        
        Returns enhanced score object:
        {
            "original_score": float,
            "ensemble_score": float,
            "arima_trend": str ("stable", "degrading", "improving"),
            "adaptive_baseline_adjusted": float,
            "drift_detected": bool,
            "final_enhanced_score": float (weighted combination),
            "confidence": float (0-1),
            "enhancement_details": {...}
        }
        """
        
        # Phase 1: Ensemble voting (5 models)
        ensemble_anomalies = []
        if recent_events:
            for event in recent_events:
                is_anomaly = self.ensemble_detector.predict(event)
                if is_anomaly:
                    ensemble_anomalies.append(event)
        
        ensemble_score = (len(ensemble_anomalies) / max(1, len(recent_events))) * 100 if recent_events else 0
        
        # Phase 3: Check concept drift
        drift_detected = self.drift_detector.check_drift(
            current_error_rate=window_features.error_rate,
            current_throughput=window_features.throughput_eps
        )
        
        # Phase 3: Adaptive baseline adjustment
        adaptive_baseline = self.adaptive_baseline.get_baseline(window_features)
        adaptive_score = self._compute_adaptive_score(window_features, adaptive_baseline)
        
        # Phase 1: ARIMA trend detection
        arima_result = self.arima_baseline.analyze(window_features)
        arima_trend = arima_result.get('trend', 'stable')
        arima_anomaly_score = arima_result.get('anomaly_score', 0)
        
        # Combine: 40% original + 35% ensemble + 25% online learning
        final_enhanced_score = (
            original_score * 0.40 +
            ensemble_score * 0.35 +
            adaptive_score * 0.25
        )
        
        # Boost if ARIMA detects sustained degradation
        if arima_trend == 'degrading' and arima_anomaly_score > 70:
            final_enhanced_score = min(100, final_enhanced_score * 1.15)
        
        # Confidence: based on agreement between models
        agreement_score = abs(original_score - ensemble_score) / 100
        confidence = 1.0 - min(agreement_score, 0.3)  # Max 30% penalty for disagreement
        
        return {
            "original_score": round(original_score, 2),
            "ensemble_score": round(ensemble_score, 2),
            "arima_trend": arima_trend,
            "arima_anomaly_score": round(arima_anomaly_score, 2),
            "adaptive_baseline_adjusted": round(adaptive_score, 2),
            "drift_detected": drift_detected,
            "final_enhanced_score": round(final_enhanced_score, 2),
            "confidence": round(confidence, 3),
            "enhancement_source": "Phase1_Ensemble + Phase3_OnlineLearning + Phase1_ARIMA"
        }
    
    def analyze_root_cause(
        self,
        window_features: WindowFeatures,
        anomaly_score: float,
        recent_events: Optional[List[LogEvent]] = None,
    ) -> Dict:
        """
        Phase 2: Advanced root cause analysis using causal inference.
        
        Returns:
        {
            "primary_cause": str,
            "confidence": float (0-1),
            "causal_chain": [{"cause": str, "probability": float}, ...],
            "affected_services": [service names],
            "cascade_analysis": {...},
            "recommended_actions": [str],
        }
        """
        
        # Learn service dependencies from current data
        if recent_events:
            services = set()
            for event in recent_events:
                if hasattr(event, 'service'):
                    services.add(event.service)
            
            # Update dependency graph
            for service in services:
                for other_service in services:
                    if service != other_service:
                        self.service_dependency.add_edge(service, other_service)
        
        # Perform causal analysis
        causes = self.causal_rca.infer_causes(
            error_rate=window_features.error_rate,
            throughput=window_features.throughput_eps,
            latency=window_features.latency_p95 or 0,
            error_types=list(window_features.level_distribution.keys())
        )
        
        # Analyze cascading failures
        cascade_info = self.service_dependency.analyze_cascade(
            service=window_features.service,
            anomaly_severity=anomaly_score / 100.0
        )
        
        # Get incident response recommendations
        recommendations = self.service_dependency.get_recommendations(
            affected_service=window_features.service,
            cascade_services=cascade_info.get('affected_services', [])
        )
        
        return {
            "primary_cause": causes[0]['cause'] if causes else "Unknown",
            "confidence": causes[0]['probability'] if causes else 0.0,
            "causal_chain": causes[:3],  # Top 3 causes
            "affected_services": cascade_info.get('affected_services', []),
            "cascade_analysis": {
                "is_cascade": cascade_info.get('is_cascade', False),
                "severity": cascade_info.get('severity', 'LOW'),
                "propagation_path": cascade_info.get('propagation_path', [])
            },
            "recommended_actions": recommendations[:5] if recommendations else [],
            "analysis_source": "Phase2_CausalRCA + ServiceDependencyGraph"
        }
    
    def forecast_issues(
        self,
        window_features: WindowFeatures,
        recent_windows: Optional[List[WindowFeatures]] = None,
    ) -> Dict:
        """
        Phase 4: Predict crashes and resource exhaustion 5+ minutes ahead.
        
        Returns:
        {
            "crash_prediction": {
                "will_crash": bool,
                "probability": float (0-1),
                "time_to_crash_minutes": int,
                "confidence": float
            },
            "resource_forecast": {
                "cpu_exhaustion": {...},
                "memory_exhaustion": {...},
                "disk_exhaustion": {...}
            },
            "recommendations": [str],
            "urgency": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
        }
        """
        
        # Crash prediction
        crash_pred = self.crash_forecaster.forecast(window_features)
        
        # Resource forecasting
        resource_pred_cpu = self.resource_forecaster.forecast_cpu(window_features)
        resource_pred_memory = self.resource_forecaster.forecast_memory(window_features)
        resource_pred_disk = self.resource_forecaster.forecast_disk(window_features)
        
        # Determine urgency
        urgency = "LOW"
        if crash_pred.get('probability', 0) > 0.8 or any(
            r.get('probability', 0) > 0.9 
            for r in [resource_pred_cpu, resource_pred_memory, resource_pred_disk]
        ):
            urgency = "CRITICAL"
        elif crash_pred.get('probability', 0) > 0.6 or any(
            r.get('probability', 0) > 0.7 
            for r in [resource_pred_cpu, resource_pred_memory, resource_pred_disk]
        ):
            urgency = "HIGH"
        elif crash_pred.get('probability', 0) > 0.4:
            urgency = "MEDIUM"
        
        return {
            "crash_prediction": {
                "will_crash": crash_pred.get('will_crash', False),
                "probability": round(crash_pred.get('probability', 0), 3),
                "time_to_crash_minutes": crash_pred.get('time_to_crash_minutes', 0),
                "confidence": round(crash_pred.get('confidence', 0), 3)
            },
            "resource_forecast": {
                "cpu": {
                    "projected_utilization": round(resource_pred_cpu.get('projected_utilization', 0), 2),
                    "exhaustion_probability": round(resource_pred_cpu.get('probability', 0), 3),
                    "time_to_exhaustion": resource_pred_cpu.get('time_to_exhaustion_minutes', 0)
                },
                "memory": {
                    "projected_utilization": round(resource_pred_memory.get('projected_utilization', 0), 2),
                    "exhaustion_probability": round(resource_pred_memory.get('probability', 0), 3),
                    "time_to_exhaustion": resource_pred_memory.get('time_to_exhaustion_minutes', 0)
                },
                "disk": {
                    "projected_utilization": round(resource_pred_disk.get('projected_utilization', 0), 2),
                    "exhaustion_probability": round(resource_pred_disk.get('probability', 0), 3),
                    "time_to_exhaustion": resource_pred_disk.get('time_to_exhaustion_minutes', 0)
                }
            },
            "recommendations": [
                f"Scale {resource_pred_cpu['recommendation']}" if resource_pred_cpu.get('recommendation') else None,
                f"Investigate {resource_pred_memory['recommendation']}" if resource_pred_memory.get('recommendation') else None,
            ],
            "urgency": urgency,
            "analysis_source": "Phase4_CrashForecasting + ResourceForecasting"
        }
    
    def analyze_errors_nlp(
        self,
        recent_events: Optional[List[LogEvent]] = None,
    ) -> Dict:
        """
        Phase 5: NLP-based error analysis and behavioral anomaly detection.
        
        Returns:
        {
            "error_categories": [
                {"category": str, "count": int, "examples": [str]},
                ...
            ],
            "behavior_patterns": [
                {"pattern": str, "confidence": float, "is_anomalous": bool},
                ...
            ],
            "top_error_templates": [str],
            "behavioral_anomalies_detected": int,
        }
        """
        
        if not recent_events:
            return {
                "error_categories": [],
                "behavior_patterns": [],
                "top_error_templates": [],
                "behavioral_anomalies_detected": 0
            }
        
        # NLP error categorization
        error_categories = {}
        for event in recent_events:
            msg = getattr(event, 'message', '') if hasattr(event, 'message') else ''
            level = getattr(event, 'level', 'INFO') if hasattr(event, 'level') else 'INFO'
            
            category = self.nlp_analyzer.categorize_error(msg, level)
            if category not in error_categories:
                error_categories[category] = {'count': 0, 'messages': set()}
            
            error_categories[category]['count'] += 1
            error_categories[category]['messages'].add(msg[:80])  # Store first 80 chars
        
        # Behavioral anomaly detection
        behavioral_anomalies = 0
        behavior_patterns = []
        
        for event in recent_events:
            if self.behavior_detector.is_anomalous(event):
                behavioral_anomalies += 1
                behavior_patterns.append({
                    "pattern": f"Service {event.service} shows unusual behavior",
                    "confidence": 0.75,
                    "is_anomalous": True
                })
        
        # Top error templates
        top_templates = self.nlp_analyzer.get_error_templates(recent_events)[:5]
        
        return {
            "error_categories": [
                {
                    "category": cat,
                    "count": data['count'],
                    "examples": list(data['messages'])[:3]
                }
                for cat, data in sorted(
                    error_categories.items(),
                    key=lambda x: x[1]['count'],
                    reverse=True
                )[:5]
            ],
            "behavior_patterns": behavior_patterns[:3],
            "top_error_templates": top_templates,
            "behavioral_anomalies_detected": behavioral_anomalies,
            "analysis_source": "Phase5_NLP + BehavioralAnomaly"
        }
    
    def learn_from_feedback(self, report_id: str, was_incident: bool, feedback_text: str = "") -> None:
        """
        Phase 3: Active learning - improve models based on user feedback
        """
        self.active_learning.provide_feedback(
            report_id=report_id,
            was_actual_incident=was_incident,
            feedback=feedback_text
        )
    
    def _compute_adaptive_score(
        self,
        window_features: WindowFeatures,
        adaptive_baseline: Dict
    ) -> float:
        """Compute anomaly score using adaptive baselines"""
        
        score = 0.0
        
        # Error rate deviation from adaptive baseline
        error_threshold = adaptive_baseline.get('error_baseline', 0.05)
        if window_features.error_rate > error_threshold * 1.5:
            score += 30
        elif window_features.error_rate > error_threshold * 1.2:
            score += 15
        
        # Throughput deviation
        throughput_baseline = adaptive_baseline.get('throughput_baseline', 100.0)
        if window_features.throughput_eps > throughput_baseline * 2.0:
            score += 35
        elif window_features.throughput_eps > throughput_baseline * 1.5:
            score += 20
        
        # Latency deviation
        if window_features.latency_p95:
            latency_baseline = adaptive_baseline.get('latency_baseline', 200.0)
            if window_features.latency_p95 > latency_baseline * 1.5:
                score += 25
        
        # Service health
        if window_features.heartbeat_missing:
            score += 40
        
        return min(100, score)
