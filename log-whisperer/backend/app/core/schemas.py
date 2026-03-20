"""
Core Pydantic schemas for Log-Whisperer ML pipeline.
Defines event structures, feature vectors, and report outputs.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Literal
from pydantic import BaseModel, Field


# ============================================================================
# LOG EVENT SCHEMA (Unified format after parsing)
# ============================================================================

class LogEvent(BaseModel):
    """Unified log event across all formats (Apache, Nginx, Syslog, JSON, Spring Boot)"""
    
    # Identifiers
    timestamp: datetime = Field(..., description="ISO-8601, normalized to UTC")
    event_id: str = Field(..., description="UUID or hash-based ID")
    
    # Source Information
    service: str = Field(..., description="e.g., 'auth-service', 'payment-api'")
    host: Optional[str] = Field(None, description="hostname or pod name")
    source: str = Field(..., description="Log source format: 'apache', 'nginx', 'syslog', 'json', 'spring-boot'")
    
    # Log Content
    level: str = Field(..., description="Log level: DEBUG, INFO, WARN, ERROR, FATAL")
    message: str = Field(..., description="Cleaned/normalized message text")
    template: Optional[str] = Field(None, description="Templated message (e.g., 'User {uid} login failed')")
    raw: str = Field(..., description="Original raw log line for context")
    
    # Context (optional, extracted by parser)
    trace_id: Optional[str] = Field(None, description="Distributed trace ID")
    request_id: Optional[str] = Field(None, description="Request correlation ID")
    user_id: Optional[str] = Field(None, description="User identifier if extractable")
    origin_ip: Optional[str] = Field(None, description="Source IP if extractable")
    
    # Custom Metadata (parser-specific fields)
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Parser-specific: http_status, latency_ms, etc.")
    
    # ML Features (computed during ingestion)
    anomaly_score: float = Field(default=0.0, ge=0, le=100, description="Anomaly score 0-100")
    detection_reason: Optional[str] = Field(None, description="Why this event is anomalous")


# ============================================================================
# TIME-WINDOW FEATURES (Aggregated statistics)
# ============================================================================

class WindowFeatures(BaseModel):
    """Time-window aggregate features for anomaly detection"""
    
    window_start: datetime
    window_end: datetime
    duration_sec: int = Field(..., description="Window duration in seconds")
    service: str
    
    # Event Counts
    event_count: int = Field(..., ge=0)
    error_count: int = Field(..., ge=0, description="Count of ERROR and FATAL level logs")
    error_rate: float = Field(..., ge=0, le=1, description="error_count / event_count")
    
    # Level Distribution
    level_distribution: Dict[str, int] = Field(default_factory=dict, description="{DEBUG: N, INFO: N, WARN: N, ERROR: N, FATAL: N}")
    
    # Throughput
    throughput_eps: float = Field(..., ge=0, description="Events per second")
    
    # Message Uniqueness
    unique_messages: int = Field(..., ge=0)
    unique_templates: int = Field(..., ge=0)
    top_error_messages: List[tuple] = Field(default_factory=list, description="[(message, count), ...]")
    
    # Latency Metrics (milliseconds, if extractable)
    latency_p50: Optional[float] = Field(None, ge=0)
    latency_p95: Optional[float] = Field(None, ge=0)
    latency_p99: Optional[float] = Field(None, ge=0)
    latency_max: Optional[float] = Field(None, ge=0)
    
    # Anomaly Indicators (heuristic pre-flags)
    heartbeat_missing: bool = Field(default=False, description="Expected service heartbeat absent in 3x window")
    error_burst: bool = Field(default=False, description="error_rate > 10%")
    volume_spike: bool = Field(default=False, description="throughput_eps > 2x baseline")
    sequence_anomaly: bool = Field(default=False, description="Unexpected state transitions")
    service_down: bool = Field(default=False, description="No events for 5+ windows")


# ============================================================================
# ML FEATURE VECTOR (Input to Isolation Forest)
# ============================================================================

class AnomalyFeatures(BaseModel):
    """Features passed to machine learning model (Isolation Forest)"""
    
    # Core Statistical Features
    error_rate: float = Field(..., ge=0, le=1, description="Normalized 0-1")
    throughput_rate: float = Field(..., ge=0, description="Events per second")
    throughput_ratio: float = Field(..., ge=0, description="Current / baseline throughput")
    latency_p95_ratio: Optional[float] = Field(None, ge=0, description="Current p95 / baseline p95")
    
    # Temporal Features
    hour_of_day: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6, description="0=Mon, 6=Sun")
    
    # Sequence Features
    error_level_entropy: float = Field(..., ge=0, description="Shannon entropy of level distribution")
    unique_message_ratio: float = Field(..., ge=0, le=1, description="unique_messages / event_count")
    
    # Aggregated Heuristic Flags
    error_burst_flag: int = Field(..., ge=0, le=1)
    volume_spike_flag: int = Field(..., ge=0, le=1)
    heartbeat_missing_flag: int = Field(..., ge=0, le=1)
    sequence_anomaly_flag: int = Field(..., ge=0, le=1)


# ============================================================================
# CRASH REPORT OUTPUT
# ============================================================================

class TimelineEntry(BaseModel):
    """Single entry in crash report timeline"""
    timestamp: datetime
    event: str
    severity: Optional[str] = None
    log_event: Optional[LogEvent] = None


class CrashReport(BaseModel):
    """Root cause analysis report for detected crashes"""
    
    # Identifiers
    report_id: str
    generated_at: datetime
    
    # Root Cause Analysis
    first_anomalous_event: LogEvent
    probable_root_cause: str = Field(..., description="Human-readable diagnosis")
    confidence: float = Field(..., ge=0, le=1, description="0-1 confidence score")
    
    # Timeline
    timeline: List[TimelineEntry] = Field(default_factory=list, description="Chronological markers")
    
    # Affected Services
    affected_services: List[str] = Field(default_factory=list)
    service_dependencies: Dict[str, List[str]] = Field(default_factory=dict, description="service → [dependents]")
    
    # Recommendations
    recommended_actions: List[str] = Field(default_factory=list, description="Actionable fixes")
    
    # Evidence
    window_features: Optional[WindowFeatures] = None
    supporting_events: List[LogEvent] = Field(default_factory=list, description="Top 20 events in crash window")


# ============================================================================
# ANOMALY ALERT (Real-time feed)
# ============================================================================

class AnomalyAlert(BaseModel):
    """Real-time anomaly event for streaming to frontend"""
    
    event_id: str
    timestamp: datetime
    service: str
    anomaly_score: float = Field(..., ge=0, le=100)
    severity: str = Field(..., description="HEALTHY | NOMINAL | CAUTION | ALERT | CRITICAL")
    reason: str = Field(..., description="Why this event is anomalous")
    
    class Config:
        json_schema_extra = {
            "example": {
                "event_id": "uuid-12345",
                "timestamp": "2026-03-20T10:30:45Z",
                "service": "auth-service",
                "anomaly_score": 75,
                "severity": "ALERT",
                "reason": "HEURISTIC"
            }
        }


# ============================================================================
# SERVICE CONFIG
# ============================================================================

class Config(BaseModel):
    """Service configuration"""
    
    # Window Configuration
    window_size_sec: int = Field(default=30, description="Default window size")
    
    # ML Configuration
    isolation_forest_contamination: float = Field(default=0.1, description="IF contamination parameter")
    isolation_forest_n_estimators: int = Field(default=100)
    
    # Baseline Configuration
    baseline_throughput_windows: int = Field(default=50, description="Rolling window for throughput baseline")
    baseline_latency_windows: int = Field(default=20, description="Rolling window for latency baseline")
    baseline_error_windows: int = Field(default=30, description="Rolling window for error rate baseline")
    
    # Thresholds
    warmup_event_threshold: int = Field(default=100, description="Events before ML kicks in")
    sparse_window_threshold: int = Field(default=5, description="Min events per window for ML")
    
    # Scoring Thresholds
    alert_threshold: int = Field(default=61, description="Alert level starts at score >= this")
    critical_threshold: int = Field(default=81, description="Critical level starts at score >= this")
    sustained_critical_windows: int = Field(default=3, description="Consecutive windows for crash detection")


class AlertDispatchRequest(BaseModel):
    webhook_url: Optional[str] = Field(default=None, description="Override webhook URL")
    min_score: int = Field(default=61, ge=0, le=100)
    max_alerts: int = Field(default=10, ge=1, le=100)
    include_crash_summary: bool = True


class AlertDispatchResponse(BaseModel):
    sent: bool
    provider: Literal["webhook"] = "webhook"
    destination: str
    anomaly_count: int = Field(default=0, ge=0)
    max_score: float = Field(default=0, ge=0, le=100)
    crash_reports_included: int = Field(default=0, ge=0)
    status_code: Optional[int] = None
    message: str
    timestamp: str
