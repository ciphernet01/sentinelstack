# Log-Whisperer ML Pipeline - Initialization Specification

**Status**: 🚀 Ready for Implementation  
**Last Updated**: 2026-03-20  
**Scope**: MVP (Hackathon) - Ingest → Parse → Score → Report

---

## 1. Final Event Schema & Derived Features

### 1.1 Unified Event Schema (Ingestion Layer Output)

```python
class LogEvent(BaseModel):
    # Identifiers
    timestamp: datetime  # ISO-8601, normalized to UTC
    event_id: str  # UUID or generated from hash
    
    # Source Information
    service: str  # e.g., "auth-service", "payment-api", "db-worker"
    host: Optional[str] = None  # hostname or pod name
    source: str  # e.g., "apache", "nginx", "syslog", "spring-boot"
    
    # Log Content
    level: str  # Enum: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL"
    message: str  # Cleaned/normalized message text
    template: Optional[str] = None  # Templated message (e.g., "User {uid} login failed")
    raw: str  # Original raw log line for context
    
    # Context (optional, extracted by parser)
    trace_id: Optional[str] = None  # Distributed trace ID
    request_id: Optional[str] = None  # Request correlation ID
    user_id: Optional[str] = None  # If extractable
    origin_ip: Optional[str] = None  # If extractable
    
    # Custom Metadata (parser-specific fields)
    metadata: Dict[str, Any] = {}  # {http_status, latency_ms, db_query, etc}
    
    # ML Features (computed during ingestion, before scoring)
    anomaly_score: float = 0.0  # 0-100, filled by anomaly scorer
    detection_reason: Optional[str] = None  # Why this event is anomalous
```

### 1.2 Time-Window Feature Vector (Feature Engineering)

For **each sliding window** (default 30s, 1m, 5m):

```python
class WindowFeatures(BaseModel):
    window_start: datetime
    window_end: datetime
    duration_sec: int
    service: str
    
    # Aggregate Statistics
    event_count: int  # Total events in window
    error_count: int  # Level in [ERROR, FATAL]
    error_rate: float  # error_count / event_count
    
    # Level Distribution
    level_distribution: Dict[str, int]  # {DEBUG: N, INFO: N, WARN: N, ERROR: N, FATAL: N}
    
    # Log Throughput (events per second)
    throughput_eps: float  # events / duration_sec
    
    # Error Patterns
    unique_messages: int
    unique_templates: int
    top_error_messages: List[Tuple[str, int]]  # [(message, count), ...]
    
    # Latency Metrics (if extractable from metadata)
    latency_p50: Optional[float] = None  # milliseconds
    latency_p95: Optional[float] = None
    latency_p99: Optional[float] = None
    latency_max: Optional[float] = None
    
    # Heartbeat Detection
    heartbeat_missing: bool  # True if expected service heartbeat is absent in 3x window
    
    # Anomaly Indicators (heuristic pre-flags)
    error_burst: bool  # error_rate > 10%
    volume_spike: bool  # throughput_eps > 2x baseline
    sequence_anomaly: bool  # Unexpected transitions (e.g., FATAL without ERROR)
    
    # Persistence Features
    service_down: bool = False  # No events for 5+ windows
```

### 1.3 Derived Features for Isolation Forest

```python
class AnomalyFeatures(BaseModel):
    """Features passed to Isolation Forest ML model"""
    
    # Core Statistical Features
    error_rate: float  # 0-1
    throughput_rate: float  # events/sec
    throughput_ratio: float  # current / baseline_throughput
    latency_p95_ratio: Optional[float] = None  # current / baseline
    
    # Temporal Features
    hour_of_day: int  # 0-23 (captures diurnal patterns)
    day_of_week: int  # 0-6 (Mon-Sun)
    
    # Sequence Features
    error_level_entropy: float  # Shannon entropy of level distribution (0-2.3 bits)
    unique_message_ratio: float  # unique_messages / event_count
    
    # Aggregated Heuristic Flags (0/1)
    error_burst_flag: int
    volume_spike_flag: int
    heartbeat_missing_flag: int
    sequence_anomaly_flag: int
```

---

## 2. Anomaly Score Formula (0–100)

### 2.1 Multi-Component Scoring Strategy

**Final Score = Weighted Combination of:**
1. **Isolation Forest ML Score** (40% weight)
2. **Statistical Heuristics** (40% weight)
3. **Rule-Based Detectors** (20% weight)

