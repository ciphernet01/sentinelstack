from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ParsedLog(BaseModel):
    timestamp: datetime
    service: str
    level: str
    message: str
    trace_id: str | None = None
    raw: str | None = None


class AnomalyRecord(BaseModel):
    timestamp: datetime
    service: str
    level: str
    message: str
    score: float = Field(ge=0, le=100)
    reason: str


class CrashReport(BaseModel):
    first_anomaly_timestamp: str
    root_cause: str
    affected_services: list[str]
    timeline: list[dict[str, Any]]
    confidence_score: float = Field(ge=0, le=100)
    confidence_explanation: str = ""
    causal_chain: list[str] = Field(default_factory=list)
    cascading_failures: list[dict[str, Any]] = Field(default_factory=list)
    crash_prediction: dict[str, Any] = Field(default_factory=dict)
    suggested_fix: str
    similar_incidents: list[dict[str, Any]]


class UploadResponse(BaseModel):
    accepted_lines: int
    queued_lines: int
    queue_depth: int


class StreamRequest(BaseModel):
    lines_per_second: int = Field(default=10000, ge=1, le=200000)
    duration_seconds: int = Field(default=5, ge=1, le=120)
    service: str = "simulator"


class StreamResponse(BaseModel):
    stream_id: str
    target_lines_per_second: int
    duration_seconds: int


class SimilarIncidentRequest(BaseModel):
    root_cause: str
    timeline: list[str] = Field(default_factory=list)
    top_k: int = Field(default=5, ge=1, le=20)


class ProcessorHealth(BaseModel):
    status: Literal["ok"]
    queue_depth: int
    processed_lines: int
    anomalies_detected: int
    incidents_recorded: int
