# SentinelStack — Risk Quantification & Mathematical Model Specification v1.1

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.1  
**Document Status:** Reconciled Analytical / Mathematical Engineering Baseline  
**Baselines:** SRS v2.1 • SDD v1.2 • Data Dictionary & Database Schema v1.1 • ML Dataset & Training Specification v1.0  
**Implementation Baseline:** `ciphernet01/sentinelstack`  
**Primary Current Risk Service:** `src/services/cyberRiskQuantification.service.ts`

---

## 1. Purpose

This document defines the authoritative mathematical contract for SentinelStack's PS 26105 risk pipeline.

Version 1.0 defined the intended quantitative architecture:

```text
Point-in-time evidence
    -> likelihood
    -> frequency
    -> severity
    -> aggregate loss distribution
    -> EAL / VaR / Financial Exposure
    -> Risk Score
    -> risk drivers
    -> scenario delta
    -> mitigation value
    -> investment optimization
```

Version 1.1 keeps that contract but reconciles it with the **actual SentinelStack implementation**.

The current repository already computes financial exposure, likelihood, EAL, VaR-like output, scenarios and budget allocation, but its current implementation is simplified. In particular, the repository currently uses:

- hand-tuned likelihood contributions;
- a point impact value rather than a full severity distribution;
- a VaR proxy rather than an empirical loss-distribution quantile;
- fixed scenario EAL multipliers;
- a greedy risk-reduction/cost optimizer.

Those mechanisms are treated as **transitional implementation**, not as the final PS 26105 mathematical implementation.

---

## 2. Authority Boundary

### 2.1 Authoritative values

Only the governed Risk Quantification Engine may author authoritative:

- incident frequency;
- probability used by the risk model;
- financial severity parameters;
- aggregate annual loss distribution;
- Expected Annual Loss (EAL);
- Value at Risk (VaR);
- Financial Exposure;
- SentinelStack Product Risk Score;
- scenario deltas;
- optimization results.

### 2.2 ML responsibility

ML models estimate uncertain inputs such as:

- probability of exploitation/incident within a defined horizon;
- severity conditioning parameters;
- temporal trends;
- anomalies.

ML outputs must be versioned and accompanied by calibration/uncertainty metadata.

### 2.3 LLM responsibility

The LLM/NLQ layer may:

- explain verified risk values;
- summarize trends;
- translate technical drivers into business language;
- describe verified recommendations;
- invoke approved read-only analytical tools.

The LLM must not:

- calculate authoritative EAL/VaR/Risk Score values itself;
- overwrite stored metrics;
- invent financial assumptions;
- create unsupported evidence;
- turn an unavailable metric into a precise-looking value.

---

## 3. Design Invariants

| Invariant | Requirement |
|---|---|
| Point-in-time correctness | A calculation uses only state available at the declared assessment time unless a backtest/simulation explicitly defines another temporal policy. |
| No double counting | Multiple alerts/vulnerabilities on one asset are not automatically treated as independent loss events. |
| Separation of frequency and severity | Incident occurrence and monetary consequence are modeled separately where data supports it. |
| Distribution-first risk | Tail risk is calculated from an annual aggregate loss distribution, not from a fixed impact multiplier. |
| Reproducibility | Same state + same model bundle + same simulation configuration must produce equivalent deterministic outputs within declared numerical tolerance. |
| Explicit uncertainty | Weak data, out-of-distribution states and missing business parameters reduce confidence or block authoritative calculation where necessary. |
| Scenario isolation | Scenario calculations are mutations of a baseline state and never modify production state. |
| Optimization integrity | Portfolio cost cannot exceed budget and dependencies/incompatibilities must be enforced. |
| Versioned mathematics | Changes to formulas, mappings, parameters or model transformations create a new calculation/model version. |
| Human accountability | Risk acceptance and consequential security-investment decisions remain human decisions. |

---

## 4. Canonical Calculation Contract

### 4.1 End-to-end pipeline

