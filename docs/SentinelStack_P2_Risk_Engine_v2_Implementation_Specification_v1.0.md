# SentinelStack — P2 Risk Engine v2 Implementation Specification v1.0

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.0  
**Document Status:** P2 Implementation Engineering Baseline  
**Repository:** `github.com/ciphernet01/sentinelstack`  
**Primary Current Risk Service:** `src/services/cyberRiskQuantification.service.ts`  
**Runtime:** Existing Express + TypeScript + Prisma/PostgreSQL  
**Date:** 29 September 2026  
**Baselines:** SRS v2.1 • SDD v1.2 • Data Dictionary v1.1 • Risk Model v1.1 • ML Spec v1.1 • API Contract v1.1 • P0/P1 Implementation Runbook v1.0

> **Purpose:** Turn the approved PS-26105 mathematical contract into an implementation plan for Risk Engine v2. This specification defines the calculation pipeline, module boundaries, current-to-target migration, formulas, persistence, tests, performance strategy and acceptance gates.

> **Authority:** Risk Engine v2 is the only component allowed to author authoritative EAL, VaR, Financial Exposure and SentinelStack Product Risk Score values. ML supplies estimates for uncertain variables. The LLM explains verified results and cannot replace the calculation engine.

---

# 1. Objective

P2 replaces the current simplified financial-risk calculation with the governed PS-26105 quantitative pipeline.

## 1.1 Current Implementation

The current `CyberRiskQuantificationService` uses:

```text
hand-tuned likelihood
+
point impact
+
EAL = impact × likelihood
+
VaR proxy = impact × likelihood-derived multiplier
+
fixed scenario multipliers
+
greedy recommendation selection
```

This remains useful as a migration baseline but is not the final Risk Engine v2.

## 1.2 P2 Target

```text
Point-in-time evidence
        |
        v
Context / control effectiveness
        |
        v
Event likelihood
        |
        v
Annualized frequency
        |
        v
Severity distribution
        |
        v
Dependency / correlation handling
        |
        v
Annual aggregate loss distribution
        |
        +--> EAL
        +--> VaR95
        +--> VaR99
        +--> Financial Exposure
        +--> Risk Score
        |
        v
Driver attribution
```

## 1.3 P2 Goal

At the end of P2, SentinelStack must be able to produce a reproducible authoritative risk assessment whose result is derived from:

```text
explicit state
+
versioned parameters
+
versioned model inputs
+
declared simulation configuration
```

and whose output is linked to a `RiskRun`.

---

# 2. Source Contract

P2 is governed by the Risk Quantification & Mathematical Model Specification v1.1.

Core mathematical chain:

```text
evidence
    ->
likelihood
    ->
frequency
    ->
severity
    ->
aggregate loss
    ->
EAL / VaR / exposure
    ->
risk score
```

The model specification also requires:

- point-in-time correctness;
- no double counting;
- separation of frequency and severity;
- distribution-first risk;
- scenario recomputation;
- reproducibility;
- explicit uncertainty.

---

# 3. P2 Entry Criteria

P2 should start only after P1 can provide:

```text
RiskRun
Risk input bundle
Input-state hash
Version metadata
Evidence/context snapshot
Job execution
RiskAssessment persistence
Tenant enforcement
Compatibility façade
```

The P2 engine should not rebuild these foundations.

It should consume them.

---

# 4. P2 Exit Criteria

P2 is complete when:

```text
[ ] Annual frequency is explicitly modeled
[ ] Severity is distributional
[ ] Aggregate annual loss is simulated
[ ] VaR is a quantile of the loss distribution
[ ] EAL is the mean of the annual loss distribution
[ ] Risk Score is versioned and decomposable
[ ] Shared services/dependencies do not cause uncontrolled double counting
[ ] Monte Carlo configuration is persisted
[ ] Fixed seeds reproduce development/test results
[ ] Driver inputs can be traced
[ ] Current API compatibility remains
[ ] Risk results are stored against RiskRun
[ ] Mathematical test suite passes
```

---

# 5. Architecture

## 5.1 Target Module Tree

```text
src/services/risk/
├── index.ts
├── riskRun.service.ts
├── evidenceContext.service.ts
├── likelihood.service.ts
├── frequency.service.ts
├── severity.service.ts
├── dependency.service.ts
├── lossDistribution.service.ts
├── riskScore.service.ts
├── driverAttribution.service.ts
├── riskAssessment.service.ts
├── assumptions.service.ts
├── calculationHash.service.ts
├── simulationConfig.service.ts
└── errors.ts
```

## 5.2 Responsibilities

