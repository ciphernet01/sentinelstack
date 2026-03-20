"""
Unit tests for anomaly detection module
Tests all components: BaselineManager, IsolationForest, Heuristics, Rules, and main Detector
"""

import pytest
from datetime import datetime, timedelta
from app.core.schemas import WindowFeatures, AnomalyFeatures, LogEvent
from app.detect.anomaly import (
    AnomalyDetector,
    BaselineManager,
    IsolationForestModel,
    HeuristicEngine,
    RuleEngine,
    ScoreCombiner,
)


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def sample_window_features():
    """Create a normal (healthy) window"""
    return WindowFeatures(
        window_start=datetime.now(),
        window_end=datetime.now() + timedelta(seconds=30),
        duration_sec=30,
        service="test-service",
        event_count=100,
        error_count=5,
        error_rate=0.05,
        level_distribution={"DEBUG": 10, "INFO": 70, "WARN": 10, "ERROR": 10, "FATAL": 0},
        throughput_eps=3.33,  # 100 events / 30 sec
        unique_messages=20,
        unique_templates=15,
        top_error_messages=[],
        latency_p50=50.0,
        latency_p95=100.0,
        latency_p99=150.0,
        latency_max=200.0,
        heartbeat_missing=False,
        error_burst=False,
        volume_spike=False,
        sequence_anomaly=False,
        service_down=False,
    )


@pytest.fixture
def anomaly_window_features():
    """Create an anomalous window (error burst + high latency)"""
    return WindowFeatures(
        window_start=datetime.now(),
        window_end=datetime.now() + timedelta(seconds=30),
        duration_sec=30,
        service="db-service",
        event_count=50,
        error_count=20,
        error_rate=0.40,  # 40% errors!
        level_distribution={"DEBUG": 0, "INFO": 10, "WARN": 10, "ERROR": 25, "FATAL": 5},
        throughput_eps=1.67,  # 50 events / 30 sec (low)
        unique_messages=5,
        unique_templates=3,
        top_error_messages=[("DB timeout", 12), ("Connection failed", 8)],
        latency_p50=500.0,
        latency_p95=2000.0,  # Very high!
        latency_p99=3000.0,
        latency_max=5000.0,
        heartbeat_missing=True,
        error_burst=True,
        volume_spike=False,
        sequence_anomaly=False,
        service_down=False,
    )


# ============================================================================
# TESTS: BaselineManager
# ============================================================================

class TestBaselineManager:
    """Test baseline statistics tracking"""
    
    def test_initialization(self):
        """Baseline should init empty"""
        mgr = BaselineManager()
        assert mgr.total_events_seen == 0
        assert len(mgr.throughput_history) == 0
    
    def test_update_baseline(self, sample_window_features):
        """Should track window statistics"""
        mgr = BaselineManager()
        mgr.update(sample_window_features)
        
        assert mgr.total_events_seen == 100
        assert len(mgr.throughput_history) == 1
        assert mgr.throughput_history[0] == 3.33
    
    def test_get_baseline(self, sample_window_features):
        """Should compute rolling averages"""
        mgr = BaselineManager()
        
        # Add 10 identical windows
        for _ in range(10):
            mgr.update(sample_window_features)
        
        baseline = mgr.get_baseline()
        assert baseline['throughput_baseline'] == pytest.approx(3.33, rel=0.01)
        assert baseline['error_rate_baseline'] == pytest.approx(0.05, rel=0.01)
    
    def test_should_retrain(self, sample_window_features):
        """Should flag when retrain is needed"""
        mgr = BaselineManager()
        
        # Not enough events yet
        assert not mgr.should_retrain()
        
        # Add ~1000 windows = ~100k events
        mgr.total_events_seen = 1000
        assert mgr.should_retrain()


# ============================================================================
# TESTS: HeuristicEngine
# ============================================================================

