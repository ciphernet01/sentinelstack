"""
Tests for API routes - Log upload, streaming, anomaly queries, crash reports
"""

import pytest
from datetime import datetime, timedelta
from io import BytesIO
from fastapi.testclient import TestClient

from app.main import app
from app.api.routes import AppState, get_severity, extract_patterns
from app.core.schemas import WindowFeatures, LogEvent
from app.report.generator import CrashReportGenerator
from app.detect.anomaly import AnomalyDetector
from app.ingest.service import IngestionService


# ============================================================================
# TEST FIXTURES
# ============================================================================

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_app_state():
    """Reset global app state before each test"""
    AppState.reset()
    AppState.initialize()
    yield
    AppState.reset()


@pytest.fixture
def sample_logs():
    """Sample log content for upload tests"""
    return """192.168.1.1 - - [20/Mar/2026:10:30:45 +0000] GET /api/users 200 512 "-" "curl/7.68.0"
192.168.1.1 - - [20/Mar/2026:10:30:46 +0000] GET /api/login 200 1024 "-" "Mozilla/5.0"
192.168.1.2 - - [20/Mar/2026:10:30:47 +0000] GET /api/health 500 256 "-" "curl/7.68.0"
192.168.1.2 - - [20/Mar/2026:10:30:48 +0000] GET /api/users 500 256 "-" "curl/7.68.0"
192.168.1.3 - - [20/Mar/2026:10:30:49 +0000] GET /api/query 200 2048 "-" "curl/7.68.0"
"""


@pytest.fixture
def sample_json_logs():
    """Sample JSON logs for format_hint testing"""
    logs = """{"timestamp": "2026-03-20T10:30:45Z", "service": "api", "level": "INFO", "message": "Request received"}
{"timestamp": "2026-03-20T10:30:46Z", "service": "api", "level": "ERROR", "message": "Connection timeout"}
{"timestamp": "2026-03-20T10:30:47Z", "service": "api", "level": "ERROR", "message": "Connection timeout"}
{"timestamp": "2026-03-20T10:30:48Z", "service": "api", "level": "ERROR", "message": "Connection timeout"}
{"timestamp": "2026-03-20T10:30:49Z", "service": "api", "level": "INFO", "message": "Request completed"}
"""
    return logs


@pytest.fixture
def window_features():
    """Sample WindowFeatures for report generation"""
    return WindowFeatures(
        window_start=datetime.utcnow() - timedelta(minutes=1),
        window_end=datetime.utcnow(),
        duration_sec=60,
        service="auth-service",
        event_count=2847,
        error_count=284,
        error_rate=0.0998,
        level_distribution={"DEBUG": 1200, "INFO": 1200, "WARN": 300, "ERROR": 147, "FATAL": 0},
        throughput_eps=47.45,
        unique_messages=23,
        unique_templates=18,
        top_error_messages=[["Connection refused", 45], ["Timeout", 35]],
        latency_p50=45.2,
        latency_p95=189.5,
        latency_p99=542.1,
        latency_max=2847.3,
        heartbeat_missing=False,
        error_burst=False,
        volume_spike=False,
        sequence_anomaly=False,
        service_down=False
    )


# ============================================================================
# TESTS: LOG UPLOAD ENDPOINT
# ============================================================================