### 2.2 Component Definitions

#### **Component 1: Isolation Forest ML Score (40%)**
```
if service_down or no_events_in_window:
    ml_score_0_1 = 0.95  # Near-certain anomaly
else:
    ml_score_0_1 = anomaly_probability(isolation_forest(features))
    # isolation_forest returns distance in [0, 1] range
    # normalize: distance >= 0.7 → anomalous

ml_score_0_100 = ml_score_0_1 * 100
```

**Baseline & Adaptation:**
- First 100 events: Use heuristics only (insufficient ML history)
- After 100+ events: Compute rolling mean/stddev for throughput & latency
- **Fallback on sparse logs**: If < 10 events/window, use heuristics with 1.2x weight

#### **Component 2: Statistical Heuristics (40%)**
```
heuristic_scores = {
    error_burst: 40 if error_rate > 10% else 0,
    volume_spike: 35 if throughput_spike_ratio > 2.0 else (20 if ratio > 1.5 else 0),
    latency_spike: 30 if latency_p95 > baseline * 1.5 else 0,
    heartbeat_missing: 45 if heartbeat missing else 0,
    sequence_anomaly: 25 if unexpected transition else 0,
}

heuristic_score_0_100 = min(100, sum(heuristic_scores))
```

**Baseline Computation (Adaptive):**
- **Throughput baseline**: Rolling average of last 50 windows (or 10 windows if < 50 seen)
- **Latency baseline**: Rolling p95 of last 20 windows (or minimum 100 events)
- **Error rate baseline**: Rolling average of last 30 windows

#### **Component 3: Rule-Based Detectors (20%)**
```
rule_flags = {
    # Service-level rules
    three_fatals_in_minute: 20 if count_fatals(1m) >= 3 else 0,
    repeated_error_pattern: 15 if same_error_msg_repeated(N=5) else 0,
    
    # Database-specific patterns
    connection_pool_exhausted: 30 if "connection pool" in message else 0,
    transaction_deadlock: 25 if "deadlock detected" in message else 0,
    
    # HTTP API patterns  
    high_error_status: 20 if http_status in [500, 502, 503, 504] else 0,
    auth_failure_burst: 30 if count_401_403(1m) > 10 else 0,
    
    # Timeout patterns
    request_timeout_burst: 25 if count_timeout_errors(1m) > 5 else 0,
}

rule_score_0_100 = min(100, sum(rule_flags))
```

### 2.3 Final Anomaly Score Calculation

```python
def compute_anomaly_score(
    ml_score: float,
    heuristic_score: float,
    rule_score: float,
    event_count: int,
    history_size: int
) -> Tuple[float, str]:
    """
    Args:
        ml_score: 0-100, from Isolation Forest
        heuristic_score: 0-100, from statistical rules
        rule_score: 0-100, from pattern matchers
        event_count: events in current window
        history_size: cumulative events seen
    
    Returns:
        (anomaly_score, detection_reason)
    """
    
    # Warm-up period: First 100 events use heuristics only
    if history_size < 100:
        score = heuristic_score * 0.8 + rule_score * 0.2
        reason = "WARM_UP_HEURISTIC"
    
    # Sparse window: < 5 events (unreliable ML)
    elif event_count < 5:
        score = heuristic_score * 0.7 + rule_score * 0.3
        reason = "SPARSE_HEURISTIC"
    
    # Normal: Full weighted combination
    else:
        score = (
            ml_score * 0.40 +
            heuristic_score * 0.40 +
            rule_score * 0.20
        )
        reason = "NORMAL"
    
    # Clamp to [0, 100]
    final_score = min(100, max(0, score))
    
    return final_score, reason
```

---

## 3. Thresholds & Fallback Behavior

### 3.1 Anomaly Severity Levels

| Level | Score Range | Action | Latency |
|-------|-------------|--------|---------|
| **HEALTHY** | 0-20 | Log only (debug) | N/A |
| **NOMINAL** | 21-40 | Track trend (info) | N/A |
| **CAUTION** | 41-60 | Flag in feed (warn) | 5-10s |
| **ALERT** | 61-80 | Anomaly event pushed (warn) | 2-3s |
| **CRITICAL** | 81-100 | Trigger crash detection (error) | <1s |

### 3.2 Crash Report Triggering

**Automatic Crash Report Generated When:**

