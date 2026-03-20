```
LOG-WHISPERER ML PIPELINE ARCHITECTURE
Generated: 2026-03-20 | Status: ✅ SPECIFICATION COMPLETE

╔══════════════════════════════════════════════════════════════════════════════╗
║                          UNIFIED LOG SCHEMA (1)                             ║
║  LogEvent: timestamp, service, level, message, template, trace_id, raw...   ║
║           + extracted metadata (http_status, latency_ms, etc.)              ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                     ↓
╔══════════════════════════════════════════════════════════════════════════════╗
║                    TIME-WINDOW FEATURES (30s window)                        ║
║  • Aggregate stats: event_count, error_rate, throughput_eps               ║
║  • Distributions: level_distribution, unique_messages                      ║
║  • Latency: p50, p95, p99 + max                                            ║
║  • Anomaly indicators: error_burst, volume_spike, heartbeat_missing        ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                     ↓
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ML FEATURE EXTRACTION                                     ║
║  AnomalyFeatures:                                                           ║
║  • error_rate, throughput_rate, throughput_ratio                          ║
║  • latency_p95_ratio, error_level_entropy, unique_message_ratio           ║
║  • hour_of_day, day_of_week, anomaly_flags (0/1)                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
                    ↙                ↓                ↘
        ┌───────────────────┐  ┌──────────────┐  ┌──────────────┐
        │  ML_SCORE (40%)   │  │  HEURISTIC   │  │   RULES      │
        │  Isolation Forest │  │  ERROR_BURST │  │   SCORE      │
        │  distance 0-100   │  │  VOL_SPIKE   │  │   (20%)      │
        │  [0-100 pts]      │  │  LATENCY     │  │   [0-100]    │
        │                   │  │  HEARTBEAT   │  │   FATALS     │
        │  Warm-up: skip    │  │  SEQUENCE    │  │   DB ERRORS  │
        │  Sparse: skip     │  │  [0-100 pts] │  │   AUTH FAIL  │
        │                   │  │              │  │              │
        └─────────┬─────────┘  └──────┬───────┘  └──────┬───────┘
                  │                   │                 │
                  └───────────────────┼─────────────────┘
                                      ↓
        ╔═══════════════════════════════════════════════════════════════╗
        ║  ANOMALY SCORE COMBINER                                      ║
        ║  ─────────────────────────────────────────────────────────  ║
        ║  if history < 100:  0.8 × HEURISTIC + 0.2 × RULES          ║
        ║  elif sparse < 5:   0.7 × HEURISTIC + 0.3 × RULES          ║
        ║  else:              0.4 × ML + 0.4 × HEURISTIC + 0.2 × RULES║
        ║                                                              ║
        ║  FINAL_SCORE = clamp(score, 0, 100)                        ║
        ╚═══════════════════════════════════════════════════════════════╝
                                      ↓
        ╔═══════════════════════════════════════════════════════════════╗
        ║  SEVERITY CLASSIFICATION                                     ║
        ║  ─────────────────────────────────────────────────────────  ║
        ║  0-20:   HEALTHY   (log only)                               ║
        ║  21-40:  NOMINAL   (track trend)                            ║
        ║  41-60:  CAUTION   (flag in feed)                           ║
        ║  61-80:  ALERT     (push anomaly event)                     ║
        ║  81-100: CRITICAL  (trigger crash detection)                ║
        ╚═══════════════════════════════════════════════════════════════╝
                                      ↓
        ╔═══════════════════════════════════════════════════════════════╗
        ║  CRASH REPORT TRIGGERING                                     ║
        ║  ─────────────────────────────────────────────────────────  ║
        ║  ✓ Score ≥ 80 for ≥ 3 consecutive windows (90s)            ║
        ║  ✓ 3+ FATAL + heartbeat missing in 5min                    ║
        ║  ✓ Service down (0 events) > 5 windows (300s)              ║
        ║  ✓ Error rate > 30% AND throughput < 10% baseline          ║
        ║         → Generate CrashReport                             ║
        ╚═══════════════════════════════════════════════════════════════╝
                                      ↓
        ╔═══════════════════════════════════════════════════════════════╗
        ║  CRASH REPORT OUTPUT                                         ║
        ║  ─────────────────────────────────────────────────────────  ║
        ║  • first_anomalous_event (lowest timestamp with score > 80) ║
        ║  • probable_root_cause (auto-detected diagnosis)            ║
        ║  • timeline (10 events before + 20 after)                  ║
        ║  • affected_services (list)                                ║
        ║  • recommended_actions (["Restart", "Check DB", ...])      ║
        ║  • confidence (0-1, based on evidence)                    ║
        ║  • supporting_events (top 20 events in crash window)       ║
        ╚═══════════════════════════════════════════════════════════════╝


╔══════════════════════════════════════════════════════════════════════════════╗
║                    BASELINE ADAPTATION (Rolling Windows)                     ║
║                                                                              ║
║  Throughput Baseline:  avg of last 50 windows (or min 10)                   ║
║  Latency Baseline:     avg of last 20 windows (or min 100 events)           ║
║  Error Rate Baseline:  avg of last 30 windows                               ║
║                                                                              ║
║  Recomputation:  Every 1000 events OR every 1 hour                          ║
║  Staleness:      Drop windows older than 2 hours                            ║
╚══════════════════════════════════════════════════════════════════════════════╝


╔══════════════════════════════════════════════════════════════════════════════╗
║                      FALLBACK BEHAVIORS                                      ║
║                                                                              ║
║  Sparse Data (< 5 events/window):  Use 0.7×Heuristic + 0.3×Rules           ║
║  Cold Start (< 100 events total):  Use 0.8×Heuristic + 0.2×Rules           ║
║  Noisy Service (CV > 0.8):         Increase anomaly threshold × 1.2         ║
║  Missing Context (no latency):     Rely on throughput + error burst         ║
║  Service Down (0 events/5 wins):   ML score = 0.95 (near-certain anomaly)   ║
╚══════════════════════════════════════════════════════════════════════════════╝


╔══════════════════════════════════════════════════════════════════════════════╗
║                    IMPLEMENTATION PHASES                                     ║
║                                                                              ║
║  Phase 1: Foundation (9-12 hours)                                           ║
║  ├─ Commit 1: core/schemas.py (2-3h)                                        ║
║  ├─ Commit 2: parse/parser.py (4-5h)                                        ║
║  └─ Commit 3: ingest/service.py (3-4h)                                      ║
║                                                                              ║
║  Phase 2: Core ML (10-13 hours)                                             ║
║  ├─ Commit 4: detect/anomaly.py ⭐ ML CORE (6-8h)                           ║
║  └─ Commit 5: api/routes.py (4-5h)                                          ║
║                                                                              ║
║  Phase 3: Completion (5-7 hours)                                            ║
║  ├─ Commit 6: report/generator.py (3-4h)                                    ║
║  └─ Commit 7: Demo Ready (2-3h)                                             ║
║                                                                              ║
║  Total: 22-30 hours (2-3 days focused work)                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝


╔══════════════════════════════════════════════════════════════════════════════╗
║                         KEY FORMULAS & CONSTANTS                             ║
║                                                                              ║
║  ANOMALY_SCORE = 0.40 × ML_SCORE + 0.40 × HEURISTIC_SCORE + 0.20 × RULES  ║
║                                                                              ║
║  Heuristic Components:                                                       ║
║  • error_burst: if error_rate > 10% then +40 pts                           ║
║  • volume_spike: if throughput > 2.0× baseline then +35 pts               ║
║  • latency_spike: if p95 > 1.5× baseline then +30 pts                     ║
║  • heartbeat_missing: if service health check absent then +45 pts         ║
║  • sequence_anomaly: if unexpected state transitions then +25 pts         ║
║                                                                              ║
║  Rule Components:                                                            ║
║  • three_fatals_in_minute: 3+ FATALs in 60s → +20 pts                     ║
║  • connection_pool: "connection pool" in message → +30 pts                 ║
║  • auth_failure: > 10 (401/403) in 60s → +30 pts                          ║
║  • request_timeout: > 5 timeout errors in 60s → +25 pts                   ║
║  ... and more (see QUICK_REFERENCE.md)                                    ║
║                                                                              ║
║  Thresholds:                                                                ║
║  • ALERT threshold: 61                                                      ║
║  • CRITICAL threshold: 81                                                   ║
║  • SUSTAINED_CRITICAL_WINDOWS: 3 (90 seconds)                             ║
║  • Window size: 30 seconds                                                  ║
║  • Service down: > 5 windows (150+ seconds)                                ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Development Module Dependency Graph

```
                    ┌─────────────────┐
                    │ core/schemas.py │  ← START HERE
                    └────────┬────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
        ┌───────▼──────┐    │    ┌──────▼────────┐
        │ parse/       │    │    │ ingest/       │
        │ parser.py    │◄───┘    │ service.py    │
        └───────┬──────┘         └──────┬────────┘
                │                       │
                └───────────┬───────────┘
                            │
                    ┌───────▼────────┐
                    │ detect/        │  ⭐ ML CORE
                    │ anomaly.py     │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ┌───▼────────┐  ┌──────▼────────┐  ┌──────▼───────┐
    │ api/       │  │ report/       │  │ tests/       │
    │ routes.py  │  │ generator.py  │  │ all tests    │
    └────────────┘  └───────────────┘  └──────────────┘