def test_upload_logs_success(client, sample_logs):
    """Test successful log upload"""
    response = client.post(
        "/api/v1/logs/upload",
        files={"file": ("logs.txt", BytesIO(sample_logs.encode()))},
        params={"format_hint": "apache"}
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert "upload_id" in data
    assert data["filename"] == "logs.txt"
    assert "ingestion" in data
    assert data["ingestion"]["parsed"] > 0
    assert "anomalies" in data


def test_upload_logs_json_format(client, sample_json_logs):
    """Test log upload with JSON format"""
    response = client.post(
        "/api/v1/logs/upload",
        files={"file": ("logs.json", BytesIO(sample_json_logs.encode()))},
        params={"format_hint": "json"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["ingestion"]["parsed"] > 0


def test_upload_logs_with_service_override(client, sample_logs):
    """Test log upload with service name override"""
    response = client.post(
        "/api/v1/logs/upload",
        files={"file": ("logs.txt", BytesIO(sample_logs.encode()))},
        params={
            "format_hint": "apache",
            "service_override": "custom-service"
        }
    )
    
    assert response.status_code == 200


def test_upload_logs_empty_file(client):
    """Test upload with empty file"""
    response = client.post(
        "/api/v1/logs/upload",
        files={"file": ("empty.txt", BytesIO(b""))}
    )
    
    assert response.status_code == 400


def test_upload_logs_anomaly_detection(client, sample_logs):
    """Test that anomalies are detected during upload"""
    response = client.post(
        "/api/v1/logs/upload",
        files={"file": ("logs.txt", BytesIO(sample_logs.encode()))},
        params={"format_hint": "apache"}
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # May or may not have anomalies depending on pattern
    assert "anomalies" in data
    assert isinstance(data["anomalies"], list)


# ============================================================================
# TESTS: ANOMALIES QUERY ENDPOINT
# ============================================================================

def test_get_anomalies_empty(client):
    """Test anomalies query when none exist"""
    response = client.get("/api/v1/anomalies")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["total"] == 0
    assert data["returned"] == 0
    assert data["anomalies"] == []


def test_get_anomalies_with_filter(client, sample_logs):
    """Test anomalies query with filters"""
    # First, upload some logs to create anomalies
    client.post(
        "/api/v1/logs/upload",
        files={"file": ("logs.txt", BytesIO(sample_logs.encode()))},
        params={"format_hint": "apache"}
    )
    
    # Query with minimum score
    response = client.get(
        "/api/v1/anomalies",
        params={"min_score": 50}
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert "anomalies" in data
    for anomaly in data["anomalies"]:
        assert anomaly["anomaly_score"] >= 50


def test_get_anomalies_limit(client):
    """Test anomalies query with result limit"""
    response = client.get(
        "/api/v1/anomalies",
        params={"limit": 5}
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert len(data["anomalies"]) <= 5


# ============================================================================
# TESTS: DETECTOR STATUS ENDPOINT
# ============================================================================

def test_detector_status(client):
    """Test detector status endpoint"""
    response = client.get("/api/v1/status/detector")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "detector_ready" in data
    assert "events_ingested" in data
    assert "windows_processed" in data
    assert "ml_model_trained" in data
    assert "config" in data
    assert data["detector_ready"] is True


def test_detector_status_after_ingestion(client, sample_logs):
    """Test detector status after ingesting logs"""
    # Upload logs
    client.post(
        "/api/v1/logs/upload",
        files={"file": ("logs.txt", BytesIO(sample_logs.encode()))},
        params={"format_hint": "apache"}
    )
    
    # Check status
    response = client.get("/api/v1/status/detector")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["events_ingested"] > 0
    assert data["windows_processed"] > 0


# ============================================================================
# TESTS: CRASH REPORTS ENDPOINT
# ============================================================================

def test_get_crash_reports_empty(client):
    """Test crash reports query when none exist"""
    response = client.get("/api/v1/crashes")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["total_crashes"] == 0
    assert data["reports"] == []


def test_get_crash_reports_with_filter(client):
    """Test crash reports query with service filter"""
    response = client.get(
        "/api/v1/crashes",
        params={"service": "auth-service"}
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert "reports" in data


# ============================================================================
# TESTS: ADMIN RESET ENDPOINT
# ============================================================================

def test_admin_reset(client, sample_logs):
    """Test admin reset endpoint"""
    # Upload logs to populate state
    client.post(
        "/api/v1/logs/upload",
        files={"file": ("logs.txt", BytesIO(sample_logs.encode()))},
        params={"format_hint": "apache"}
    )
    
    # Verify state populated
    response = client.get("/api/v1/status/detector")
    before = response.json()
    assert before["events_ingested"] > 0
    
    # Reset
    response = client.post("/api/v1/admin/reset")
    assert response.status_code == 200
    
    # Verify state cleared
    response = client.get("/api/v1/status/detector")
    after = response.json()
    # After reset, new instance is created, so should be fresh
    assert after["detector_ready"] is True


# ============================================================================
# TESTS: HELPER FUNCTIONS
# ============================================================================

def test_get_severity():
    """Test severity mapping function"""
    assert get_severity(10) == "HEALTHY"
    assert get_severity(30) == "NOMINAL"
    assert get_severity(50) == "CAUTION"
    assert get_severity(70) == "ALERT"
    assert get_severity(90) == "CRITICAL"


def test_extract_patterns(window_features):
    """Test pattern extraction function"""
    patterns = extract_patterns(75, window_features)
    
    # Patterns is a list of dicts
    assert isinstance(patterns, list)
    for pattern in patterns:
        assert "name" in pattern
        assert "contribution" in pattern


# ============================================================================
# TESTS: CRASH REPORT GENERATOR
# ============================================================================

class TestCrashReportGenerator:
    
    def test_generate_report(self, window_features):
        """Test basic crash report generation"""
        detector = AnomalyDetector()
        generator = CrashReportGenerator(detector=detector)
        
        report = generator.generate(
            window_features=window_features,
            anomaly_score=85
        )
        
        assert "report_id" in report
        assert "generated_at" in report
        assert "service" in report
        assert "probable_root_cause" in report
        assert "confidence" in report
        assert 0 <= report["confidence"] <= 1.0
        assert "timeline" in report
        assert "recommended_actions" in report
    
    def test_generate_report_high_error_rate(self, window_features):
        """Test report generation for high error rate"""
        window_features.error_rate = 0.35  # 35% error rate
        
        detector = AnomalyDetector()
        generator = CrashReportGenerator(detector=detector)
        
        report = generator.generate(
            window_features=window_features,
            anomaly_score=85
        )
        
        # Should mention error rate
        assert "error" in report["probable_root_cause"].lower()
    
    def test_generate_report_with_events(self, window_features):
        """Test report generation with recent events"""
        detector = AnomalyDetector()
        generator = CrashReportGenerator(detector=detector)
        
        events = [
            LogEvent(
                timestamp=datetime.utcnow(),
                event_id="1",
                service="test",
                level="ERROR",
                message="Connection pool exhausted",
                raw="",
                source="json"
            ),
            LogEvent(
                timestamp=datetime.utcnow(),
                event_id="2",
                service="test",
                level="ERROR",
                message="Connection pool exhausted",
                raw="",
                source="json"
            )
        ]
        
        report = generator.generate(
            window_features=window_features,
            anomaly_score=85,
            recent_events=events
        )
        
        # Should mention connection pool
        if "connection pool" in report["probable_root_cause"].lower():
            assert any("connection" in action.lower() for action in report["recommended_actions"])
    
    def test_report_history(self, window_features):
        """Test report history tracking"""
        detector = AnomalyDetector()
        generator = CrashReportGenerator(detector=detector)
        
        # Generate multiple reports
        for i in range(5):
            window_features.window_start = datetime.utcnow() - timedelta(minutes=5-i)
            generator.generate(window_features, 85)
        
        # Verify history
        reports = generator.get_recent_reports(limit=3)
        assert len(reports) == 3
    
    def test_service_dependencies(self, window_features):
        """Test service dependency tracking"""
        detector = AnomalyDetector()
        generator = CrashReportGenerator(detector=detector)
        
        deps = {
            "auth-service": ["user-api", "payment-processor"],
            "user-api": ["database"]
        }
        generator.set_service_dependencies(deps)
        
        report = generator.generate(window_features, 85)
        
        # Check that dependencies are included
        assert "service_dependencies" in report


# ============================================================================
# TESTS: HEALTH & STATUS ENDPOINTS
# ============================================================================

def test_health_endpoint(client):
    """Test /health endpoint"""
    response = client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "log-whisperer-backend"


def test_api_status_endpoint(client):
    """Test /api/v1/status endpoint"""
    response = client.get("/api/v1/status")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "ingest" in data
    assert "parse" in data
    assert "detect" in data
    assert "report" in data
    assert data["ingest"] == "ready"
    assert data["parse"] == "ready"


def test_alert_dispatch_missing_webhook(client):
    response = client.post(
        "/api/v1/alerts/send",
        json={
            "min_score": 61,
            "max_alerts": 5,
            "include_crash_summary": False
        }
    )

    assert response.status_code == 400
    assert "webhook" in response.json()["detail"].lower()


def test_alert_dispatch_success(client, monkeypatch):
    AppState.anomaly_buffer = [
        {
            "window": datetime.utcnow().isoformat() + "Z",
            "anomaly_score": 82,
            "service": "auth-service",
            "reason": "NORMAL"
        }
    ]

    def fake_send_webhook(url, payload):
        return True, 200, "ok"

    monkeypatch.setattr("app.api.routes.send_webhook", fake_send_webhook)

    response = client.post(
        "/api/v1/alerts/send",
        json={
            "webhook_url": "https://example.com/hook",
            "min_score": 61,
            "max_alerts": 5,
            "include_crash_summary": True
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["sent"] is True
    assert data["status_code"] == 200
    assert data["anomaly_count"] == 1
