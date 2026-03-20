"""
FastAPI routes for Log-Whisperer ML pipeline.
Endpoints: log upload, real-time streaming, anomaly queries, crash reports.
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
import json
from typing import Dict, List, Optional, AsyncGenerator
from datetime import datetime, timedelta
import asyncio
import uuid

from app.ingest.service import IngestionService, BatchLogProcessor
from app.detect.anomaly import AnomalyDetector
from app.report.generator import CrashReportGenerator
from app.core.schemas import (
    LogEvent, WindowFeatures, AnomalyAlert, CrashReport, Config
)
from app.enhance.integration import EnhancementIntegrationEngine

# ============================================================================
# GLOBAL APP STATE (Shared across requests)
# ============================================================================

class AppState:
    """Singleton for shared service instances"""
    ingest_service = None
    detector = None
    report_generator = None
    config = None
    anomaly_buffer = []  # Circular buffer for recent anomalies
    enhancement_engine = None  # Phase 1-5 enhancements
    
    @classmethod
    def initialize(cls, config: Config = None):
        """Initialize all services"""
        if cls.ingest_service is None:
            cls.config = config or Config()
            cls.ingest_service = IngestionService(
                window_size_sec=cls.config.window_size_sec
            )
            cls.detector = AnomalyDetector()
            
            # Initialize enhancements
            cls.enhancement_engine = EnhancementIntegrationEngine()
            
            # Create crash report generator with enhancement engines
            cls.report_generator = CrashReportGenerator(
                detector=cls.detector,
                causal_rca=cls.enhancement_engine.causal_rca,
                service_dependency=cls.enhancement_engine.service_dependency
            )
    
    @classmethod
    def reset(cls):
        """Reset all services"""
        cls.ingest_service = None
        cls.detector = None
        cls.report_generator = None
        cls.enhancement_engine = None
        cls.anomaly_buffer = []


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(prefix="/api/v1", tags=["log-whisperer"])


# ============================================================================
# 1. LOG UPLOAD ENDPOINT
# ============================================================================

class LogUploadResponse(Dict):
    """Response model for log upload"""
    pass


@router.post("/logs/upload", response_model=Dict)
async def upload_logs(
    file: UploadFile = File(..., description="Log file to upload"),
    format_hint: Optional[str] = Query(None, description="apache, nginx, syslog, json, spring-boot"),
    service_override: Optional[str] = Query(None, description="Override detected service name"),
) -> Dict:
    """
    Upload and ingest log file. Automatically parses, aggregates into time windows,
    and scores for anomalies.
    
    Args:
        file: Log file (text/plain)
        format_hint: Optional parser hint (apache, nginx, syslog, json, spring-boot)
        service_override: Override service name detection
    
    Returns:
        {
            "upload_id": "uuid",
            "filename": "access.log",
            "format": "nginx",
            "service": "api-gateway",
            "ingestion": {
                "total_lines": 10000,
                "parsed": 9998,
                "failed": 2,
                "windows_created": 167
            },
            "anomalies": [
                {
                    "window": "2026-03-20T10:30:00Z",
                    "anomaly_score": 75,
                    "severity": "ALERT",
                    "reason": "NORMAL"
                }
            ],
            "crashes_detected": 1,
            "timestamp": "2026-03-20T10:45:30Z"
        }
    """
    
    AppState.initialize()
    
    try:
        # Read file content
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty file")
        
        file_text = content.decode('utf-8', errors='ignore')
        
        # Ingest logs
        result = AppState.ingest_service.ingest_file(
            file_content=file_text,
            format_hint=format_hint,
            service_override=service_override
        )
        
        # Score all windows
        anomalies = []
        crashes = []
        
        for window_features in AppState.ingest_service.get_current_windows():
            score, reason = AppState.detector.score_window(window_features)
            
            # Track anomalies
            if score >= AppState.config.alert_threshold:
                anomaly = {
                    "window": window_features.window_start.isoformat(),
                    "anomaly_score": round(score, 2),
                    "severity": get_severity(score),
                    "reason": reason,
                    "service": window_features.service,
                    "triggered_patterns": extract_patterns(score, window_features)
                }
                anomalies.append(anomaly)
                
                # Store in buffer for streaming
                AppState.anomaly_buffer.append(anomaly)
                if len(AppState.anomaly_buffer) > 1000:  # Keep recent 1000
                    AppState.anomaly_buffer.pop(0)
            
            # Check for crash detection
            if AppState.detector.detect_crash_pattern():
                crash_report = AppState.report_generator.generate(
                    window_features=window_features,
                    anomaly_score=score
                )
                crashes.append(crash_report)
        
        return {
            "upload_id": str(uuid.uuid4()),
            "filename": file.filename,
            "format": format_hint or "auto-detected",
            "service": service_override or "multiple",
            "ingestion": {
                "total_lines": result['total'],
                "parsed": result['parsed'],
                "failed": result['failed'],
                "windows_created": result['windows_created']
            },
            "anomalies": anomalies,
            "crash_reports": crashes,
            "crashes_detected": len(crashes),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# 2. REAL-TIME STREAMING ENDPOINT (Server-Sent Events)
# ============================================================================

@router.get("/stream/anomalies")
async def stream_anomalies(
    duration_sec: int = Query(60, ge=1, le=3600, description="Stream duration in seconds"),
    min_score: int = Query(41, ge=0, le=100, description="Minimum anomaly score"),
) -> StreamingResponse:
    """
    Stream real-time anomalies as Server-Sent Events (SSE).
    
    Client connects and receives anomaly alerts as they're detected.
    Auto-closes after duration_sec.
    
    Returns:
        Server-Sent Events stream of anomalies
    
    Example client (JavaScript):
        const es = new EventSource('/api/v1/stream/anomalies?duration_sec=300');
        es.addEventListener('anomaly', (ev) => {
            const anomaly = JSON.parse(ev.data);
            console.log(anomaly.anomaly_score);
        });
    """
    
    AppState.initialize()
    
    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE events"""
        start_time = datetime.utcnow()
        last_index = len(AppState.anomaly_buffer)
        
        while (datetime.utcnow() - start_time).total_seconds() < duration_sec:
            # Check for new anomalies
            current_index = len(AppState.anomaly_buffer)
            
            if current_index > last_index:
                for anomaly in AppState.anomaly_buffer[last_index:current_index]:
                    if anomaly['anomaly_score'] >= min_score:
                        yield f"data: {json.dumps(anomaly)}\n\n"
                
                last_index = current_index
            
            # Send heartbeat every 5 seconds
            yield f": heartbeat at {datetime.utcnow().isoformat()}\n\n"
            await asyncio.sleep(1)
        
        # Final message
        yield f"data: {json.dumps({'type': 'stream_closed', 'reason': 'duration_exceeded'})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ============================================================================