| Module | Responsibility |
|---|---|
| `riskRun.service.ts` | Run identity, lifecycle and versions |
| `evidenceContext.service.ts` | Point-in-time enterprise state |
| `likelihood.service.ts` | Probability provider contract |
| `frequency.service.ts` | Probability-to-annual-frequency transformation |
| `severity.service.ts` | Severity distribution and loss components |
| `dependency.service.ts` | Service/dependency/correlation handling |
| `lossDistribution.service.ts` | Monte Carlo annual-loss simulation |
| `riskScore.service.ts` | Product Risk Score |
| `driverAttribution.service.ts` | Risk-factor contributions |
| `riskAssessment.service.ts` | Top-level orchestration + persistence |
| `assumptions.service.ts` | Approved financial/risk parameter loading |
| `calculationHash.service.ts` | Canonical hash generation |
| `simulationConfig.service.ts` | Monte Carlo configuration/version |

---

# 6. Authority Boundary

## 6.1 Risk Engine Owns

```text
annual frequency used in assessment
severity distribution composition
annual aggregate loss distribution
EAL
VaR
Financial Exposure
Product Risk Score
scenario deltas
portfolio residual risk
```

## 6.2 ML Provides

```text
p_h
severity conditioning parameters
forecast signals
anomaly signals
uncertainty
calibration metadata
```

## 6.3 LLM Provides

```text
explanation
summary
business translation
verified recommendation explanation
natural-language query
```

LLM does not write authoritative risk metrics.

---

# 7. Calculation State

Every risk calculation must use a state bundle.

## 7.1 Required State

```text
organization
scope
as_of
assets
services
business units
dependencies
vulnerabilities
controls
control effectiveness
telemetry-derived evidence
threat evidence
business impact parameters
model bundle
parameter bundle
simulation configuration
```

## 7.2 Immutable Calculation Context

The engine should receive:

```ts
type RiskCalculationContext = {
  organizationId: string;
  scopeType: "ENTERPRISE" | "BUSINESS_UNIT" | "SERVICE" | "ASSET";
  scopeId: string;
  asOf: Date;

  assets: RiskAssetContext[];
  services: RiskServiceContext[];
  dependencies: RiskDependencyContext[];
  vulnerabilities: RiskVulnerabilityContext[];
  controls: RiskControlContext[];
  telemetry: RiskTelemetryContext[];

  parameters: RiskParameterBundle;
  modelBundle: RiskModelBundle;
  simulation: SimulationConfig;

  inputStateHash: string;
};
```

The calculation code should treat the context as immutable.

---

# 8. Likelihood Model Interface

The Risk Engine should not hardcode one likelihood algorithm.

Use an interface:

```ts
interface LikelihoodProvider {
  estimate(input: LikelihoodInput): Promise<LikelihoodEstimate>;
}
```

## 8.1 Output

```ts
type LikelihoodEstimate = {
  eventClass: string;
  horizonDays: number;
  probability: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  calibrationVersion?: string;
  modelVersion: string;
  featureSetVersion?: string;
  ood: boolean;
  attribution?: Record<string, number>;
};
```

## 8.2 Phase P2 Provider

Before ML is promoted, a deterministic/statistical baseline provider may be used.

Example:

```text
DeterministicLikelihoodProvider
```

It must be versioned.

Later:

```text
CalibratedLikelihoodProvider
    ->
ML model
```

can be inserted without changing the Risk Engine API.

---

# 9. Frequency Transformation

If the likelihood provider supplies:

```text
p_h = probability of at least one target event in horizon H
```

the Risk Engine converts it to an annual event rate.

Let:

```text
H_y = horizon_days / 365
```

Then:

```text
lambda = -ln(1 - p_h) / H_y
```

Where:

```text
lambda >= 0
```

and:

```text
0 <= p_h <= 1
```

## 9.1 Boundary Handling

For:

```text
p_h = 0
```

return:

```text
lambda = 0
```

For:

```text
p_h near 1
```

the implementation must use a numerical safety rule and explicit uncertainty rather than allowing floating-point overflow.

Do not silently cap a near-certain event probability without recording the policy.

---

# 10. Event Classes

The enterprise should not be modeled as:

```text
every vulnerability = one incident
```

Instead, normalize security evidence into event classes such as:

```text
external exploitation
credential compromise
ransomware / destructive malware
cloud compromise
data exposure
privilege escalation
third-party compromise
availability attack
```

The exact taxonomy may evolve.

The critical requirement is that multiple signals can map to one modeled incident class without being blindly summed as independent losses.

---

# 11. Severity Modeling

## 11.1 Severity Variable

Let:

```text
L = loss severity for one cyber incident
```

Loss is represented in the organization’s configured currency.

## 11.2 Loss Components

Possible components:

