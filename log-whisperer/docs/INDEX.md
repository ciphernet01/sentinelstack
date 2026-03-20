# Documentation Index & Reading Guide

**Generated**: 2026-03-20  
**Project**: Log-Whisperer ML Pipeline (Hackathon MVP)  
**Status**: 🟢 Initialization Complete

---

## 📚 Document Roadmap

### For **Project Managers & Stakeholders**
1. **This file** (2 min) - Quick navigation
2. [INIT_SUMMARY.md](INIT_SUMMARY.md) (15 min) - Executive summary with FAQ
3. [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) (10 min) - Visual walkthrough

**Purpose**: Understand what was delivered, timelines, and next steps.

---

### For **ML Engineers & Developers** (Start Here)
1. **This file** (2 min) - Document map
2. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (15 min) - Scoring formula, constants, examples
3. [ML_PIPELINE_INIT.md](ML_PIPELINE_INIT.md) (90 min) - Full technical specification
   - Sections 1-3: Event schema, scoring formula, thresholds (45 min)
   - Sections 4-6: Module specs, testing, contracts (45 min)
4. [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) (20 min) - What to build, commit order

**Purpose**: Understand every design detail before starting code.

**Total prep time**: ~2 hours (before coding)

---

### For **Code Reviewers**
1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Constants reference (during review)
2. [ML_PIPELINE_INIT.md - Section 4](ML_PIPELINE_INIT.md#4-module-by-module-implementation-plan) - Module specs
3. [ML_PIPELINE_INIT.md - Section 5](ML_PIPELINE_INIT.md#5-testing-approach) - Testing criteria

**Purpose**: Validate implementation against specification.

---

### For **QA & Validation Teams**
1. [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md) - Expected behaviors (existing doc)
2. [IMPLEMENTATION_CHECKLIST.md - Phase 4](IMPLEMENTATION_CHECKLIST.md#phase-4-validation--polish) - Validation gates
3. [QUICK_REFERENCE.md - Key Metrics](QUICK_REFERENCE.md#key-thresholds) - Success criteria

**Purpose**: Test implementation meets requirements.

---

## 🎯 Document Purposes

| Document | Length | Purpose | Audience |
|----------|--------|---------|----------|
| **ML_PIPELINE_INIT.md** | 7,000 words | Complete technical specification | Developers, Architects |
| **IMPLEMENTATION_CHECKLIST.md** | 2,000 words | Phase-by-phase task breakdown | Developers, Project Mgrs |
| **QUICK_REFERENCE.md** | 2,500 words | Developer pocket guide + examples | Developers, Code Reviewers |
| **INIT_SUMMARY.md** | 3,000 words | Executive summary + FAQ | Stakeholders, Managers, All |
| **ARCHITECTURE_DIAGRAM.md** | 1,500 words | Visual flows + dependency graphs | All (reference) |
| **This file** | 500 words | Navigation guide | All |

---

## 🔍 Key Content Locations

### Scoring Formula
- **Quick start**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md#anomaly-score-formula)
- **Full details**: [ML_PIPELINE_INIT.md Section 2](ML_PIPELINE_INIT.md#2-anomaly-score-formula-0100)
- **Visual**: [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) (top section)

### Event Schema
- **Quick start**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md#sample-event-flow)
- **Full details**: [ML_PIPELINE_INIT.md Section 1](ML_PIPELINE_INIT.md#1-final-event-schema--derived-features)
- **Fields reference**: [ML_PIPELINE_INIT.md 1.1](ML_PIPELINE_INIT.md#11-unified-event-schema-ingestion-layer-output)

### Thresholds & Alerts
- **Quick reference**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md#key-thresholds)
- **Full details**: [ML_PIPELINE_INIT.md Section 3](ML_PIPELINE_INIT.md#3-thresholds--fallback-behavior)
- **Crash triggers**: [ML_PIPELINE_INIT.md 3.2](ML_PIPELINE_INIT.md#32-crash-report-triggering)

### Module Specifications
- **Overview**: [ML_PIPELINE_INIT.md Section 4](ML_PIPELINE_INIT.md#4-module-by-module-implementation-plan)
- **Commit order**: [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md#phase-1-foundation-estimated-9-12-hours)
- **Dependencies**: [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md#development-module-dependency-graph)

### Testing Strategy
- **Overview**: [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)
- **Coverage map**: [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md#testing-coverage-map)
- **Details**: [ML_PIPELINE_INIT.md Section 5](ML_PIPELINE_INIT.md#5-testing-approach)

### Development Constants
- **All constants**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md#development-constants)
- **Copy-paste ready**: Python code block for `app/detect/anomaly.py`

### API Examples
- **Response samples**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md#api-response-examples)
- **Endpoint specs**: [ML_PIPELINE_INIT.md 4.2 (Module 5)](ML_PIPELINE_INIT.md#module-5-apiroutespy-5th-priority)

---

## 📋 Design Decisions with Rationales

| Decision | Rationale | Documentation |
|----------|------------|-----------------|
| **40-40-20 scoring split** | ML needs warm-up; heuristics more reliable; rules catch exceptions | [INIT_SUMMARY.md](INIT_SUMMARY.md#1-40-40-20-scoring-weighting) |
| **Warm-up period (100 events)** | Sweet spot for baseline computation | [INIT_SUMMARY.md](INIT_SUMMARY.md#2-warm-up-period-first-100-events) |
| **Fallback to heuristics (< 5 events)** | ML unreliable on sparse data | [INIT_SUMMARY.md](INIT_SUMMARY.md#3-fallback-to-heuristics-on-sparse-data--5-eventswindow) |
| **Adaptive baselines** | Services have diurnal patterns | [INIT_SUMMARY.md](INIT_SUMMARY.md#4-adaptive-baselines-rolling-windows) |
| **Separate heuristics from rules** | Rules are domain-specific; heuristics are generalizable | [INIT_SUMMARY.md](INIT_SUMMARY.md#5-separate-heuristics-from-rules) |

---

## ⏱️ Development Timeline

```
Phase 1 (9-12h):     Schemas → Parser → Ingest
                     └─ Commit 1-3

Phase 2 (10-13h):    Anomaly Detection ⭐ → API Routes
                     └─ Commit 4-5

Phase 3 (5-7h):      Report Generator → Demo Ready
                     └─ Commit 6-7

Phase 4 (2-3h):      Code review + validation + polish
                     
Total: 22-30 hours (2-3 days)
```

**Details**: [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)

---

## ❓ Quick Lookups

**Q: What's the anomaly score formula?**  
A: See [QUICK_REFERENCE.md](QUICK_REFERENCE.md#anomaly-score-formula)

**Q: When does a crash report get triggered?**  
A: See [QUICK_REFERENCE.md](QUICK_REFERENCE.md#crash-report-triggers)

**Q: What are the development constants?**  
A: See [QUICK_REFERENCE.md](QUICK_REFERENCE.md#development-constants)

**Q: What's the event schema?**  
A: See [ML_PIPELINE_INIT.md Section 1.1](ML_PIPELINE_INIT.md#11-unified-event-schema-ingestion-layer-output)

**Q: How do modules depend on each other?**  
A: See [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md#development-module-dependency-graph)

**Q: What should I implement first?**  
A: See [IMPLEMENTATION_CHECKLIST.md Phase 1](IMPLEMENTATION_CHECKLIST.md#phase-1-foundation-estimated-9-12-hours) → Commit 1 (schemas)

**Q: How many tests do I need per module?**  
A: See [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md#testing-coverage-map)

**Q: What's the performance target?**  
A: See [ML_PIPELINE_INIT.md Section 6.3](ML_PIPELINE_INIT.md#63-performance-slos)

---

## 📖 Reading Recommendations

### **First-Time Visitor (30 minutes)**
1. This file (2 min)
2. [INIT_SUMMARY.md](INIT_SUMMARY.md) - first half (10 min)
3. [QUICK_REFERENCE.md](QUICK_REFERENCE.md#anomaly-score-formula) - formula section (5 min)
4. [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) - first diagram (10 min)
5. **Done!** You now understand the project.

### **Developer Starting Coding (2-3 hours)**
1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - all sections (30 min)
2. [ML_PIPELINE_INIT.md](ML_PIPELINE_INIT.md) Sections 1-3 (60 min)
3. [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) - your commit (30 min)
4. Start Commit 1 from [IMPLEMENTATION_CHECKLIST.md Phase 1](IMPLEMENTATION_CHECKLIST.md#commit-1-core-schemas--30m)

### **Code Reviewer (45 minutes)**
1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md#development-constants) - constants (5 min)
2. [ML_PIPELINE_INIT.md Section 4](ML_PIPELINE_INIT.md#4-module-by-module-implementation-plan) - module being reviewed (15 min)
3. [ML_PIPELINE_INIT.md Section 5](ML_PIPELINE_INIT.md#5-testing-approach) - test expectations (10 min)
4. Review code against spec

### **Stakeholder Brief (15 minutes)**
1. This file (2 min)
2. [INIT_SUMMARY.md](INIT_SUMMARY.md) - summary sections only (8 min)
3. [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) - top diagram only (5 min)

---

## 🚀 Getting Started Checklist

- [ ] **Step 1**: Skim this document (2 min)
- [ ] **Step 2**: Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (15 min)
- [ ] **Step 3**: Read [ML_PIPELINE_INIT.md Sections 1-3](ML_PIPELINE_INIT.md) (45 min)
- [ ] **Step 4**: Review [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) (20 min)
- [ ] **Step 5**: Get stakeholder sign-off on scoring formula
- [ ] **Step 6**: Start Commit 1 from the checklist
- [ ] **Ready to code!** 🎉

---

## 📞 When You Need Help

**Question about anomaly scoring?**  
→ [QUICK_REFERENCE.md](QUICK_REFERENCE.md) + [ML_PIPELINE_INIT.md Section 2](ML_PIPELINE_INIT.md#2-anomaly-score-formula-0100)

**Confused about which module to implement?**  
→ [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md#phase-1-foundation-estimated-9-12-hours) (start with Commit 1)

**Need implementation details for a module?**  
→ [ML_PIPELINE_INIT.md Section 4.2](ML_PIPELINE_INIT.md#42-module-specifications)

**Don't understand module dependencies?**  
→ [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md#development-module-dependency-graph)

**Need testing guidance?**  
→ [ML_PIPELINE_INIT.md Section 5](ML_PIPELINE_INIT.md#5-testing-approach)

**Blocked on a design decision?**  
→ [INIT_SUMMARY.md](INIT_SUMMARY.md#💡-key-design-decisions--rationales)

---

## 📊 Project Status

| Phase | Status | Documentation |
|-------|--------|-----------------|
| **Design** | ✅ Complete | All docs (5 files) |
| **Specification** | ✅ Complete | ML_PIPELINE_INIT.md |
| **Implementation Planning** | ✅ Complete | IMPLEMENTATION_CHECKLIST.md |
| **Development** | ⏳ Pending | Ready to start Commit 1 |
| **Testing** | ⏳ Pending | Test plan defined |
| **Demo** | ⏳ Pending | Demo scenarios documented |

---

## 🎯 Next Step

**→ Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (10 min) to understand the scoring formula**

Then follow the "Developer Starting Coding" path above to begin implementation.

---

**Last Updated**: 2026-03-20  
**Maintainer**: ML Engineer (Copilot)  
**For**: Log-Whisperer Hackathon MVP