```text
X_t = Canonical enterprise state at time t
  |
  +--> likelihood model --> p_h, confidence, uncertainty
  |
  +--> frequency model --> lambda
  |
  +--> financial severity model --> L
  |
  +--> frequency + severity aggregation --> S
  |
  +--> deterministic metrics
  |       |
  |       +--> EAL = E[S]
  |       +--> VaR_alpha = Quantile_alpha(S)
  |       +--> Financial Exposure
  |
  +--> Risk Score (0..100)
  |
  +--> Risk Driver Attribution
  |
  +--> Scenario State Mutation
  |       |
  |       +--> rerun same pipeline
  |       +--> Delta EAL / VaR / Exposure / Score
  |
  +--> Investment Option Valuation
  |
  +--> Constrained Optimization
          |
          +--> selected portfolio
          +--> spend
          +--> residual risk
          +--> modeled reduction
          +--> ROSI / cost-benefit
```

### 4.2 Mathematical notation

| Symbol | Meaning |
|---|---|
| `t` | assessment/scoring timestamp |
| `H` | probability evaluation horizon in years |
| `p_H` | probability of at least one target event within horizon `H` |
| `lambda` | annualized event frequency |
| `N` | annual incident count |
| `L` | loss from one incident |
| `S` | aggregate annual loss |
| `EAL` | expected annual loss |
| `VaR_alpha` | alpha-quantile of annual aggregate loss |
| `CE` | normalized control effectiveness |
| `R` | product Risk Score |
| `DeltaX` | baseline metric minus scenario metric |

---

## 5. Input State Model

The calculation engine receives a canonical state assembled from:

### Security evidence

- CVE / vulnerability state
- CVSS
- EPSS
- KEV status
- exploit availability
- patch state
- vulnerability age
- SIEM signals
- EDR signals
- IAM signals
- CSPM signals
- threat-intelligence activity
- confirmed incidents

### Business context

- organization
- business unit
- service
- asset
- service criticality
- business criticality
- dependency relationships
- revenue dependency
- downtime cost
- maximum tolerable downtime
- data sensitivity
- regulatory/legal exposure assumptions

### Control context

- control definition
- coverage
- configuration strength
- effectiveness
- implementation state
- evidence freshness
- relevant incidents/control failures

### Model context

- approved likelihood model
- approved severity/frequency model
- score mapping version
- parameter bundle
- feature schema version
- assessment timestamp

---

## 6. Likelihood / Incident Frequency Model

### 6.1 Probability contract

For an event class `i`:

```text
p_H,i = P(event_i occurs within horizon H | X_t)
```

Example horizon:

```text
H = 30 / 365 years
```

for a 30-day prediction window.

### 6.2 Annualization

For an estimated probability of at least one event within horizon `H`:

```text
lambda_i = -ln(1 - p_H,i) / H
```

provided the probability is interpreted as arising from a Poisson-like event process and the transformation is approved for the event class.

For small probabilities, the approximation:

```text
lambda_i ≈ p_H,i / H
```

may be used as a documented approximation.

The system must record which conversion policy was applied.

### 6.3 Likelihood features

Potential predictors:

- CVSS;
- EPSS;
- KEV flag;
- exploit availability;
- vulnerability age;
- patch state;
- internet exposure;
- threat activity;
- telemetry activity;
- MFA/control coverage;
- EDR/control effectiveness;
- asset criticality;
- service dependency context.

### 6.4 Model hierarchy

The initial implementation should maintain a transparent baseline and challenger architecture:

```text
Baseline
  Logistic / GLM

Challenger
  XGBoost / gradient-boosted tabular model

Promotion gate
  Temporal validation
  + calibration
  + stability
  + attribution review
  + drift plan
```

The production model is whichever candidate passes the declared validation and governance gate.

### 6.5 Important correction from the current repository

The current `cyberRiskQuantification.service.ts` does **not** yet implement a calibrated likelihood model. It calculates likelihood by summing hand-tuned components such as CVSS, EPSS, exploit availability, vulnerability age and telemetry, then applying exposure/business/control multipliers.

