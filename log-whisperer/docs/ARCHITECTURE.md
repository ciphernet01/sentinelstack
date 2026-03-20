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
