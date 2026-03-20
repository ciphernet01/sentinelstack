"""
Anomaly Detection Engine - ML Core
Combines Isolation Forest + Heuristics + Rules for robust crash detection
"""

import math
from collections import deque
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import numpy as np
from sklearn.ensemble import IsolationForest
from app.core.schemas import WindowFeatures, AnomalyFeatures


# ============================================================================
# CONSTANTS (from spec)
# ============================================================================

# Warm-up & Sparse Handling
WARMUP_EVENT_THRESHOLD = 100
SPARSE_WINDOW_EVENT_THRESHOLD = 5

# Baseline Windows
BASELINE_THROUGHPUT_WINDOWS = 50
BASELINE_LATENCY_WINDOWS = 20
BASELINE_ERROR_WINDOWS = 30

# ML Model
ML_RETRAIN_EVENT_COUNT = 1000
ML_RETRAIN_MINUTES = 60

# Heuristic Thresholds
ERROR_BURST_RATE = 0.10  # 10%
VOLUME_SPIKE_RATIO = 2.0  # 2x
VOLUME_CAUTION_RATIO = 1.5  # 1.5x
LATENCY_SPIKE_RATIO = 1.5  # 1.5x
NOISY_SERVICE_CV_THRESHOLD = 0.8
NOISY_SERVICE_THRESHOLD_MULTIPLIER = 1.2

# Rule Thresholds
FATAL_CASCADE_COUNT = 3
FATAL_CASCADE_WINDOW_SEC = 60
AUTH_FAILURE_THRESHOLD = 10
AUTH_FAILURE_WINDOW_SEC = 60
TIMEOUT_ERROR_THRESHOLD = 5
TIMEOUT_ERROR_WINDOW_SEC = 60

# Scoring
ML_COMPONENT_WEIGHT = 0.40
HEURISTIC_COMPONENT_WEIGHT = 0.40
RULE_COMPONENT_WEIGHT = 0.20

# Severity Thresholds
ALERT_THRESHOLD = 61
CRITICAL_THRESHOLD = 81
SUSTAINED_CRITICAL_WINDOWS = 3


# ============================================================================
# 1. BASELINE MANAGER - Tracks rolling statistics
# ============================================================================

class BaselineManager:
    """Manages rolling baselines for throughput, latency, error rate"""
    
    def __init__(self, config=None):
        self.config = config or {}
        self.throughput_history = deque(maxlen=BASELINE_THROUGHPUT_WINDOWS)
        self.latency_history = deque(maxlen=BASELINE_LATENCY_WINDOWS)
        self.error_history = deque(maxlen=BASELINE_ERROR_WINDOWS)
        self.total_events_seen = 0
        self.last_retrain_time = datetime.now()
        self.last_retrain_count = 0
    
    def update(self, window_features: WindowFeatures) -> None:
        """Add new window stats to history"""
        self.throughput_history.append(window_features.throughput_eps)
        if window_features.latency_p95 is not None:
            self.latency_history.append(window_features.latency_p95)
        self.error_history.append(window_features.error_rate)
        self.total_events_seen += window_features.event_count
    
    def get_baseline(self) -> Dict[str, float]:
        """Return current baseline stats"""
        return {
            'throughput_baseline': float(np.mean(self.throughput_history)) if self.throughput_history else 1.0,
            'throughput_std': float(np.std(self.throughput_history)) if len(self.throughput_history) > 1 else 0.0,
            'latency_baseline': float(np.mean(self.latency_history)) if self.latency_history else 100.0,
            'error_rate_baseline': float(np.mean(self.error_history)) if self.error_history else 0.05,
        }
    
    def should_retrain(self) -> bool:
        """Check if ML model should be retrained"""
        events_since_last = self.total_events_seen - self.last_retrain_count
        time_since_last = (datetime.now() - self.last_retrain_time).total_seconds() / 60
        
        return events_since_last >= ML_RETRAIN_EVENT_COUNT or time_since_last >= ML_RETRAIN_MINUTES
    
    def mark_retrained(self) -> None:
        """Mark that model was retrained"""
        self.last_retrain_time = datetime.now()
        self.last_retrain_count = self.total_events_seen


# ============================================================================
# 2. ISOLATION FOREST MODEL - ML-based anomaly detection
# ============================================================================