That code is therefore classified as:

> **Risk Model v0.x compatibility baseline**

and must not be described in product documentation as a production-calibrated ML probability model.

---

## 7. Control Effectiveness Model

### 7.1 Canonical control effectiveness

For a control `k`:

```text
CE_k = Coverage_k × Effectiveness_k
```

with both components normalized to `[0,1]`.

For an asset, an initial aggregate may be:

```text
CE_asset = WeightedAggregate(CE_1 ... CE_n)
```

The aggregation weight must be versioned.

### 7.2 Target behavior

Control effectiveness should influence relevant model mechanisms rather than simply subtracting a fixed percentage from every risk.

Examples:

- MFA reduces unauthorized credential-use pathway likelihood.
- EDR primarily affects endpoint compromise detection/response and may reduce severity or containment time.
- Segmentation affects propagation/exposure pathways.
- Backup/recovery controls primarily affect loss severity rather than initial compromise probability.

### 7.3 No universal control multiplier

A single statement such as:

```text
EAL × 0.78
```

must not become the permanent representation of MFA, segmentation or EDR effectiveness.

Control transformations must be scoped to the threat pathway and justified by the model/parameter bundle.

---

## 8. Financial Impact / Severity Model

### 8.1 Loss decomposition

For one incident:

```text
L =
    DirectLoss
  + BusinessInterruption
  + ResponseRecovery
  + RegulatoryLegal
  + OtherModeledConsequences
```

### 8.2 Direct loss

Potential drivers:

- records/data affected;
- transaction exposure;
- fraud/payment impact;
- asset/service-specific loss parameters.

### 8.3 Business interruption

A deterministic starting model:

```text
DowntimeLoss = CostPerHour × DowntimeHours
```

where downtime hours may itself be modeled as a distribution when empirical data exists.

### 8.4 Response/recovery

Can include:

- incident response;
- forensic work;
- remediation;
- infrastructure recovery;
- customer/support operations.

### 8.5 Regulatory/legal

The model may use:

- approved organization assumptions;
- event-class parameters;
- incident history;
- deployment-specific legal/regulatory estimates.

The system must distinguish estimates from observed realized losses.

### 8.6 Severity distributions

Where data supports statistical estimation, severity should be modeled as:

```text
L_i ~ SeverityDistribution_i(parameters | context)
```

Candidate families can include:

- empirical/bootstrap distributions;
- lognormal;
- gamma;
- Pareto/tail distributions;
- mixture distributions.

The production family must be selected based on empirical fit and tail validation rather than preference alone.

---

## 9. Aggregate Annual Loss Distribution

### 9.1 Event-class aggregation

For event class `i`:

```text
S_i = Σ(j=1..N_i) L_i,j
```

Enterprise annual loss:

```text
S = Σ_i S_i
```

after dependency/correlation and anti-double-counting rules are applied.

### 9.2 Monte Carlo procedure

For simulation `m`:

1. Sample incident count `N_i` for each event class.
2. Sample incident severity `L_i,j`.
3. Apply approved correlation/dependency logic.
4. Aggregate losses.
5. Store annual loss `S^(m)`.

Repeat for `M` simulations.

Reference production setting:

```text
M >= 50,000
```

Development environments may use fewer simulations when clearly marked.

### 9.3 EAL

```text
EAL_hat = (1/M) Σ S^(m)
```

### 9.4 VaR

```text
VaR_alpha = Quantile_alpha(S)
```

Reference dashboard values:

```text
VaR_95
VaR_99
```

VaR is a percentile threshold of the modeled annual loss distribution. It is not a maximum possible loss and not a guarantee.

### 9.5 Monte Carlo confidence

The system should record:

- simulation count;
- random seed policy;
- simulation version;
- quantile method;
- confidence/error metadata where calculated.

This prevents a dashboard from displaying a VaR number without the context needed to interpret its stability.

---

## 10. Financial Exposure

Financial Exposure is a reporting concept distinct from EAL and VaR.

The implementation must expose at minimum:

```text
Financial Exposure
Expected Annual Loss
VaR 95
VaR 99 (when enabled)
```

The system must not label these as interchangeable.

Recommended reporting semantics:

- **Financial Exposure:** monetary exposure envelope for the selected scope;
- **EAL:** expected annual aggregate loss;
- **VaR:** selected percentile of annual aggregate loss.

The exact Financial Exposure formula must be versioned and must state whether it represents:

- current modeled gross exposure;
- residual exposure;
- a bounded reporting measure;
- or another declared quantity.

---

## 11. Product Risk Score

### 11.1 Purpose

Risk Score is a SentinelStack prioritization index.

It is **not**:

- a regulatory score;
- a guarantee;
- a replacement for EAL/VaR;
- a direct statement that one country or sector is inherently risky.

### 11.2 Score design

The score is normalized:

```text
0 <= R <= 100
```

A versioned mapping may combine:

- normalized financial exposure;
- incident likelihood;
- control gap;
- criticality;
- data confidence.

The mapping must be documented and stable within a model version.

### 11.3 Score traceability

Every material score must be decomposable to:

```text
scope
+
input state
+
calculation bundle
+
score model version
+
driver contributions
```

---

## 12. Risk Driver Attribution

### 12.1 Driver definition

A driver is a factor that materially contributes to the calculated risk metric.

Examples:

```text
Internet exposure
High exploitation probability
Active KEV vulnerability
Weak privileged MFA coverage
High service downtime cost
Critical business dependency
High data sensitivity
Relevant threat activity
```

### 12.2 Attribution contract

For a selected metric:

```text
DriverContribution_i
```

must be tied to the same model/calculation version used for the result.

The UI should not display a “top driver” merely because it is a large asset row.

### 12.3 Expected implementation

Use:

- SHAP/feature attribution for approved ML models where applicable;
- sensitivity analysis for deterministic parameters;
- scenario-based contribution analysis for control/business parameters.

The attribution method must be stated alongside the driver.

---

## 13. Continuous Recalculation

### 13.1 Material events

Priority recalculation should be triggered by events such as:

- critical vulnerability becoming actively exploited;
- critical vulnerability added to an exposed asset;
- significant control disablement;
- material control coverage change;
- significant threat-intelligence change;
- service/asset added or retired;
- material business criticality/dependency change;
- material financial-parameter change.

### 13.2 Routine events

Less material updates may enter:

```text
scheduled / batch recalculation
```

Reference target:

```text
High-severity material recalculation <= 15 minutes
Routine recalculation <= 24 hours
```

subject to the SDD capacity/operating assumptions.

### 13.3 Snapshot rule

Every material recalculation creates a new persisted result.

Historical assessments are never rewritten to reflect the newest state.

---

## 14. Scenario Engine

### 14.1 Scenario semantics

A scenario is:

```text
Baseline State
+
Declared Mutations
=
Scenario State
```

The same risk pipeline is then executed against the scenario state.

### 14.2 Scenario delta

```text
DeltaEAL      = EAL_baseline      - EAL_scenario
DeltaVaR      = VaR_baseline      - VaR_scenario
DeltaExposure = Exposure_baseline - Exposure_scenario
DeltaScore    = Score_baseline    - Score_scenario
```

Positive delta indicates a modeled reduction.

### 14.3 Standard scenario classes

- control coverage change;
- patch/remediation;
- remediation delay;
- threat stress;
- dependency change;
- financial parameter sensitivity;
- selected asset/service mitigation.

### 14.4 Current repository correction

The repository currently defines scenarios such as MFA, patching, network segmentation, EDR rollout and cloud hardening using fixed EAL multipliers.

Version 1.1 replaces this as the target:

```text
Scenario EAL = RiskEngine(ScenarioState)
```

where the state change modifies relevant vulnerability/control/exposure/frequency/severity parameters and the risk engine recomputes the resulting loss distribution.

---

## 15. Mitigation Recommendation Quantification

A recommendation becomes optimization-eligible only if the system can establish:

