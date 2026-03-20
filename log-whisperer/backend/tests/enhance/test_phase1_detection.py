"""
Tests for Phase 1: Advanced Anomaly Detection (Ensemble, Autoencoder, ARIMA)
"""

import numpy as np
import pytest
from app.enhance.ensemble_detector import EnsembleAnomalyDetector
from app.enhance.arima_baseline import ARIMABaselineManager, SeasonalAutoencoder


class TestEnsembleAnomalyDetector:
    """Test ensemble anomaly detection."""
    
    def setup_method(self):
        """Setup test data."""
        np.random.seed(42)
        # Generate normal data
        self.normal_data = np.random.normal(loc=0, scale=1, size=(100, 5))
        # Generate anomalous data
        self.anomalous_data = np.random.normal(loc=5, scale=2, size=(20, 5))
    
    def test_ensemble_initialization(self):
        """Test ensemble detector initialization."""
        detector = EnsembleAnomalyDetector()
        assert detector.contamination == 0.05
        assert detector.is_fitted == False
    
    def test_ensemble_fit(self):
        """Test fitting ensemble."""
        detector = EnsembleAnomalyDetector()
        detector.fit(self.normal_data)
        assert detector.is_fitted == True
    
    def test_ensemble_prediction(self):
        """Test ensemble prediction."""
        detector = EnsembleAnomalyDetector()
        detector.fit(self.normal_data)
        
        # Normal data should have low score
        score_normal, _ = detector.predict_ensemble(self.normal_data[0])
        assert 0 <= score_normal <= 1
        assert score_normal < 0.5  # Normal data should score low
        
        # Anomalous data should have high score
        score_anomalous, _ = detector.predict_ensemble(self.anomalous_data[0])
        assert score_anomalous > 0.5  # Anomalous should score high
    
    def test_ensemble_voting(self):
        """Test model voting."""
        detector = EnsembleAnomalyDetector()
        detector.fit(self.normal_data)
        
        votes = detector.get_model_votes(self.anomalous_data[0])
        assert isinstance(votes, dict)
        assert len(votes) == 5  # 5 models
        
        # Anomalous data should have majority vote
        anomaly_votes = sum(1 for v in votes.values() if v)
        assert anomaly_votes >= 2  # Majority should detect


class TestARIMABaseline:
    """Test ARIMA baseline management."""
    
    def setup_method(self):
        """Setup test time series."""
        # Generate synthetic time series with trend
        self.timeseries = list(range(50)) + list(np.random.normal(50, 5, 50))
    
    def test_arima_fit(self):
        """Test ARIMA model fitting."""
        manager = ARIMABaselineManager()
        success = manager.fit_arima('service_test', self.timeseries[:30])
        assert success == True
    
    def test_arima_prediction(self):
        """Test ARIMA forecasting."""
        manager = ARIMABaselineManager()
        manager.fit_arima('service_test', self.timeseries[:30])
        
        pred = manager.predict_next_window('service_test')
        assert pred is not None
        assert isinstance(pred, (int, float))
    
    def test_deviation_score(self):
        """Test deviation calculation."""
        manager = ARIMABaselineManager()
        manager.fit_arima('service_test', self.timeseries[:30])
        
        # Normal value should have low deviation
        score_normal = manager.deviation_score('service_test', 50)
        assert 0 <= score_normal <= 1
        
        # Anomalous value should have high deviation
        score_anomalous = manager.deviation_score('service_test', 100)
        assert score_anomalous > score_normal


class TestSeasonalAutoencoder:
    """Test seasonal pattern detection."""
    
    def setup_method(self):
        """Setup seasonal data."""
        # Generate 48-hour (2-day) data with 24-hour seasonality
        daily_pattern = np.sin(np.linspace(0, 2*np.pi, 24))
        self.timeseries = np.tile(daily_pattern, 2) + np.random.normal(0, 0.1, 48)
    
    def test_seasonal_fit(self):
        """Test learning seasonal pattern."""
        detector = SeasonalAutoencoder(period=24)
        detector.fit('service', list(self.timeseries))
        assert detector.is_fitted == True
    
    def test_seasonal_anomaly_detection(self):
        """Test seasonal anomaly detection."""
        detector = SeasonalAutoencoder(period=24)
        detector.fit('service', list(self.timeseries))
        
        # Normal value at position 0
        score_normal = detector.anomaly_score('service', self.timeseries[0], 0)
        assert 0 <= score_normal <= 1
        
        # Anomalous value
        score_anomalous = detector.anomaly_score('service', 100, 0)
        assert score_anomalous > score_normal
