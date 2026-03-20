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
