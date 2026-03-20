"""
Service Dependency Graph - Map service relationships and propagate anomalies.
Phase 2 Enhancement: Understand multi-service correlation and cascading failures.
"""

import numpy as np
from typing import Dict, Set, List, Tuple
from collections import defaultdict


class ServiceDependencyGraph:
    """
    Maps how services depend on each other.
    Detects cascading failures and propagates risk scores.
    """
    
    def __init__(self):
        """Initialize dependency graph."""
        self.dependency_graph = defaultdict(set)  # service -> upstream services
        self.correlation_matrix = defaultdict(list)  # (s1, s2) -> correlations
        self.co_occurrence_counts = defaultdict(int)  # (s1, s2) -> count
        self.error_correlation = defaultdict(int)  # (s1, s2) -> error co-occur count
    
    def learn_dependencies(self, logs, window_duration: int = 300):
        """
        Learn service dependencies from log co-occurrence patterns.
        
        Args:
            logs: List of LogEvent objects
            window_duration: Seconds for grouping into windows
        """
        # Group logs by time window
        windows = defaultdict(list)
        for log in logs:
            window_key = int(log.timestamp.timestamp() / window_duration)
            windows[window_key].append(log)
        
        # Analyze correlations
        for window_logs in windows.values():
            if len(window_logs) < 2:
                continue
            
            services = list(set(log.service for log in window_logs if log.service))
            
            # Check each service pair
            for i, s1 in enumerate(services):
                for s2 in services[i+1:]:
                    # Update co-occurrence
                    key = tuple(sorted([s1, s2]))
                    self.co_occurrence_counts[key] += 1
                    
                    # Check error correlation
                    s1_errors = sum(1 for l in window_logs 
                                   if l.service == s1 and l.level == 'ERROR')
                    s2_errors = sum(1 for l in window_logs 
                                   if l.service == s2 and l.level == 'ERROR')
                    
                    if s1_errors > 0 and s2_errors > 0:
                        self.error_correlation[key] += 1
                        
                        # Record dependency direction
                        # If s1 has errors and s2 has errors, s2 likely depends on s1
                        self.dependency_graph[s2].add(s1)
    
    def get_dependencies(self, service: str) -> Set[str]:
        """
        Get upstream services that this service depends on.
        
        Args:
            service: Service identifier
        
        Returns:
            Set of upstream service names
        """
        return self.dependency_graph.get(service, set())
    
    def get_dependents(self, service: str) -> Set[str]:
        """
        Get downstream services that depend on this service.
        
        Args:
            service: Service identifier
        
        Returns:
            Set of downstream service names
        """
        dependents = set()
        for svc, deps in self.dependency_graph.items():
            if service in deps:
                dependents.add(svc)
        
        return dependents
    
    def propagate_anomaly(self, affected_service: str,
                         base_risk: float = 1.0) -> Dict[str, float]:
        """
        Calculate risk propagation when one service has anomaly.
        Uses BFS to traverse dependency graph.
        
        Args:
            affected_service: Service with detected anomaly
            base_risk: Starting risk score (0-1)
        
        Returns:
            Dict mapping service -> risk_score
        """
        risk_scores = {affected_service: base_risk}
        queue = [(affected_service, base_risk)]
        visited = set()
        
        # Traverse dependents (downstream propagation)
        while queue:
            current, current_risk = queue.pop(0)
            
            if current in visited:
                continue
            visited.add(current)
            
            # Find services that depend on current service
            dependents = self.get_dependents(current)
            
            for dependent in dependents:
                # Propagation factor: how much does anomaly spread?
                # Look up correlation strength
                key = tuple(sorted([current, dependent]))
                frequency = self.co_occurrence_counts.get(key, 0)
                error_freq = self.error_correlation.get(key, 0)
                
                # Propagation strength based on correlation
                if frequency > 0:
                    propagation_strength = min(1.0, error_freq / frequency)
                else:
                    propagation_strength = 0.7  # Default propagation
                
                # Attenuate risk as it propagates
                propagated_risk = current_risk * propagation_strength * 0.8
                
                # Update risk (take max if already scored)
                if dependent not in risk_scores:
                    risk_scores[dependent] = 0.0
                risk_scores[dependent] = max(risk_scores[dependent], propagated_risk)
                
                # Add to queue if significant risk
                if propagated_risk > 0.1:
                    queue.append((dependent, propagated_risk))
        
        return risk_scores
    
    def get_dependency_chain(self, service: str, direction: str = 'upstream',
                           max_depth: int = 5) -> List[List[str]]:
        """
        Get dependency chains (paths) for a service.
        
        Args:
            service: Service to analyze
            direction: 'upstream' or 'downstream'
            max_depth: Maximum chain length
        
        Returns:
            List of dependency chains (each chain is list of services)
        """
        chains = []
        
        if direction == 'upstream':
            # Find all paths to root causes
            queue = [([service], 0)]
            
            while queue:
                path, depth = queue.pop(0)
                current = path[-1]
                
                deps = self.get_dependencies(current)
                
                if not deps or depth >= max_depth:
                    chains.append(path)
                else:
                    for dep in deps:
                        queue.append((path + [dep], depth + 1))
        
        else:  # downstream
            # Find all services affected
            queue = [([service], 0)]
            
            while queue:
                path, depth = queue.pop(0)
                current = path[-1]
                
                dependents = self.get_dependents(current)
                
                if not dependents or depth >= max_depth:
                    chains.append(path)
                else:
                    for dep in dependents:
                        queue.append((path + [dep], depth + 1))
        
        return chains
    
    def analyze_criticality(self, service: str) -> Dict:
        """
        Analyze how critical a service is (how many depend on it?).
        
        Args:
            service: Service identifier
        
        Returns:
            Dict with criticality metrics
        """
        dependents = self.get_dependents(service)
        dependencies = self.get_dependencies(service)
        
        # Count total downstream impact
        total_impact = len(self._get_all_downstream(service))
        
        # Criticality score: 0-1
        # Higher = more services depend on this one
        criticality = min(1.0, len(dependents) / 10.0)  # Normalize to 10 services max
        
        return {
            'service': service,
            'criticality_score': criticality,
            'direct_dependents': len(dependents),
            'total_downstream_impact': total_impact,
            'dependencies_count': len(dependencies),
            'is_critical': criticality > 0.7,
            'failure_impact': 'high' if criticality > 0.7 else ('medium' if criticality > 0.3 else 'low'),
        }
    
    def _get_all_downstream(self, service: str) -> Set[str]:
        """Get all services impacted if this service fails (BFS)."""
        impacted = set()
        queue = [service]
        visited = set()
        
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            
            dependents = self.get_dependents(current)
            impacted.update(dependents)
            queue.extend(dependents)
        
        return impacted
    
    def suggest_incident_response(self, affected_service: str) -> Dict:
        """
        Suggest incident response based on service topology.
        
        Args:
            affected_service: Service with anomaly
        
        Returns:
            Dict with recommended actions
        """
        risk_propagation = self.propagate_anomaly(affected_service)
        criticality = self.analyze_criticality(affected_service)
        
        # High priority if it affects many services
        high_risk_services = [s for s, r in risk_propagation.items() if r > 0.5]
        
        actions = {
            'affected_service': affected_service,
            'priority': 'critical' if criticality['is_critical'] else 'high',
            'recommended_actions': [],
            'services_at_risk': high_risk_services,
            'suggested_timeline': {},
        }
        
        # Add recommendations
        if criticality['is_critical']:
            actions['recommended_actions'].extend([
                '🚨 CRITICAL: Engage incident commander immediately',
                'Prepare rollback/failover plan',
                'Alert dependent service teams',
                'Increase monitoring verbosity',
            ])
            actions['suggested_timeline']['now'] = 'Notify teams (0-5 min)'
            actions['suggested_timeline']['+5min'] = 'Implement fix or rollback'
            actions['suggested_timeline']['+15min'] = 'Verify all services healthy'
        else:
            actions['recommended_actions'].extend([
                'Investigate root cause in logs',
                'Monitor downstream services',
                'Prepare mitigation if needed',
            ])
            actions['suggested_timeline']['now'] = 'Begin investigation'
            actions['suggested_timeline']['+10min'] = 'Implement fix if clear'
            actions['suggested_timeline']['+30min'] = 'Full incident review'
        
        return actions
    
    def export_graph_as_dict(self) -> Dict:
        """Export dependency graph for visualization."""
        return {
            'nodes': list(set().union(*self.dependency_graph.keys(),
                                     *self.dependency_graph.values())),
            'edges': [
                {'source': svc, 'target': dep}
                for svc, deps in self.dependency_graph.items()
                for dep in deps
            ],
        }
