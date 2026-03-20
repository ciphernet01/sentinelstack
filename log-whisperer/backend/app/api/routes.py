from __future__ import annotations

import json

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.schemas import IngestJsonRequest, IngestResponse, IngestTextRequest, PipelineStatus
from app.ingest.service import ingest_json_records, ingest_raw_lines, ingest_text_blob, pipeline_status, recent_events

router = APIRouter(prefix="/api/v1", tags=["log-whisperer"])


@router.get("/status", response_model=PipelineStatus)
def get_status() -> PipelineStatus:
	return pipeline_status()


@router.post("/ingest/text", response_model=IngestResponse)
def ingest_text(payload: IngestTextRequest) -> IngestResponse:
	return ingest_text_blob(payload.logs, source=payload.source)


@router.post("/ingest/json", response_model=IngestResponse)
def ingest_json(payload: IngestJsonRequest) -> IngestResponse:
	return ingest_json_records(payload.records, source=payload.source)


@router.post("/ingest/upload", response_model=IngestResponse)
async def ingest_upload(file: UploadFile = File(...)) -> IngestResponse:
	content = (await file.read()).decode("utf-8", errors="ignore")
	filename = (file.filename or "uploaded").lower()

	if filename.endswith(".json") or filename.endswith(".jsonl"):
		try:
			parsed_json = json.loads(content)
			if isinstance(parsed_json, list):
				records = [item for item in parsed_json if isinstance(item, dict)]
				if not records:
					raise HTTPException(status_code=400, detail="No valid JSON object records found")
				return ingest_json_records(records, source="upload_json")
			if isinstance(parsed_json, dict):
				return ingest_json_records([parsed_json], source="upload_json")
		except json.JSONDecodeError:
			lines = [line for line in content.splitlines() if line.strip()]
			records = []
			for line in lines:
				try:
					data = json.loads(line)
					if isinstance(data, dict):
						records.append(data)
				except json.JSONDecodeError:
					continue
			if records:
				return ingest_json_records(records, source="upload_jsonl")
			raise HTTPException(status_code=400, detail="Unable to parse uploaded JSON/JSONL file")

	return ingest_text_blob(content, source="upload_text")


@router.post("/ingest/stream", response_model=IngestResponse)
def ingest_stream(lines: list[str]) -> IngestResponse:
	return ingest_raw_lines(lines, source="stream")


@router.get("/logs/recent")
def get_recent_logs(limit: int = 100):
	safe_limit = min(max(limit, 1), 1000)
	events = recent_events(limit=safe_limit)
	return {"events": events, "count": len(events)}