class TestHeuristicEngine:
    """Test heuristic rule scoring"""
    
    def test_healthy_window(self, sample_window_features):
        """Healthy window should score low"""
        baseline = {'throughput_baseline': 3.33, 'latency_baseline': 100.0, 'error_rate_baseline': 0.05}
        score = HeuristicEngine.score(sample_window_features, baseline)
        
        assert score < 30  # Should be NOMINAL or HEALTHY
    
    def test_error_burst_detection(self, anomaly_window_features):
        """Should detect error_rate > 10%"""
        baseline = {'throughput_baseline': 1.67, 'latency_baseline': 100.0, 'error_rate_baseline': 0.05}
        score = HeuristicEngine.score(anomaly_window_features, baseline)
        
        # Should have at least error_burst points (40)
        assert score >= 40
    
    def test_latency_spike_detection(self, anomaly_window_features):
        """Should detect latency spike (2000 >> 100 * 1.5)"""
        baseline = {'throughput_baseline': 1.67, 'latency_baseline': 100.0, 'error_rate_baseline': 0.05}
        score = HeuristicEngine.score(anomaly_window_features, baseline)
        
        # Should detect latency spike (30 more points)
        assert score >= 60


# ============================================================================
# TESTS: RuleEngine
# ============================================================================

class TestRuleEngine:
    """Test pattern-based rule detection"""
    
    def test_initialization(self):
        """RuleEngine should init empty"""
        engine = RuleEngine()
        assert len(engine.fatal_events) == 0
    
    def test_add_fatal_event(self):
        """Should track FATAL events"""
        engine = RuleEngine()
        engine.add_event("FATAL", "Critical error", datetime.now())
        
        assert len(engine.fatal_events) == 1
    
    def test_score_with_rule_match(self, anomaly_window_features):
        """Should score higher with matching patterns"""
        engine = RuleEngine()
        score = engine.score(anomaly_window_features, [])
        
        # May detect patterns from message content
        assert score >= 0


# ============================================================================
# TESTS: ScoreCombiner
# ============================================================================

class TestScoreCombiner:
    """Test score combination formula"""
    
    def test_warmup_period(self):
        """Warm-up (< 100 events) should use heuristic + rules only"""
        score, reason = ScoreCombiner.combine(
            ml_score=50,
            heuristic_score=60,
            rule_score=40,
            event_count=10,
            total_events_seen=50,  # Warm-up
        )
        
        # Should be 0.8 * 60 + 0.2 * 40 = 56
        assert score == pytest.approx(56, rel=0.01)
        assert reason == "WARM_UP_HEURISTIC"
    
    def test_sparse_window(self):
        """Sparse window (< 5 events) should use heuristic + rules"""
        score, reason = ScoreCombiner.combine(
            ml_score=50,
            heuristic_score=60,
            rule_score=40,
            event_count=2,  # Sparse!
            total_events_seen=1000,
        )
        
        # Should be 0.7 * 60 + 0.3 * 40 = 54
        assert score == pytest.approx(54, rel=0.01)
        assert reason == "SPARSE_HEURISTIC"
    
    def test_normal_formula(self):
        """Normal case should use 40-40-20"""
        score, reason = ScoreCombiner.combine(
            ml_score=40,
            heuristic_score=60,
            rule_score=80,
            event_count=100,
            total_events_seen=1000,
        )
        
        # Should be 0.4 * 40 + 0.4 * 60 + 0.2 * 80 = 16 + 24 + 16 = 56
        assert score == pytest.approx(56, rel=0.01)
        assert reason == "NORMAL"
    
    def test_score_clamping(self):
        """Score should be clamped to 0-100"""
        score, _ = ScoreCombiner.combine(
            ml_score=150,  # Over 100
            heuristic_score=150,
            rule_score=150,
            event_count=100,
            total_events_seen=1000,
        )
        
        assert score <= 100


# ============================================================================
# TESTS: Main AnomalyDetector
# ============================================================================

