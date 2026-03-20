"""
NLP & Behavioral Anomaly Detection - Advanced pattern recognition.
Phase 5 Enhancement: Semantic understanding of errors and behavior analysis.
"""

import numpy as np
from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict
import re


class ErrorMessageAnalyzer:
    """NLP-based analysis of error messages (simplified without transformers)."""
    
    def __init__(self):
        """Initialize error analyzer."""
        self.error_templates = defaultdict(int)  # template -> frequency
        self.error_categories = {}  # message -> category
        self.known_errors = self._initialize_known_errors()
    
    def _initialize_known_errors(self) -> Dict[str, Dict]:
        """Initialize known error patterns."""
        return {
            'connection_pool': {
                'keywords': ['connection', 'pool', 'exhausted', 'expired', 'timeout'],
                'severity': 'high',
            },
            'database': {
                'keywords': ['database', 'query', 'sql', 'deadlock', 'timeout'],
                'severity': 'high',
            },
            'memory': {
                'keywords': ['memory', 'heap', 'oom', 'out of memory', 'gc'],
                'severity': 'critical',
            },
            'network': {
                'keywords': ['network', 'ungcircle', 'connection reset', 'timeout'],
                'severity': 'high',
            },
            'authentication': {
                'keywords': ['auth', 'unauthorized', 'forbidden', 'invalid password'],
                'severity': 'medium',
            },
            'application': {
                'keywords': ['exception', 'error', 'failed', 'cannot', 'invalid'],
                'severity': 'medium',
            },
        }
    
    def extract_error_template(self, message: str) -> str:
        """
        Extract error template by replacing values with placeholders.
        E.g., "Unable to connect to 192.168.1.1:5432" -> "Unable to connect to {IP}:{PORT}"
        
        Args:
            message: Error message
        
        Returns:
            Error template
        """
        template = message
        
        # Replace common patterns
        template = re.sub(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', '{IP}', template)
        template = re.sub(r':\d+', ':{PORT}', template)
        template = re.sub(r'0x[0-9a-f]+', '{HEX}', template, flags=re.IGNORECASE)
        template = re.sub(r'\d+', '{NUM}', template)
        template = re.sub(r'"[^"]*"', '{STR}', template)
        
        return template
    
    def categorize_error(self, message: str) -> Dict:
        """
        Categorize error message semantically.
        
        Args:
            message: Error message
        
        Returns:
            Dict with category, severity, and details
        """
        message_lower = message.lower()
        template = self.extract_error_template(message)
        
        # Find best matching category
        best_category = None
        best_score = 0
        
        for category, info in self.known_errors.items():
            keywords = info['keywords']
            
            # Count keyword matches
            score = sum(1 for kw in keywords if kw in message_lower)
            
            if score > best_score:
                best_score = score
                best_category = category
        
        category = best_category or 'unknown'
        
        # Record template frequency
        self.error_templates[template] += 1
        
        return {
            'category': category,
            'severity': self.known_errors.get(category, {}).get('severity', 'low'),
            'template': template,
            'confidence': min(1.0, best_score / 3.0),  # Normalize 0-1
            'original_message': message[:100],  # First 100 chars
        }
    
    def cluster_similar_errors(self, messages: List[str]) -> Dict[str, List[str]]:
        """
        Cluster similar error messages together.
        
        Args:
            messages: List of error messages
        
        Returns:
            Dict mapping cluster template to messages
        """
        clusters = defaultdict(list)
        
        for msg in messages:
            template = self.extract_error_template(msg)
            clusters[template].append(msg)
        
        return dict(clusters)
    
    def get_error_trends(self, time_window: int = 3600) -> Dict:
        """Get trending error patterns."""
        
        # Sort templates by frequency
        sorted_templates = sorted(
            self.error_templates.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        return {
            'top_errors': sorted_templates[:10],
            'unique_templates': len(self.error_templates),
            'total_errors': sum(self.error_templates.values()),
        }


class BehavioralAnomalyDetector:
    """Detect anomalies in service behavior patterns."""
    
    def __init__(self):
        """Initialize behavior detector."""
        self.normal_behaviors = {}  # service -> set of normal patterns
        self.behavior_history = defaultdict(list)  # service -> patterns over time
    
    def learn_normal_behavior(self, service: str,
                            training_windows: List) -> int:
        """
        Learn what 'normal' behavior looks like.
        
        Args:
            service: Service identifier
            training_windows: List of WindowFeatures from normal operation
        
        Returns:
            Number of patterns learned
        """
        patterns = set()
        
        for window in training_windows:
            pattern = self._extract_behavior_pattern(window)
            patterns.add(pattern)
        
        self.normal_behaviors[service] = patterns
        
        return len(patterns)
    
    def _extract_behavior_pattern(self, window) -> Tuple:
        """
        Extract behavior pattern from window.
        Returns tuple of discretized metrics.
        """
        
        def discretize(value, thresholds):
            """Convert continuous value to ordinal category."""
            for i, threshold in enumerate(thresholds):
                if value <= threshold:
                    return i
            return len(thresholds)
        
        # Discretize each metric
        error_level = discretize(window.error_rate, [0.01, 0.05, 0.10, 0.20])
        throughput_level = discretize(getattr(window, 'throughput_eps', 100), [10, 50, 100, 500])
        latency_level = discretize(getattr(window, 'latency_p95', 100) or 100, [50, 200, 500, 1000])
        
        variance = 'high' if window.event_count < 5 else 'low'
        
        return (error_level, throughput_level, latency_level, variance)
    
    def is_behavioral_anomaly(self, service: str, window) -> bool:
        """
        Check if this window exhibits anomalous behavior.
        
        Args:
            service: Service identifier
            window: WindowFeatures object
        
        Returns:
            True if behavior is anomalous
        """
        if service not in self.normal_behaviors:
            # Not yet learned this service
            return False
        
        pattern = self._extract_behavior_pattern(window)
        normal_patterns = self.normal_behaviors[service]
        
        # If we've never seen this combination, it's anomalous
        is_anomalous = pattern not in normal_patterns
        
        # Track behavior
        self.behavior_history[service].append({
            'pattern': pattern,
            'is_anomalous': is_anomalous,
            'timestamp': getattr(window, 'window_start', None),
        })
        
        return is_anomalous
    
    def get_anomalous_behaviors(self, service: str) -> List[Dict]:
        """Get recent anomalous behaviors for a service."""
        
        if service not in self.behavior_history:
            return []
        
        anomalous = [
            b for b in self.behavior_history[service][-100:]
            if b['is_anomalous']
        ]
        
        return anomalous
    
    def explain_anomaly(self, window) -> Dict:
        """
        Explain what's anomalous about this window.
        
        Args:
            window: WindowFeatures
        
        Returns:
            Dict with explanation
        """
        explanations = []
        
        error_rate = window.error_rate
        throughput = getattr(window, 'throughput_eps', 100)
        latency = getattr(window, 'latency_p95', 100) or 100
        
        # Check for unusual combinations
        if error_rate > 0.10 and throughput < 10:
            explanations.append('Service appears to be down (no traffic but high error_rate)')
        
        if error_rate > 0.20 and latency > 1000:
            explanations.append('Both high error rate and high latency - possible resource exhaustion')
        
        if throughput > 500 and latency > 2000:
            explanations.append('High throughput with extreme latency - possible overload')
        
        if window.event_count < 3 and error_rate > 0.0:
            explanations.append('Too few events to draw conclusions - sparse data')
        
        if not explanations:
            explanations.append('Behavior differs from learned patterns but no specific issue detected')
        
        return {
            'is_anomalous': len(explanations) > 0,
            'explanations': explanations,
            'error_rate': float(error_rate),
            'throughput': float(throughput),
            'latency': float(latency),
        }
    
    def get_behavior_statistics(self, service: str) -> Dict:
        """Get statistics on service behavior."""
        
        if service not in self.behavior_history:
            return {'status': 'no_data'}
        
        history = self.behavior_history[service]
        
        if not history:
            return {'status': 'no_data'}
        
        anomalous_count = sum(1 for b in history if b['is_anomalous'])
        
        return {
            'total_observations': len(history),
            'anomalies_detected': anomalous_count,
            'anomaly_rate': anomalous_count / len(history) if history else 0,
            'patterns_learned': len(self.normal_behaviors.get(service, set())),
        }


class ServiceBehaviorProfile:
    """Build and maintain behavior profile for a service."""
    
    def __init__(self, service: str):
        """Initialize behavior profile."""
        self.service = service
        self.baseline_metrics = {}
        self.metric_history = defaultdict(list)
        self.deviation_alerts = []
    
    def update_profile(self, window):
        """Update service profile with new window."""
        
        # Extract key metrics
        metrics = {
            'error_rate': window.error_rate,
            'throughput': getattr(window, 'throughput_eps', 0),
            'latency_p95': getattr(window, 'latency_p95', 0),
            'event_count': window.event_count,
        }
        
        # Store history
        for metric, value in metrics.items():
            self.metric_history[metric].append(value)
        
        # Update baseline if not initialized
        if not self.baseline_metrics:
            self.baseline_metrics = metrics
        else:
            # Update baseline with exponential moving average
            alpha = 0.1
            for metric, value in metrics.items():
                old = self.baseline_metrics.get(metric, value)
                self.baseline_metrics[metric] = alpha * value + (1 - alpha) * old
    
    def detect_deviations(self, window) -> List[str]:
        """Detect metric deviations from baseline."""
        
        deviations = []
        
        error_rate = window.error_rate
        baseline_error = self.baseline_metrics.get('error_rate', 0.01)
        
        if error_rate > baseline_error * 2:
            deviations.append(f"Error rate {error_rate*100:.1f}% (baseline {baseline_error*100:.1f}%)")
        
        throughput = getattr(window, 'throughput_eps', 0)
        baseline_throughput = self.baseline_metrics.get('throughput', 100)
        
        if throughput < baseline_throughput * 0.5 and throughput > 0:
            deviations.append(f"Throughput down to {throughput:.0f} eps (baseline {baseline_throughput:.0f})")
        
        return deviations
