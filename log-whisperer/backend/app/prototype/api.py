from __future__ import annotations

import asyncio
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile

from .anomaly_detector import AnomalyDetector
from .dashboard_stub import render_dashboard_stub
from .fix_suggester import FixSuggester
from .incident_store import IncidentStore
from .log_ingestion import AsyncLogIngestion
from .log_parser import LogParser
from .models import (
    CrashReport,
    ProcessorHealth,
    SimilarIncidentRequest,
    StreamRequest,
    StreamResponse,
    UploadResponse,
)
from .root_cause_engine import RootCauseEngine
from .sequence_analyzer import SequenceAnalyzer


class PipelineState:
    def __init__(self) -> None:
        self.parser = LogParser()
        self.detector = AnomalyDetector()
        self.sequence = SequenceAnalyzer(window_size=5000)
        self.root_cause = RootCauseEngine()
        self.fixer = FixSuggester()
        self.store = IncidentStore(db_path="prototype_incidents.db")
        self.ingestion = AsyncLogIngestion(queue_maxsize=250_000, batch_size=1000)

        self.recent_anomalies: deque[dict] = deque(maxlen=5000)
        self.latest_report: CrashReport | None = None
        self.lock = asyncio.Lock()

    async def process_batch(self, lines: list[str]) -> None:
        parsed = self.parser.parse_batch(lines)
        anomalies = self.detector.score_logs(parsed)
        anomaly_lookup = {(a.timestamp.isoformat(), a.service, a.message): a for a in anomalies}

        crash_payload = None
        for log in parsed:
            anomaly = anomaly_lookup.get((log.timestamp.isoformat(), log.service, log.message))
            if anomaly:
                self.recent_anomalies.append(anomaly.model_dump())

            self.sequence.record(log, anomaly)
            crash_payload = self.sequence.detect_first_signal_before_crash(log)

        if crash_payload:
            first_signal = crash_payload.get("first_signal")
            timeline = crash_payload.get("timeline", [])
            report = self.root_cause.build_report(first_signal, timeline, anomalies)
            report.suggested_fix = self.fixer.suggest_fix(report.root_cause)
            llm_stub = self.fixer.generate_explanation(report.root_cause)

            report_payload = report.model_dump()
            report_payload["llm_explanation"] = llm_stub
            similar = self.store.find_similar_incidents(report_payload, top_k=5)
            report.similar_incidents = [
                {
                    "id": item.get("id"),
                    "root_cause": item.get("root_cause"),
                    "similarity_score": item.get("similarity_score", 0),
                    "created_at": item.get("created_at"),
                }
                for item in similar
            ]

            self.store.add_incident(report.model_dump())
            async with self.lock:
                self.latest_report = report
            self.sequence.clear_signal()


state = PipelineState()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await state.ingestion.start_workers(worker_count=4, process_batch=state.process_batch)
    yield
    await state.ingestion.stop_workers()


app = FastAPI(
    title="Log-Whisperer Production Prototype",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/")
async def dashboard_stub():
    return render_dashboard_stub()


@app.get("/health", response_model=ProcessorHealth)
async def health() -> ProcessorHealth:
    return ProcessorHealth(
        status="ok",
        queue_depth=state.ingestion.queue.qsize(),
        processed_lines=state.ingestion.stats.processed_lines,
        anomalies_detected=len(state.recent_anomalies),
        incidents_recorded=state.store.total_incidents(),
    )


@app.post("/upload_logs", response_model=UploadResponse)
async def upload_logs(file: UploadFile = File(...)) -> UploadResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="empty file")

    lines = content.decode("utf-8", errors="ignore").splitlines()
    accepted = await state.ingestion.push_lines(lines)
    return UploadResponse(
        accepted_lines=accepted,
        queued_lines=state.ingestion.stats.queued_lines,
        queue_depth=state.ingestion.queue.qsize(),
    )