```

---

## Testing Coverage Map

```
test_schemas.py
  ├─ LogEvent validation (15 tests)
  ├─ WindowFeatures aggregation (8 tests)
  ├─ AnomalyFeatures extraction (7 tests)
  └─ CrashReport structure (5 tests)
  ├─ 35 tests total

test_parser.py
  ├─ ApacheAccessLogParser (5 tests)
  ├─ NginxAccessLogParser (5 tests)
  ├─ SyslogParser (5 tests)
  ├─ JSONLogParser (5 tests)
  ├─ SpringBootLogParser (5 tests)
  └─ UniversalParser + format detection (6 tests)
  ├─ 35 tests total

test_ingest.py
  ├─ File upload (.txt, .json) (5 tests)
  ├─ Stream simulation scenarios (5 tests)
  ├─ Batch handling & accumulation (5 tests)
  ├─ Metadata tracking (3 tests)
  └─ Error handling (2 tests)
  ├─ 20 tests total

test_anomaly.py ⭐ CRITICAL
  ├─ BaselineManager (8 tests)
  ├─ IsolationForestModel (12 tests)
  ├─ HeuristicEngine (10 tests)
  ├─ RuleEngine (8 tests)
  ├─ ScoreCombiner (12 tests)
  └─ Full integration (10 tests)
  ├─ 60 tests total