```text
business interruption
incident response
recovery
direct financial loss
legal/regulatory
customer remediation
reputational impact
other approved consequence
```

## 11.3 Severity Distribution

The severity service can provide:

```text
parametric distribution
OR
empirical distribution
OR
bootstrap sample
```

The selected family must be versioned.

Possible families:

```text
Lognormal
Gamma
Empirical
Quantile-based conditional model
```

## 11.4 Component Composition

For incident `j`:

```text
L_j =
    downtime_j
  + response_j
  + recovery_j
  + regulatory_j
  + direct_j
  + other_j
```

only when components are defined to be non-overlapping.

## 11.5 Anti-Double-Counting Rule

A source report that already includes business interruption must not add another independent business interruption amount merely because a separate telemetry signal references downtime.

Every component needs a clear semantic owner.

---

# 12. Business Impact

Asset/service business context provides loss parameters.

Current repository inputs include values such as:

```text
downtimeCostPerHourInr
maxTolerableDowntimeHours
breachCostInr
recoveryCostInr
regulatoryExposureInr
reputationCostInr
```

P2 should normalize these into a governed parameter model rather than directly embedding database field arithmetic throughout the engine.

Example:

```ts
type BusinessImpactParameters = {
  downtimeCostPerHour: number;
  maxTolerableDowntimeHours: number;
  breachCost: number;
  recoveryCost: number;
  regulatoryExposure: number;
  reputationCost: number;
  currency: string;
  parameterVersion: string;
};
```

---

# 13. Control Effectiveness

Control effectiveness affects modeled likelihood and/or severity according to explicit model rules.

## 13.1 Current Implementation

The current service averages:

```text
coverage × effectiveness
```

across controls.

This is a useful starting point but must become a versioned function.

## 13.2 P2 Control Function

Recommended abstract interface:

```ts
interface ControlEffectivenessProvider {
  evaluate(input: ControlState): ControlEffectivenessResult;
}
```

Output:

```ts
type ControlEffectivenessResult = {
  enterpriseEffectiveness: number;
  assetEffectiveness: number;
  coverage: number;
  modelVersion: string;
  contributors: Array<{
    controlId: string;
    contribution: number;
  }>;
};
```

## 13.3 Guardrails

```text
0 <= coverage <= 1
0 <= effectiveness <= 1
0 <= combinedEffectiveness <= 1
```

Missing controls must not automatically mean:

```text
0 incidents
```

---

# 14. Dependency and Blast Radius

The Digital Twin contains business/service relationships.

Risk Engine v2 should model impact propagation through dependencies.

## 14.1 Example

```text
Customer API
    |
    v
Identity Service
    |
    v
Customer Database
```

A compromise affecting the identity service may affect multiple dependent services.

## 14.2 Dependency Weight

For eligible dependency:

```text
propagated_impact =
    base_impact
    × normalized_dependency_strength
```

The propagation rule must be explicit and versioned.

## 14.3 Primary Service Association

Where an asset belongs to multiple services, designate a primary association.

Secondary associations are included only when the relationship rules permit.

## 14.4 No Unbounded Multiplication

A dependency graph must not cause:

```text
same loss
    ->
service A
    ->
service B
    ->
service C
    ->
same loss counted three times
```

The engine requires a defined allocation/correlation rule.

---

# 15. Aggregate Annual Loss Distribution

For event class `i`:

```text
N_i = annual incident count
L_i,j = severity of incident j
```

Annual loss:

```text
S_i = Σ(j=1..N_i) L_i,j
```

Enterprise aggregate:

```text
S = Σ_i S_i
```

after dependency/correlation handling.

---

# 16. Monte Carlo Simulation

## 16.1 Reference Procedure

For each simulation `m`:

```text
1. Sample annual event counts N_i
2. For each event:
      sample severity L_i,j
3. Apply dependency/correlation rules
4. Aggregate all event losses
5. Store annual loss S^(m)
```

Repeat:

```text
M simulations
```

## 16.2 Simulation Count

The mathematical baseline specifies:

```text
production-grade reference minimum:
M >= 50,000
```

Development may use fewer simulations, but the configuration must clearly state that the result is development-grade.

Example:

```json
{
  "simulationCount": 50000,
  "seed": 42,
  "samplingMethod": "MONTE_CARLO",
  "configVersion": "mc-v1"
}
```

## 16.3 Reproducibility

For deterministic testing:

```text
same input
+
same seed
+
same configuration
+
same model bundle
```

must produce equivalent results.

Production execution may use controlled parallel random streams, but the implementation must still record the simulation configuration.

---

# 17. EAL

Expected Annual Loss:

```text
EAL = E[S]
```

Simulation estimate:

```text
EAL_hat = (1/M) Σ_m S^(m)
```

## 17.1 Acceptance

The result must be:

```text
>= 0
```

and expressed in the configured currency.

## 17.2 Convergence

Development tests should compare:

```text
M = 10k
M = 25k
M = 50k
```

or another declared sequence.

The goal is to verify that the estimate stabilizes within a declared tolerance for deterministic fixtures.

---

# 18. VaR

VaR is:

```text
VaR_alpha = Quantile_alpha(S)
```

Examples:

```text
VaR95 = Quantile_0.95(S)
VaR99 = Quantile_0.99(S)
```

## 18.1 Explicit Meaning

VaR is:

- a percentile threshold;
- not maximum loss;
- not guaranteed upper bound;
- not a prediction of a specific event.

## 18.2 Implementation

After simulation:

```ts
const sortedLosses = losses.slice().sort((a, b) => a - b);
const var95 = empiricalQuantile(sortedLosses, 0.95);
const var99 = empiricalQuantile(sortedLosses, 0.99);
```

The quantile interpolation method must be versioned/tested.

Do not use the current:

```text
impact × clamp(likelihood × 2.2, ...)
```

formula as VaR v2.

---

# 19. Financial Exposure

Financial Exposure is a reporting envelope around modeled monetary risk.

For the executive view, expose at minimum:

```text
EAL
VaR95
VaR99
```

rather than collapsing the three into one indistinct metric.

The stored assessment must identify:

```text
which exposure metric
which calculation time
which model/parameter bundle
which confidence state
```

---

# 20. Product Risk Score

Risk Score is a SentinelStack product index.

It is not a regulatory score.

## 20.1 Components

The approved model defines:

```text
S_E = 100 × clamp(EAL / EAL_appetite, 0, 1)

S_L = 100 × P_annual(event or loss class)

S_C = 100 × (1 - CE_enterprise)
```

Then:

```text
RiskScore =
    w_E × S_E
  + w_L × S_L
  + w_C × S_C
```

subject to:

```text
w_E + w_L + w_C = 1
```

## 20.2 Configuration

Weights and risk appetite must be versioned.

Example:

```json
{
  "ealAppetite": 10000000,
  "weights": {
    "financial": 0.5,
    "likelihood": 0.3,
    "controls": 0.2
  },
  "version": "risk-score-v1"
}
```

These are configuration examples, not universal recommended values.

## 20.3 Output

Store:

```text
riskScore
riskScoreVersion
riskScoreComponents
riskScoreParameters
```

so the score can be reconstructed.

---

# 21. Risk Drivers

The current implementation returns high-EAL asset rows as `topRiskDrivers`.

P2 must separate:

```text
risk driver
```

from:

```text
high-risk asset
```

## 21.1 Driver Types

Examples:

```text
VULNERABILITY
EXPOSURE
THREAT
CONTROL
DEPENDENCY
BUSINESS_IMPACT
MODEL_SIGNAL
```

## 21.2 Driver Contract

```ts
type RiskDriver = {
  id: string;
  type: string;
  entityRef: string;
  name: string;
  contributionToEal?: number;
  contributionToVaR?: number;
  contributionToScore?: number;
  direction: "INCREASES_RISK" | "REDUCES_RISK";
  confidence: string;
  evidenceRefs: string[];
};
```

## 21.3 Attribution

Attribution may initially use controlled counterfactuals.

Example:

```text
baseline EAL = 10M

remove exposure factor
    ->
counterfactual EAL = 7M

driver contribution ≈ 3M
```

More advanced model-based attribution can later use SHAP or another validated method.

The method must be stored with the result.

---

# 22. Scenario Compatibility

Although scenarios are a later P4 workstream, P2 must expose a reusable calculation API.

Recommended:

```ts
calculateRisk(context: RiskCalculationContext): Promise<RiskCalculationResult>
```

This enables:

```text
baseline context
     ->
calculateRisk()

scenario context
     ->
calculateRisk()
```

without two separate formula implementations.

---

# 23. Calculation Result Contract

```ts
type RiskCalculationResult = {
  eal: number;
  var95: number;
  var99: number;
  financialExposure: number;
  riskScore: number;

  lossDistributionSummary: {
    simulationCount: number;
    mean: number;
    median: number;
    q90: number;
    q95: number;
    q99: number;
    maxSimulated: number;
  };

  frequencySummary: {
    byEventClass: Array<{
      eventClass: string;
      annualFrequency: number;
    }>;
  };

  controlEffectiveness: number;
  drivers: RiskDriver[];

  uncertainty: {
    confidenceLevel: string;
    coverage: Record<string, number>;
    warnings: string[];
    ood: boolean;
  };

  versions: {
    riskEngine: string;
    parameters: string;
    modelBundle: string;
    score: string;
    simulation: string;
  };

  inputStateHash: string;
  resultHash: string;
};
```

