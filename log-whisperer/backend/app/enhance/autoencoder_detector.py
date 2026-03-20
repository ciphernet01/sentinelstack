"""
Autoencoder-based Anomaly Detector - Deep learning for anomaly detection.
Phase 1 Enhancement: Use neural networks to learn optimal representations.
"""

import numpy as np
from typing import List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, Model
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False


class AutoencoderAnomalyDetector:
    """
    Autoencoder neural network for unsupervised anomaly detection.
    Learns to reconstruct normal patterns; high reconstruction error = anomaly.
    """
    
    def __init__(self, input_dim: int, encoding_dim: int = 5, 
                 batch_size: int = 32, epochs: int = 50):
        """
        Initialize autoencoder.
        
        Args:
            input_dim: Number of input features
            encoding_dim: Bottleneck dimension (compression factor)
            batch_size: Training batch size
            epochs: Training epochs
        """
        if not TENSORFLOW_AVAILABLE:
            raise ImportError("TensorFlow required for AutoencoderAnomalyDetector. "
                            "Install with: pip install tensorflow")
        
        self.input_dim = input_dim
        self.encoding_dim = encoding_dim
        self.batch_size = batch_size
        self.epochs = epochs
        
        self.model = None
        self.encoder = None
        self.threshold = None
        self.is_fitted = False
        
        self._build_network()
    
    def _build_network(self):
        """Build 3-layer autoencoder architecture."""
        
        # Input
        inputs = keras.Input(shape=(self.input_dim,))
        
        # Encoder: compress features
        encoded = layers.Dense(
            max(15, self.input_dim // 2),
            activation='relu',
            name='encoder_1'
        )(inputs)
        
        encoded = layers.Dense(
            max(10, self.input_dim // 3),
            activation='relu',
            name='encoder_2'
        )(encoded)
        
        # Bottleneck: compressed representation
        encoded = layers.Dense(
            self.encoding_dim,
            activation='relu',
            name='bottleneck'
        )(encoded)
        
        # Decoder: reconstruct features
        decoded = layers.Dense(
            max(10, self.input_dim // 3),
            activation='relu',
            name='decoder_1'
        )(encoded)
        
        decoded = layers.Dense(
            max(15, self.input_dim // 2),
            activation='relu',
            name='decoder_2'
        )(decoded)
        
        # Output: reconstruct original dimension
        decoded = layers.Dense(
            self.input_dim,
            activation='linear',
            name='output'
        )(decoded)
        
        # Full autoencoder
        self.model = Model(inputs, decoded)
        self.model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mse'
        )
        
        # Encoder for visualization / intermediate representations
        self.encoder = Model(inputs, encoded)
    
    def fit(self, data: np.ndarray, validation_split: float = 0.2,
            verbose: bool = False):
        """
        Train autoencoder on normal data.
        
        Args:
            data: Training data (n_samples, n_features)
            validation_split: Fraction for validation
            verbose: Print training progress
        """
        # Normalize features
        self.data_mean = np.mean(data, axis=0)
        self.data_std = np.std(data, axis=0) + 1e-6
        
        data_normalized = (data - self.data_mean) / self.data_std
        
        # Train
        history = self.model.fit(
            data_normalized,
            data_normalized,
            epochs=self.epochs,
            batch_size=self.batch_size,
            validation_split=validation_split,
            verbose=1 if verbose else 0,
            shuffle=True
        )
        
        # Calculate threshold based on training reconstruction errors
        train_predictions = self.model.predict(data_normalized, verbose=0)
        train_errors = np.mean(np.square(data_normalized - train_predictions), axis=1)
        
        # Threshold at 95th percentile of reconstruction errors
        self.threshold = np.percentile(train_errors, 95)
        
        self.is_fitted = True
    
    def anomaly_score(self, features: np.ndarray) -> Tuple[float, float]:
        """
        Calculate anomaly score based on reconstruction error.
        
        Args:
            features: Feature vector (1D or 2D)
        
        Returns:
            Tuple of (anomaly_score, reconstruction_error)
            anomaly_score: 0-1 (1 = strong anomaly)
            reconstruction_error: Raw MSE
        """
        if not self.is_fitted:
            raise ValueError("Autoencoder must be fitted before prediction")
        
        # Ensure 2D
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        # Normalize same way as training
        features_normalized = (features - self.data_mean) / self.data_std
        
        # Get reconstruction
        reconstruction = self.model.predict(features_normalized, verbose=0)
        
        # Calculate error
        reconstruction_error = np.mean(
            np.square(features_normalized - reconstruction),
            axis=1
        )[0]
        
        # Normalize error to 0-1 using threshold
        # error < threshold → score near 0
        # error > threshold → score near 1
        anomaly_score = min(1.0, reconstruction_error / (self.threshold + 1e-6))
        
        return float(anomaly_score), float(reconstruction_error)
    
    def get_encoded_representation(self, features: np.ndarray) -> np.ndarray:
        """
        Get compressed representation from encoder (bottleneck).
        Useful for clustering similar anomalies.
        
        Args:
            features: Feature vector
        
        Returns:
            Encoded representation (encoding_dim,)
        """
        if not self.is_fitted:
            raise ValueError("Autoencoder must be fitted")
        
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        features_normalized = (features - self.data_mean) / self.data_std
        encoding = self.encoder.predict(features_normalized, verbose=0)
        
        return encoding[0]
    
    def detect_anomaly_type(self, features: np.ndarray) -> Dict:
        """
        Identify type of anomaly based on reconstruction error patterns.
        
        Args:
            features: Feature vector
        
        Returns:
            Dict with anomaly type info
        """
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        features_normalized = (features - self.data_mean) / self.data_std
        reconstruction = self.model.predict(features_normalized, verbose=0)[0]
        
        # Element-wise error
        elementwise_errors = np.square(features_normalized[0] - reconstruction)
        
        # Find which features have highest error
        top_error_indices = np.argsort(elementwise_errors)[-3:][::-1]
        
        return {
            'anomaly_type': 'representation_mismatch',
            'most_anomalous_features': top_error_indices.tolist(),
            'feature_errors': elementwise_errors[top_error_indices].tolist(),
        }


class AutoencoderEnsemble:
    """
    Multiple autoencoders trained on different data subsets.
    Increases robustness through diversity.
    """
    
    def __init__(self, n_models: int = 3, input_dim: int = 20):
        """
        Initialize ensemble of autoencoders.
        
        Args:
            n_models: Number of independent autoencoders
            input_dim: Number of features
        """
        self.n_models = n_models
        self.models = [
            AutoencoderAnomalyDetector(
                input_dim=input_dim,
                encoding_dim=max(3, input_dim // 4),
                epochs=40
            )
            for _ in range(n_models)
        ]
        self.is_fitted = False
    
    def fit(self, data: np.ndarray):
        """
        Train ensemble with bootstrap samples (bagging for diversity).
        
        Args:
            data: Training data
        """
        np.random.seed(42)
        
        for model in self.models:
            # Bootstrap sample
            indices = np.random.choice(len(data), len(data), replace=True)
            bootstrap_data = data[indices]
            
            # Train
            model.fit(bootstrap_data, verbose=False)
        
        self.is_fitted = True
    
    def predict_ensemble(self, features: np.ndarray) -> float:
        """
        Ensemble prediction: average of all models.
        
        Args:
            features: Feature vector
        
        Returns:
            Ensemble anomaly score (0-1)
        """
        if not self.is_fitted:
            raise ValueError("Ensemble must be fitted")
        
        scores = []
        for model in self.models:
            score, _ = model.anomaly_score(features)
            scores.append(score)
        
        return float(np.mean(scores))
