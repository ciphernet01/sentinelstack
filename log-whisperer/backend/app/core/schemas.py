from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


LogLevel = Literal["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"]


class NormalizedLogEvent(BaseModel):
	timestamp: datetime
	service: str = "unknown-service"
	level: LogLevel = "INFO"
	message: str
	template: str = "generic"
	trace_id: str | None = None
	host: str | None = None
	raw: str
	source_format: str = "plain"
	anomaly_score: int | None = Field(default=None, ge=0, le=100)
	reasons: list[str] = Field(default_factory=list)
	minute_bucket: datetime | None = None
	is_error: bool = False

	@model_validator(mode="after")
	def set_derived_fields(self) -> "NormalizedLogEvent":
		self.level = self.level.upper()  # type: ignore[assignment]
		self.minute_bucket = self.timestamp.replace(second=0, microsecond=0)
		self.is_error = self.level in {"ERROR", "FATAL"}
		return self


class IngestTextRequest(BaseModel):
	logs: str = Field(..., min_length=1)
	source: str = "text"


class IngestJsonRequest(BaseModel):
	records: list[dict]
	source: str = "json"


class IngestResponse(BaseModel):
	ingested_count: int
	failed_count: int
	failed_samples: list[str] = Field(default_factory=list)
	source: str


class PipelineStatus(BaseModel):
	ingest: str
	parse: str
	detect: str
	report: str
	metrics: dict


class AnomalyCluster(BaseModel):
	service: str
	event_count: int
	avg_score: float
	max_score: int
	reasons: list[str] = Field(default_factory=list)


class AnomaliesLiveResponse(BaseModel):
	generated_at: datetime
	total_events: int
	evaluated_events: int
	anomalous_events: int
	threshold: int
	events: list[NormalizedLogEvent] = Field(default_factory=list)
	clusters: list[AnomalyCluster] = Field(default_factory=list)


class TimelineEvent(BaseModel):
	timestamp: datetime
	service: str
	level: LogLevel
	message: str
	anomaly_score: int = Field(default=0, ge=0, le=100)


class CrashReport(BaseModel):
	report_id: str
	created_at: datetime
	status: Literal["detected", "clear"]
	first_anomalous_event: NormalizedLogEvent | None = None
	probable_root_cause: str
	affected_services: list[str] = Field(default_factory=list)
	timeline: list[TimelineEvent] = Field(default_factory=list)
	recommended_fix: list[str] = Field(default_factory=list)
	anomaly_threshold: int = Field(default=75, ge=0, le=100)
	max_anomaly_score: int = Field(default=0, ge=0, le=100)


class CrashReportResponse(BaseModel):
	generated_at: datetime
	report: CrashReport | None = None