@app.post("/stream_logs", response_model=StreamResponse)
async def stream_logs(request: StreamRequest) -> StreamResponse:
    sample_path = Path(__file__).resolve().parents[2] / "samples" / "prototype_stream.log"
    if not sample_path.exists():
        raise HTTPException(status_code=500, detail="sample stream file missing")

    lines = sample_path.read_text(encoding="utf-8").splitlines()
    stream_id = await state.ingestion.simulate_stream(
        template_lines=lines,
        lines_per_second=request.lines_per_second,
        duration_seconds=request.duration_seconds,
    )

    return StreamResponse(
        stream_id=stream_id,
        target_lines_per_second=request.lines_per_second,
        duration_seconds=request.duration_seconds,
    )


@app.get("/anomalies")
async def anomalies(limit: int = 100) -> dict:
    recent = list(state.recent_anomalies)[-limit:]
    return {
        "total": len(recent),
        "items": recent,
    }


@app.get("/crash_report")
async def crash_report() -> dict:
    async with state.lock:
        report = state.latest_report

    if report is None:
        return {
            "first_anomaly_timestamp": "",
            "root_cause": "",
            "affected_services": [],
            "timeline": [],
            "confidence_score": 0,
            "confidence_explanation": "No incident detected yet.",
            "confidence_score_explanation": "No incident detected yet.",
            "causal_chain": [],
            "cascading_failures": [],
            "crash_prediction": {},
            "first_anomaly_highlight": None,
            "readable": {
                "headline": "No crash incident available",
                "timeline": [],
            },
            "suggested_fix": "",
            "similar_incidents": [],
        }

    payload = report.model_dump()
    first_ts = payload.get("first_anomaly_timestamp")

    def _norm_ts(value: str | None) -> str:
        if not value:
            return ""
        return str(value).replace("Z", "+00:00")

    first_ts_norm = _norm_ts(first_ts)
    ordered_timeline = sorted(payload.get("timeline", []), key=lambda item: item.get("timestamp", ""))

    readable_timeline = []
    for index, item in enumerate(ordered_timeline, start=1):
        item_ts = _norm_ts(item.get("timestamp"))
        is_first = bool(first_ts_norm and item_ts == first_ts_norm)
        readable_timeline.append(
            {
                "step": index,
                "timestamp": item.get("timestamp"),
                "service": item.get("service"),
                "level": item.get("level"),
                "event": item.get("message"),
                "anomaly_score": item.get("anomaly_score", 0),
                "highlight": "FIRST_ANOMALY" if is_first else "",
            }
        )

    payload["confidence_score_explanation"] = payload.get("confidence_explanation", "")
    first_highlight = next(
        (item for item in readable_timeline if item.get("highlight") == "FIRST_ANOMALY"),
        None,
    )
    if first_highlight is None:
        first_highlight = next(
            (item for item in readable_timeline if float(item.get("anomaly_score") or 0) > 0),
            None,
        )
        if first_highlight is not None:
            first_highlight["highlight"] = "FIRST_ANOMALY"

    payload["first_anomaly_highlight"] = first_highlight
    payload["readable"] = {
        "headline": f"Root Cause: {payload.get('root_cause', 'Unknown')}",
        "summary": {
            "first_anomaly_timestamp": payload.get("first_anomaly_timestamp", ""),
            "crash_probability_score": (payload.get("crash_prediction") or {}).get("probability_score", 0),
            "confidence_score": payload.get("confidence_score", 0),
            "confidence_explanation": payload.get("confidence_explanation", ""),
        },
        "causal_chain": payload.get("causal_chain", []),
        "timeline": readable_timeline,
    }

    return payload


@app.post("/similar_incidents")
async def similar_incidents(request: SimilarIncidentRequest) -> dict:
    payload = {
        "root_cause": request.root_cause,
        "timeline": [{"message": text} for text in request.timeline],
        "affected_services": [],
        "suggested_fix": "",
    }
    matches = state.store.find_similar_incidents(payload, top_k=request.top_k)
    return {
        "total": len(matches),
        "items": [
            {
                "id": item.get("id"),
                "root_cause": item.get("root_cause"),
                "similarity_score": item.get("similarity_score", 0),
                "created_at": item.get("created_at"),
            }
            for item in matches
        ],
    }
