# 🚀 ML Development - Quick Start

**Status**: ✅ Code Ready to Run  
**Last Updated**: 2026-03-20  
**Your Task**: Validate and refine the anomaly detection implementation

---

## ✅ What's Been Implemented

### 1. **Core Schemas** (`app/core/schemas.py`)
✅ LogEvent - Unified log format across all parsers  
✅ WindowFeatures - Time-window aggregated statistics  
✅ AnomalyFeatures - ML feature vector  
✅ CrashReport - Root cause report structure  
✅ AnomalyAlert - Real-time anomaly feed  
✅ Config - Service configuration  

### 2. **Anomaly Detection Engine** (`app/detect/anomaly.py`)
✅ BaselineManager - Rolling stat tracking (50/20/30 windows)  
✅ IsolationForestModel - ML scoring (scikit-learn)  
✅ HeuristicEngine - 5 statistical rules (error, volume, latency, heartbeat, sequence)  
✅ RuleEngine - 7 pattern matchers (FATAL, DB, HTTP, auth, timeouts)  
✅ ScoreCombiner - 40-40-20 weighted formula  
✅ AnomalyDetector - Main orchestrator class  

### 3. **Test Suite** (`tests/test_anomaly.py`)
✅ 30+ unit tests for all components  
✅ 3+ integration tests (end-to-end scenarios)  
✅ Fixtures for healthy and anomalous windows  

---

## 📋 Your First Tasks

### **Task 1: Install Dependencies** (5 min)
```bash
cd log-whisperer/backend

# Install Python dependencies
pip install -r requirements.txt
```

### **Task 2: Run Tests** (10 min)
```bash
# Run all anomaly tests
pytest tests/test_anomaly.py -v

# Run specific test class
pytest tests/test_anomaly.py::TestAnomalyDetector -v

# Run with coverage
pytest tests/test_anomaly.py --cov=app/detect --cov-report=html
```

### **Task 3: Validate Scoring Formula** (15 min)
Run this Python snippet to verify the 40-40-20 formula:

```python
from app.detect.anomaly import ScoreCombiner

# Test normal case: 0.4×40 + 0.4×60 + 0.2×80 = 56
score, reason = ScoreCombiner.combine(
    ml_score=40,
    heuristic_score=60,
    rule_score=80,
    event_count=100,
    total_events_seen=1000,
)
print(f"Score: {score} (expected ~56)")
assert score == 56.0, f"Formula broken! Got {score}"
```

---

## 🧪 How the Detector Works

### **Scoring Flow**

```
InputWindow (30 seconds of logs)
    ↓
BaselineManager 
    ↓ (gets baseline stats)
    ├─→ ML_SCORE (Isolation Forest)
    ├─→ HEURISTIC_SCORE (error burst, volume spike, etc.)
    └─→ RULE_SCORE (pattern matching)
            ↓
        ScoreCombiner (40-40-20 formula)
            ↓
        FINAL_SCORE (0-100)
            ↓
        SEVERITY = {
            0-20: HEALTHY,
            21-40: NOMINAL,
            41-60: CAUTION,
            61-80: ALERT,
            81-100: CRITICAL
        }
            ↓
        If score >= 80 for 3+ windows → CRASH_DETECTED
```

### **Key Decision Points**

| Condition | Action |
|-----------|--------|
| total_events < 100 | Use heuristics + rules (warm-up) |
| event_count < 5 | Use heuristics + rules (sparse) |
| Normal (100+ events, 5+ events/window) | Use 40-40-20 formula |
| score >= 80 for 3+ windows | Trigger crash detection |

---

## 🔍 Testing Your Implementation

### **Test 1: Healthy Service**
```python
from app.detect.anomaly import AnomalyDetector
from datetime import datetime, timedelta
from app.core.schemas import WindowFeatures

detector = AnomalyDetector()

# Create a healthy window
healthy = WindowFeatures(
    window_start=datetime.now(),
    window_end=datetime.now() + timedelta(seconds=30),
    duration_sec=30,
    service="auth-service",
    event_count=100,
    error_count=5,
    error_rate=0.05,  # 5% errors = normal
    level_distribution={"DEBUG": 20, "INFO": 75, "ERROR": 5},
    throughput_eps=3.33,  # ~100 events/30s
    unique_messages=50,
    unique_templates=30,
    latency_p95=50.0,
    heartbeat_missing=False,
    error_burst=False,
    volume_spike=False,
    sequence_anomaly=False,
)

score, reason = detector.score_window(healthy)
print(f"✅ Healthy score: {score} (should be < 30)")
assert score < 30
```