1. **Sustained High Score**: Anomaly score ≥ 80 for ≥ 3 consecutive windows
2. **Pattern Match**: 3+ FATAL errors + heartbeat missing in 5m window
3. **Service Down**: Service has 0 events for > 5 windows (300s)
4. **Cascading Failure**: Error rate > 30% AND throughput < 10% of baseline

**Crash Report Includes:**
```python
class CrashReport(BaseModel):
    report_id: str  # UUID
    generated_at: datetime
    
    # Root Cause Analysis
    first_anomalous_event: LogEvent
    probable_root_cause: str  # Human-readable diagnosis
    confidence: float  # 0-1
    
    # Timeline
    timeline: List[TimelineEntry]  # ChromenumIsolationForestEventmarkers leading to crash
    
    # Affected Services
    affected_services: List[str]
    service_dependencies: Dict[str, List[str]]  # service → [dependent_services]
    
    # Recommendations
    recommended_actions: List[str]  # Actionable fixes
    similar_incidents: List[SimilarIncident]  # (optional, phase 2)
    
    # Evidence
    window_features: WindowFeatures
    supporting_events: List[LogEvent]  # Top 20 events in crash window
```

### 3.3 Fallback Behavior

#### **Scenario A: Sparse Logs (< 10 events/min)**
```
Action: Use heuristic + rule scoring only (skip ML)
Reason: Insufficient data for statistical learning
Details:
  - Isolation Forest requires ≥ 5 events per window
  - Increase window size from 30s → 60s for sparse services
  - Re-baseline after 50 windows (≈ 50 minutes)
```

#### **Scenario B: Cold Start (First 100 events)**
```
Action: Use heuristic + rule scoring
Reason: ML model needs warm-up period
Details:
  - No baseline stats available
  - Use default thresholds: error_rate > 5%, throughput > 1 event/sec
  - Switch to ML after 100 events
```

#### **Scenario C: Noisy Service (High Baseline Variance)**
```
Action: Increase anomaly threshold percentile (75th → 90th)
Reason: Normal variability shouldn't trigger alerts
Details:
  - Monitor coefficient of variation (σ/μ) for throughput
  - If CV > 0.8, apply "noisy service" multiplier (1.2x threshold)
  - Example: Alert if score > 80 → Alert if score > 96 for noisy service
```

#### **Scenario D: Missing Context (No Latency/HTTP Status)**
```
Action: Rely on event-level and throughput heuristics
Reason: Insufficient feature space for ML
Details:
  - Reweight remaining features
  - Increase sensitivity to error bursts (threshold: error_rate > 7%)
  - Allow rule-based detectors to dominate scoring
```

---

## 4. Module-by-Module Implementation Plan

### 4.1 Dependency Graph

```
    [1] core/schemas.py 
            ↓
   [2] parse/parser.py  ←  [3] ingest/service.py
            ↓                    ↓
   [4] detect/anomaly.py ←  [5] api/routes.py
            ↓                    ↓
   [6] report/generator.py ← [5] api/routes.py
```

### 4.2 Module Specifications

#### **Module 1: `app/core/schemas.py` (START HERE)**
**Purpose**: Define all Pydantic models for type safety and validation

**Exports**:
- `LogEvent` - Unified log event schema
- `WindowFeatures` - Time-window aggregate features
- `AnomalyFeatures` - ML feature vector
- `CrashReport` - Final report output
- `AnomalyAlert` - Real-time anomaly feed item
- `Config` - Service configuration

**Key Methods**:
- `LogEvent.normalize()` → Clean/extract fields from raw log
- `WindowFeatures.from_events()` → Aggregate window stats
- `AnomalyFeatures.from_window()` → Extract ML features

**Dependencies**: `pydantic`, `datetime`, `typing`

**Testing**:
- Unit tests for schema validation
- Test edge cases: missing fields, type coercion, enum validation

---

#### **Module 2: `app/parse/parser.py` (2ND PRIORITY)**
**Purpose**: Multi-format log parsing and normalization

**Exports**:
- `Parser` (abstract base)
- `ApacheAccessLogParser`
- `NginxAccessLogParser`  
- `SyslogParser`
- `JSONLogParser`
- `SpringBootLogParser`
- `UniversalParser` (auto-detect format)

**Key Methods**:
```python
class Parser(ABC):
    def parse(self, raw_line: str) -> Optional[LogEvent]: ...
    def can_parse(self, raw_line: str) -> bool: ...  # Format detection

class UniversalParser:
    def parse(self, raw_line: str) -> Optional[LogEvent]:
        # Try each format parser until success
        # Return LogEvent with source= detected format
```

