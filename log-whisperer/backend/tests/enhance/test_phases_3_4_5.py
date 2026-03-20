"""
Tests for Phase 3: Online Learning, Phase 4: Forecasting, Phase 5: NLP/Behavior
"""

import numpy as np
import pytest
from app.enhance.online_learning import AdaptiveBaselineManager, ActiveLearningFeedback
from app.enhance.forecasting import CrashForecastingEngine, ResourceForecastingEngine
from app.enhance.error_nlp import ErrorMessageAnalyzer, BehavioralAnomalyDetector


class TestOnlineLearning:
    """Test adaptive baseline and active learning."""
    
    def test_adaptive_baseline_update(self):
        """Test online baseline update."""
        manager = AdaptiveBaselineManager(learning_rate=0.1)
        
        features1 = np.array([10, 20, 30])
        features2 = np.array([12, 22, 32])
        
        manager.update_baseline_online(features1)
        assert manager.baseline_features is not None
        
        manager.update_baseline_online(features2, prediction_error=0.01)
        # Baseline should move towards new values
        assert np.allclose(manager.baseline_features, features1, rtol=0.2)
    
    def test_active_learning_feedback(self):
        """Test active learning system."""
        learner = ActiveLearningFeedback()
        
        # Collect feedback
        for i in range(50):
            learner.collect_feedback(f'alert_{i}', 'true_positive' if i % 2 == 0 else 'false_positive')
        
        summary = learner.get_feedback_summary()
        assert summary['total_feedback'] > 0
        assert 'precision' in summary


class TestForecasting:
    """Test crash and resource forecasting."""
    
    def test_crash_forecast(self):
        """Test crash prediction."""
        engine = CrashForecastingEngine(forecast_window_minutes=5)
        
        # Add some data
        for i in range(20):
            engine.update_service_data('api', anomaly_score=10+i*2, latency=100+i, error_rate=0.01)
        
        forecast = engine.predict_crash_risk('api')
        
        assert 'risk_level' in forecast
        assert 'predicted_scores' in forecast
        assert forecast['max_predicted_score'] >= 0
    
    def test_resource_forecast(self):
        """Test resource forecasting."""
        engine = ResourceForecastingEngine(history_size=24)
        
        # Record resources
        for i in range(30):
            engine.record_resources('api', cpu_percent=20+i, memory_mb=500+i*10, disk_gb=100+i)
        
        forecast = engine.forecast_resources('api', hours_ahead=24)
        
        assert 'forecasts' in forecast
        assert 'scaling_recommendation' in forecast


class TestNLPAndBehavior:
    """Test NLP and behavioral anomaly detection."""
    
    def test_error_categorization(self):
        """Test error message analysis."""
        analyzer = ErrorMessageAnalyzer()
        
        messages = [
            'Connection pool exhausted',
            'Database query timeout',
            'Out of memory error',
        ]
        
        for msg in messages:
            result = analyzer.categorize_error(msg)
            assert 'category' in result
            assert 'severity' in result
            assert result['confidence'] > 0
    
    def test_error_clustering(self):
        """Test error message clustering."""
        analyzer = ErrorMessageAnalyzer()
        
        messages = [
            'Unable to connect to 192.168.1.1:5432',
            'Unable to connect to 192.168.1.2:5432',
            'Query timeout on table users',
            'Query timeout on table orders',
        ]
        
        clusters = analyzer.cluster_similar_errors(messages)
        assert len(clusters) == 2  # Should cluster into 2 groups
    
    def test_behavioral_anomaly(self):
        """Test behavioral anomaly detection."""
        detector = BehavioralAnomalyDetector()
        
        # Mock windows
        class MockWindow:
            def __init__(self, error_rate, throughput, latency, count):
                self.error_rate = error_rate
                self.throughput_eps = throughput
                self.latency_p95 = latency
                self.event_count = count
        
        # Learn normal behavior
        windows = [
            MockWindow(0.01, 100, 100, 1000) for _ in range(10)
        ]
        detector.learn_normal_behavior('api', windows)
        
        # Test anomaly
        normal_window = MockWindow(0.01, 100, 100, 1000)
        is_anomalous = detector.is_behavioral_anomaly('api', normal_window)
        assert is_anomalous == False  # Normal behavior
        
        anomalous_window = MockWindow(0.50, 10, 1000, 100)
        is_anomalous = detector.is_behavioral_anomaly('api', anomalous_window)
        assert is_anomalous == True  # Anomalous behavior