# 3. ANOMALIES QUERY ENDPOINT
# ============================================================================

@router.get("/anomalies", response_model=Dict)
async def get_anomalies(
    service: Optional[str] = Query(None, description="Filter by service"),
    min_score: int = Query(41, ge=0, le=100, description="Minimum anomaly score"),
    limit: int = Query(100, ge=1, le=1000, description="Result limit"),
) -> Dict:
    """
    Query detected anomalies from current detector state.
    
    Args:
        service: Optional service name filter
        min_score: Minimum anomaly score threshold
        limit: Maximum results to return
    
    Returns:
        {
            "total": 156,
            "returned": 50,
            "anomalies": [
                {
                    "window": "2026-03-20T10:30:00Z",
                    "anomaly_score": 75,
                    "severity": "ALERT",
                    "service": "api-gateway",
                    "reason": "NORMAL",
                    "triggered_patterns": [...]
                }
            ]
        }
    """
    
    AppState.initialize()
    
    # Filter anomalies
    filtered = AppState.anomaly_buffer
    
    if service:
        filtered = [a for a in filtered if a.get('service') == service]
    
    filtered = [a for a in filtered if a.get('anomaly_score', 0) >= min_score]
    
    # Sort by score descending
    filtered = sorted(filtered, key=lambda x: x.get('anomaly_score', 0), reverse=True)
    
    # Apply limit
    returned = filtered[:limit]
    
    return {
        "total": len(filtered),
        "returned": len(returned),
        "filter": {
            "service": service,
            "min_score": min_score
        },
        "anomalies": returned,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# ============================================================================
# 4. CRASH REPORTS ENDPOINT
# ============================================================================

@router.get("/crashes", response_model=Dict)
async def get_crash_reports(
    service: Optional[str] = Query(None, description="Filter by service"),
    limit: int = Query(50, ge=1, le=500, description="Result limit"),
) -> Dict:
    """
    Retrieve generated crash reports for detected crashes.
    
    Args:
        service: Optional service filter
        limit: Maximum reports to return
    
    Returns:
        {
            "total_crashes": 3,
            "reports": [
                {
                    "report_id": "crash-20260320-001",
                    "service": "auth-service",
                    "generated_at": "2026-03-20T10:35:12Z",
                    "probable_root_cause": "Database connection pool exhausted",
                    "confidence": 0.87,
                    "severity": "CRITICAL",
                    "affected_services": ["auth-service", "user-api"],
                    "recommended_actions": [...]
                }
            ]
        }
    """
    
    AppState.initialize()
    
    # Query stored crash reports
    reports = AppState.report_generator.get_recent_reports(limit=limit)
    
    if service:
        reports = [r for r in reports if r.get('service') == service]
    
    return {
        "total_crashes": len(reports),
        "reports": reports,
        "filter": {"service": service},
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# ============================================================================
# 5. DETECTOR STATUS ENDPOINT
# ============================================================================

@router.get("/status/detector", response_model=Dict)
async def detector_status() -> Dict:
    """
    Get current detector state and statistics.
    
    Returns:
        {
            "detector_ready": true,
            "events_ingested": 45230,
            "windows_processed": 756,
            "ml_model_trained": true,
            "training_count": 450,
            "baseline_converged": true,
            "critical_window_streak": 0,
            "last_crash_detected": "2026-03-20T10:30:00Z"
        }
    """
    
    AppState.initialize()
    
    return {
        "detector_ready": AppState.detector is not None,
        "events_ingested": AppState.detector.total_events_seen,
        "windows_processed": len(AppState.ingest_service.get_current_windows()),
        "ml_model_trained": AppState.detector.ml_model.is_trained,
        "ml_training_count": AppState.detector.ml_model.training_count,
        "baseline_converged": AppState.detector.baseline_manager.total_events_seen >= 100,
        "critical_window_streak": AppState.detector.critical_window_streak,
        "config": {
            "alert_threshold": AppState.config.alert_threshold,
            "critical_threshold": AppState.config.critical_threshold,
            "warm_up_events": AppState.config.warmup_event_threshold
        },
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# ============================================================================
# 7. ENHANCED ANOMALY SCORE ENDPOINT (Phase 1-3)
# ============================================================================

@router.post("/enhanced/score", response_model=Dict)
async def get_enhanced_score(
    service: str = Query(..., description="Service name"),
    error_rate: float = Query(..., ge=0, le=1, description="Error rate 0-1"),
    throughput_eps: float = Query(..., ge=0, description="Events per second"),
    latency_p95_ms: Optional[float] = Query(None, description="P95 latency in ms"),
) -> Dict:
    """
    Get enhanced anomaly score using Phase 1-3 enhancements:
    - Ensemble voting (5 models)
    - ARIMA trend detection
    - Online learning + adaptive baselines
    - Concept drift detection
    
    Returns:
    {
        "original_score": 65.0,
        "enhanced_score": 72.5,
        "confidence": 0.87,
        "enhancements": {
            "ensemble_score": 70.0,
            "arima_trend": "degrading",
            "adaptive_baseline_adjusted": 68.0,
            "drift_detected": false
        }
    }
    """
    
    AppState.initialize()
    
    # Create window features
    window_features = WindowFeatures(
        service=service,
        window_start=datetime.utcnow(),
        window_end=datetime.utcnow(),
        event_count=int(throughput_eps * 60),  # Approximate
        throughput_eps=throughput_eps,
        error_rate=error_rate,
        latency_p95=latency_p95_ms,
        level_distribution={"ERROR": int(error_rate * 100)},
        unique_messages=1,
        error_burst=error_rate > 0.10,
        volume_spike=False,
        heartbeat_missing=False,
        sequence_anomaly=False
    )
    
    # Get base score
    base_score, reason = AppState.detector.score_window(window_features)
    
    # Get enhanced score with enhancements
    enhanced = AppState.enhancement_engine.enhance_score(
        original_score=base_score,
        window_features=window_features
    )
    
    return {
        "service": service,
        "original_score": round(base_score, 2),
        "enhanced_score": enhanced["final_enhanced_score"],
        "confidence": enhanced["confidence"],
        "enhancements": {
            "ensemble_score": enhanced["ensemble_score"],
            "arima_trend": enhanced["arima_trend"],
            "adaptive_baseline_adjusted": enhanced["adaptive_baseline_adjusted"],
            "drift_detected": enhanced["drift_detected"]
        },
        "severity": get_severity(enhanced["final_enhanced_score"]),
        "enhancement_source": enhanced["enhancement_source"],
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# ============================================================================
# 8. CAUSAL ROOT CAUSE ANALYSIS ENDPOINT (Phase 2)
# ============================================================================

@router.post("/enhanced/causal-rca", response_model=Dict)
async def get_causal_rca(
    service: str = Query(..., description="Service name"),
    anomaly_score: float = Query(..., ge=0, le=100, description="Anomaly severity"),
    error_rate: Optional[float] = Query(None, ge=0, le=1),
    throughput_eps: Optional[float] = Query(None, ge=0),
    latency_p95_ms: Optional[float] = Query(None, ge=0),
) -> Dict:
    """
    Get causal root cause analysis using Phase 2 enhancements:
    - Bayesian causal inference
    - Service dependency graph
    - Cascading failure analysis
    - Incident response recommendations
    
    Returns:
    {
        "primary_cause": "Database connection pool exhausted",
        "confidence": 0.87,
        "causal_chain": [
            {"cause": "DB pool exhaustion", "probability": 0.87},
            {"cause": "Slow queries", "probability": 0.65},
            {"cause": "Memory leak", "probability": 0.45}
        ],
        "affected_services": ["auth-service", "user-api", "api-gateway"],
        "cascade_analysis": {
            "is_cascade": true,
            "severity": "CRITICAL",
            "propagation_path": ["auth-service", "user-api", "api-gateway"]
        },
        "recommended_actions": [...]
    }
    """
    
    AppState.initialize()
    
    # Create window features
    window_features = WindowFeatures(
        service=service,
        window_start=datetime.utcnow(),
        window_end=datetime.utcnow(),
        event_count=100,
        throughput_eps=throughput_eps or 10.0,
        error_rate=error_rate or 0.0,
        latency_p95=latency_p95_ms or 100,
        level_distribution={"ERROR": 1},
        unique_messages=1,
        error_burst=error_rate and error_rate > 0.10,
        volume_spike=False,
        heartbeat_missing=False,
        sequence_anomaly=False
    )
    
    # Perform causal analysis
    rca_result = AppState.enhancement_engine.analyze_root_cause(
        window_features=window_features,
        anomaly_score=anomaly_score
    )
    
    return {
        "service": service,
        "anomaly_score": anomaly_score,
        "primary_cause": rca_result["primary_cause"],
        "confidence": round(rca_result["confidence"], 3),
        "causal_chain": rca_result["causal_chain"],
        "affected_services": rca_result["affected_services"],
        "cascade_analysis": rca_result["cascade_analysis"],
        "recommended_actions": rca_result["recommended_actions"],
        "analysis_source": rca_result["analysis_source"],
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# ============================================================================
# 9. FORECASTING ENDPOINT (Phase 4)
# ============================================================================

@router.post("/enhanced/forecast", response_model=Dict)
async def forecast_issues(
    service: str = Query(..., description="Service name"),
    error_rate: Optional[float] = Query(None, ge=0, le=1),
    throughput_eps: Optional[float] = Query(None, ge=0),
    latency_p95_ms: Optional[float] = Query(None, ge=0),
) -> Dict:
    """
    Get crash and resource exhaustion forecasts using Phase 4 enhancements:
    - Predict crashes 5+ minutes ahead
    - Forecast CPU, memory, disk exhaustion
    - Auto-scaling recommendations
    
    Returns:
    {
        "crash_prediction": {
            "will_crash": true,
            "probability": 0.87,
            "time_to_crash_minutes": 3,
            "confidence": 0.85
        },
        "resource_forecast": {
            "cpu": {
                "projected_utilization": 92.5,
                "exhaustion_probability": 0.85,
                "time_to_exhaustion": 2
            },
            "memory": {...},
            "disk": {...}
        },
        "urgency": "CRITICAL",
        "recommendations": [...]
    }
    """
    
    AppState.initialize()
    
    # Create window features
    window_features = WindowFeatures(
        service=service,
        window_start=datetime.utcnow(),
        window_end=datetime.utcnow(),
        event_count=100,
        throughput_eps=throughput_eps or 10.0,
        error_rate=error_rate or 0.0,
        latency_p95=latency_p95_ms or 100,
        level_distribution={"ERROR": 1},
        unique_messages=1,
        error_burst=False,
        volume_spike=False,
        heartbeat_missing=False,
        sequence_anomaly=False
    )
    
    # Get forecast
    forecast = AppState.enhancement_engine.forecast_issues(
        window_features=window_features
    )
    
    return {
        "service": service,
        "forecast": forecast,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# ============================================================================
# 10. NLP ERROR ANALYSIS ENDPOINT (Phase 5)
# ============================================================================

@router.post("/enhanced/nlp-analysis", response_model=Dict)
async def analyze_errors_nlp(
    service: str = Query(..., description="Service name"),
    error_messages: List[str] = None,
) -> Dict:
    """
    Analyze errors using Phase 5 NLP enhancements:
    - Categorize errors into 6 categories
    - Extract error templates
    - Detect behavioral anomalies
    
    Returns:
    {
        "error_categories": [
            {
                "category": "Connection Error",
                "count": 42,
                "examples": ["Connection refused", "Connection timeout"]
            }
        ],
        "behavior_patterns": [
            {"pattern": "Unusual spike pattern", "confidence": 0.85, "is_anomalous": true}
        ],
        "top_error_templates": [
            "Connection refused to {IP}:{PORT}",
            "Query timeout after {TIMEOUT}ms"
        ],
        "behavioral_anomalies_detected": 5
    }
    """
    
    AppState.initialize()
    
    # Create mock events if error messages provided
    events = []
    if error_messages:
        for msg in error_messages:
            event = LogEvent(
                service=service,
                level="ERROR",
                message=msg,
                timestamp=datetime.utcnow()
            )
            events.append(event)
    
    # Analyze
    nlp_result = AppState.enhancement_engine.analyze_errors_nlp(
        recent_events=events if events else None
    )
    
    return {
        "service": service,
        "analysis": nlp_result,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# ============================================================================
# 11. ACTIVE LEARNING FEEDBACK ENDPOINT (Phase 3)
# ============================================================================

@router.post("/enhanced/feedback", response_model=Dict)
async def provide_feedback(
    report_id: str = Query(..., description="Report ID to learn from"),
    was_incident: bool = Query(..., description="Was this actually an incident?"),
    feedback_text: Optional[str] = Query(None, description="Additional feedback"),
) -> Dict:
    """
    Submit feedback to improve models using Phase 3 active learning.
    
    Args:
        report_id: ID of the anomaly report
        was_incident: Whether this was a true incident (user feedback)
        feedback_text: Optional additional context
    
    Returns:
        {"status": "feedback_received", "models_updated": true}
    """
    
    AppState.initialize()
    
    # Record feedback
    AppState.enhancement_engine.learn_from_feedback(
        report_id=report_id,
        was_incident=was_incident,
        feedback_text=feedback_text or ""
    )
    
    return {
        "status": "feedback_received",
        "report_id": report_id,
        "was_incident": was_incident,
        "models_updated": True,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# ============================================================================
# 12. ENHANCEMENT STATUS ENDPOINT
# ============================================================================

@router.get("/enhanced/status", response_model=Dict)
async def enhancement_status() -> Dict:
    """
    Get status of all enhancement modules (Phase 1-5).
    
    Returns:
    {
        "phase_1": {"ensemble": "ready", "arima": "ready", "autoencoder": "ready"},
        "phase_2": {"causal_rca": "ready", "service_dependency": "ready"},
        "phase_3": {"online_learning": "ready", "drift_detection": "ready"},
        "phase_4": {"crash_forecasting": "ready", "resource_forecasting": "ready"},
        "phase_5": {"nlp_analysis": "ready", "behavioral_anomaly": "ready"}
    }
    """
    
    AppState.initialize()
    
    return {
        "phase_1": {
            "ensemble_detector": "ready" if AppState.enhancement_engine.ensemble_detector else "error",
            "arima_baseline": "ready" if AppState.enhancement_engine.arima_baseline else "error",
            "autoencoder": "ready"
        },
        "phase_2": {
            "causal_rca": "ready" if AppState.enhancement_engine.causal_rca else "error",
            "service_dependency": "ready" if AppState.enhancement_engine.service_dependency else "error"
        },
        "phase_3": {
            "online_learning": "ready" if AppState.enhancement_engine.adaptive_baseline else "error",
            "drift_detection": "ready" if AppState.enhancement_engine.drift_detector else "error",
            "active_learning": "ready" if AppState.enhancement_engine.active_learning else "error"
        },
        "phase_4": {
            "crash_forecasting": "ready" if AppState.enhancement_engine.crash_forecaster else "error",
            "resource_forecasting": "ready" if AppState.enhancement_engine.resource_forecaster else "error"
        },
        "phase_5": {
            "nlp_analysis": "ready" if AppState.enhancement_engine.nlp_analyzer else "error",
            "behavioral_anomaly": "ready" if AppState.enhancement_engine.behavior_detector else "error"
        },
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


@router.post("/admin/reset", response_model=Dict)
async def reset_detector() -> Dict:
    """
    Reset detector and ingestion service. Use for testing/maintenance only.
    
    Returns:
        {"status": "reset_complete", "timestamp": "..."}
    """
    
    AppState.reset()
    AppState.initialize()
    
    return {
        "status": "reset_complete",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_severity(score: float) -> str:
    """Map anomaly score to severity level"""
    if score < 21:
        return "HEALTHY"
    elif score < 41:
        return "NOMINAL"
    elif score < 61:
        return "CAUTION"
    elif score < 81:
        return "ALERT"
    else:
        return "CRITICAL"


def extract_patterns(score: float, window: WindowFeatures) -> List[Dict]:
    """Extract triggered heuristic patterns"""
    patterns = []
    
    if window.error_rate > 0.10:
        patterns.append({
            "name": "error_burst",
            "contribution": 40,
            "value": window.error_rate,
            "threshold": 0.10
        })
    
    if window.volume_spike:
        patterns.append({
            "name": "volume_spike",
            "contribution": 35,
            "detected": True
        })
    
    if window.heartbeat_missing:
        patterns.append({
            "name": "heartbeat_missing",
            "contribution": 45,
            "detected": True
        })
    
    if window.sequence_anomaly:
        patterns.append({
            "name": "sequence_anomaly",
            "contribution": 25,
            "detected": True
        })
    
    return patterns
