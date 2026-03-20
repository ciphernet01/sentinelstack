# Architecture (MVP)

## Pipeline
1. Ingest logs via upload or stream simulator
2. Parse into unified schema
3. Create time-window feature vectors
4. Score anomalies (Isolation Forest + heuristic rules)
5. Trigger crash report when threshold/exceptions are met
6. Push anomaly feed and alerts to UI/webhooks

## Unified Event Schema
```json
{
  "timestamp": "ISO-8601",
  "service": "string",
  "level": "INFO|WARN|ERROR|FATAL",
  "message": "string",
  "template": "string",
  "trace_id": "string|null",
  "host": "string|null",
  "raw": "string",
  "anomaly_score": 0
}
```

## Crash Report Shape
- first_anomalous_event
- probable_root_cause
- affected_services
- timeline
- recommended_fix

## API Contract (Phase 2 Fallback)
- `GET /health`
- `GET /api/v1/status`
- `POST /api/v1/ingest/text`
- `POST /api/v1/ingest/json`
- `POST /api/v1/ingest/upload`
- `POST /api/v1/ingest/stream`
- `POST /api/v1/ingest/simulate`
- `GET /api/v1/logs/recent?limit=100`
- `GET /api/v1/anomalies/live?limit=300&threshold=60`
- `GET /api/v1/reports/latest?limit=500&threshold=75`
- `POST /api/v1/alerts/evaluate`

### `GET /api/v1/anomalies/live` response highlights
- `generated_at`
- `total_events`, `evaluated_events`, `anomalous_events`, `threshold`
- `events[]` (normalized events with `anomaly_score` and `reasons`)
- `clusters[]` (`service`, `event_count`, `avg_score`, `max_score`, `reasons`)

### `GET /api/v1/reports/latest` response highlights
- `generated_at`
- `report` (nullable)
- `report.first_anomalous_event`
- `report.probable_root_cause`
- `report.affected_services`
- `report.timeline[]`
- `report.recommended_fix[]`

### `POST /api/v1/ingest/simulate` request body
```json
{
  "profile": "healthy | error_burst | crash_like",
  "lines": 120,
  "service": "api-gateway"
}
```

### `POST /api/v1/alerts/evaluate` request body (optional)
```json
{
  "anomaly_threshold": 75,
  "min_anomalous_events": 3,
  "max_window_events": 400
}
```