### **Test 2: Error Burst**
```python
# Create anomalous window
anomaly = WindowFeatures(
    window_start=datetime.now(),
    window_end=datetime.now() + timedelta(seconds=30),
    duration_sec=30,
    service="db-service",
    event_count=50,
    error_count=25,
    error_rate=0.50,  # 50% errors = ALERT!
    level_distribution={"INFO": 10, "ERROR": 30, "FATAL": 10},
    throughput_eps=1.67,
    unique_messages=5,
    unique_templates=2,
    latency_p95=500.0,  # High latency
    heartbeat_missing=True,  # Missing heartbeat
    error_burst=True,
    volume_spike=False,
    sequence_anomaly=False,
)

score, reason = detector.score_window(anomaly)
print(f"⚠️  Anomaly score: {score} (should be > 40)")
assert score > 40
```

### **Test 3: Crash Detection**
```python
# Simulate 3 consecutive critical windows
for i in range(3):
    detector.critical_window_streak = i + 1
    crash = detector.detect_crash_pattern()
    print(f"Window {i+1}: Crash={crash}")

print(f"✅ Crash detected: {detector.detect_crash_pattern()}")
assert detector.detect_crash_pattern()
```

---

## 📊 Performance Targets

Your implementation should meet these SLOs:

| Metric | Target | How to Test |
|--------|--------|-----------|
| Parse + Score latency | < 100ms per log line | Time window processing |
| Anomaly scoring | < 50ms per window | Time `detector.score_window()` |
| ML model training | < 5s on 1000 windows | Monitor baseline retraining |
| Memory usage | < 500MB | Monitor during stream processing |

---

## 🐛 Debugging Tips

### "My tests are failing"
1. Check Python version (3.8+)
2. Verify all dependencies: `pip list | grep scikit`
3. Run one test at a time: `pytest tests/test_anomaly.py::TestBaselineManager::test_initialization -v`

### "Scores are always 0-50"
1. Verify heuristic_engine is working: print scores before combining
2. Check if thresholds match spec (ERROR_BURST_RATE = 0.10, etc.)
3. Compare against [QUICK_REFERENCE.md](../docs/QUICK_REFERENCE.md#development-constants)

### "Crash detection never triggers"
1. Verify critical_window_streak increments properly
2. Check SUSTAINED_CRITICAL_WINDOWS = 3
3. Ensure score >= CRITICAL_THRESHOLD (81)

---

## 📚 Reference Files

- **Testing Guide**: [ML_PIPELINE_INIT.md - Section 5](../docs/ML_PIPELINE_INIT.md#5-testing-approach)
- **Scoring Formula**: [QUICK_REFERENCE.md - Anomaly Score Formula](../docs/QUICK_REFERENCE.md#anomaly-score-formula)
- **Constants**: [QUICK_REFERENCE.md - Development Constants](../docs/QUICK_REFERENCE.md#development-constants)
- **Full Spec**: [ML_PIPELINE_INIT.md - Module 4](../docs/ML_PIPELINE_INIT.md#module-4-detectanomalypy-4th-priority---core-ml)

---

## ✅ Validation Checklist

Before moving to API integration:

- [ ] All 30+ tests pass (`pytest tests/test_anomaly.py -v`)
- [ ] Scoring formula correct (40-40-20 split validated)
- [ ] Thresholds match spec (ALERT=61-80, CRITICAL=81-100)
- [ ] Warm-up period works (first 100 events use heuristics)
- [ ] Sparse window handling works (< 5 events)
- [ ] Crash detection works (3+ critical windows)
- [ ] Performance < 50ms per window
- [ ] No circular imports
- [ ] Full docstrings on public methods

---

## 🎯 Next Steps After Validation

Once anomaly.py passes all tests:

1. **API Integration** (app/api/routes.py)
   - Wire AnomalyDetector into POST `/logs/upload`
   - Return anomaly scores in response

2. **Report Generation** (app/report/generator.py)
   - Use crash detection to generate CrashReports

3. **Demo** (Commit 7)
   - Run end-to-end scenarios

---

## 🚨 Important Notes

1. **BaselineManager** uses deques with maxlen for memory efficiency
2. **IsolationForestModel** requires 100+ events before training
3. **Heuristics** are always active (no dependencies)
4. **Rules** check recent events for pattern matching
5. **ScoreCombiner** handles warm-up and sparse specially

---

## 💬 Questions?

See [Documentation Index](../docs/INDEX.md) for full reference materials.

Good luck! 🚀