---

# 24. Persistence

P2 consumes P1 persistence and writes:

```text
RiskRun
RiskAssessment
RiskDriver
ModelPrediction references
Evidence references
```

## 24.1 Assessment Fields

Minimum authoritative persistence:

```text
riskRunId
scope
asOf
currency
eal
var95
var99
financialExposure
riskScore
controlEffectiveness
uncertainty
calculationHash
versions
```

## 24.2 Simulation Metadata

Persist:

```text
simulationCount
sampling method
seed policy
quantile method
simulation config version
```

Large raw Monte Carlo vectors do not need to be stored in PostgreSQL by default.

Store summary statistics and artifact references as appropriate.

---

# 25. Migration from Current Service

## 25.1 Do Not Rewrite Everything at Once

Current:

```text
CyberRiskQuantificationService
```

becomes:

```text
compatibility façade
```

## 25.2 Target Flow

```text
getEnterpriseRisk()
       |
       v
buildRiskContext()
       |
       v
calculateRisk()
       |
       +--> likelihood
       +--> frequency
       +--> severity
       +--> dependency
       +--> aggregate loss
       +--> EAL/VaR
       +--> score
       +--> drivers
       |
       v
persist
       |
       v
map to legacy response
```

## 25.3 Legacy Fields

During migration, the old response names may remain:

```text
expectedAnnualLossInr
valueAtRisk95Inr
```

But the semantics must eventually map to:

```text
eal
var95
```

Once clients are migrated, the legacy names can be deprecated.

---

# 26. Current Service Logic to Remove

The following current mechanisms must not remain authoritative after P2:

## 26.1 Hand-Tuned Likelihood

Current:

```text
CVSS component
+
EPSS component
+
exploit component
+
age component
+
telemetry signal
```

The structure may inform a baseline provider but should be isolated and versioned.

## 26.2 Point Impact

Current:

```text
downtime
+
breach
+
recovery
+
regulatory
+
reputation
```

must become inputs to a defined severity/distribution system.

## 26.3 VaR Proxy

Remove:

```text
impact × clamp(likelihood × 2.2, ...)
```

from authoritative VaR.

## 26.4 Scenario Multipliers

P2 should not create new calculations depending on:

```text
ealMultiplier
```

Scenario multiplication is replaced in P4 by state mutation and recomputation.

## 26.5 Greedy Optimizer

P2 does not implement the optimizer.

The current greedy selection remains outside Risk Engine v2 and is replaced in P5.

---

# 27. Risk Engine Internal API

The top-level interface should be small:

```ts
interface RiskEngine {
  calculate(
    context: RiskCalculationContext
  ): Promise<RiskCalculationResult>;
}
```

Additional internal services are injected behind it.

## 27.1 Dependency Injection

Prefer:

```ts
RiskEngine(
  likelihoodProvider,
  severityProvider,
  controlProvider,
  dependencyHandler,
  parameterProvider,
  simulationEngine,
  scoreEngine,
  driverEngine
)
```

This makes each mathematical component testable independently.

---

# 28. Numerical Safety

## 28.1 Monetary Values

Use:

```text
number
```

internally only when the selected precision is safe.

For persistence, align with the existing Decimal/BigInt strategy and Data Dictionary semantics.

Avoid accidental:

```text
floating point -> integer truncation
```

for risk calculation.

## 28.2 Bounds

Enforce:

```text
probability ∈ [0,1]
control effectiveness ∈ [0,1]
severity >= 0
frequency >= 0
loss >= 0
weights >= 0
weights sum = 1
```

## 28.3 NaN / Infinity

A result containing:

```text
NaN
Infinity
-Infinity
```

must fail the calculation rather than being serialized into the API.

---

# 29. Uncertainty and Coverage

The calculation result must expose:

```text
coverage
confidence
warnings
OOD state
assumption count
```

## 29.1 Missing Financial Parameters

Possible behavior:

```text
approved default/range
OR
limited-confidence calculation
OR
metric unavailable
```

Never silently substitute:

```text
0
```

unless zero is explicitly the approved business parameter.

## 29.2 Missing Telemetry

Missing telemetry does not imply:

```text
no attack
```

The evidence context must mark source freshness/coverage.

---

# 30. Performance

## 30.1 Main Cost Centers

```text
evidence loading
dependency traversal
Monte Carlo
large tenant aggregation
driver attribution
```

## 30.2 Performance Order

First implement correct calculation.

Then optimize:

```text
batch DB access
pre-aggregation
scope-specific recalculation
simulation vectorization
worker execution
cache/read models
```

## 30.3 Job Execution

Large enterprise calculations should use the P1 job framework:

```text
POST /risk/recalculate
    ->
Job
    ->
RiskRun
    ->
RiskEngine
```

The HTTP controller should not contain the simulation loop.

---

# 31. Mathematical Test Suite

## 31.1 Frequency

Test:

```text
p = 0
p = small probability
p = medium probability
p near 1
```

Verify:

```text
lambda >= 0
```

## 31.2 Severity

Test:

```text
zero severity
single-point empirical distribution
known parametric distribution
heavy-tailed fixture
```

## 31.3 EAL

For deterministic fixture:

```text
known frequency
known severity
```

verify expected mean is within tolerance.

## 31.4 VaR

Given:

```text
sorted known loss vector
```

verify:

```text
VaR95
VaR99
```

against the selected empirical quantile method.

Also verify:

```text
VaR95 <= VaR99
```

## 31.5 Monte Carlo Reproducibility

Same seed:

```text
run A == run B
```

within declared tolerance.

## 31.6 Non-Negativity

All simulated annual loss values must satisfy:

```text
S^(m) >= 0
```

## 31.7 Driver Attribution

Removing a known controlled driver in a test fixture should change EAL in the expected direction when the model semantics imply a monotonic relationship.

This is a test property, not a universal cyber-risk law.

---

# 32. Integration Tests

## 32.1 Full Run

```text
organization
 ->
RiskRun
 ->
context
 ->
RiskEngine
 ->
RiskAssessment
 ->
hash
```

Verify all IDs remain linked.

## 32.2 Historical Run

Run twice at different `asOf` timestamps.

Expected:

```text
two RiskRuns
two historical assessments
```

not one mutable record.

## 32.3 Current API

Verify:

```text
GET /api/cyber-risk/enterprise
```

still works.

The endpoint should now read from the new domain.

---

# 33. No Double-Counting Tests

Create a fixture:

```text
Asset A
  vulnerability V1
  vulnerability V2
  two SIEM alerts
  one affected service
```

Verify that:

```text
V1 + V2 + alerts
```

does not automatically create:

```text
4 independent incidents
```

unless the event model explicitly defines four independent opportunities.

---

# 34. Risk Score Tests

Test:

```text
EAL below appetite
EAL above appetite
zero control effectiveness
full control effectiveness
weight normalization failure
```

Verify:

```text
0 <= RiskScore <= 100
```

and weight sum is exactly the configured policy.

---

# 35. Current-to-Target API Mapping

## Existing

```text
GET /api/cyber-risk/enterprise
```

Target behavior:

```text
Compatibility controller
    ->
RiskAssessmentService
    ->
RiskEngine v2
```

## Existing

```text
POST /api/cyber-risk/snapshots
```

Target:

```text
create RiskRun
calculate
persist RiskAssessment
optionally populate compatibility RiskSnapshot
```

## New canonical

```text
POST /api/v1/risk/recalculate
GET  /api/v1/risk/current
GET  /api/v1/risk/assessments/{id}
```

---

# 36. Logging and Observability

Every RiskRun should log:

```text
riskRunId
organizationId
scope
asOf
engineVersion
simulationConfig
start
end
status
inputHash
resultHash
```

Do not log:

```text
raw secrets
sensitive financial records
raw telemetry payloads
```

## 36.1 Metrics

Track:

```text
risk_calculation_duration
risk_calculation_failures
risk_simulation_count
risk_assessment_stale_count
risk_input_coverage
risk_hash_verification_failure
```

---

# 37. Failure Handling

| Failure | Behavior |
|---|---|
| Invalid input state | Reject run |
| Missing essential context | Limited/failed calculation according to policy |
| ML provider unavailable | Approved fallback or limited-confidence state |
| Severity distribution invalid | Fail run |
| Simulation configuration invalid | Fail run |
| NaN/Infinity | Fail run |
| Dependency graph invalid | Fail run or isolate invalid branch according to policy |
| Hash generation failure | Fail persistence of authoritative result |
| Database failure during persistence | Mark run failed; no partial authoritative assessment |
| Worker restart | Requeue/recover using job semantics |

---

# 38. Security Requirements

P2 inherits platform security but adds:

- no cross-tenant context loading;
- authorized scope resolution;
- no client-supplied authoritative metrics;
- parameter changes require role authorization;
- calculation result writes are server-owned;
- simulation artifacts cannot alter production state.

---

# 39. P2 File Change Plan

## New

