"""
ARIMA-based Baseline Manager - Time series anomaly detection.
Phase 1 Enhancement: Detect deviations from expected trends using statistical forecasting.
"""

import numpy as np
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

try:
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False


class ARIMABaselineManager:
    """
    ARIMA models for time series anomaly detection.
    Tracks trends, seasonality, and predicts next expected values.
    """
    
    def __init__(self, window_size: int = 24, min_observations: int = 10):
        """
        Initialize ARIMA baseline manager.
        
        Args:
            window_size: Windows of history to track (hours)
            min_observations: Minimum points needed to fit model
        """
        if not STATSMODELS_AVAILABLE:
            raise ImportError("statsmodels required for ARIMABaselineManager. "
                            "Install with: pip install statsmodels")
        
        self.window_size = window_size
        self.min_observations = min_observations
        self.arima_models = {}  # service -> model
        self.timeseries_history = {}  # service -> list of values
        self.last_predictions = {}  # service -> predicted value
    
    def fit_arima(self, service: str, timeseries: List[float]) -> bool:
        """
        Train ARIMA model on time series data.
        
        Args:
            service: Service identifier
            timeseries: List of metric values (e.g., error_rate over time)
        
        Returns:
            True if fit successful, False otherwise
        """
        try:
            if len(timeseries) < self.min_observations:
                return False
            
            # Simple ARIMA parameters (p=1, d=1, q=1)
            # In production, use auto_arima for optimal parameters
            model = ARIMA(
                timeseries,
                order=(1, 1, 1)
            )
            
            results = model.fit()
            self.arima_models[service] = results
            self.timeseries_history[service] = list(timeseries)
            
            return True
        
        except Exception as e:
            print(f"⚠️  Failed to fit ARIMA for {service}: {e}")
            return False
    
    def update_timeseries(self, service: str, value: float):
        """
        Add new observation to time series history.
        
        Args:
            service: Service identifier
            value: New metric value
        """
        if service not in self.timeseries_history:
            self.timeseries_history[service] = []
        
        # Keep only last window_size * 2 observations for memory
        history = self.timeseries_history[service]
        history.append(value)
        
        if len(history) > self.window_size * 2:
            history = history[-self.window_size * 2:]
            self.timeseries_history[service] = history
        
        # Refit model every window_size observations
        if len(history) % self.window_size == 0 and len(history) >= self.min_observations:
            self.fit_arima(service, history)
    
    def predict_next_window(self, service: str, steps: int = 1) -> Optional[float]:
        """
        Forecast next window's expected metric value.
        
        Args:
            service: Service identifier
            steps: Number of steps ahead to forecast
        
        Returns:
            Predicted value for next window, or None if not fitted
        """
        if service not in self.arima_models:
            return None
        
        try:
            model = self.arima_models[service]
            forecast = model.get_forecast(steps=steps)
            predicted = forecast.predicted_mean.iloc[-1] if len(forecast.predicted_mean) > 0 else None
            
            self.last_predictions[service] = predicted
            return float(predicted) if predicted is not None else None
        
        except Exception as e:
            print(f"⚠️  Forecast failed for {service}: {e}")
            return None
    
    def deviation_score(self, service: str, actual: float) -> float:
        """
        Calculate how much actual value deviates from prediction (0-1).
        
        Args:
            service: Service identifier
            actual: Actual observed value
        
        Returns:
            Deviation score (0 = expected, 1 = highly anomalous)
        """
        expected = self.predict_next_window(service)
        
        if expected is None or expected == 0:
            return 0.0
        
        # Relative deviation
        deviation = abs(actual - expected) / (abs(expected) + 1e-6)
        
        # Normalize to 0-1 with sigmoid
        normalized = 1 / (1 + np.exp(-deviation + 1))
        
        return float(min(1.0, normalized))
    
    def get_trend(self, service: str) -> Dict:
        """
        Get current trend information for a service.
        
        Args:
            service: Service identifier
        
        Returns:
            Dict with trend info (uptrend, downtrend, stable)
        """
        if service not in self.timeseries_history or len(self.timeseries_history[service]) < 3:
            return {'trend': 'unknown', 'direction': 0.0}
        
        recent = self.timeseries_history[service][-5:]
        
        # Simple trend: compare recent average to older average
        recent_avg = np.mean(recent[-2:])
        older_avg = np.mean(recent[:2])
        
        if older_avg == 0:
            direction = 0.0
        else:
            direction = (recent_avg - older_avg) / older_avg
        
        if abs(direction) < 0.05:
            trend = 'stable'
        elif direction > 0:
            trend = 'uptrend'
        else:
            trend = 'downtrend'
        
        return {
            'trend': trend,
            'direction': float(direction),
            'recent_avg': float(recent_avg),
            'older_avg': float(older_avg),
        }
    
    def detect_anomaly_type(self, service: str, actual: float) -> Dict:
        """
        Classify type of anomaly based on time series context.
        
        Args:
            service: Service identifier
            actual: Actual observed value
        
        Returns:
            Dict describing anomaly type
        """
        expected = self.predict_next_window(service)
        trend = self.get_trend(service)
        
        if expected is None:
            return {'type': 'unknown', 'reason': 'not_fitted'}
        
        # Classification
        if actual > expected * 1.5:
            if trend['trend'] == 'uptrend':
                anomaly_type = 'accelerating_increase'
            else:
                anomaly_type = 'sudden_spike'
        elif actual < expected * 0.5:
            if trend['trend'] == 'downtrend':
                anomaly_type = 'accelerating_decrease'
            else:
                anomaly_type = 'sudden_drop'
        elif abs(actual - expected) > expected * 0.3:
            anomaly_type = 'deviation_from_trend'
        else:
            anomaly_type = 'normal'
        
        return {
            'type': anomaly_type,
            'expected': float(expected),
            'actual': float(actual),
            'ratio': float(actual / expected) if expected != 0 else 0.0,
            'trend': trend['trend'],
        }


class SeasonalAutoencoder:
    """
    Detects anomalies in seasonal time series.
    Accounts for daily/weekly/monthly patterns.
    """
    
    def __init__(self, period: int = 24):
        """
        Initialize with seasonality period (e.g., 24 for daily).
        
        Args:
            period: Number of steps for seasonal repetition
        """
        self.period = period
        self.seasonal_patterns = {}  # (service, hour) -> typical value
        self.is_fitted = False
    
    def fit(self, service: str, timeseries: List[float]):
        """
        Learn seasonal pattern.
        
        Args:
            service: Service identifier
            timeseries: Time series values
        """
        if len(timeseries) < self.period * 2:
            return
        
        # Group by position in cycle
        patterns = {}
        for i, value in enumerate(timeseries):
            position = i % self.period
            
            if position not in patterns:
                patterns[position] = []
            
            patterns[position].append(value)
        
        # Store average for each position
        for position, values in patterns.items():
            self.seasonal_patterns[(service, position)] = np.mean(values)
        
        self.is_fitted = True
    
    def anomaly_score(self, service: str, value: float, position: int) -> float:
        """
        Score anomaly considering seasonality.
        
        Args:
            service: Service identifier
            value: Current value
            position: Position in seasonal cycle (0 to period-1)
        
        Returns:
            Anomaly score (0-1)
        """
        if (service, position) not in self.seasonal_patterns:
            return 0.0
        
        expected = self.seasonal_patterns[(service, position)]
        
        if expected == 0:
            return 0.0
        
        deviation = abs(value - expected) / abs(expected)
        normalized = min(1.0, deviation / 2.0)  # Normalize with 2.0 as max deviation
        
        return float(normalized)