**Format Support Examples**:
- Apache: `192.168.1.1 - - [20/Mar/2026 10:30:45] "GET /api/users HTTP/1.1" 200 1234`
- Nginx: `2026-03-20T10:30:45Z [info] Request took 150ms`
- Spring Boot: `2026-03-20 10:30:45.123 [main] INFO com.example.Service: User login successful`
- JSON: `{"timestamp":"2026-03-20T10:30:45Z", "level":"ERROR", "message":"DB timeout"}`

**Dependencies**: `re`, `dateutil.parser`, `json`

**Testing**:
- Sample logs from `samples/` directory
- Test field extraction accuracy
- Test template generation (e.g., "User {uid} Failed" from "User john Failed", "User jane Failed")

---

#### **Module 3: `app/ingest/service.py` (3RD PRIORITY)**
**Purpose**: File and stream ingestion

**Exports**:
- `IngestionService`
  - `ingest_file(file_path: str) → List[LogEvent]`
  - `ingest_stream(source: str) → AsyncIterator[LogEvent]`
  - `sim_stream(scenario: str) → AsyncIterator[LogEvent]`  # Simulated stream for demo

**Key Features**:
- File upload handler (`.txt`, `.json`)
- Stream simulator (generates synthetic logs based on scenario)
- Batch processing (configurable batch size, default 100 events)
- Metadata tracking (ingestion timestamp, source URL, etc.)

**Stream Simulator Scenarios**:
- `healthy` - Normal baseline logs
- `error_burst` - Sudden spike in ERRORs
- `volume_spike` - High throughput
- `missing_heartbeat` - Service health check logs missing
- `cascade_failure` - Multiple services failing

**Dependencies**: `aiofiles`, `orjson`, `parser` module

**Testing**:
- Test file upload with different log formats
- Test stream simulator scenarios
- Test batch accumulation and event ordering

---

#### **Module 4: `app/detect/anomaly.py` (4TH PRIORITY - CORE ML)**
**Purpose**: Anomaly scoring engine

**Exports**:
- `AnomalyDetector`
  - `__init__(baseline_window_count: int = 50)` - ML model initialization
  - `update_baseline(events: List[LogEvent])` - Adaptive baseline learning
  - `score_window(window_features: WindowFeatures) → Tuple[float, str]`
  - `is_anomalous(score: float, level: str = "ALERT") → bool`
  - `detect_crash_pattern(events: List[LogEvent], last_N: int = 100) → bool`

**Internal Logic**:
- **Baseline Manager**: Tracks rolling stats (throughput, latency, error_rate)
- **Isolation Forest Model**: Trains on non-anomalous windows
- **Heuristic Engine**: Checks error burst, volume spike, etc.
- **Rule Engine**: Pattern matchers (FATAL cascade, DB errors, etc.)
- **Score Combiner**: Weighted blend formula (40-40-20)

**ML Training**:
- Retrain Isolation Forest every 1000 events or every 1 hour
- Use windows labeled as "normal" (score 0-20) from previous periods
- Handle concept drift with exponential weighting (newer windows more important)

**Dependencies**: `scikit-learn`, `numpy`, `pandas`, `datetime`

**Testing**:
- Unit tests for each scoring component
- Integration test: synthetic event stream → scores → verify thresholds
- Crash pattern detection accuracy (precision/recall)

---

#### **Module 5: `app/api/routes.py` (5TH PRIORITY)**
**Purpose**: FastAPI endpoint definitions

**Endpoints**:
```python
POST /api/v1/logs/upload
  - Accept file upload (.txt, .json)
  - Call ingest_file() → parse → score
  - Return: {event_ids, parse_errors, anomalies_detected}

GET  /api/v1/logs/stream
  - WebSocket or Server-Sent Events
  - Stream simulator or tail live logs
  - Emit: LogEvent + anomaly_score in real-time

GET  /api/v1/anomalies
  - Query parameters: service, time_range, min_score
  - Return: List of anomalous events + scores

GET  /api/v1/crashes
  - Return list of detected crash reports
  - Pagination: limit, offset

GET  /api/v1/crashes/{report_id}
  - Return full crash report with timeline

GET  /api/v1/status
  - Return model status: (trained, baseline_windows_seen, last_update)
```

