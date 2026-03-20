"""
Forecasting Engine - Predict crashes and resource needs in advance.
Phase 4 Enhancement: Proactive incident prevention through forecasting.
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from collections import deque


class CrashForecastingEngine:
    """Predict crashes 5+ minutes in advance using time series forecasting."""
    
    def __init__(self, forecast_window_minutes: int = 5):
        """
        Initialize crash forecasting engine.
        
        Args:
            forecast_window_minutes: Minutes ahead to forecast
        """
        self.forecast_window = forecast_window_minutes
        self.service_forecasts = {}  # service -> forecast model/data
        self.anomaly_score_history = defaultdict(deque)  # service -> scores
        self.max_history = 144  # 24 hours of 10-minute windows
    
    def update_service_data(self, service: str, anomaly_score: float,
                           latency: float, error_rate: float):
        """
        Update service data for forecasting.
        
        Args:
            service: Service identifier
            anomaly_score: Current anomaly score (0-100)
            latency: Current latency (ms)
            error_rate: Current error rate (0-1)
        """
        if service not in self.anomaly_score_history:
            self.anomaly_score_history[service] = deque(maxlen=self.max_history)
        
        # Store metrics
        self.anomaly_score_history[service].append({
            'timestamp': datetime.now(),
            'anomaly_score': anomaly_score,
            'latency': latency,
            'error_rate': error_rate,
        })
    
    def predict_crash_risk(self, service: str) -> Dict:
        """
        Forecast crash risk for next forecast_window minutes.
        
        Args:
            service: Service identifier
        
        Returns:
            Dict with risk level, predicted scores, and recommendations
        """
        if service not in self.anomaly_score_history:
            return {'risk_level': 'UNKNOWN', 'confidence': 0.0}
        
        history = list(self.anomaly_score_history[service])
        
        if len(history) < 5:
            return {
                'risk_level': 'INSUFFICIENT_DATA',
                'confidence': 0.0,
                'reason': 'Not enough historical data',
            }
        
        # Extract anomaly scores
        scores = [h['anomaly_score'] for h in history]
        
        # Simple forecasting: trend extrapolation
        recent_scores = scores[-5:]
        
        # Calculate trend
        trend = np.polyfit(range(len(recent_scores)), recent_scores, 1)[0]
        
        # Forecast next 5 values
        last_score = scores[-1]
        forecasted = []
        
        for i in range(1, self.forecast_window + 1):
            predicted = last_score + trend * i
            forecasted.append(max(0, min(100, predicted)))  # Clamp 0-100
        
        max_predicted = max(forecasted)
        
        # Classify risk
        if max_predicted > 80:
            risk_level = 'CRITICAL'
        elif max_predicted > 70:
            risk_level = 'HIGH'
        elif max_predicted > 50:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'LOW'
        
        # Confidence based on trend stability
        confidence = min(1.0, abs(trend) / 10.0)
        
        return {
            'service': service,
            'risk_level': risk_level,
            'max_predicted_score': float(max_predicted),
            'confidence': float(confidence),
            'predicted_scores': [float(s) for s in forecasted],
            'forecast_minutes_ahead': self.forecast_window,
            'trend': float(trend),
            'current_score': float(last_score),
            'recommendation': self._get_mitigation(risk_level),
        }
    
    def _get_mitigation(self, risk_level: str) -> str:
        """Get recommended mitigation for risk level."""
        recommendations = {
            'CRITICAL': '🚨 URGENT: Immediate action required. Scale resources, increase timeouts, prepare rollback.',
            'HIGH': '⚠️ Alert: Monitor closely. Prepare incident response. Consider preemptive scaling.',
            'MEDIUM': '📊 Caution: Elevated risk. Increase logging. Be ready to respond.',
            'LOW': '✅ Normal: No immediate action needed. Continue monitoring.',
        }
        return recommendations.get(risk_level, '')


class ResourceForecastingEngine:
    """Predict CPU, memory, disk usage for automated scaling."""
    
    def __init__(self, history_size: int = 24):
        """
        Initialize resource forecasting.
        
        Args:
            history_size: Hours of history to track
        """
        self.history_size = history_size
        self.resource_history = defaultdict(deque)  # service -> metrics
        self.max_history = history_size * 60  # 60 data points per hour
    
    def record_resources(self, service: str, cpu_percent: float,
                        memory_mb: float, disk_gb: float):
        """
        Record current resource usage.
        
        Args:
            service: Service identifier
            cpu_percent: CPU usage %
            memory_mb: Memory in MB
            disk_gb: Disk in GB
        """
        if service not in self.resource_history:
            for metric in ['cpu', 'memory', 'disk']:
                self.resource_history[f'{service}:{metric}'] = deque(maxlen=self.max_history)
        
        self.resource_history[f'{service}:cpu'].append(cpu_percent)
        self.resource_history[f'{service}:memory'].append(memory_mb)
        self.resource_history[f'{service}:disk'].append(disk_gb)
    
    def forecast_resources(self, service: str, hours_ahead: int = 24) -> Dict:
        """
        Forecast resource usage for next N hours.
        
        Args:
            service: Service identifier
            hours_ahead: Hours to forecast
        
        Returns:
            Dict with forecasts and scaling recommendations
        """
        forecasts = {}
        
        for resource_type in ['cpu', 'memory', 'disk']:
            key = f'{service}:{resource_type}'
            
            if key not in self.resource_history or len(self.resource_history[key]) < 5:
                forecasts[resource_type] = None
                continue
            
            history = list(self.resource_history[key])
            
            # Simple linear trend
            trend = np.polyfit(range(len(history)), history, 1)[0]
            
            # Forecast
            last_value = history[-1]
            forecast_values = []
            
            for i in range(1, hours_ahead + 1):
                pred = last_value + trend * i
                forecast_values.append(max(0, pred))
            
            forecasts[resource_type] = {
                'current': float(last_value),
                'forecast': [float(v) for v in forecast_values],
                'trend': float(trend),
                'peak_predicted': float(max(forecast_values)),
            }
        
        # Generate scaling recommendations
        recommendation = self._recommend_scaling(service, forecasts)
        
        return {
            'service': service,
            'forecasts': forecasts,
            'scaling_recommendation': recommendation,
            'timestamp': datetime.now().isoformat(),
        }
    
    def _recommend_scaling(self, service: str, forecasts: Dict) -> Dict:
        """Generate scaling recommendations."""
        if not forecasts.get('cpu'):
            return {'action': 'INSUFFICIENT_DATA', 'reason': 'Not enough data'}
        
        cpu_peak = forecasts['cpu']['peak_predicted']
        memory_peak = forecasts['memory']['peak_predicted'] if forecasts.get('memory') else 0
        
        if cpu_peak > 85:
            return {
                'action': 'SCALE_UP',
                'reason': f'CPU predicted to reach {cpu_peak:.1f}%',
                'suggested_instances': '+2',
                'urgency': 'immediate',
                'estimated_time': '5-10 minutes',
            }
        elif cpu_peak > 75:
            return {
                'action': 'PREPARE_SCALING',
                'reason': f'CPU trending to {cpu_peak:.1f}%',
                'suggested_instances': '+1',
                'urgency': 'soon',
                'estimated_time': '15-30 minutes',
            }
        elif cpu_peak > 60:
            return {
                'action': 'MONITOR',
                'reason': 'Adequate capacity but trending up',
                'suggested_instances': 'no change',
                'urgency': 'watch',
                'estimated_time': 'next review cycle',
            }
        else:
            return {
                'action': 'MAINTAIN',
                'reason': 'Resources adequate',
                'suggested_instances': 'no change',
                'urgency': 'none',
                'estimated_time': 'na',
            }


# Import defaultdict if not already imported
from collections import defaultdict
