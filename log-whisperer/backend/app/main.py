"""Log-Whisperer FastAPI application entrypoint with production-safe middleware."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import time
import uuid

from app.api.routes import router, AppState
from app.core.schemas import Config
from app.core.settings import RuntimeSettings
from app.enhance.integration import EnhancementIntegrationEngine

# ============================================================================
# LOGGING SETUP
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
settings = RuntimeSettings.load()

# ============================================================================
# APP LIFECYCLE
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager for startup/shutdown"""
    # Startup
    logger.info("🚀 Log-Whisperer ML Pipeline starting up...")
    config = Config(
        alert_threshold=settings.alert_threshold,
        critical_threshold=settings.critical_threshold,
        warmup_event_threshold=settings.warmup_event_threshold,
        window_size_sec=settings.window_size_sec,
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
    title=settings.app_name,
    version=settings.app_version,
    description="Real-time anomaly detection with Phase 1-5 ML enhancements",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    start = time.perf_counter()

    if settings.require_api_key and request.url.path.startswith(settings.api_prefix):
        if request.url.path not in {"/health", f"{settings.api_prefix}/status"}:
            provided = request.headers.get("x-api-key")
            if not settings.api_key or provided != settings.api_key:
                return JSONResponse(
                    status_code=401,
                    content={
                        "error": "unauthorized",
                        "message": "Missing or invalid API key",
                        "request_id": request_id,
                    },
                )

    response = await call_next(request)
    process_time_ms = round((time.perf_counter() - start) * 1000, 2)
    response.headers["x-request-id"] = request_id
    response.headers["x-process-time-ms"] = str(process_time_ms)
    response.headers["x-content-type-options"] = "nosniff"
    response.headers["x-frame-options"] = "DENY"
    response.headers["referrer-policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server error at %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "Unexpected error occurred",
            "path": request.url.path,
        },
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
        "version": settings.app_version,
        "env": settings.env,
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