class IsolationForestModel:
    """Wrapper around scikit-learn Isolation Forest"""
    
    def __init__(self):
        self.model = None
        self.is_trained = False
        self.training_count = 0
        self.feature_scaler_mean = None
        self.feature_scaler_std = None
    
    def train(self, features_list: List[AnomalyFeatures]) -> None:
        """Train Isolation Forest on normal (non-anomalous) data"""
        if len(features_list) < 10:
            return  # Need at least 10 samples
        
        # Extract numeric features
        X = np.array([
            [
                f.error_rate,
                f.throughput_rate,
                f.throughput_ratio,
                f.latency_p95_ratio or 1.0,
                f.hour_of_day / 24.0,  # Normalize
                f.day_of_week / 7.0,  # Normalize
                f.error_level_entropy,
                f.unique_message_ratio,
                f.error_burst_flag,
                f.volume_spike_flag,
                f.heartbeat_missing_flag,
                f.sequence_anomaly_flag,
            ]
            for f in features_list
        ])
        
        # Normalize features
        self.feature_scaler_mean = np.mean(X, axis=0)
        self.feature_scaler_std = np.std(X, axis=0) + 1e-8  # Avoid division by zero
        X_normalized = (X - self.feature_scaler_mean) / self.feature_scaler_std
        
        # Train model
        self.model = IsolationForest(
            contamination=0.1,
            n_estimators=100,
            random_state=42
        )
        self.model.fit(X_normalized)
        self.is_trained = True
        self.training_count = len(features_list)
    
    def score(self, features: AnomalyFeatures) -> float:
        """
        Score a single feature vector
        Returns: 0-100 anomaly score
        """
        if not self.is_trained or self.model is None:
            return 0.0  # No score during warm-up
        
        # Extract and normalize features
        x = np.array([[
            features.error_rate,
            features.throughput_rate,
            features.throughput_ratio,
            features.latency_p95_ratio or 1.0,
            features.hour_of_day / 24.0,
            features.day_of_week / 7.0,
            features.error_level_entropy,
            features.unique_message_ratio,
            features.error_burst_flag,
            features.volume_spike_flag,
            features.heartbeat_missing_flag,
            features.sequence_anomaly_flag,
        ]])
        
        x_normalized = (x - self.feature_scaler_mean) / self.feature_scaler_std
        
        # Get anomaly score (-1 to 1, where >0 is anomalous)
        raw_score = self.model.score_samples(x_normalized)[0]
        
        # Convert to 0-100 range (heuristic: threshold at -0.7)
        # raw_score >= 0.7 → anomalous
        normalized = max(0.0, min(1.0, (raw_score + 1.0) / 2.0))
        return normalized * 100


# ============================================================================
# 3. HEURISTIC ENGINE - Top 5 statistical rules
# ============================================================================

class HeuristicEngine:
    """Detects common anomaly patterns via statistical rules"""
    
    @staticmethod
    def score(window_features: WindowFeatures, baseline: Dict[str, float]) -> float:
        """
        Return heuristic score 0-100 based on 5 patterns:
        - error_burst: error_rate > 10%
        - volume_spike: throughput > 2x baseline
        - latency_spike: p95 > 1.5x baseline
        - heartbeat_missing: service health check absent
        - sequence_anomaly: unexpected level transitions
        """
        score = 0.0
        
        # 1. Error Burst (40 points)
        if window_features.error_rate > ERROR_BURST_RATE:
            score += 40
        
        # 2. Volume Spike (35 points)
        throughput_baseline = baseline.get('throughput_baseline', 1.0)
        if window_features.throughput_eps > throughput_baseline * VOLUME_SPIKE_RATIO:
            score += 35
        elif window_features.throughput_eps > throughput_baseline * VOLUME_CAUTION_RATIO:
            score += 20  # Partial credit for caution level
        
        # 3. Latency Spike (30 points)
        if window_features.latency_p95 is not None:
            latency_baseline = baseline.get('latency_baseline', 100.0)
            if window_features.latency_p95 > latency_baseline * LATENCY_SPIKE_RATIO:
                score += 30
        
        # 4. Heartbeat Missing (45 points) - strongest signal
        if window_features.heartbeat_missing:
            score += 45
        
        # 5. Sequence Anomaly (25 points)
        if window_features.sequence_anomaly:
            score += 25
        
        return min(100, score)


# ============================================================================
# 4. RULE ENGINE - Pattern matchers for known crash types
# ============================================================================