```text
src/services/risk/index.ts
src/services/risk/riskRun.service.ts
src/services/risk/evidenceContext.service.ts
src/services/risk/likelihood.service.ts
src/services/risk/frequency.service.ts
src/services/risk/severity.service.ts
src/services/risk/dependency.service.ts
src/services/risk/lossDistribution.service.ts
src/services/risk/riskScore.service.ts
src/services/risk/driverAttribution.service.ts
src/services/risk/riskAssessment.service.ts
src/services/risk/assumptions.service.ts
src/services/risk/simulationConfig.service.ts
src/services/risk/errors.ts

tests/unit/risk/*
tests/integration/risk/*
```

## Modify

```text
src/services/cyberRiskQuantification.service.ts
src/controllers/cyber-risk.controller.ts
src/routes/cyber-risk.routes.ts
prisma/schema.prisma
```

Potentially:

```text
src/routes/index.ts
```

only if the canonical `/api/v1/risk/*` route family is introduced in P2.

---

# 40. Suggested Commit Sequence

Keep the migration reviewable.

```text
1. risk: create risk domain interfaces
2. risk: add frequency calculation
3. risk: add severity distribution abstraction
4. risk: add Monte Carlo aggregate loss
5. risk: implement EAL and empirical VaR
6. risk: implement enterprise risk score
7. risk: add dependency allocation
8. risk: add risk driver attribution
9. risk: integrate RiskRun persistence
10. risk: route legacy cyber-risk through risk engine
11. test: add mathematical risk fixtures
12. test: add reproducibility and tenant tests
```

---

# 41. Rollback Strategy

P2 should be deployable behind a controlled mode switch.

Suggested:

```env
RISK_ENGINE_MODE=legacy|v2
```

During migration:

```text
legacy
   |
   +--> existing response
```

and optionally:

```text
shadow-v2
   |
   +--> run v2
   +--> compare with legacy
   +--> do not change authoritative production result yet
```

After validation:

```text
RISK_ENGINE_MODE=v2
```

The exact configuration name is implementation-defined.

## 41.1 Shadow Comparison

For selected fixtures/tenant-safe test scopes:

```text
legacy EAL
v2 EAL
legacy VaR proxy
v2 VaR
```

Differences are expected.

The purpose is not to make v2 match the legacy heuristic.

The purpose is to catch unexpected implementation errors.

---

# 42. P2 Acceptance Matrix

| Area | Acceptance |
|---|---|
| Frequency | Explicit annualization from horizon probability |
| Severity | Distribution-based |
| Aggregate loss | Monte Carlo/approved aggregation |
| EAL | Mean annual aggregate loss |
| VaR | Quantile of aggregate annual loss |
| Score | Versioned 0–100 decomposition |
| Dependencies | Explicit allocation/correlation rule |
| Drivers | Evidence-linked attribution |
| Reproducibility | Same inputs/config produce equivalent results |
| Persistence | RiskRun + RiskAssessment lineage |
| Compatibility | Existing risk endpoint remains functional |
| Security | Tenant/RBAC tests pass |
| Performance | Heavy runs execute through worker/job path |
| No false precision | Coverage/uncertainty exposed |
| Failure safety | Invalid numerical outputs cannot become authoritative |

---

# 43. P2 Definition of Done

P2 is accepted only when:

```text
1. Risk Engine v2 exists as a modular domain.
2. Current CyberRiskQuantificationService is a façade, not a second calculator.
3. EAL comes from the annual loss distribution.
4. VaR comes from a declared percentile of that distribution.
5. Financial Exposure is clearly defined and persisted.
6. Product Risk Score is versioned and decomposable.
7. Simulation configuration is stored.
8. Input and result hashes are linked to RiskRun.
9. Historical assessments are append-oriented.
10. Shared dependencies are handled by explicit rules.
11. Driver attribution is stored separately from high-risk asset lists.
12. All mathematical invariants have tests.
13. Existing SentinelStack product flows remain functional.
14. No UI or LLM code computes authoritative risk values.
```

---

# 44. What P2 Does Not Implement

P2 intentionally does not complete:

```text
P3 advanced driver UX/evidence exploration
P4 scenario engine
P5 investment optimizer
P6 production ML likelihood
P7 grounded NLQ
P8 blockchain/audit expansion
P9 final hardening
```

Those are downstream consumers of the risk engine.

---

# 45. Recommended Development Sequence

```text
P0/P1
  |
  v
Risk context + RiskRun
  |
  v
P2
  |
  +--> deterministic likelihood provider
  +--> frequency
  +--> severity
  +--> Monte Carlo
  +--> EAL
  +--> VaR
  +--> Score
  +--> Drivers
  |
  v
P3 attribution/evidence
  |
  v
P4 scenarios
  |
  v
P5 optimization
  |
  v
P6 ML
```

