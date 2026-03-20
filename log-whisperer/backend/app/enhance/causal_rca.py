"""
Causal RCA Engine - Bayesian network for root cause analysis.
Phase 2 Enhancement: Learn and reason about causal relationships in logs.
"""

import numpy as np
from typing import List, Dict, Set, Tuple, Optional
from collections import defaultdict


class CausalRCAEngine:
    """
    Bayesian network-based root cause analysis.
    Learns causal relationships and infers probable root causes.
    """
    
    def __init__(self):
        """Initialize causal graph."""
        # Define known causal relationships (expert knowledge)
        self.causal_edges = [
            # Connection pool issues
            ('connection_pool_limit', 'connection_error'),
            ('connection_error', 'request_failure'),
            ('request_failure', 'error_spike'),
            ('error_spike', 'crash_detected'),
            
            # Database issues
            ('database_slow', 'query_timeout'),
            ('query_timeout', 'connection_timeout'),
            ('connection_timeout', 'connection_error'),
            
            # Memory issues
            ('memory_leak', 'gc_pause'),
            ('gc_pause', 'latency_spike'),
            ('latency_spike', 'request_timeout'),
            ('request_timeout', 'error_spike'),
            
            # Network issues
            ('network_partition', 'service_unavailable'),
            ('service_unavailable', 'cascading_failure'),
            
            # Application issues
            ('logic_error', 'unexpected_exception'),
            ('unexpected_exception', 'error_spike'),
            ('error_spike', 'crash_detected'),
        ]
        
        # Build reverse graph for querying
        self.reverse_graph = defaultdict(set)  # effect -> causes
        self.forward_graph = defaultdict(set)  # cause -> effects
        
        for cause, effect in self.causal_edges:
            self.reverse_graph[effect].add(cause)
            self.forward_graph[cause].add(effect)
        
        # Conditional probabilities (learned from data or set manually)
        # P(cause | effect): how likely is cause given we see effect
        self.conditional_probs = self._initialize_conditional_probs()
    
    def _initialize_conditional_probs(self) -> Dict[Tuple[str, str], float]:
        """
        Initialize conditional probabilities P(cause | effect).
        Can be updated with real data over time.
        
        Returns:
            Dict mapping (effect, cause) -> probability
        """
        probs = {}
        
        # Prior probabilities (likelihood of each root cause)
        priors = {
            'connection_pool_limit': 0.20,
            'database_slow': 0.15,
            'memory_leak': 0.10,
            'network_partition': 0.08,
            'logic_error': 0.05,
            'gc_pause': 0.12,
            'query_timeout': 0.08,
            'service_unavailable': 0.10,
        }
        
        # For each causal relationship
        for cause, effect in self.causal_edges:
            # P(cause | effect) ∝ P(cause) * P(effect | cause)
            # Assuming high conditional likelihood if direct cause
            prior = priors.get(cause, 0.05)
            likelihood = 0.8  # High likelihood if direct cause
            probs[(effect, cause)] = prior * likelihood
        
        return probs
    
    def infer_root_causes(self, observed_signals: Dict[str, bool],
                         min_probability: float = 0.3) -> List[Tuple[str, float]]:
        """
        Infer probable root causes given observed symptoms.
        
        Args:
            observed_signals: Dict of {signal_name: observed}
                             E.g., {'error_spike': True, 'latency_spike': True}
            min_probability: Minimum probability to report
        
        Returns:
            List of (root_cause, probability) tuples, sorted by probability
        """
        probable_causes = {}
        
        potential_root_causes = [
            'connection_pool_limit',
            'database_slow',
            'memory_leak',
            'network_partition',
            'logic_error',
            'query_timeout',
        ]
        
        # For each potential root cause
        for root_cause in potential_root_causes:
            # Calculate probability this is the root cause
            prob = self._calculate_cause_probability(root_cause, observed_signals)
            
            if prob > min_probability:
                probable_causes[root_cause] = prob
        
        # Sort by probability
        return sorted(probable_causes.items(), key=lambda x: x[1], reverse=True)
    
    def _calculate_cause_probability(self, cause: str,
                                    observed_signals: Dict[str, bool]) -> float:
        """
        Calculate probability of cause given observed signals.
        Uses Bayesian inference: P(cause | signals) ∝ P(signals | cause)
        
        Args:
            cause: Potential root cause
            observed_signals: Observed symptoms
        
        Returns:
            Probability 0-1
        """
        # Get all downstream effects of this cause
        effects = self._get_downstream_effects(cause)
        
        # Count how many observed signals are explained by this cause
        explained = 0
        for signal, observed in observed_signals.items():
            if observed and signal in effects:
                explained += 1
        
        # Probability based on explanation power
        if len(observed_signals) == 0:
            return 0.0
        
        explanation_ratio = explained / len(observed_signals)
        
        # Boost probability if cascade matches expected pattern
        cascade_match = self._check_cascade_match(cause, observed_signals)
        
        # Combine scores
        base_prob = explanation_ratio * 0.6
        cascade_bonus = cascade_match * 0.4
        
        return base_prob + cascade_bonus
    
    def _get_downstream_effects(self, cause: str, max_depth: int = 5) -> Set[str]:
        """
        Get all downstream effects of a cause (BFS traversal).
        
        Args:
            cause: Root cause
            max_depth: Maximum cascade depth
        
        Returns:
            Set of all downstream effects
        """
        effects = set()
        queue = [(cause, 0)]
        visited = set()
        
        while queue:
            current, depth = queue.pop(0)
            
            if current in visited or depth > max_depth:
                continue
            
            visited.add(current)
            
            # Find direct effects
            for effect in self.forward_graph[current]:
                effects.add(effect)
                queue.append((effect, depth + 1))
        
        return effects
    
    def _check_cascade_match(self, cause: str,
                            observed_signals: Dict[str, bool]) -> float:
        """
        Check if observed signals match expected cascade from cause.
        
        Args:
            cause: Potential root cause
            observed_signals: Observed symptoms
        
        Returns:
            Match score 0-1
        """
        # Get expected cascade
        expected_cascade = self._get_cascade_path(cause)
        
        # See how many expected signals are present
        matches = sum(1 for signal in expected_cascade
                     if observed_signals.get(signal, False))
        
        if len(expected_cascade) == 0:
            return 0.0
        
        return matches / len(expected_cascade)
    
    def _get_cascade_path(self, cause: str) -> List[str]:
        """
        Get expected cascade path from cause to final symptom.
        
        Args:
            cause: Root cause
        
        Returns:
            List of effects in cascade order
        """
        path = [cause]
        current = cause
        
        while current in self.forward_graph:
            # Follow most likely effect
            effects = list(self.forward_graph[current])
            if effects:
                # Just take first effect (could be weighted by likelihood)
                next_effect = effects[0]
                path.append(next_effect)
                current = next_effect
            else:
                break
        
        return path
    
    def explain_cascade(self, root_cause: str) -> List[str]:
        """
        Explain how root cause leads to crash.
        
        Args:
            root_cause: Root cause identifier
        
        Returns:
            List of steps in cascade
        """
        cascade = []
        current = root_cause
        visited = set()
        
        while current not in visited:
            cascade.append(current)
            visited.add(current)
            
            # Find next effect
            next_nodes = list(self.forward_graph[current])
            if next_nodes:
                current = next_nodes[0]
            else:
                break
        
        return cascade
    
    def suggest_mitigation(self, root_cause: str) -> List[str]:
        """
        Suggest mitigation steps for root cause.
        
        Args:
            root_cause: Root cause identifier
        
        Returns:
            List of recommended mitigations
        """
        mitigations = {
            'connection_pool_limit': [
                'Increase connection pool size',
                'Optimize query time to free connections faster',
                'Implement connection timeout to reclaim lost connections',
            ],
            'database_slow': [
                'Add database indexes',
                'Optimize slow queries (use EXPLAIN)',
                'Check database resource usage (CPU, disk)',
                'Consider read replicas for load balancing',
            ],
            'memory_leak': [
                'Enable memory profiling',
                'Check for unreleased objects in application',
                'Restart service for temporary relief',
                'Update to latest runtime version',
            ],
            'network_partition': [
                'Check network connectivity',
                'Verify firewall rules',
                'Check DNS resolution',
                'Review load balancer configuration',
            ],
            'query_timeout': [
                'Increase query timeout',
                'Optimize query performance',
                'Add database indexes',
                'Check for table locks',
            ],
        }
        
        return mitigations.get(root_cause, [
            'Investigate root cause in application logs',
            'Enable debug logging',
            'Check system resources',
        ])
    
    def update_conditional_probs(self, cause: str, effect: str,
                                new_probability: float):
        """
        Update conditional probability based on observed data.
        Called when we confirm a cause-effect relationship.
        
        Args:
            cause: Root cause
            effect: Observed effect
            new_probability: Updated probability
        """
        self.conditional_probs[(effect, cause)] = new_probability