test_api.py
  ├─ POST /logs/upload (4 tests)
  ├─ GET /logs/stream (4 tests)
  ├─ GET /anomalies (3 tests)
  ├─ GET /crashes (4 tests)
  ├─ GET /status (2 tests)
  └─ Error handling (3 tests)
  ├─ 20 tests total

test_report.py
  ├─ Root cause detection (8 tests)
  ├─ Timeline assembly (5 tests)
  ├─ Recommendation generation (5 tests)
  └─ Edge cases (2 tests)
  ├─ 20 tests total

Target: 100+ unit tests + 30+ integration tests = 130+ tests
Coverage target: > 85%
```

---

## Documentation Artifacts Delivered

```
log-whisperer/docs/
├─ ML_PIPELINE_INIT.md ✅
│  ├─ Section 1: Event Schema (3 components)
│  ├─ Section 2: Anomaly Score Formula (4 subsections)
│  ├─ Section 3: Thresholds & Fallback (4 subsections)
│  ├─ Section 4: Module-by-Module Plan (7 modules)
│  ├─ Section 5: Testing Approach
│  ├─ Section 6: Resource Contracts
│  ├─ Section 7: Validation Checklist
│  └─ Total: ~7,000 words, comprehensive
│
├─ IMPLEMENTATION_CHECKLIST.md ✅
│  ├─ Pre-implementation sign-off
│  ├─ Phase 1: Foundation (Commits 1-3)
│  ├─ Phase 2: Core ML (Commits 4-5)
│  ├─ Phase 3: Completion (Commits 6-7)
│  ├─ Phase 4: Validation & Polish
│  ├─ Key metrics tracking
│  └─ Quick reference (scoring formula)
│
├─ QUICK_REFERENCE.md ✅
│  ├─ Anomaly score formula (visual)
│  ├─ Severity levels table
│  ├─ Crash report triggers
│  ├─ Fallback behaviors
│  ├─ Key thresholds
│  ├─ Development constants (copy-paste ready)
│  ├─ Sample event flow walkthrough
│  └─ API response examples
│
├─ INIT_SUMMARY.md ✅
│  ├─ Executive summary
│  ├─ What was delivered (6 items)
│  ├─ Next steps for developers
│  ├─ Key design decisions & rationales
│  ├─ Implementation checklist summary
│  ├─ FAQ
│  └─ Escalation path
│
├─ ARCHITECTURE.md (existing)
├─ DEMO_RUNBOOK.md (existing)
└─ README.md (to update after implementation)
```

---

## Success Criteria (Definition of Done)

```
✅ DESIGN COMPLETE
  ├─ Event schema defined (20 fields)
  ├─ Scoring formula documented (40-40-20)
  ├─ Thresholds explicit (ALERT 61-80, CRITICAL 81-100)
  ├─ Fallback behaviors specified (5 scenarios)
  ├─ Module dependencies resolved
  └─ Testing strategy mapped

✅ SPECIFICATION COMPLETE
  ├─ 4 documentation files created
  ├─ Implementation checklist detailed
  ├─ Resource contracts defined
  ├─ Performance SLOs set (< 50ms scoring, < 1s API)
  └─ Zero ambiguity in contracts

⏳ IMPLEMENTATION PENDING
  ├─ Commit sequence: 7 commits
  ├─ Estimated time: 22-30 hours
  ├─ Modules: 7 (schemas, parser, ingest, anomaly, api, report, demo)
  ├─ Tests: 130+ tests, > 85% coverage
  └─ Next: Stakeholder sign-off → Start Commit 1

⏳ VALIDATION PENDING
  ├─ Parse accuracy > 95%
  ├─ Anomaly detection F1 > 0.85
  ├─ Crash pattern recall > 0.90
  ├─ API response p95 < 1s
  └─ End-to-end demo validates all scenarios
```