---

# Appendix A — Example Deterministic Fixture

The following is an engineering test fixture, not a real organization.

```json
{
  "eventClass": "EXTERNAL_EXPLOITATION",
  "horizonDays": 30,
  "probability": 0.10,
  "severity": {
    "distribution": "EMPIRICAL",
    "samples": [100000, 200000, 500000, 1000000]
  },
  "simulation": {
    "count": 50000,
    "seed": 42
  }
}
```

Expected properties:

```text
p_h = 0.10
lambda > 0
all losses >= 0
VaR95 <= VaR99
EAL >= 0
```

Exact numerical expected values should be generated by the test implementation using the declared random-generation method.

---

# Appendix B — Example Engine Pseudocode

```text
function calculate(context):

    validateContext(context)

    likelihoods =
        likelihoodProvider.estimate(context)

    frequencies =
        frequencyService.annualize(likelihoods)

    severityModels =
        severityService.build(context)

    controlState =
        controlEffectivenessProvider.evaluate(context.controls)

    for simulation in 1..M:

        eventCounts =
            sampleFrequencies(frequencies)

        eventLosses = []

        for eventClass in eventCounts:

            n = eventCounts[eventClass]

            for i in 1..n:
                severity =
                    sampleSeverity(severityModels[eventClass])

                eventLosses.push(
                    severity
                )

        aggregateLoss =
            dependencyService.aggregate(
                eventLosses,
                context.dependencies
            )

        losses.push(aggregateLoss)

    sort(losses)

    eal =
        mean(losses)

    var95 =
        quantile(losses, 0.95)

    var99 =
        quantile(losses, 0.99)

    exposure =
        buildFinancialExposure(eal, var95, var99)

    riskScore =
        riskScoreService.calculate(
            eal,
            frequencies,
            controlState,
            context.parameters
        )

    drivers =
        driverAttributionService.attribute(
            context,
            baselineOutputs
        )

    return {
        eal,
        var95,
        var99,
        exposure,
        riskScore,
        drivers
    }
```

---

# Appendix C — Mathematical Validation Checklist

```text
[ ] p_h ∈ [0,1]
[ ] lambda >= 0
[ ] N_i ∈ non-negative integers
[ ] L_i,j >= 0
[ ] S >= 0
[ ] EAL >= 0
[ ] VaR95 >= 0
[ ] VaR99 >= 0
[ ] VaR95 <= VaR99
[ ] weights sum to 1
[ ] RiskScore ∈ [0,100]
[ ] simulation count recorded
[ ] seed/config policy recorded
[ ] model/parameter versions recorded
[ ] input hash recorded
[ ] result hash recorded
```

---

# Appendix D — Implementation Notes for Existing Code

Current `src/services/cyberRiskQuantification.service.ts` contains useful domain concepts:

```text
asset impact
control effectiveness
likelihood signals
recommendations
scenarios
optimization
```

P2 should reuse domain concepts where valid, but not preserve transitional shortcuts as authoritative mathematics.

Specifically:

```text
calculateAssetImpact()
    ->
map into Severity/BusinessImpact service

calculateControlEffectiveness()
    ->
map into versioned ControlEffectivenessProvider

calculateLikelihood()
    ->
move behind LikelihoodProvider

assetRiskRow()
    ->
replace with RiskContext + event-class representation

valueAtRisk95Inr
    ->
replace with actual empirical quantile

buildRecommendations()
    ->
downstream P3/P5 domain

optimizeRecommendations()
    ->
downstream P5 optimizer

scenarioPresets / ealMultiplier
    ->
downstream P4 scenario state mutations
```

---

# Appendix E — P2 Review Checklist

Before merge:

```text
[ ] Risk formulas reviewed
[ ] Probability-to-frequency reviewed
[ ] Severity semantics reviewed
[ ] Double-counting test passed
[ ] VaR quantile test passed
[ ] Monte Carlo reproducibility passed
[ ] Risk score configuration versioned
[ ] Tenant tests passed
[ ] Existing route regression passed
[ ] Prisma migration validated
[ ] Worker execution validated
[ ] Failure-mode tests passed
[ ] No secret/data leakage
[ ] Documentation synchronized
[ ] Legacy/v2 migration mode documented
```

---

# Baseline Status

**P2 Risk Engine v2 Implementation Specification:** READY

This document is the implementation baseline for converting SentinelStack's transitional financial-risk service into the governed quantitative engine defined by the PS-26105 mathematical model.

The next dependent implementation workstream is:

```text
P3 — Risk Driver Attribution + Evidence
```

P3 must consume authoritative P2 outputs rather than implement another risk calculation path.
