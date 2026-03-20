"""
FastAPI routes for Log-Whisperer ML pipeline.
Endpoints: log upload, real-time streaming, anomaly queries, crash reports.
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
import json
import os
from typing import Dict, List, Optional, AsyncGenerator
from datetime import datetime, timedelta
import asyncio
import uuid

from app.ingest.service import IngestionService, BatchLogProcessor
from app.detect.anomaly import AnomalyDetector
from app.detect.notifier import build_alert_payload, send_webhook
from app.report.generator import CrashReportGenerator
from app.core.schemas import (
    LogEvent, WindowFeatures, AnomalyAlert, CrashReport, Config,
    AlertDispatchRequest, AlertDispatchResponse,
)

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
    
    @classmethod
    def initialize(cls, config: Config = None):
        """Initialize all services"""
        if cls.ingest_service is None:
            cls.config = config or Config()
            cls.ingest_service = IngestionService(
                window_size_sec=cls.config.window_size_sec
            )
            cls.detector = AnomalyDetector()
            cls.report_generator = CrashReportGenerator(cls.detector)
    
    @classmethod
    def reset(cls):
        """Reset all services"""
        cls.ingest_service = None
        cls.detector = None
        cls.report_generator = None
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
# 6. RESET ENDPOINT (Testing/Maintenance)
# ============================================================================

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


@router.post("/alerts/send", response_model=AlertDispatchResponse)
async def send_alert(payload: AlertDispatchRequest) -> AlertDispatchResponse:
    AppState.initialize()

    webhook_url = (
        payload.webhook_url
        or os.getenv("ALERT_WEBHOOK_URL")
        or os.getenv("SLACK_WEBHOOK_URL")
    )
    if not webhook_url:
        raise HTTPException(status_code=400, detail="No webhook URL provided. Set ALERT_WEBHOOK_URL or SLACK_WEBHOOK_URL.")

    anomalies = [
        item for item in AppState.anomaly_buffer
        if float(item.get("anomaly_score", 0)) >= payload.min_score
    ]
    anomalies = sorted(anomalies, key=lambda item: float(item.get("anomaly_score", 0)), reverse=True)[:payload.max_alerts]

    reports = AppState.report_generator.get_recent_reports(limit=1) if payload.include_crash_summary else []
    body = build_alert_payload(anomalies=anomalies, crash_reports=reports)
    sent, status_code, message = send_webhook(webhook_url, body)

    destination = webhook_url.split("?")[0]
    max_score = max((float(item.get("anomaly_score", 0)) for item in anomalies), default=0.0)

    return AlertDispatchResponse(
        sent=sent,
        destination=destination,
        anomaly_count=len(anomalies),
        max_score=max_score,
        crash_reports_included=len(reports),
        status_code=status_code,
        message=message,
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


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