```text
valid action
+
applicability
+
cost
+
affected scope
+
dependency constraints
+
model-derived risk reduction
+
confidence/evidence
```

### 15.1 Recommendation pipeline

```text
Risk Driver
    ↓
Candidate Action
    ↓
Applicability Check
    ↓
Scenario State Mutation
    ↓
Risk Recalculation
    ↓
Delta EAL / Delta VaR / Delta Exposure
    ↓
Cost + Dependencies + Confidence
    ↓
Recommendation
    ↓
Optimizer Candidate
```

### 15.2 Cost-effectiveness

Basic metrics:

```text
RiskReductionPerRupee = DeltaEAL / Cost
```

and:

```text
ROSI = (ModeledRiskReduction - InvestmentCost) / InvestmentCost
```

ROSI must always identify:

- risk metric used;
- model version;
- cost basis;
- horizon;
- scenario assumptions.

---

## 16. Investment Optimization

### 16.1 Baseline optimization problem

For binary options:

```text
maximize Σ (DeltaEAL_i × x_i)

subject to:

Σ Cost_i × x_i <= Budget

x_i ∈ {0,1}
```

with additional constraints for:

- dependencies;
- mutually exclusive options;
- prerequisite controls;
- applicability;
- implementation capacity;
- mandatory options where policy requires them.

### 16.2 Current repository correction

The existing implementation uses a greedy ratio:

```text
estimated risk reduction / cost
```

and iterates through sorted candidates.

That is useful as a fallback, but it is **not a general constrained optimization solver** and cannot guarantee global optimality when dependencies/interactions exist.

### 16.3 Target optimizer

Use a true constrained optimization implementation such as:

- integer linear programming;
- 0/1 knapsack where appropriate;
- OR-Tools;
- another tested solver.

The optimizer output must persist:

- input baseline assessment;
- budget;
- candidate set;
- constraint set;
- optimizer version;
- selected options;
- unselected alternatives where useful;
- spend;
- modeled risk reduction;
- residual risk;
- objective value;
- feasibility/status.

---

## 17. Investment-vs-Risk-Reduction Curve

The curve is generated by evaluating feasible investment portfolios across increasing budgets.

For budget values:

```text
B_1 < B_2 < ... < B_n
```

calculate:

```text
OptimalRisk(B_i)
```

and:

```text
RiskReduction(B_i)
```

The UI may then plot:

```text
Budget
   vs
Modeled Risk Reduction
```

This is decision-support evidence, not a prediction of organizational losses.

The curve must preserve:

- candidate set;
- optimizer version;
- scenario/model bundle;
- budget;
- objective;
- constraints.

---

## 18. Geographic Context and the Interactive Globe

The interactive globe is a **contextual navigation and scoping layer**, not an independent mathematical risk model.

### 18.1 Valid geographic uses

Geography may be used to:

- scope the organization's asset footprint;
- show cloud/asset/service locations;
- filter enterprise risk to a geographic scope;
- show where modeled financial exposure is concentrated;
- contextualize relevant threat-intelligence signals;
- visualize dependency/blast-radius paths.

### 18.2 Important rule

The system must not infer:

```text
Country = high cyber risk
```

from the mere existence of a node, threat signal or geopolitical association.

A displayed geographic risk value must instead represent something explicitly modeled, such as:

```text
"Modeled exposure associated with organization assets/services in this scope."
```

### 18.3 Recommended globe data chain

```text
Geographic scope
   ↓
Organization assets/services
   ↓
Digital Twin relationships
   ↓
Risk Assessment
   ↓
EAL / VaR / Exposure / Drivers
```

The globe can therefore act as a **Digital Twin explorer** rather than decorative UI.

### 18.4 Blast-radius interaction

A selected asset/service may highlight:

```text
Asset
  ↓
Service
  ↓
Dependencies
  ↓
Business Unit
  ↓
Potentially affected assets/services
  ↓
Scenario financial impact
```

The exact impact remains the output of the risk engine.

---

## 19. Uncertainty and Data Coverage

Every material risk assessment should expose:

```text
confidence
coverage
assumptions
model_version
data_snapshot
```

### 19.1 Missing data

Examples:

- no business-impact parameter;
- stale EDR;
- missing asset-to-service mapping;
- unavailable threat source;
- insufficient historical severity data.

System behavior:

```text
Approved prior / bounded assumption
OR
limited-confidence result
OR
no authoritative result
```

but never:

```text
missing input -> silently zero
```

### 19.2 Out-of-distribution state

If the current environment differs materially from model training conditions:

- flag OOD;
- widen/qualify uncertainty where supported;
- use an approved fallback when defined;
- identify that stress scenarios may be outside learned patterns.

The system does not claim to predict black-swan events.

---

## 20. Current Implementation vs Target Mathematical State

| Area | Current repository | v1.1 target |
|---|---|---|
| Likelihood | Hand-tuned deterministic signal composition | Calibrated probabilistic model |
| Annual frequency | Embedded inside simplified likelihood | Explicit frequency model |
| Severity | Single asset impact amount | Statistical/empirical severity distribution |
| Aggregate loss | Asset-wise summation | Incident/event-class aggregate distribution |
| EAL | Impact × annual likelihood | Mean of aggregate annual loss distribution |
| VaR | Impact × likelihood multiplier proxy | Empirical quantile of simulated loss distribution |
| Risk Score | Legacy finding severity score elsewhere; enterprise score not yet fully implemented | Versioned enterprise/BU/service/asset score |
| Control effect | Average coverage × effectiveness + generic likelihood attenuation | Control/pathway-specific modeled transformations |
| Drivers | Top asset rows | Stored attribution/contribution |
| Scenarios | Fixed EAL multipliers | State mutation + full recalculation |
| Recommendation value | Fixed percentage EAL reduction | Scenario-derived delta |
| Optimizer | Greedy reduction/cost ratio | Constrained optimizer with dependencies |
| ROSI | Based on current modeled reduction/cost | Based on reproducible scenario/optimizer outputs |
| Uncertainty | Limited | First-class coverage/confidence/OOD |
| Model lineage | Not yet persisted in risk schema | Explicit model bundle/version |
| Calculation reproducibility | Assumptions JSON | Versioned calculation bundle + hash |

---

## 21. Implementation Architecture Mapping

The mathematical modules should eventually be separated from the current monolithic risk service.

Recommended logical services:

```text
src/services/risk/
├── stateBuilder.ts
├── likelihood/
│   ├── baseline.ts
│   ├── inference.ts
│   └── calibration.ts
├── frequency/
│   └── frequencyModel.ts
├── severity/
│   ├── severityModel.ts
│   └── impactComponents.ts
├── aggregation/
│   ├── monteCarlo.ts
│   └── dependencyAggregation.ts
├── scoring/
│   └── riskScore.ts
├── attribution/
│   └── riskDrivers.ts
├── scenarios/
│   └── scenarioEngine.ts
├── mitigation/
│   └── recommendationValue.ts
├── optimization/
│   └── portfolioOptimizer.ts
└── calculation/
    ├── calculationBundle.ts
    └── reproducibility.ts
```

The existing:

```text
src/services/cyberRiskQuantification.service.ts
```

should initially become a **compatibility façade/orchestrator**, rather than being replaced in one breaking change.

---

## 22. Persistence Requirements

Every material risk calculation should be reconstructable from:

```text
assessment_id
+
state/data snapshot
+
model bundle
+
parameter bundle
+
simulation configuration
+
calculation hash
```

Target persistence concepts:

- `RiskAssessment`
- `RiskAssessmentInput`
- `RiskDriver`
- `ModelVersion`
- `ModelPrediction`
- `CalculationArtifact`

These align with the reconciled Data Dictionary v1.1.

---

## 23. Calculation Hash

A calculation hash should be generated from a canonical representation of:

```text
organization scope
assessment timestamp
input snapshot identifiers/hashes
model versions
parameter bundle
simulation settings
scenario state
key configuration
```

