# Log-Whisperer (Hackathon Scaffold)

Log-Whisperer is a crash-root-cause assistant for high-volume microservice logs.
This folder is isolated from the main product so it can be developed and demoed independently.

## Scope for MVP
- Log ingestion from file upload (`.txt`, `.json`) and simulated stream
- Multi-format parsing (Apache, Nginx, syslog, structured JSON, Spring Boot-style text)
- Anomaly scoring (`0-100`) using statistical ML + rule checks
- Crash report generation with timeline and probable root cause
- Real-time dashboard + threshold alerting

## Directory Layout
- `backend/` FastAPI ingestion + parsing + detection + report engine
- `frontend/` dashboard shell for live feed and crash report views
- `samples/` synthetic logs for demo scenarios
- `docs/` architecture notes and demo runbook

## Quick Start (to be finalized)
1. Backend
   - `cd log-whisperer/backend`
   - `pip install -r requirements.txt`
   - `uvicorn app.main:app --reload --port 8090`
2. Frontend
   - `cd log-whisperer/frontend`
   - `npm install`
   - `npm run dev`

## Environment
Copy `.env.example` to `.env` and fill values.

## Status
Scaffold created. Feature implementation pending.