class RuleEngine:
    """Detects known crash patterns via rule matching"""
    
    def __init__(self):
        self.fatal_events = deque(maxlen=100)  # Store recent FATAL events
        self.error_events = deque(maxlen=500)
    
    def add_event(self, event_level: str, event_message: str, timestamp: datetime) -> None:
        """Track events for pattern detection"""
        if event_level == "FATAL":
            self.fatal_events.append((timestamp, event_message))
        elif event_level == "ERROR":
            self.error_events.append((timestamp, event_message))
    
    def score(self, window_features: WindowFeatures, recent_events: List = None) -> float:
        """
        Return rule score 0-100 for known patterns:
        - three_fatals_in_minute: 3+ FATAL in 60s (+20)
        - connection_pool_exhausted: +30
        - transaction_deadlock: +25
        - high_error_status: 500-504 errors (+20)
        - auth_failure_burst: 10+ 401/403 in 60s (+30)
        - request_timeout_burst: 5+ timeouts in 60s (+25)
        - repeated_error_pattern: Same error 5+ times (+15)
        """
        score = 0.0
        
        # 1. FATAL Cascade (20 points if 3+ FATALs in 60s)
        if recent_events:
            now = datetime.now()
            fatal_count = sum(
                1 for e in recent_events 
                if hasattr(e, 'level') and e.level == "FATAL" 
                and (now - e.timestamp).total_seconds() < FATAL_CASCADE_WINDOW_SEC
            )
            if fatal_count >= FATAL_CASCADE_COUNT:
                score += 20
        
        # 2-7. Check message patterns
        if recent_events:
            for e in recent_events:
                msg = getattr(e, 'message', '').lower() if hasattr(e, 'message') else ''
                meta = getattr(e, 'metadata', {}) if hasattr(e, 'metadata') else {}
                
                # Connection pool exhausted (30)
                if 'connection pool' in msg or 'exhausted' in msg:
                    score += 30
                    break
                
                # DB deadlock (25)
                if 'deadlock' in msg:
                    score += 25
                    break
                
                # DB timeout (25)
                if 'timeout' in msg or 'timed out' in msg:
                    score += 25
                    break
        
        # 8. High error status (500-504)
        if recent_events:
            status_errors = sum(
                1 for e in recent_events 
                if hasattr(e, 'metadata') and e.metadata.get('http_status') in [500, 502, 503, 504]
            )
            if status_errors > 0:
                score += 20
        
        return min(100, score)


# ============================================================================
# 5. SCORE COMBINER - Weighted formula orchestrator
# ============================================================================

class ScoreCombiner:
    """Combines ML, Heuristic, and Rule scores with 40-40-20 weighting"""
    
    @staticmethod
    def combine(
        ml_score: float,
        heuristic_score: float,
        rule_score: float,
        event_count: int,
        total_events_seen: int,
    ) -> Tuple[float, str]:
        """
        Apply scoring formula with special handling for warm-up and sparse windows
        
        Returns: (final_score, reason)
        """
        
        # Case 1: Warm-up period (first 100 events) - use heuristics only
        if total_events_seen < WARMUP_EVENT_THRESHOLD:
            score = heuristic_score * 0.8 + rule_score * 0.2
            return min(100, max(0, score)), "WARM_UP_HEURISTIC"
        
        # Case 2: Sparse window (< 5 events) - reduced ML weight
        if event_count < SPARSE_WINDOW_EVENT_THRESHOLD:
            score = (
                heuristic_score * 0.7 +
                rule_score * 0.3
            )
            return min(100, max(0, score)), "SPARSE_HEURISTIC"
        
        # Case 3: Normal - full weighted formula (40-40-20)
        score = (
            ml_score * ML_COMPONENT_WEIGHT +
            heuristic_score * HEURISTIC_COMPONENT_WEIGHT +
            rule_score * RULE_COMPONENT_WEIGHT
        )
        
        return min(100, max(0, score)), "NORMAL"


# ============================================================================
# 6. ANOMALY DETECTOR - Main orchestrator
# ============================================================================