Example conceptual representation:

```text
SHA256(
  canonical_json({
    scope,
    assessed_at,
    data_snapshot,
    model_bundle,
    parameters,
    simulation_config,
    scenario_state
  })
)
```

This hash provides reproducibility/provenance evidence.

It does not prove that the mathematical model is correct.

---

## 24. Validation Requirements

### 24.1 Deterministic checks

- probability in `[0,1]`;
- monetary values non-negative;
- valid currency;
- valid VaR confidence;
- risk score in `[0,100]`;
- scenario state does not mutate baseline;
- optimizer cost <= budget;
- dependency constraints satisfied.

### 24.2 Distribution checks

- simulated EAL converges within declared tolerance;
- VaR quantile is monotonic with alpha;
- higher simulation count provides stable estimates;
- severity fit/backtest is documented;
- tail behavior is reviewed.

### 24.3 Scope reconciliation

For compatible scopes:

```text
Enterprise risk
≈
sum of non-overlapping BU risk
```

within the declared dependency/correlation tolerance.

Exact equality is not assumed when shared dependencies require allocation.

### 24.4 Model validation

Production candidate requires:

- temporal holdout;
- discrimination metrics;
- calibration;
- stability;
- drift plan;
- explainability;
- limitation documentation.

---

## 25. Verification Tests

| Test | Expected result |
|---|---|
| RQ-01 | Same input/model bundle produces equivalent deterministic outputs. |
| RQ-02 | Probability stays within `[0,1]`. |
| RQ-03 | EAL equals the mean of simulated annual aggregate losses within tolerance. |
| RQ-04 | VaR equals the declared empirical quantile method. |
| RQ-05 | VaR_99 >= VaR_95 for the same distribution/configuration. |
| RQ-06 | Scenario execution does not mutate baseline state. |
| RQ-07 | Scenario delta equals baseline metric minus scenario metric. |
| RQ-08 | Recommendation is optimization-eligible only when modeled risk reduction and cost are valid. |
| RQ-09 | Optimizer never exceeds budget. |
| RQ-10 | Optimizer rejects/flags infeasible dependency combinations. |
| RQ-11 | Displayed drivers are backed by persisted attribution records. |
| RQ-12 | LLM response uses exact backend risk values where cited. |
| RQ-13 | Missing critical financial inputs cause uncertainty/limitation behavior. |
| RQ-14 | Model/version/calculation hash is persisted with each material assessment. |
| RQ-15 | Audit/hash verification detects modified analytical records. |
| RQ-16 | Geographic filtering changes scope only; it does not create unsupported country-risk claims. |

---

## 26. API Output Contract

A risk API response should expose at least:

```json
{
  "assessmentId": "risk-assessment-id",
  "assessedAt": "2026-09-29T00:00:00Z",
  "scope": {
    "type": "ENTERPRISE",
    "id": null
  },
  "metrics": {
    "financialExposure": 0,
    "eal": 0,
    "var95": 0,
    "var99": 0,
    "riskScore": 0
  },
  "uncertainty": {
    "confidence": 0,
    "coverage": 0,
    "limited": false
  },
  "model": {
    "riskModelVersion": "rq-1.1",
    "likelihoodModelVersion": "likelihood-0.1",
    "severityModelVersion": "severity-0.1"
  },
  "simulation": {
    "iterations": 50000,
    "seed": null
  },
  "drivers": [],
  "assumptions": [],
  "calculationHash": "..."
}
```

The current API may expose a compatibility subset while the backend migrates to this richer contract.

---

## 27. No-False-Precision Rules

SentinelStack must prefer:

```text
"Limited confidence: financial impact data is incomplete."
```

over:

```text
"₹3,47,28,913.42"
```

when the underlying evidence cannot support that precision.

The UI should distinguish:

- observed;
- modeled;
- assumed;
- stress-tested;
- low-confidence;
- out-of-distribution.

---

## 28. Model Governance

Every approved production model must have:

