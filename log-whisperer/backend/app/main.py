"""
Log-Whisperer ML Pipeline - FastAPI Application
Complete ML system for log anomaly detection with Phase 1-5 enhancements
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.api.routes import router, AppState
from app.core.schemas import Config
from app.enhance.integration import EnhancementIntegrationEngine

# ============================================================================
# LOGGING SETUP
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# APP LIFECYCLE
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager for startup/shutdown"""
    # Startup
    logger.info("🚀 Log-Whisperer ML Pipeline starting up...")
    config = Config(
        alert_threshold=61,
        critical_threshold=81,
        warmup_event_threshold=100,
        window_size_sec=60
    )
    AppState.initialize(config=config)
    logger.info("✅ Core ML detector initialized")
    logger.info("✅ Phase 1-5 enhancements loaded")
    logger.info("✅ API routes ready")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down...")
    AppState.reset()
    logger.info("✅ Cleanup complete")


# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(
    title="Log-Whisperer ML API",
    version="1.5.0",
    description="Real-time anomaly detection with Phase 1-5 ML enhancements",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include router
app.include_router(router)


# ============================================================================
# HEALTH CHECKS
# ============================================================================

@app.get("/health", tags=["health"])
def health() -> dict:
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "log-whisperer-backend",
        "version": "1.5.0"
    }


@app.get("/api/v1/status", tags=["health"])
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