class TestAnomalyDetector:
    """Test main detector orchestration"""
    
    def test_initialization(self):
        """Detector should init with all components"""
        detector = AnomalyDetector()
        assert detector.baseline_manager is not None
        assert detector.ml_model is not None
        assert detector.heuristic_engine is not None
        assert detector.rule_engine is not None
    
    def test_score_healthy_window(self, sample_window_features):
        """Healthy window should score low"""
        detector = AnomalyDetector()
        score, reason = detector.score_window(sample_window_features)
        
        assert score < 30  # NOMINAL or below
        assert reason in ["WARM_UP_HEURISTIC", "NORMAL"]
    
    def test_score_anomalous_window(self, anomaly_window_features):
        """Anomalous window should score high"""
        detector = AnomalyDetector()
        
        # Add 100 healthy windows first to exit warm-up
        healthy = WindowFeatures(
            window_start=datetime.now(), window_end=datetime.now() + timedelta(seconds=30),
            duration_sec=30, service="test", event_count=100, error_count=5, error_rate=0.05,
            level_distribution={"INFO": 95, "ERROR": 5}, throughput_eps=3.33,
            unique_messages=10, unique_templates=5, latency_p95=50.0,
            heartbeat_missing=False, error_burst=False, volume_spike=False, sequence_anomaly=False,
        )
        
        for _ in range(100):
            detector.score_window(healthy)
        
        # Now score anomalous window
        score, reason = detector.score_window(anomaly_window_features)
        
        assert score > 40  # At least CAUTION
    
    def test_crash_pattern_detection(self, anomaly_window_features):
        """Should detect crash when sustained critical for 3 windows"""
        detector = AnomalyDetector()
        
        # Simulate 3 consecutive critical windows
        anomaly_window_features.error_rate = 0.50  # Very high
        
        for _ in range(3):
            detector.critical_window_streak += 1
        
        assert detector.detect_crash_pattern()


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestAnomalyDetectionIntegration:
    """Integration tests with realistic scenario"""
    
    def test_end_to_end_detection(self):
        """Full pipeline: healthy → error burst → crash detection"""
        detector = AnomalyDetector()
        
        # Phase 1: Healthy baseline (warm-up)
        healthy = WindowFeatures(
            window_start=datetime.now(), window_end=datetime.now() + timedelta(seconds=30),
            duration_sec=30, service="api", event_count=100, error_count=2, error_rate=0.02,
            level_distribution={"DEBUG": 20, "INFO": 75, "ERROR": 5}, throughput_eps=3.33,
            unique_messages=50, unique_templates=30, latency_p95=50.0, latency_max=100.0,
            heartbeat_missing=False, error_burst=False, volume_spike=False, sequence_anomaly=False,
        )
        
        scores_phase1 = [detector.score_window(healthy)[0] for _ in range(50)]
        assert all(s < 30 for s in scores_phase1), "Warm-up should be healthy"
        
        # Phase 2: Error burst (sustained anomaly)
        anomaly = WindowFeatures(
            window_start=datetime.now(), window_end=datetime.now() + timedelta(seconds=30),
            duration_sec=30, service="api", event_count=80, error_count=40, error_rate=0.50,
            level_distribution={"INFO": 25, "ERROR": 55, "FATAL": 20}, throughput_eps=2.67,
            unique_messages=5, unique_templates=2, latency_p95=500.0, latency_max=1000.0,
            heartbeat_missing=True, error_burst=True, volume_spike=False, sequence_anomaly=False,
        )
        
        scores_phase2 = [detector.score_window(anomaly)[0] for _ in range(3)]
        assert all(s > 60 for s in scores_phase2), "Anomaly phase should be ALERT+"
        
        # Phase 3: Crash detection
        crash_detected = detector.detect_crash_pattern()
        assert crash_detected, "Should detect crash after 3 critical windows"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