```text
Model Card
Training Data Snapshot
Feature Schema Hash
Label Policy
Temporal Validation
Calibration Results
Error Analysis
Limitations
Approval Record
Deployment Record
Monitoring Record
Rollback Target
```

Historical assessments must retain the model version used to create them.

---

## 29. Engineering Migration Plan

### Stage 1 — Compatibility façade

Keep:

```text
CyberRiskQuantificationService
```

as the external service contract.

Internally delegate to new risk modules.

### Stage 2 — Canonical state builder

Extract:

```text
Database state
-> CanonicalRiskState
```

including point-in-time semantics.

### Stage 3 — Likelihood

Replace hand-tuned likelihood with a governed baseline model, initially transparent and calibrated.

### Stage 4 — Severity

Introduce event-class severity distributions and explicit incident frequency.

### Stage 5 — Aggregate loss

Implement Monte Carlo annual loss simulation.

### Stage 6 — True VaR

Replace the existing VaR proxy with empirical quantiles from the aggregate loss distribution.

### Stage 7 — Drivers

Persist model/sensitivity attribution.

### Stage 8 — Scenario engine

Replace fixed multipliers with state mutation + full risk recomputation.

### Stage 9 — Optimizer

Replace greedy selection with a constrained solver.

### Stage 10 — Governance

Persist model versions, calculation bundles, hashes, evidence and analytical audit events.

---

## 30. Traceability to SRS

| SRS | Mathematical realization |
|---|---|
| FR-04 | Calibrated likelihood model |
| FR-05 | Statistical/ML-supported financial severity model |
| FR-06 | Aggregate loss, EAL, VaR, Financial Exposure |
| FR-06A | Historical assessment/snapshot persistence |
| FR-06B | Versioned Risk Score |
| FR-07 | Criticality/dependency-aware state and aggregation |
| FR-08 | Control effectiveness model |
| FR-09 | Risk driver attribution |
| FR-10 | Predictive likelihood/anomaly/trend models |
| FR-11 | Quantified mitigation recommendation |
| FR-12 / FR-12A | Grounded AI/business translation |
| FR-13 | Scenario state mutation and delta |
| FR-14 | Budget |
| FR-15 | Candidate investment modeling |
| FR-16 | Constrained optimization |
| FR-17 | ROSI / strategic review |
| FR-18 | Cost-benefit analysis |
| FR-19 | Investment-vs-risk-reduction curve |
| FR-20–22 | Executive/technical/drill-down outputs |
| NFR-03A | Recalculation semantics |
| NFR-05 | Explainability, uncertainty, model governance |
| NFR-08 | Calculation/audit hashes |
| NFR-10 | Source lineage and retention preservation |

---

## 31. Definition of Done

Risk Model v1.1 is implemented when:

- [ ] Current simplified risk code is explicitly identified as transitional.
- [ ] Point-in-time canonical state is implemented.
- [ ] Likelihood model is versioned and calibrated.
- [ ] Frequency and severity are separated.
- [ ] Aggregate annual loss distribution is simulated.
- [ ] EAL is derived from the simulated distribution.
- [ ] VaR is an actual declared quantile.
- [ ] Risk Score is separately versioned from legacy finding severity.
- [ ] Drivers are persisted and attributable.
- [ ] Scenarios mutate state and rerun the pipeline.
- [ ] Recommendation reduction comes from scenario/risk-engine output.
- [ ] Optimization enforces budget and dependencies.
- [ ] ROSI and cost-effectiveness are reproducible.
- [ ] Model uncertainty and coverage are visible.
- [ ] Calculation/version/hash lineage is persisted.
- [ ] Historical assessments remain interpretable.
- [ ] The globe is wired as a geographic risk/digital-twin scope, not a decorative risk claim.
- [ ] RQ-01 through RQ-16 validation tests pass.

---

## 32. Next Artifact

The next specification is:

**ML Dataset & Training Specification v1.1**

That document will reconcile the current repository interfaces with this mathematical contract and define the first trainable workload, dataset-to-inference path, feature schema, calibration artifact, model registry contract, and production promotion gate.
