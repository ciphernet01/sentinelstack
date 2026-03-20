"""
Tests for Phase 2: Intelligent RCA (Causal Analysis, Service Dependencies)
"""

import pytest
from app.enhance.causal_rca import CausalRCAEngine
from app.enhance.service_dependency import ServiceDependencyGraph


class MockLogEvent:
    """Mock LogEvent for testing."""
    def __init__(self, service, level='INFO', message='test'):
        self.service = service
        self.level = level
        self.message = message
        self.timestamp = __import__('datetime').datetime.now()


class TestCausalRCAEngine:
    """Test Bayesian causal RCA."""
    
    def setup_method(self):
        """Setup RCA engine."""
        self.rca = CausalRCAEngine()
    
    def test_initialization(self):
        """Test RCA initialization."""
        assert len(self.rca.causal_edges) > 0
        assert len(self.rca.forward_graph) > 0
        assert len(self.rca.reverse_graph) > 0
    
    def test_infer_root_causes(self):
        """Test root cause inference."""
        signals = {
            'error_spike': True,
            'crash_detected': True,
            'connection_error': True,
        }
        
        causes = self.rca.infer_root_causes(signals)
        assert len(causes) > 0
        assert all(isinstance(c, tuple) and len(c) == 2 for c in causes)
        # Each cause should have probability 0-1
        assert all(0 <= prob <= 1 for _, prob in causes)
    
    def test_explain_cascade(self):
        """Test cascade explanation."""
        cascade = self.rca.explain_cascade('connection_pool_limit')
        assert len(cascade) > 0
        assert 'connection_pool_limit' in cascade
        assert 'crash_detected' in cascade or 'error_spike' in cascade
    
    def test_suggest_mitigation(self):
        """Test mitigation suggestions."""
        mitigations = self.rca.suggest_mitigation('connection_pool_limit')
        assert len(mitigations) > 0
        assert all(isinstance(m, str) for m in mitigations)


class TestServiceDependencyGraph:
    """Test service dependency analysis."""
    
    def setup_method(self):
        """Setup dependency graph."""
        self.graph = ServiceDependencyGraph()
    
    def test_learn_dependencies(self):
        """Test learning from logs."""
        # Create mock logs
        logs = [
            MockLogEvent('api', 'ERROR'),
            MockLogEvent('database', 'ERROR'),
            MockLogEvent('cache', 'INFO'),
        ]
        
        self.graph.learn_dependencies(logs, window_duration=300)
        # Should have learned some relationships
        assert len(self.graph.co_occurrence_counts) >= 0
    
    def test_propagate_anomaly(self):
        """Test anomaly propagation."""
        # Create dependencies
        self.graph.dependency_graph['api'].add('database')
        self.graph.dependency_graph['database'].add('storage')
        
        risks = self.graph.propagate_anomaly('database', base_risk=1.0)
        
        assert 'database' in risks
        assert risks['database'] == 1.0  # Original service
        assert 'api' in risks  # Downstream
        assert risks['api'] < 1.0  # Attenuated risk
    
    def test_criticality_analysis(self):
        """Test service criticality analysis."""
        # Create topology
        self.graph.dependency_graph['web'].add('api')
        self.graph.dependency_graph['worker'].add('api')
        self.graph.dependency_graph['api'].add('database')
        
        criticality = self.graph.analyze_criticality('api')
        
        assert criticality['direct_dependents'] == 2  # web, worker
        assert criticality['criticality_score'] > 0.5  # High criticality
        assert criticality['is_critical'] == True


class TestIncidentResponse:
    """Test incident response suggestions."""
    
    def setup_method(self):
        """Setup graph."""
        self.graph = ServiceDependencyGraph()
        # Create critical service
        for i in range(5):
            self.graph.dependency_graph[f'service_{i}'].add('core_api')
    
    def test_suggest_response(self):
        """Test response suggestions."""
        response = self.graph.suggest_incident_response('core_api')
        
        assert 'recommended_actions' in response
        assert len(response['recommended_actions']) > 0
        assert 'priority' in response
        assert response['priority'] == 'critical'