**Integration**:
- Connect to `ingest_service`, `parser`, `anomaly_detector`, `report_generator`
- Async handlers for stream endpoints
- Error handling and validation

**Testing**:
- API contract tests
- Load test with simulated streams

---

#### **Module 6: `app/report/generator.py` (LAST - REPORTING)**
**Purpose**: Crash report generation and root cause analysis

**Exports**:
- `ReportGenerator`
  - `generate_crash_report(events: List[LogEvent], trigger: str) → CrashReport`

**Root Cause Logic**:
```
Algorithm:
1. Identify first anomalous event (lowest timestamp with score > 80)
2. Collect timeline: 10 events before + 20 events after
3. Detect pattern:
   - If error_rate spike: "Error Rate Surge - {service}"
   - If latency spike: "High Latency Detected - {service}"
   - If heartbeat missing: "Service {service} Unresponsive"
   - If FATAL cascade: "Critical Errors in {services}"
   - If DB errors dominant: "Database Connectivity Issue"
4. Recommend actions:
   - Restart service
   - Check DB connections
   - Review recent deployments
   - Examine network health
```

**Dependencies**: `datetime`, `schemas`, `typing`

**Testing**:
- Test report generation from synthetic crash scenarios
- Validate timeline accuracy
- Verify recommendation relevance

---

### 4.3 Implementation Order & Commits

```
Commit 1: Core Schemas
  └─ app/core/schemas.py + unit tests

Commit 2: Parser Implementation  
  └─ app/parse/parser.py + sample formats + tests

Commit 3: Ingestion Service
  └─ app/ingest/service.py + file upload + stream sim + tests

Commit 4: Anomaly Detection Engine
  └─ app/detect/anomaly.py (all scoring logic) + tests

Commit 5: API Routes
  └─ app/api/routes.py (wire all modules) + integration tests

Commit 6: Report Generator
  └─ app/report/generator.py + tests

Commit 7: Demo Ready
  └─ Sample datasets + demo scenarios + README
```

---

## 5. Testing Approach

### 5.1 Test Structure

```
log-whisperer/backend/
├── app/
│   ├── ...
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py  # Shared fixtures
│       ├── test_schemas.py
│       ├── test_parser.py
│       ├── test_ingest.py
│       ├── test_anomaly.py
│       ├── test_api.py
│       └── test_report.py
```

### 5.2 Testing Strategy

| Module | Test Type | Scenarios |
|--------|-----------|-----------|
| **schemas** | Unit | Validation, edge cases, coercion |
| **parser** | Unit + Integration | Per-format parsing, field extraction, template gen |
| **ingest** | Integration | File upload, stream simulation, batch handling |
| **anomaly** | Unit + Integration | Each scoring component, warm-up period, fallback |
| **api** | Integration | Endpoint contracts, error handling, async |
| **report** | Integration | Crash pattern detection, root cause assignment |

### 5.3 Validation Checklist

**After each commit:**
- ✅ All tests pass
- ✅ Pylint/black formatting clean
- ✅ No circular imports
- ✅ Async functions properly handled
- ✅ Error messages user-friendly

---

## 6. Resource Contracts

### 6.1 Input Contracts

**File Upload**:
- Allowed formats: `.txt`, `.json`
- Max file size: 50 MB
- Max lines: 100,000
- Encoding: UTF-8

**Stream**:
- Events per second: 100 - 1,000
- Batch size: 100 events
- Timeout: 30s per batch

### 6.2 Output Contracts

**Anomaly Feed**:
```json
{
  "event_id": "uuid",
  "timestamp": "ISO-8601",
  "service": "string",
  "anomaly_score": 0-100,
  "severity": "NOMINAL|CAUTION|ALERT|CRITICAL",
  "reason": "string"
}
```

**Crash Report**:
```json
{
  "report_id": "uuid",
  "generated_at": "ISO-8601",
  "first_anomalous_event": LogEvent,
  "probable_root_cause": "Human-readable diagnosis",
  "confidence": 0-1,
  "recommended_actions": ["action1", "action2"],
  "affected_services": ["service1", "service2"]
}
```

### 6.3 Performance SLOs

- Parse latency: < 100ms per log line (batch)
- Anomaly scoring: < 50ms per window
- Report generation: < 500ms
- API endpoints: < 1s response time (p95)

---

## 7. Validation & Definition of Done

