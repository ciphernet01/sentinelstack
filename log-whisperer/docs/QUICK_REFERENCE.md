# ML Pipeline Quick Reference

## Anomaly Score Formula

```
┌─────────────────────────────────────────────────────────────────┐
│ FINAL_SCORE = 0.40 × ML_SCORE + 0.40 × HEURISTIC + 0.20 × RULES │
│              (0-100)            (0-100)              (0-100)      │
└─────────────────────────────────────────────────────────────────┘

Component Breakdown:

1. ML_SCORE (Isolation Forest)
   ├─ First 100 events: 0 (warm-up, use heuristics only)
   ├─ < 5 events/window: 0 (sparse, use heuristics)
   └─ Normal: distance-from-hyperplane normalized to 0-100

2. HEURISTIC_SCORE (Statistical Rules)
   ├─ error_burst (error_rate > 10%): +40 points
   ├─ volume_spike (throughput > 2x baseline): +35 points
   ├─ latency_spike (p95 > 1.5x baseline): +30 points
   ├─ heartbeat_missing (service health check absent): +45 points
   └─ sequence_anomaly (unexpected transitions): +25 points
   
   Total: Sum capped at 100

3. RULE_SCORE (Pattern Matchers)
   ├─ three_fatals_in_minute: +20 points
   ├─ repeated_error_pattern (same error N=5 times): +15 points
   ├─ connection_pool_exhausted: +30 points
   ├─ transaction_deadlock: +25 points
   ├─ high_error_status (500-504): +20 points
   ├─ auth_failure_burst (> 10 in 1min): +30 points
   └─ request_timeout_burst (> 5 in 1min): +25 points
   
   Total: Sum capped at 100

Special Cases:
├─ Warm-up (history < 100 events): Use 0.8 × heuristic + 0.2 × rules
├─ Sparse window (< 5 events): Use 0.7 × heuristic + 0.3 × rules
├─ Service down (0 events/5 windows): ML score = 0.95 (near-certain anomaly)
└─ Noisy service (CV > 0.8): Multiply anomaly threshold by 1.2×
```

## Severity Levels

```
Score Range │ Level      │ Action                │ Latency
────────────┼────────────┼───────────────────────┼─────────
0 - 20      │ HEALTHY    │ Log only (debug)      │ N/A
21 - 40     │ NOMINAL    │ Track trend (info)    │ N/A
41 - 60     │ CAUTION    │ Flag in feed (warn)   │ 5-10s
61 - 80     │ ALERT      │ Anomaly event pushed  │ 2-3s
81 - 100    │ CRITICAL   │ Trigger crash detect  │ < 1s
```

## Crash Report Triggers

```
ANY of these conditions trigger crash detection:

1. Score Sustained High
   └─ anomaly_score ≥ 80 for ≥ 3 consecutive windows (90 seconds)

2. FATAL Cascade
   └─ 3+ FATAL level logs AND heartbeat missing in 5-minute window

3. Service Unresponsive
   └─ 0 events for > 5 windows (300+ seconds)

4. Cascading Failure
   └─ error_rate > 30% AND throughput < 10% of baseline

Report Contents:
├─ first_anomalous_event (earliest event with score > 80)
├─ timeline (10 events before + 20 after anomaly start)
├─ probable_root_cause ("Error Rate Surge", "DB Connectivity", etc.)
├─ affected_services (list impacted services)
├─ recommended_actions (["Restart service", "Check DB", ...])
├─ confidence (0-1, based on evidence strength)
└─ supporting_events (top 20 events in crash window)
```

## Fallback Behavior

```
Condition                      Action                  Thresholds
─────────────────────────────────────────────────────────────────
Sparse logs (< 10 events/min) │ Use heuristic only    │ error_rate > 5%
Service cold start (< 100 events) │ Use heuristic only    │ error_rate > 5%
Noisy service (CV > 0.8)      │ Increase threshold    │×1.2 anomaly_threshold
Missing context (no latency)  │ Rely on throughput    │ error_burst > 7%

Baseline Adaptation:
├─ Throughput: Rolling avg of 50 windows (or 10 if history < 50)
├─ Latency p95: Rolling avg of 20 windows (or min 100 events)
├─ Error rate: Rolling avg of 30 windows
└─ Recompute baselines every 1000 events or 1 hour
```

## Key Thresholds

```
Window Size:                30 seconds (default)
Service Down Threshold:     5 windows without events (150s minimum)
Isolation Forest Retrain:   Every 1000 events OR 1 hour
Warm-up Period:             First 100 events (heuristics only)
Sparse Window Threshold:    < 5 events
Error Rate Alert:           > 10% (heuristic), > 30% (crash trigger)
Throughput Spike:           > 2× baseline (alert), > 1.5× (caution)
Latency Spike:              > 1.5× baseline p95
Auth Failure Burst:         > 10 in 60 seconds
FATAL Accumulation:         3+ in 60 seconds + heartbeat missing
```

## Sample Event Flow