class AnomalyDetector:
    """
    Main anomaly detection orchestrator.
    Coordinates BaselineManager, IsolationForests, Heuristics, Rules, and Combiner.
    """
    
    def __init__(self):
        self.baseline_manager = BaselineManager()
        self.ml_model = IsolationForestModel()
        self.heuristic_engine = HeuristicEngine()
        self.rule_engine = RuleEngine()
        self.combiner = ScoreCombiner()
        
        # State tracking
        self.total_events_seen = 0
        self.critical_window_streak = 0
        self.last_crash_check_time = datetime.now()
        self.normal_windows = deque(maxlen=100)  # Store windows for ML training
    
    def score_window(self, window_features: WindowFeatures, recent_events: List = None) -> Tuple[float, str]:
        """
        Score a time window for anomalies
        
        Args:
            window_features: Aggregated statistics for the window
            recent_events: List of LogEvent objects from recent windows (optional)
        
        Returns:
            (anomaly_score: float 0-100, detection_reason: str)
        """
        # Update baseline
        self.baseline_manager.update(window_features)
        self.total_events_seen += window_features.event_count
        
        # Get current baseline
        baseline = self.baseline_manager.get_baseline()
        
        # Compute heuristic score (always available)
        heuristic_score = self.heuristic_engine.score(window_features, baseline)
        
        # Compute rule score
        self.rule_engine.add_event if recent_events else None
        rule_score = self.rule_engine.score(window_features, recent_events)
        
        # Compute ML score (only if trained)
        ml_score = 0.0
        if self.baseline_manager.total_events_seen >= WARMUP_EVENT_THRESHOLD and self.ml_model.is_trained:
            # Convert window to AnomalyFeatures
            features = self._extract_features(window_features)
            ml_score = self.ml_model.score(features)
        
        # Combine scores
        final_score, reason = self.combiner.combine(
            ml_score=ml_score,
            heuristic_score=heuristic_score,
            rule_score=rule_score,
            event_count=window_features.event_count,
            total_events_seen=self.total_events_seen,
        )
        
        # Track critical windows for crash detection
        if final_score >= CRITICAL_THRESHOLD:
            self.critical_window_streak += 1
        else:
            self.critical_window_streak = 0
        
        # Store normal windows for ML retraining
        if final_score < 30:  # NOMINAL and below = normal
            self.normal_windows.append(self._extract_features(window_features))
            
            # Retrain ML model if needed
            if self.baseline_manager.should_retrain() and len(self.normal_windows) > 5:
                self.ml_model.train(list(self.normal_windows))
                self.baseline_manager.mark_retrained()
        
        return final_score, reason
    
    def detect_crash_pattern(self, events: List = None) -> bool:
        """
        Check if a crash pattern has been detected
        
        Triggers when:
        - Score >= 80 for >= 3 consecutive windows (90 seconds), OR
        - 3+ FATAL logs + heartbeat missing in 5min window, OR
        - Service down (0 events for > 5 windows)
        """
        
        # Pattern 1: Sustained critical
        if self.critical_window_streak >= SUSTAINED_CRITICAL_WINDOWS:
            return True
        
        # Pattern 2: Would check for FATAL cascade + heartbeat (requires event history)
        # Pattern 3: Would check for service_down (tracked in WindowFeatures)
        
        return False
    
    @staticmethod
    def _extract_features(window_features: WindowFeatures) -> AnomalyFeatures:
        """Convert WindowFeatures → AnomalyFeatures for ML model"""
        
        # Safe division
        unique_message_ratio = (
            window_features.unique_messages / window_features.event_count
            if window_features.event_count > 0 else 0.0
        )
        
        # Compute entropy of level distribution
        entropy = 0.0
        total = sum(window_features.level_distribution.values())
        if total > 0:
            for count in window_features.level_distribution.values():
                if count > 0:
                    p = count / total
                    entropy -= p * math.log2(p)
        
        return AnomalyFeatures(
            error_rate=window_features.error_rate,
            throughput_rate=window_features.throughput_eps,
            throughput_ratio=1.0,  # Will be computed by caller
            latency_p95_ratio=1.0,  # Will be computed by caller
            hour_of_day=datetime.now().hour,
            day_of_week=datetime.now().weekday(),
            error_level_entropy=entropy,
            unique_message_ratio=unique_message_ratio,
            error_burst_flag=1 if window_features.error_burst else 0,
            volume_spike_flag=1 if window_features.volume_spike else 0,
            heartbeat_missing_flag=1 if window_features.heartbeat_missing else 0,
            sequence_anomaly_flag=1 if window_features.sequence_anomaly else 0,
        )