### ✅ Event Schema & Scoring Strategy
- [x] Event schema defined (1.1)
- [x] Derived features specified (1.3)
- [x] Anomaly score formula fully detailed (2.1-2.3)
- [x] Threshold levels mapped (3.1)

### ✅ Thresholds Explicit & Documented
- [x] Severity levels (3.1)
- [x] Crash trigger conditions (3.2)
- [x] Fallback scenarios (3.3)
- [x] Baseline adaptation logic (2.2)

### ✅ Implementation Plan Ready
- [x] Module dependency graph (4.1)
- [x] Per-module specifications (4.2)
- [x] Commit order defined (4.3)
- [x] Testing strategy documented (5)

### ✅ Ready to Code
- [x] No ambiguities in contracts (6)
- [x] All components defined
- [x] Edge cases handled
- [x] Next developer can implement without design questions

---

## Next Steps

1. **Review & Validate**: Stakeholder sign-off on scoring formula and thresholds
2. **Create Samples**: Add synthetic log files to `samples/` for testing
3. **Begin Implementation**: Start with Commit 1 (schemas)
4. **Track Progress**: Update TODO checklist below as commits complete

---

## Developer TODO Checklist

### Phase 1: Foundation (Commits 1-3)
- [ ] **Commit 1**: `app/core/schemas.py` + unit tests (Est: 2-3h)
  - [ ] LogEvent, WindowFeatures, AnomalyFeatures classes
  - [ ] CrashReport, AnomalyAlert schemas
  - [ ] normalize(), from_events(), from_window() methods
  - [ ] 15+ unit tests

- [ ] **Commit 2**: `app/parse/parser.py` + tests (Est: 4-5h)
  - [ ] Abstract Parser base class
  - [ ] Apache, Nginx, Syslog, JSON, Spring Boot parsers
  - [ ] UniversalParser (format auto-detection)
  - [ ] Template extraction logic
  - [ ] 25+ unit tests + sample data

- [ ] **Commit 3**: `app/ingest/service.py` + tests (Est: 3-4h)
  - [ ] IngestionService class
  - [ ] ingest_file() with batch processing
  - [ ] Stream simulator with 5 scenarios
  - [ ] Metadata tracking
  - [ ] 20+ integration tests

### Phase 2: Core ML (Commits 4-5)
- [ ] **Commit 4**: `app/detect/anomaly.py` + tests (Est: 6-8h) ⭐ CRITICAL
  - [ ] BaselineManager (rolling stats)
  - [ ] IsolationForestModel (training + inference)
  - [ ] HeuristicEngine (error burst, volume spike, etc)
  - [ ] RuleEngine (FATAL cascade, DB patterns, etc)
  - [ ] ScoreCombiner (weighted formula)
  - [ ] AnomalyDetector main class
  - [ ] 40+ unit tests + integration tests
  - [ ] Validation: thresholds match spec (3.1)

- [ ] **Commit 5**: `app/api/routes.py` + tests (Est: 4-5h)
  - [ ] POST /logs/upload endpoint
  - [ ] GET /logs/stream (SSE or WebSocket)
  - [ ] GET /anomalies endpoint
  - [ ] GET /crashes endpoints (list + detail)
  - [ ] GET /status endpoint
  - [ ] 20+ integration tests
  - [ ] Error handling + validation

### Phase 3: Completion (Commits 6-7)
- [ ] **Commit 6**: `app/report/generator.py` + tests (Est: 3-4h)
  - [ ] ReportGenerator class
  - [ ] Root cause detection logic
  - [ ] Timeline assembly
  - [ ] Recommendation generation
  - [ ] 20+ tests with synthetic crash scenarios

- [ ] **Commit 7**: Demo Ready (Est: 2-3h)
  - [ ] Sample datasets in `samples/`
  - [ ] Updated README with quick start
  - [ ] Demo scenarios documented
  - [ ] All tests passing
  - [ ] Manual end-to-end demo

### Phase 4: Validation & Polish (Est: 2-3h)
- [ ] Code review checklist
- [ ] Performance validation (SLOs met)
- [ ] Edge case testing
- [ ] Documentation complete
- [ ] Ready for hackathon demo

---

**Total Estimated Dev Time**: 22-30 hours (2-3 days focused work)

---

## References

- [Architecture Document](ARCHITECTURE.md)
- [Demo Runbook](DEMO_RUNBOOK.md)
- [Dependencies](../requirements.txt)
- [Scikit-learn Isolation Forest Docs](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html)