```
1. Raw Log Line
   └─ "2026-03-20 10:30:45 ERROR DB connection timeout"

2. Parse → LogEvent
   ├─ timestamp: 2026-03-20T10:30:45Z
   ├─ level: ERROR
   ├─ message: "DB connection timeout"
   ├─ service: (extracted or default)
   └─ raw: (original line)

3. Accumulate 30-second Window
   └─ {event_count: 145, error_count: 32, latency_p95: 850ms, ...}

4. Extract Features → AnomalyFeatures
   └─ {error_rate: 0.22, throughput_rate: 4.83, latency_ratio: 1.7, ...}

5. Score Components
   ├─ ML_SCORE = isolated_forest.score(features) * 100 = 35
   ├─ HEURISTIC = error_burst(40) + latency_spike(30) = 70
   └─ RULES = connection_pool_exhausted(30) = 30

6. Combine
   └─ FINAL = 0.40×35 + 0.40×70 + 0.20×30 = 14 + 28 + 6 = 48 (CAUTION)

7. Check Crash Conditions
   └─ Is this the 3rd window in a row with score > 80? NO → No crash report

8. Emit to API
   └─ {event_id, timestamp, service, anomaly_score: 48, severity: CAUTION}
```

## Development Constants

```python
# File: app/detect/anomaly.py

# Window Configuration
WINDOW_SIZE_SEC = 30
SERVICE_DOWN_WINDOW_THRESHOLD = 5  # windows
SERVICE_DOWN_SECONDS = WINDOW_SIZE_SEC * SERVICE_DOWN_WINDOW_THRESHOLD  # 150s

# Warm-up & Sparse Handling
WARMUP_EVENT_THRESHOLD = 100
SPARSE_WINDOW_EVENT_THRESHOLD = 5

# Baseline Windows
BASELINE_THROUGHPUT_WINDOWS = 50
BASELINE_LATENCY_WINDOWS = 20
BASELINE_ERROR_WINDOWS = 30

# ML Model
ML_RETRAIN_EVENT_COUNT = 1000
ML_RETRAIN_MINUTES = 60

# Heuristic Thresholds
ERROR_BURST_RATE = 0.10  # 10%
VOLUME_SPIKE_RATIO = 2.0  # 2x
VOLUME_CAUTION_RATIO = 1.5  # 1.5x
LATENCY_SPIKE_RATIO = 1.5  # 1.5x
NOISY_SERVICE_CV_THRESHOLD = 0.8
NOISY_SERVICE_THRESHOLD_MULTIPLIER = 1.2

# Rule Thresholds
FATAL_CASCADE_COUNT = 3
FATAL_CASCADE_WINDOW_SEC = 60
AUTH_FAILURE_THRESHOLD = 10
AUTH_FAILURE_WINDOW_SEC = 60
TIMEOUT_ERROR_THRESHOLD = 5
TIMEOUT_ERROR_WINDOW_SEC = 60

# Scoring
ML_COMPONENT_WEIGHT = 0.40
HEURISTIC_COMPONENT_WEIGHT = 0.40
RULE_COMPONENT_WEIGHT = 0.20

# Severity Thresholds
ALERT_THRESHOLD = 61
CRITICAL_THRESHOLD = 81
SUSTAINED_CRITICAL_WINDOWS = 3

# Crash Report
CRASH_TIMELINE_BEFORE_EVENTS = 10
CRASH_TIMELINE_AFTER_EVENTS = 20
CRASH_SUPPORTING_EVENTS = 20
```

## API Response Examples

### POST /api/v1/logs/upload

**Request:**
```bash
curl -X POST \
  -F "file=@logs.txt" \
  http://localhost:8090/api/v1/logs/upload
```

**Response (200):**
```json
{
  "upload_id": "uuid-12345",
  "events_parsed": 1500,
  "events_scored": 1500,
  "parse_errors": 0,
  "anomalies_detected": 12,
  "anomalies": [
    {
      "event_id": "uuid-a",
      "timestamp": "2026-03-20T10:30:45Z",
      "service": "auth-service",
      "anomaly_score": 78,
      "severity": "ALERT",
      "reason": "HEURISTIC"
    }
  ],
  "crash_reports": [
    {
      "report_id": "uuid-crash-1",
      "first_anomalous_at": "2026-03-20T10:30:50Z",
      "probable_root_cause": "Error Rate Surge - auth-service"
    }
  ]
}
```

### GET /api/v1/crashes/{report_id}

**Response (200):**
```json
{
  "report_id": "uuid-crash-1",
  "generated_at": "2026-03-20T10:31:00Z",
  "first_anomalous_event": { /* LogEvent object */ },
  "probable_root_cause": "Error Rate Surge - auth-service",
  "confidence": 0.87,
  "affected_services": ["auth-service", "user-db"],
  "timeline": [
    { "time": "10:30:40", "event": "Service healthy", },
    { "time": "10:30:45", "event": "Error rate spike detected", "count_errors": 45 },
    { "time": "10:30:50", "event": "Critical threshold reached" }
  ],
  "recommended_actions": [
    "Check auth-service pod logs for error patterns",
    "Verify database connection pool status",
    "Review recent deployments to auth-service",
    "Consider traffic rerouting to backup instance"
  ],
  "supporting_events": [ /* Top 20 events */ ]
}
```

---

**For full specification, see: [ML_PIPELINE_INIT.md](ML_PIPELINE_INIT.md)**  
**For implementation checklist, see: [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)**
