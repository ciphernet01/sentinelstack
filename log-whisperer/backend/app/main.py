from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.api.routes import router, AppState
from app.core.schemas import Config

# ============================================================================
# APP LIFECYCLE
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager for startup/shutdown"""
    # Startup
    AppState.initialize(config=Config())
    yield
    # Shutdown
    AppState.reset()


# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(
    title="Log-Whisperer ML API",
    version="0.1.0",
    description="Real-time anomaly detection and crash report generation",
    lifespan=lifespan
)

# Include router
app.include_router(router)


# ============================================================================
# HEALTH CHECKS
# ============================================================================

@app.get("/health")
def health() -> dict:
    """Health check endpoint"""
    return {"status": "ok", "service": "log-whisperer-backend"}


@app.get("/api/v1/status")
def status() -> dict:
    """Service readiness status"""
    AppState.initialize()
    
    return {
        "ingest": "ready",
        "parse": "ready",
        "detect": "ready" if AppState.detector else "initializing",
        "report": "ready" if AppState.report_generator else "initializing",
        "events_ingested": AppState.detector.total_events_seen if AppState.detector else 0,
        "windows_processed": len(AppState.ingest_service.get_current_windows()) if AppState.ingest_service else 0
    }
