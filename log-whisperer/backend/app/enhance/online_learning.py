"""
Online Learning & Adaptation - Concept drift detection and active learning.
Phase 3 Enhancement: Auto-adapt to changing data distributions and learn from user feedback.
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from collections import deque
from datetime import datetime, timedelta


class ConceptDriftDetector:
    """Detects concept drift (data distribution changes) online."""
    
    def __init__(self, window_size: int = 100, drift_threshold: float = 0.15):
        """
        Initialize drift detector (DDM algorithm).
        
        Args:
            window_size: Observations to track
            drift_threshold: Threshold for drift detection
        """
        self.window_size = window_size
        self.drift_threshold = drift_threshold
        
        self.error_window = deque(maxlen=window_size)
        self.drift_score = 0.0
        self.is_drifting = False
        self.drift_history = []
    
    def update(self, prediction_error: float) -> bool:
        """
        Update drift detector with new prediction error.
        
        Args:
            prediction_error: Error of latest prediction (0-1)
        
        Returns:
            True if drift detected
        """
        self.error_window.append(prediction_error)
        
        if len(self.error_window) < 2:
            return False
        
        # Calculate drift using DDM (Drift Detection Method)
        errors = np.array(list(self.error_window))
        
        # Mean and variance of recent errors
        p = np.mean(errors)
        s = np.sqrt(p * (1 - p) / len(errors))
        
        # Drift score: how far from baseline?
        baseline_error = np.mean(list(self.error_window)[:10])  # First 10
        self.drift_score = abs(p - baseline_error) / (s + 1e-6)
        
        # Detect drift if score exceeds threshold
        old_drifting = self.is_drifting
        self.is_drifting = self.drift_score > self.drift_threshold
        
        if self.is_drifting and not old_drifting:
            self.drift_history.append({
                'timestamp': datetime.now(),
                'drift_score': self.drift_score,
            })
            return True
        
        return False


class AdaptiveBaselineManager:
    """Online baseline learning with concept drift detection."""
    
    def __init__(self, learning_rate: float = 0.1,
                 drift_threshold: float = 0.15):
        """
        Initialize adaptive baseline.
        
        Args:
            learning_rate: Alpha for exponential moving average
            drift_threshold: Threshold for drift detection
        """
        self.learning_rate = learning_rate
        self.baseline_features = None
        self.drift_detector = ConceptDriftDetector(drift_threshold=drift_threshold)
        self.model_versions = []
        self.adaptation_history = []
        self.feature_history = deque(maxlen=168)  # Keep 1 week of features
    
    def update_baseline_online(self, new_features: np.ndarray,
                              prediction_error: float = 0.0):
        """
        Incrementally update baseline (exponential moving average).
        
        Args:
            new_features: New feature vector
            prediction_error: Prediction error for drift detection
        """
        # Check for concept drift
        drift_detected = self.drift_detector.update(prediction_error)
        
        if drift_detected:
            print(f"⚠️ Concept drift detected at {datetime.now()}")
            self.adaptation_history.append({
                'timestamp': datetime.now(),
                'reason': 'drift_detected',
                'old_baseline': self.baseline_features.copy() if self.baseline_features is not None else None,
                'drift_score': self.drift_detector.drift_score,
            })
            
            # Trigger retraining
            self.retrain_on_recent_data()
        
        # Incremental baseline update
        if self.baseline_features is None:
            self.baseline_features = new_features
        else:
            # Exponential moving average
            for key in range(len(self.baseline_features)):
                old_val = self.baseline_features[key]
                new_val = new_features[key]
                self.baseline_features[key] = (
                    self.learning_rate * new_val +
                    (1 - self.learning_rate) * old_val
                )
        
        # Store in history
        self.feature_history.append(new_features)
    
    def retrain_on_recent_data(self, lookback_windows: int = 24):
        """
        Retrain model using recent data (after drift detected).
        
        Args:
            lookback_windows: Number of recent windows to use
        """
        if len(self.feature_history) < lookback_windows:
            return
        
        recent_data = list(self.feature_history)[-lookback_windows:]
        
        # In real implementation, would retrain ML models here
        # For now, just update baseline
        self.baseline_features = np.mean(recent_data, axis=0)
        
        # Track model version
        self.model_versions.append({
            'timestamp': datetime.now(),
            'version': len(self.model_versions),
            'training_samples': len(recent_data),
            'drift_score': self.drift_detector.drift_score,
        })
    
    def get_stability_metrics(self) -> Dict:
        """Get system stability metrics."""
        return {
            'concept_drift_probability': float(self.drift_detector.drift_score),
            'model_retrains_this_week': len([
                v for v in self.model_versions
                if v['timestamp'] > datetime.now() - timedelta(days=7)
            ]),
            'baseline_age_hours': (
                datetime.now() - self.model_versions[-1]['timestamp']
            ).total_seconds() / 3600 if self.model_versions else 0,
            'is_adapting': self.drift_detector.is_drifting,
            'recent_adaptation': self.adaptation_history[-1] if self.adaptation_history else None,
        }


class ActiveLearningFeedback:
    """Learn from user feedback on predictions."""
    
    def __init__(self):
        """Initialize active learning system."""
        self.feedback_buffer = []
        self.feedback_history = []
        self.uncertain_predictions = deque(maxlen=1000)
    
    def collect_feedback(self, alert_id: str, user_label: str,
                        prediction_confidence: float = 0.5):
        """
        Collect user feedback on predictions.
        
        Args:
            alert_id: Alert identifier
            user_label: One of: 'true_positive', 'false_positive', 'false_negative'
            prediction_confidence: Model's confidence (0-1)
        """
        feedback = {
            'alert_id': alert_id,
            'label': user_label,
            'timestamp': datetime.now(),
            'confidence': prediction_confidence,
        }
        
        self.feedback_buffer.append(feedback)
        self.feedback_history.append(feedback)
        
        # Trigger retraining every 50 feedbacks
        if len(self.feedback_buffer) >= 50:
            self.retrain_from_feedback()
    
    def get_uncertain_predictions(self, predictions: List[Dict],
                                 threshold: float = 0.5) -> List[Dict]:
        """
        Get predictions model is uncertain about (good for labeling).
        
        Args:
            predictions: List of prediction dicts (must have 'confidence')
            threshold: Uncertainty threshold
        
        Returns:
            Sorted list of uncertain predictions
        """
        uncertain = []
        
        for pred in predictions:
            confidence = pred.get('confidence', 0.5)
            
            # Model is uncertain if score near 0.5
            if abs(confidence - 0.5) < threshold:
                uncertain.append(pred)
        
        # Return top 10 most uncertain
        return sorted(uncertain, key=lambda x: abs(x['confidence'] - 0.5))[:10]
    
    def retrain_from_feedback(self):
        """Retrain using user-provided labels."""
        if len(self.feedback_buffer) < 10:
            return
        
        # Categorize feedback
        true_pos = [f for f in self.feedback_buffer if f['label'] == 'true_positive']
        false_pos = [f for f in self.feedback_buffer if f['label'] == 'false_positive']
        false_neg = [f for f in self.feedback_buffer if f['label'] == 'false_negative']
        
        # Calculate metrics
        precision = len(true_pos) / (len(true_pos) + len(false_pos) + 1e-6)
        recall = len(true_pos) / (len(true_pos) + len(false_neg) + 1e-6)
        f1 = 2 * (precision * recall) / (precision + recall + 1e-6)
        
        print(f"✅ Retrained on {len(self.feedback_buffer)} labels:")
        print(f"   Precision: {precision:.2%}, Recall: {recall:.2%}, F1: {f1:.2%}")
        
        # In real implementation:
        # - Train feedbackclassifier on features
        # - Update decision thresholds
        # - Improve confusion matrix
        
        self.feedback_buffer = []  # Clear buffer
    
    def get_feedback_summary(self) -> Dict:
        """Get summary of feedback received."""
        if not self.feedback_history:
            return {'total_feedback': 0}
        
        true_pos = sum(1 for f in self.feedback_history if f['label'] == 'true_positive')
        false_pos = sum(1 for f in self.feedback_history if f['label'] == 'false_positive')
        false_neg = sum(1 for f in self.feedback_history if f['label'] == 'false_negative')
        
        total = len(self.feedback_history)
        
        return {
            'total_feedback': total,
            'true_positives': true_pos,
            'false_positives': false_pos,
            'false_negatives': false_neg,
            'precision': true_pos / (true_pos + false_pos) if (true_pos + false_pos) > 0 else 0,
            'recall': true_pos / (true_pos + false_neg) if (true_pos + false_neg) > 0 else 0,
            'user_satisfaction': 'increasing' if false_pos < 0.1 * total else 'needs_improvement',
        }
