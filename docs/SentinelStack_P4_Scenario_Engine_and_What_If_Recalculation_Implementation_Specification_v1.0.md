# SentinelStack — P4 Scenario Engine & What-If Recalculation Implementation Specification v1.0

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.0  
**Document Status:** P4 Implementation Engineering Baseline  
**Repository:** `github.com/ciphernet01/sentinelstack`  
**Primary Runtime:** Existing Express + TypeScript + Prisma/PostgreSQL  
**Primary Dependencies:** P2 Risk Engine v2 + P3 Risk Driver Attribution & Evidence  
**Date:** 29 September 2026  
**Baselines:** PS 26105 • SRS v2.1 • SDD v1.2 • Data Dictionary v1.1 • Risk Model v1.1 • ML Spec v1.1 • API Contract v1.1 • Implementation Architecture v1.1 • P0/P1 Runbook v1.0 • P2 Risk Engine v2 Specification v1.0 • P3 Driver Attribution & Evidence Specification v1.0

> **Purpose:** Define the authoritative scenario and what-if calculation layer that lets SentinelStack simulate security, exposure, control, business-context and investment changes without mutating the operational baseline.

> **Core rule:** A scenario is a versioned hypothetical state. The baseline remains immutable. Scenario results are produced by rerunning the same authoritative P2 Risk Engine against a controlled scenario state and are never implemented as fixed EAL multipliers.

---

# 1. Objective

P4 implements the scenario engine required to answer:

```text
What happens to cyber risk if we patch these vulnerabilities?
What happens if MFA coverage rises to 95%?
What happens if an internet-facing service is segmented?
What happens if EDR is deployed to the remaining assets?
How much EAL and VaR could be reduced?
What is the residual risk?
What would the investment cost?
What changes in the risk drivers?
```

The scenario pipeline is:

```text
Current operational state
        |
        v
Create scenario copy
        |
        v
Apply controlled changes
        |
        v
Validate scenario state
        |
        v
Run P2 Risk Engine v2
        |
        v
Scenario RiskAssessment
        |
        +--> ΔEAL
        +--> ΔVaR95
        +--> ΔVaR99
        +--> ΔFinancial Exposure
        +--> ΔRisk Score
        |
        v
P3 Driver Attribution
        |
        v
Scenario explanation
        |
        v
P5 Investment Optimizer
```

---

# 2. Current Repository Gap

The existing SentinelStack risk service contains scenario presets such as:

```text
MFA
Patch critical vulnerabilities
Network segmentation
EDR rollout
Cloud hardening
```

The current behavior uses fixed assumptions including:

```text
EAL multipliers
hardcoded costs
fixed percentage reductions
```

This is a prototype mechanism.

P4 replaces that behavior with:

```text
explicit state changes
+
state validation
+
same P2 calculation pipeline
+
same model/version/parameter semantics
+
persisted scenario assessment
```

The existing `simulateScenario()` service may remain as a compatibility façade during migration, but new scenario APIs must use the P4 engine.

---

# 3. P4 Entry Criteria

P4 assumes that P2 provides:

```text
RiskRun creation
Risk Input Bundle
Risk Engine v2
EAL
VaR95
VaR99
Risk Score
financial exposure
model/parameter versions
calculation hash
```

P3 provides:

```text
RiskDriver
EvidenceReference
driver attribution
risk change analysis
```

P4 must invoke these components rather than duplicate their logic.

---

# 4. P4 Exit Criteria

P4 is complete when:

```text
[ ] Scenario definitions are persisted
[ ] Baseline references are persisted
[ ] Scenario changes are explicit and typed
[ ] Copy-on-write behavior is implemented
[ ] Baseline data is never mutated by simulation
[ ] Scenario validation exists
[ ] P2 Risk Engine can calculate scenario state
[ ] Scenario EAL/VaR/Risk Score are stored
[ ] Baseline-vs-scenario deltas are stored
[ ] Scenario drivers are attributable
[ ] Scenario evidence lineage is retained
[ ] Scenario comparisons are available through API
[ ] Frontend can create, run and inspect scenarios
[ ] Scenario assumptions are visible
[ ] Scenario reproducibility is supported
[ ] Tenant isolation is enforced
[ ] Expensive scenario runs can execute asynchronously
[ ] Fixed multiplier logic is removed from the authoritative path
```

---

# 5. Scenario Principles

## 5.1 Baseline Immutability

A scenario may read:

```text
production asset state
production vulnerability state
production control state
business context
dependency graph
telemetry state
threat intelligence
```

but must not modify those records.

Instead:

```text
Baseline
   |
   v
Scenario State
   |
   +--> Change 1
   +--> Change 2
   +--> Change 3
```

## 5.2 Explicit Changes

Every scenario change must declare:

```text
what changed
old value
new value
target entity
change type
reason/source
cost where relevant
```

## 5.3 Same Risk Engine

Scenario calculations use:

```text
P2 Risk Engine v2
```

with the same contracts and mathematical semantics as baseline calculation.

## 5.4 Versioned Hypotheticals

Historical scenario results remain reproducible even after:

```text
new vulnerabilities
new telemetry
new model versions
new parameters
```

are introduced into the operational environment.

A scenario stores the baseline/run context from which it was created.

---

# 6. Scenario State Model

The logical scenario state is:

```text
Scenario
    |
    +--> Baseline RiskAssessment
    |
    +--> ScenarioChange[]
    |
    +--> ScenarioRun[]
                |
                +--> Scenario RiskAssessment
```

Conceptually:

```text
current enterprise state
        |
        +--> scenario A
        |       |
        |       +--> result
        |
        +--> scenario B
        |       |
        |       +--> result
        |
        +--> scenario C
                |
                +--> result
```

Scenarios are siblings, not sequential mutations of each other unless explicitly created as a scenario derived from another scenario.

---

# 7. Scenario Types

Canonical scenario types:

```text
CONTROL
VULNERABILITY_REMEDIATION
EXPOSURE
SEGMENTATION
IDENTITY
ENDPOINT
CLOUD_HARDENING
THREAT_RESPONSE
BUSINESS_CONTINUITY
ASSET_CHANGE
DEPENDENCY
INVESTMENT
COMBINED
CUSTOM
```

These are classification values, not precomputed algorithms.

---

# 8. Scenario Change Types

Canonical change operations:

```text
SET
INCREASE
DECREASE
ENABLE
DISABLE
ADD
REMOVE
PATCH
UNPATCH
ISOLATE
EXPOSE
UNEXPOSE
REASSIGN
REPLACE
```

The operation must be valid for the target field.

Example:

```text
CONTROL:
coverage 0.62 -> 0.95

VULNERABILITY:
status OPEN -> PATCHED

ASSET:
internetExposure true -> false

SEGMENTATION:
networkZone public -> segmented
```

---

# 9. Scenario Entity Targets

Supported scenario targets should include:

```text
ASSET
SERVICE
VULNERABILITY
CONTROL
ASSET_CONTROL
DEPENDENCY
BUSINESS_UNIT
THREAT_SIGNAL
BUSINESS_PARAMETER
```

The implementation should validate whether a target field is mutable in scenario mode.

---

# 10. Scenario Object

Recommended logical model:

```ts
type Scenario = {
  id: string;
  organizationId: string;

  name: string;
  description?: string;

  type: ScenarioType;

  baselineRiskAssessmentId: string;
  baselineRiskRunId: string;

  status:
    | "DRAFT"
    | "VALIDATING"
    | "READY"
    | "RUNNING"
    | "COMPLETED"
    | "FAILED"
    | "EXPIRED"
    | "ARCHIVED";

  createdBy: string;

  assumptionSetId?: string;

  createdAt: string;
  updatedAt: string;
};
```

---

# 11. Scenario Change Object

```ts
type ScenarioChange = {
  id: string;
  scenarioId: string;

  targetType:
    | "ASSET"
    | "SERVICE"
    | "VULNERABILITY"
    | "CONTROL"
    | "ASSET_CONTROL"
    | "DEPENDENCY"
    | "BUSINESS_UNIT"
    | "THREAT_SIGNAL"
    | "BUSINESS_PARAMETER";

  targetId: string;

  fieldPath: string;

  operation:
    | "SET"
    | "INCREASE"
    | "DECREASE"
    | "ENABLE"
    | "DISABLE"
    | "ADD"
    | "REMOVE"
    | "PATCH"
    | "UNPATCH"
    | "ISOLATE"
    | "EXPOSE"
    | "UNEXPOSE"
    | "REASSIGN"
    | "REPLACE";

  oldValue?: unknown;
  newValue: unknown;

  reason?: string;
  sourceDriverId?: string;
  investmentOptionId?: string;

  sequence: number;
};
```

---

# 12. Scenario Result Object

```ts
type ScenarioResult = {
  scenarioId: string;
  scenarioRunId: string;

  baselineAssessmentId: string;
  scenarioAssessmentId: string;

  baseline: {
    eal: number;
    var95: number;
    var99: number;
    financialExposure: number;
    riskScore: number;
  };

  scenario: {
    eal: number;
    var95: number;
    var99: number;
    financialExposure: number;
    riskScore: number;
  };

  delta: {
    eal: number;
    var95: number;
    var99: number;
    financialExposure: number;
    riskScore: number;
  };

  cost?: number;
  avoidedEal?: number;
  residualRisk?: number;

  calculationHash: string;
};
```

---

# 13. Copy-on-Write Design

Scenario execution should not clone the entire database unless required.

Use a logical overlay:

```text
Baseline State
     |
     +--> unchanged fields read from baseline
     |
     +--> changed fields read from scenario overlay
```

Resolution:

```text
scenario override exists?
    |
   yes ---> use scenario value
    |
    no
    |
    v
use baseline value
```

This minimizes storage and reduces stale duplicated state.

---

# 14. Scenario State Resolver

Create:

```text
src/services/scenario/scenarioStateResolver.service.ts
```

Suggested contract:

```ts
interface ScenarioStateResolver {
  resolve(
    scenarioId: string,
    baselineContext: RiskInputContext
  ): Promise<RiskInputContext>;
}
```

Responsibilities:

```text
load scenario changes
validate target paths
apply changes in sequence
resolve dependent entities
produce scenario input context
```

---

# 15. Change Ordering

Scenario changes should apply in deterministic sequence.

Example:

```text
1. patch vulnerability
2. update control coverage
3. remove internet exposure
4. update dependency
```

Store:

```text
sequence
```

or use deterministic ordering rules.

Two scenario records with the same logical changes should produce the same state hash.

---

# 16. Change Validation

Before execution:

```text
target exists
+
field is scenario-mutable
+
new value has correct type
+
operation is supported
+
organization owns target
+
dependencies remain valid
```

Example invalid change:

```text
SET asset.nonexistentField = true
```

must fail validation.

---

# 17. Scenario Constraints

Some changes create inconsistent states.

Example:

```text
asset status = RETIRED
```

while:

```text
active business service dependency
```

still points to that asset.

The validator should either:

```text
reject
```

or require an explicit dependent change.

Never silently repair a scenario.

---

# 18. Dependency-Aware Scenarios

A scenario can change:

```text
dependency strength
dependency existence
service failover
segmentation boundary
identity dependency
```

When the dependency graph changes:

```text
P2 dependency engine
```

must recalculate risk aggregation.

P4 must not manually adjust EAL to account for dependency change.

---

# 19. Control Scenarios

Control changes should represent actual control state variables.

Examples:

```text
MFA:
coverage = 0.95

EDR:
coverage = 1.00
effectiveness = 0.85

Network segmentation:
enabled = true

Patch management:
critical_patch_sla_days = 7
```

The values must enter the same control-effectiveness logic used by baseline risk calculation.

---

# 20. Vulnerability Scenarios

Examples:

```text
PATCH CVE-X
REMOVE CVE-X
SET remediation_due_date
SET exploitability state
```

The scenario should not edit the source vulnerability record.

Instead:

```text
baseline vulnerability:
status = OPEN

scenario overlay:
status = PATCHED
```

---

# 21. Exposure Scenarios

Supported examples:

```text
internet exposure = false
public endpoint removed
asset moved to private segment
external access policy changed
```

These changes should flow into P2's exposure features and likelihood/frequency logic.

---

# 22. Threat Scenarios

Threat scenario changes may model:

```text
threat intensity
indicator presence
campaign relevance
attack pressure
```

The scenario should clearly identify whether the value is:

```text
observed
projected
stress-tested
```

Do not turn a hypothetical threat into an asserted real incident.

---

# 23. Business Impact Scenarios

Examples:

```text
downtime cost/hour increases
recovery cost changes
regulatory exposure assumption changes
service revenue impact changes
```

These are especially sensitive.

Every business-impact scenario should retain:

```text
parameter version
assumption source
currency
unit
owner
approval status where applicable
```

---

# 24. Investment Scenarios

An investment scenario maps:

```text
investment option
    ->
state changes
    ->
risk recalculation
```

Example:

```text
Investment:
Deploy MFA

Cost:
₹4,500,000

State changes:
MFA coverage 62% -> 95%
Privileged access policy enabled

Risk Engine:
recalculate
```

This is the bridge to P5 optimization.

---

# 25. Combined Scenarios

Multiple controls can be combined:

```text
MFA + EDR + segmentation
```

Each change remains individually traceable.

The scenario result is computed using the combined state.

This is important because control interactions can make:

```text
ΔEAL(A+B)
```

different from:

```text
ΔEAL(A) + ΔEAL(B)
```

---

# 26. Scenario Baseline Selection

A scenario must reference:

```text
baselineRiskAssessmentId
baselineRiskRunId
```

By default:

```text
latest valid authoritative assessment
```

is used.

The user may explicitly choose an historical assessment where permitted.

The selected baseline must be preserved permanently for reproducibility.

---

# 27. Scenario Snapshot

At execution time, store:

```text
baseline input hash
scenario change hash
effective scenario state hash
model bundle version
parameter bundle version
simulation configuration
attribution version
```

This creates:

```text
ScenarioResult
=
deterministic reference to scenario state + calculation environment
```

---

# 28. Scenario Run

Recommended:

```text
ScenarioRun
```

fields:

```text
id
organizationId
scenarioId
baselineRiskRunId
status
startedAt
completedAt
inputHash
scenarioStateHash
calculationHash
modelBundleId
parameterBundleId
errorCode
errorMessage
createdAt
```

---

# 29. Scenario State Hash

Canonical serialization should include:

```text
baseline state identity
+
ordered scenario changes
+
resolved effective state
```

Then:

```text
SHA-256(canonicalScenarioState)
```

Store:

```text
scenarioStateHash
```

The canonicalization rules must be shared with the P2 calculation hash implementation where possible.

---

# 30. Scenario Calculation Flow

```text
POST /scenarios/{id}/run
          |
          v
validate scenario
          |
          v
load baseline assessment
          |
          v
load baseline risk input context
          |
          v
resolve overlay
          |
          v
create ScenarioRun
          |
          v
invoke P2 Risk Engine
          |
          v
persist ScenarioAssessment
          |
          v
calculate deltas
          |
          v
run P3 attribution
          |
          v
persist result + drivers
          |
          v
complete ScenarioRun
```

---

# 31. Reusing P2 Engine

The P2 engine should expose a reusable function:

```ts
calculate(context: RiskInputContext): Promise<RiskEngineResult>
```

P4 calls:

```ts
calculate(baselineContext)
calculate(scenarioContext)
```

or reuses the persisted baseline result when its hash matches.

The mathematical implementation remains centralized.

---

# 32. Baseline Recalculation Policy

A scenario should not blindly recalculate the baseline if:

```text
baseline assessment is valid
+
input hash unchanged
+
model version unchanged
+
parameter version unchanged
```

Otherwise:

```text
recalculate baseline
```

and record the reason.

---

# 33. Delta Calculation

For risk metrics:

```text
ΔEAL = EAL_scenario - EAL_baseline

ΔVaR95 = VaR95_scenario - VaR95_baseline

ΔVaR99 = VaR99_scenario - VaR99_baseline

ΔExposure = Exposure_scenario - Exposure_baseline

ΔRiskScore = RiskScore_scenario - RiskScore_baseline
```

For risk reduction:

```text
RiskReduction_EAL = EAL_baseline - EAL_scenario

RiskReduction_VaR95 = VaR95_baseline - VaR95_scenario

RiskReduction_RiskScore = RiskScore_baseline - RiskScore_scenario
```

The API must keep the signed delta and the explicitly named reduction metric separate.

---

# 34. Residual Risk

Residual risk is:

```text
scenario risk after all stated changes
```

Example:

```text
Baseline EAL: ₹10M
Scenario EAL: ₹6.5M

Avoided EAL: ₹3.5M
Residual EAL: ₹6.5M
```

Do not call avoided EAL “profit” unless financial accounting semantics support that claim.

---

# 35. Scenario Financial Cost

Scenario cost should come from:

```text
investment option
implementation estimate
user-entered assumption
approved cost catalog
```

Store:

```text
cost
currency
cost basis
cost period
assumption source
```

Example:

```text
one-time implementation cost
annual recurring cost
```

These must not be collapsed into one ambiguous figure.

---

# 36. Scenario Cost Semantics

Support:

```text
CAPEX
OPEX
ONE_TIME
ANNUAL
MONTHLY
LICENSE
IMPLEMENTATION
PERSONNEL
SERVICE_PROVIDER
```

This allows P5 to calculate investment economics without rebuilding scenario state.

---

# 37. ROSI Interface

P4 should expose scenario outputs needed by P5.

A generic economic layer may calculate:

```text
GrossBenefit = AvoidedEAL
NetBenefit = AvoidedEAL - Cost

ROSI = (NetBenefit / Cost) * 100
```

But P4 itself should remain responsible primarily for:

```text
scenario state
risk outcome
cost inputs
```

P5 owns portfolio optimization and final investment selection.

Any organization-specific ROSI conventions must be versioned.

---

# 38. Scenario Uncertainty

A scenario result should preserve:

```text
simulation count
loss distribution metadata
confidence interval where implemented
assumption uncertainty
model confidence
evidence coverage
```

For example:

```text
Expected EAL reduction:
₹3.5M

Interpretation:
modeled estimate under scenario assumptions
```

Do not present one simulated result as guaranteed savings.

---

# 39. Scenario Confidence

A scenario can have:

```text
HIGH
MEDIUM
LOW
INSUFFICIENT
```

confidence based on:

```text
evidence completeness
model support
state coverage
parameter quality
```

Confidence does not change the numerical result unless explicitly incorporated into the mathematical model.

---

# 40. Monte Carlo Semantics

P2's aggregate loss calculation remains the authoritative source.

For scenario:

```text
for m = 1..M:
    simulate scenario loss S_scenario^(m)
```

Then:

```text
EAL_scenario = mean(S_scenario^(m))

VaR95_scenario = Quantile_0.95(S_scenario)

VaR99_scenario = Quantile_0.99(S_scenario)
```

Use the same simulation configuration or a documented comparison configuration.

Reference production baseline from the risk model:

```text
M >= 50,000
```

for production-grade VaR estimation, unless a documented computational policy specifies otherwise.

---

# 41. Common Random Numbers

When comparing:

```text
baseline
vs
scenario
```

use common random seeds/streams where mathematically valid.

This can reduce comparison noise.

Store:

```text
randomSeed
simulationConfiguration
```

for reproducibility.

Do not reuse a seed if a stochastic component is not compatible with common-random-number comparison; record the alternative policy.

---

# 42. Scenario Driver Recalculation

After scenario risk calculation:

```text
P3 Driver Attribution
```

should run against the scenario context.

Output:

```text
baseline drivers
scenario drivers
new drivers
removed drivers
changed contributors
```

This lets the UI explain:

```text
Why did risk fall?
```

---

# 43. Driver-to-Change Link

When a scenario starts from a P3 driver:

```text
sourceDriverId
```

is stored in the scenario change or scenario metadata.

Example:

```text
Driver:
Privileged MFA weakness

Scenario:
Raise MFA coverage to 95%
```

This produces a direct traceability chain:

```text
Driver
 ->
Scenario
 ->
Change
 ->
Risk delta
```

---

# 44. Scenario Templates

Templates may provide reusable change definitions:

```text
Patch critical vulnerabilities
Enable MFA
Deploy EDR
Segment internet-facing assets
Cloud hardening
Backup resilience
```

Templates must contain:

```text
editable assumptions
target resolution rules
cost defaults
required parameters
```

They must not contain fixed financial outcomes.

---

# 45. Template Resolution

A template should resolve dynamically against current scope.

Example:

```text
"Patch all KEV vulnerabilities on internet-facing critical assets"
```

may resolve to:

```text
CVE-A
CVE-B
CVE-C
```

for one assessment and:

```text
CVE-A
CVE-B
CVE-C
CVE-D
```

for a later assessment.

The resolved target set must be stored with each scenario run.

---

# 46. Scenario Scope

Supported scopes:

```text
ENTERPRISE
BUSINESS_UNIT
SERVICE
ASSET_GROUP
ASSET
```

Scenario effects should remain within scope unless the change intentionally affects dependencies outside scope.

Example:

```text
Disable identity service
```

may affect multiple business services through the dependency graph.

The result should show the resulting blast radius rather than silently truncating it.

---

# 47. Blast Radius Integration

Scenario execution can expose:

```text
affected assets
affected services
affected business units
```

through P2 dependency traversal.

This supports the globe and technical dashboards.

Example:

```text
Scenario:
Segment exposed application

Affected:
12 assets
3 services
2 business units
```

These counts are derived from the digital twin, not invented for visualization.

---

# 48. Scenario Comparison

Support:

```text
Scenario A
Scenario B
Baseline
```

comparison.

Metrics:

```text
EAL
VaR95
VaR99
financial exposure
risk score
cost
avoided EAL
residual risk
```

Do not rank scenarios as “best” through a platform-wide verdict.

Present the measurable trade-offs so the decision maker can select according to organizational objectives.

---

# 49. Multi-Scenario Analysis

The backend should support:

```text
one-at-a-time
```

and:

```text
combined portfolio scenario
```

Example:

```text
Scenario A = MFA
Scenario B = EDR
Scenario C = segmentation

Portfolio = A+B+C
```

Portfolio scenario must recalculate from the combined state rather than summing isolated deltas.

---

# 50. Scenario Dependency Graph

Investment options can depend on each other.

Example:

```text
EDR rollout
    requires
endpoint inventory

segmentation
    requires
network mapping
```

Scenario validation should optionally enforce dependency prerequisites.

P5 will use the same dependency metadata for portfolio optimization.

---

# 51. API Design

## 51.1 Create Scenario

### `POST /api/v1/scenarios`

Request:

```json
{
  "name": "Raise privileged MFA coverage",
  "description": "Model MFA coverage at 95% for privileged identities",
  "type": "IDENTITY",
  "baselineRiskAssessmentId": "uuid",
  "changes": [
    {
      "targetType": "CONTROL",
      "targetId": "control-uuid",
      "fieldPath": "coverage",
      "operation": "SET",
      "newValue": 0.95
    }
  ]
}
```

Response:

```text
201 Created
scenario
```

---

# 52. Validate Scenario

### `POST /api/v1/scenarios/{scenarioId}/validate`

Returns:

```json
{
  "valid": true,
  "warnings": [],
  "errors": [],
  "resolvedTargets": 1,
  "scenarioStateHash": "sha256:..."
}
```

---

# 53. Run Scenario

### `POST /api/v1/scenarios/{scenarioId}/run`

For small synchronous scenarios:

```text
200
```

For expensive scenarios:

```text
202
```

Response:

```json
{
  "scenarioRunId": "uuid",
  "status": "RUNNING"
}
```

---

# 54. Get Scenario Result

### `GET /api/v1/scenarios/{scenarioId}/result`

Returns:

```text
baseline
scenario
delta
cost
avoided risk
residual risk
driver changes
assumptions
provenance
```

---

# 55. List Scenarios

### `GET /api/v1/scenarios`

Filters:

```text
type
status
baselineAssessmentId
createdBy
scope
date range
```

---

# 56. Scenario Changes

### `GET /api/v1/scenarios/{scenarioId}/changes`

Returns:

```text
ordered changes
old values
new values
target entities
source drivers
investment references
```

---

# 57. Scenario Comparison

### `POST /api/v1/scenarios/compare`

Request:

```json
{
  "baselineAssessmentId": "uuid",
  "scenarioIds": [
    "scenario-a",
    "scenario-b"
  ]
}
```

Return structured metric table for the frontend.

---

# 58. Scenario Copy

### `POST /api/v1/scenarios/{scenarioId}/clone`

Useful for:

```text
try another assumption
```

Clone semantics:

```text
new Scenario
+
copied changes
+
same baseline
+
new owner/audit event
```

The clone should not copy the historical ScenarioRun as if it were a new execution.

---

# 59. Scenario Archive

Archived scenarios remain readable if authorized.

Archive does not delete:

```text
scenario result
evidence
risk assessment
audit trail
```

unless retention policy explicitly allows deletion.

---

# 60. Scenario Approval

For governance, optional approval states:

```text
DRAFT
SUBMITTED
APPROVED
REJECTED
```

Approval is separate from mathematical execution.

A scenario can be:

```text
calculated
```

without being:

```text
approved for production implementation
```

---

# 61. Human-in-the-Loop

Before an investment decision is made, a reviewer can verify:

```text
target assets
assumptions
cost
risk reduction
residual risk
evidence
```

Store:

```text
reviewer
timestamp
decision
rationale
```

P4 must not convert a model scenario directly into a real infrastructure change.

---

# 62. Safe Simulation Boundary

Scenario execution is:

```text
analytical only
```

It must not automatically:

```text
patch a server
disable an account
change firewall rules
deploy EDR
alter IAM
```

unless a separate, explicitly authorized automation system is built later.

P4 is a decision-support layer.

---

# 63. Frontend Scenario Workspace

Recommended UI:

```text
Scenario Workspace

[Baseline Risk]
EAL      VaR95     Risk Score

[Scenario Changes]
MFA 62% -> 95%
Patch 4 critical CVEs
Segment internet-facing API

[Estimated Cost]
₹...

[Run Scenario]

[Scenario Result]
EAL
VaR95
Risk Score
Residual Risk
Avoided EAL

[Why did risk change?]
Driver delta view

[Assumptions]
...

[Evidence]
...
```

---

# 64. Scenario Builder Interaction

Recommended flow:

```text
1. Select baseline
2. Choose scope
3. Add change
4. Select target
5. Enter new state
6. Review assumptions
7. Validate
8. Run
9. Inspect results
10. Compare alternatives
```

---

# 65. Scenario Validation UI

Show three states:

```text
VALID
VALID WITH WARNINGS
INVALID
```

Warnings may include:

```text
stale evidence
low model confidence
unresolved dependency
high uncertainty
large change in business assumptions
```

Invalid scenarios cannot run.

---

# 66. Scenario Result Language

Use precise terminology.

### Good

```text
Modeled EAL reduction
Modeled VaR reduction
Estimated residual risk
Scenario cost
Under stated assumptions
```

### Avoid

```text
Guaranteed savings
Guaranteed prevention
Certain loss
Attack prevented
```

unless evidence and model semantics genuinely support that conclusion.

---

# 67. Risk Appetite Integration

Scenario results may compare:

```text
Scenario RiskScore
```

against:

```text
organization risk appetite
```

Example:

```text
Current:
above appetite

Scenario:
within appetite
```

The application should display the measurable relationship.

The decision to approve the scenario remains with the organization's authorized decision makers.

---

# 68. Scenario Assumptions

Each scenario stores explicit assumptions.

Examples:

```text
MFA coverage reaches 95%
implementation completes in 90 days
cost estimate = ₹4.5M
control effectiveness = 0.82
```

Every assumption should have:

```text
value
unit
source
version
confidence where applicable
```

---

# 69. Parameter Versioning

Business parameters such as:

```text
downtime cost/hour
recovery cost
regulatory exposure
reputation factor
```

must come from a versioned parameter set.

A scenario must capture the parameter set used by the calculation.

---

# 70. Model Versioning

Scenario results must store:

```text
likelihood model version
severity model version
control effectiveness model version
aggregation version
risk score version
attribution version
```

If one changes, the result remains tied to the original versions.

---

# 71. Scenario Evidence

Scenario evidence can be:

```text
baseline evidence
+
scenario assumption evidence
+
model evidence
```

Example:

```text
Baseline:
EDR coverage 62%

Scenario assumption:
EDR coverage 100%

Evidence:
asset inventory snapshot

Result:
recalculated EAL
```

The system must clearly distinguish:

```text
observed baseline
```

from:

```text
hypothetical scenario state
```

---

# 72. Evidence Semantics in Scenarios

A hypothetical change is not evidence that the control has actually been deployed.

Therefore:

```text
scenario state != operational evidence
```

UI must show:

```text
Hypothetical
```

or equivalent scenario labeling.

---

# 73. Scenario Hash / Integrity

Compute:

```text
scenarioStateHash
calculationHash
resultHash
```

Recommended result canonicalization:

```text
scenario identity
+
scenario state hash
+
baseline assessment identity
+
risk engine version
+
metrics
+
driver set identity
```

This provides deterministic integrity checks.

---

# 74. Blockchain Anchor

A scenario decision package may optionally anchor:

```text
scenarioStateHash
+
calculationHash
+
decision record hash
```

on the chosen ledger.

Do not put:

```text
raw vulnerabilities
PII
telemetry
business financial details
```

on-chain.

Blockchain proves:

```text
the recorded scenario state/result package was not changed after anchoring
```

It does not prove:

```text
the scenario is correct
```

or:

```text
the investment will achieve the modeled outcome
```

---

# 75. Scenario-to-Investment Contract

P5 expects P4 to expose:

```ts
type InvestmentScenarioOutcome = {
  investmentOptionId: string;
  scenarioId: string;

  cost: {
    oneTime?: number;
    annual?: number;
    currency: string;
  };

  baselineEal: number;
  scenarioEal: number;
  avoidedEal: number;

  baselineVar95: number;
  scenarioVar95: number;

  baselineRiskScore: number;
  scenarioRiskScore: number;

  residualRisk: number;

  assumptions: string[];
};
```

This becomes a direct input to portfolio optimization.

---

# 76. Scenario-to-Optimization Requirements

P5 must be able to query:

```text
investment option
scenario outcome
cost
risk reduction
dependencies
constraints
```

P4 therefore must expose stable identifiers.

Example:

```text
InvestmentOption:
INV-001

Scenario:
SCN-009

Outcome:
OUT-009
```

---

# 77. Optimization Precondition

An investment option should not enter P5 as:

```text
estimated 20% EAL reduction
```

when an authoritative scenario can calculate:

```text
₹1.8M avoided EAL
```

The scenario engine should be the primary source for quantified state-change outcomes.

Heuristic reductions may exist for early candidate generation, but they must be labeled and not confused with calculated scenario results.

---

# 78. Batch Scenario Execution

Support jobs such as:

```text
run MFA at 80%
run MFA at 90%
run MFA at 95%
```

or:

```text
one scenario for each investment option
```

The resulting curve becomes useful for P5.

Batch execution should reuse common baseline inputs safely.

---

# 79. Investment-Risk Reduction Curve

P4 should make it possible to generate:

```text
x = investment cost
y = avoided EAL
```

or:

```text
x = investment cost
y = residual risk
```

from a series of independently calculated scenarios.

This is not itself an optimization verdict.

---

# 80. Scenario Sensitivity Analysis

P4 may support varying one assumption:

```text
MFA coverage:
70%
80%
90%
95%
100%
```

and measuring:

```text
EAL
VaR
Risk Score
```

This helps identify diminishing returns.

---

# 81. Sensitivity Analysis Rules

A sensitivity run should declare:

```text
varied parameter
range
step
fixed parameters
model versions
```

The result should be labeled:

```text
Sensitivity analysis
```

not as a forecast certainty.

---

# 82. Scenario Expiration

A scenario may optionally have:

```text
expiresAt
```

because its assumptions may no longer be relevant when baseline state changes significantly.

Expiration should prevent accidental operational interpretation but should not erase historical results.

---

# 83. Scenario Staleness

Show:

```text
baseline age
current environment delta
```

Example:

```text
Scenario based on Sep 20 assessment
Current enterprise assessment Sep 29

Scenario may be stale
```

The user can create a new scenario from the current baseline.

---

# 84. Rebase Scenario

Optional future capability:

```text
rebase draft scenario onto latest baseline
```

Semantics:

```text
new baseline
+
same logical changes
+
new validation
```

Do not mutate the historical run.

---

# 85. Failure Modes

| Failure | Expected behavior |
|---|---|
| Missing baseline | Scenario cannot run |
| Baseline hash mismatch | Revalidate/recalculate |
| Invalid target | Validation failure |
| Invalid value | Validation failure |
| Broken dependency | Reject or explicit warning policy |
| P2 calculation failure | ScenarioRun failed; baseline untouched |
| P3 attribution failure | Scenario risk may remain valid; attribution marked unavailable |
| Timeout | Partial status + retry metadata |
| Model unavailable | Use only approved fallback or fail closed |
| Missing parameter | Require assumption or fail validation |
| Cross-tenant target | Reject |
| Hash failure | Do not mark result complete |
| Stale baseline | Warning / rebase suggestion |

---

# 86. Security Requirements

Scenario endpoints require:

```text
Firebase authentication
+
organization tenancy
+
role/permission checks
+
rate limiting
```

High-cost scenario execution should have stronger controls:

```text
approved role
job quota
concurrency limit
```

---

# 87. Authorization Matrix

Example:

| Action | Viewer | Analyst | Risk Manager | Admin |
|---|---:|---:|---:|---:|
| View scenario | Yes | Yes | Yes | Yes |
| Create scenario | No/optional policy | Yes | Yes | Yes |
| Run scenario | No | Yes | Yes | Yes |
| Approve scenario | No | No | Yes | Yes |
| Archive scenario | No | No/optional | Yes | Yes |
| Modify assumptions | No | Yes | Yes | Yes |
| Override governance status | No | No | Yes | Yes |

Exact role mappings should follow the existing SentinelStack authorization model.

---

# 88. Rate Limiting

Counterfactual execution can be computationally expensive.

Use quotas:

```text
max concurrent scenarios / organization
max simulations / day
max batch size
max runtime
```

Prefer asynchronous processing for expensive jobs.

---

# 89. Performance Targets

Initial engineering targets:

```text
simple scenario:
interactive response when computationally safe

complex scenario:
async job

batch:
queue-based execution
```

Exact latency SLOs should be benchmarked against the deployed environment rather than promised before profiling.

---

# 90. Observability Metrics

Track:

```text
scenario_create_total
scenario_validation_total
scenario_run_total
scenario_run_duration
scenario_run_failure_total
scenario_counterfactual_count
scenario_simulation_count
scenario_result_cache_hit_total
scenario_stale_baseline_total
scenario_p3_attribution_failure_total
```

Include:

```text
organizationId
scenarioId
scenarioRunId
baselineRiskRunId
```

Do not log raw sensitive scenario payloads by default.

---

# 91. Caching

Safe cache keys may include:

```text
organizationId
baselineRiskRunId
scenarioStateHash
modelBundleId
parameterBundleId
simulationConfigHash
```

If all match:

```text
previous scenario result may be reused
```

The system should record that the result was reused rather than pretending a new calculation occurred.

---

# 92. Idempotency

`POST /scenarios/{id}/run` should accept:

```text
Idempotency-Key
```

A retry with the same:

```text
scenarioStateHash
+
model bundle
+
parameter bundle
+
simulation configuration
```

must not create accidental duplicate results.

---

# 93. Database Model

Recommended entities:

```text
Scenario
ScenarioChange
ScenarioRun
ScenarioAssessment
ScenarioMetricDelta
ScenarioAssumption
ScenarioEvidence
```

Existing `RiskScenario` may be migrated/aliased into this target structure.

---

# 94. RiskScenario Migration

Current:

```text
RiskScenario
```

contains scenario information.

Target semantics:

```text
Scenario
    |
    +--> ScenarioChange
    +--> ScenarioRun
    +--> ScenarioAssessment
```

Migration:

```text
compatibility
    ->
dual-write
    ->
new API reads
    ->
legacy reads reduced
    ->
deprecation
```

Historical scenario data must remain accessible.

---

# 95. ScenarioAssessment

Recommended:

```text
id
scenarioRunId
riskAssessmentId
eal
var95
var99
financialExposure
riskScore
currency
riskEngineVersion
modelBundleId
parameterBundleId
calculationHash
createdAt
```

---

# 96. ScenarioMetricDelta

Recommended:

```text
id
scenarioAssessmentId
baselineMetric
scenarioMetric
delta
reduction
currency
metricVersion
```

For ratio/score metrics, currency is null.

---

# 97. ScenarioAssumption

Recommended:

```text
id
scenarioId
key
value
unit
source
sourceReference
version
confidence
createdAt
```

Example:

```text
mfa_target_coverage
0.95
ratio
security-policy
POL-0021
v3
HIGH
```

---

# 98. Scenario Evidence

Use references to P3 evidence where appropriate.

Do not duplicate large raw evidence payloads into every scenario.

Prefer:

```text
ScenarioEvidence
    scenarioId
    evidenceRecordId
    relationshipType
```

---

# 99. API Security Rules

All scenario IDs are resolved inside:

```text
organization scope
```

Error responses should avoid existence leakage.

Recommended behavior for unauthorized resource IDs:

```text
404
```

when the platform's security policy avoids distinguishing:

```text
does not exist
```

from:

```text exists but inaccessible
```

---

# 100. Scenario Testing Strategy

## 100.1 Unit Tests

Test:

```text
change application
field validation
operations
state resolver
hashing
delta calculations
cost normalization
```

## 100.2 Integration Tests

Test:

```text
DB persistence
P2 invocation
P3 invocation
ScenarioAssessment
tenant isolation
```

## 100.3 Contract Tests

Test:

```text
request schema
response schema
errors
idempotency
```

## 100.4 Regression Tests

Existing:

```text
cyber-risk enterprise
risk snapshots
dashboard
scenario compatibility
```

must continue to function during migration.

---

# 101. Golden Scenario Fixtures

Create deterministic fixtures:

```text
Fixture A — MFA improvement
Fixture B — patch critical CVE
Fixture C — segmentation
Fixture D — EDR rollout
Fixture E — combined portfolio
Fixture F — business-impact sensitivity
Fixture G — dependency change
```

Each fixture stores expected:

```text
scenario state
hash
risk metrics within tolerance
```

Exact numerical outputs depend on the model parameter fixture.

---

# 102. No-Mutation Test

Before scenario execution:

```text
capture baseline entity hashes
```

After scenario execution:

```text
re-read baseline entities
```

Assert:

```text
unchanged
```

This is a critical P4 acceptance test.

---

# 103. Scenario Reproducibility Test

Run the same scenario twice with:

```text
same baseline
same scenario state
same model
same parameter bundle
same simulation configuration
same random policy
```

Expected:

```text
same state hash
equivalent risk result within declared numerical tolerance
```

---

# 104. Scenario Comparison Test

Given:

```text
Baseline
Scenario A
Scenario B
```

the comparison API must return all three independently.

It must not derive B by:

```text
Baseline + delta_A
```

unless B is explicitly defined as a dependent scenario.

---

# 105. Interaction Test

For:

```text
A = MFA
B = EDR
A+B = combined
```

verify that:

```text
EAL(A+B)
```

comes from combined scenario calculation.

The platform must not assume:

```text
ΔEAL(A+B) = ΔEAL(A) + ΔEAL(B)
```

---

# 106. Stale Baseline Test

Create scenario from:

```text
RiskAssessment A
```

then change operational environment and calculate:

```text
RiskAssessment B
```

The original scenario should remain linked to A.

UI should show:

```text
scenario baseline older than current assessment
```

---

# 107. Evidence Semantics Test

Verify:

```text
observed baseline evidence
```

and:

```text
hypothetical scenario state
```

are clearly separated.

No scenario assumption should be exposed as operational evidence.

---

# 108. Human Approval Test

Verify:

```text
analyst runs scenario
risk manager approves scenario
```

while preserving:

```text
original scenario result
approval metadata
audit trail
```

---

# 109. API Test Matrix

| Endpoint | Test |
|---|---|
| `POST /scenarios` | create |
| `POST /scenarios/{id}/validate` | validate |
| `POST /scenarios/{id}/run` | run |
| `GET /scenarios/{id}/result` | result |
| `GET /scenarios/{id}/changes` | change list |
| `GET /scenarios` | list/filter |
| `POST /scenarios/{id}/clone` | clone |
| `POST /scenarios/compare` | comparison |

---

# 110. Frontend Hook Design

Suggested split:

```text
useScenarios()
useScenario()
useScenarioValidation()
useScenarioRun()
useScenarioResult()
useScenarioComparison()
```

Existing:

```text
useCyberRisk()
```

may remain for baseline risk.

Scenario hooks should not duplicate the P2 calculations in the browser.

---

# 111. Dashboard Integration

The executive dashboard can expose:

```text
What-if Analysis
```

from the current risk overview.

Example:

```text
Current EAL        ₹12.4M

What if:
Patch 5 KEVs

Estimated EAL     ₹9.8M
Modeled reduction  ₹2.6M
Residual risk      ₹9.8M
```

The user can then inspect:

```text
driver changes
cost
assumptions
```

---

# 112. Globe Integration

The globe can become scenario-aware.

Example:

```text
Baseline:
locations with concentrated exposure

Scenario:
segment external service in Mumbai region

Globe:
affected assets/services highlighted
```

The visualization remains derived from the scenario state and dependency graph.

No random “attack” effects should be generated.

---

# 113. Scenario Blast-Radius View

When a scenario changes an asset/service:

```text
target
   |
   +--> direct dependencies
   +--> downstream services
   +--> business units
   +--> affected locations
```

This supports the platform's decision-surface globe concept.

---

# 114. What-If Natural Language Interface

Users should be able to ask:

```text
What if we patch all KEVs on critical internet-facing assets?
```

or:

```text
What if MFA reaches 95% for privileged users?
```

LLM flow:

```text
Natural language
    |
    v
structured scenario proposal
    |
    v
human review
    |
    v
scenario creation
    |
    v
P4 validation
    |
    v
P2 calculation
    |
    v
result
```

The LLM does not directly modify risk state.

---

# 115. AI Guardrails

The AI layer may:

```text
translate intent
identify likely target entities
suggest changes
summarize results
```

It may not:

```text
invent target IDs
invent costs
invent risk reduction
execute unauthorized changes
```

Target resolution must be backend-validated.

---

# 116. Scenario Explanation

For:

```text
Why did this scenario reduce risk?
```

retrieve:

```text
baseline drivers
scenario drivers
driver deltas
scenario changes
```

Then produce a grounded explanation.

Example structure:

```text
EAL reduced by ₹2.6M.

Primary modeled changes:
- vulnerability exposure decreased
- external attack surface reduced
- control effectiveness increased

Residual drivers:
- identity dependency
- unpatched internal assets
```

Exact amounts must come from stored scenario calculations.

---

# 117. Scenario Assumption Audit

Every material user-edited assumption must record:

```text
actor
old value
new value
rationale
timestamp
```

This makes the scenario explainable later.

---

# 118. Reporting

A scenario report should contain:

```text
Scenario name
Baseline
Changes
Assumptions
Cost
Baseline metrics
Scenario metrics
Risk reduction
Residual risk
Driver changes
Evidence
Model versions
Parameter versions
Calculation hash
Approval history
```

---

# 119. Executive Summary Report

Use business terminology:

```text
Current modeled exposure
Modeled impact of proposed change
Estimated cost
Residual exposure
Key assumptions
Confidence/limitations
```

Avoid turning the report into a technical vulnerability dump.

---

# 120. Technical Scenario Report

Include:

```text
target assets
vulnerabilities
controls
telemetry
dependencies
evidence
model outputs
```

This is the engineer-facing counterpart.

---

# 121. Regulatory / Governance Evidence

Scenario reports may be useful as evidence of:

```text
risk assessment
control evaluation
management decision process
risk treatment analysis
```

But they should not be represented as proof of compliance automatically.

Framework-specific evidence mapping remains governed by the compliance module.

---

# 122. P4 Implementation File Map

## New

```text
src/services/scenario/scenario.service.ts
src/services/scenario/scenarioStateResolver.service.ts
src/services/scenario/scenarioValidator.service.ts
src/services/scenario/scenarioRun.service.ts
src/services/scenario/scenarioComparison.service.ts
src/services/scenario/scenarioHash.service.ts
src/services/scenario/scenarioCost.service.ts
src/services/scenario/scenarioTemplates.service.ts

src/controllers/scenario.controller.ts
src/routes/scenario.routes.ts

tests/unit/scenario/*
tests/integration/scenario/*
tests/contract/scenario/*
```

## Modify

```text
prisma/schema.prisma
src/routes/index.ts
src/routes/cyber-risk.routes.ts
src/services/cyberRiskQuantification.service.ts
src/services/risk/riskAssessment.service.ts
src/services/risk/driverAttribution.service.ts
```

Frontend:

```text
src/hooks/use-scenarios.ts
src/app/dashboard/risk-intelligence/*
src/components/dashboard/scenario/*
src/components/dashboard/ExecutiveRiskOverview.tsx
```

Use existing paths where repository structure already provides equivalent modules.

---

# 123. Migration Strategy

## Phase A — Compatibility

Keep current:

```text
simulateScenario()
RiskScenario
scenarioPresets
```

but mark them:

```text
legacy/prototype
```

## Phase B — New Engine

Implement:

```text
Scenario
ScenarioChange
ScenarioRun
ScenarioAssessment
```

## Phase C — Dual Path

For test fixtures:

```text
legacy result
vs
P4 result
```

Differences are expected where the old code used fixed multipliers.

## Phase D — Read Migration

New frontend reads:

```text
/api/v1/scenarios/*
```

## Phase E — Deprecation

Remove fixed multiplier logic from authoritative route.

---

# 124. Legacy Compatibility Rule

Existing endpoint:

```text
GET /api/cyber-risk/enterprise
```

must continue working.

If it exposes legacy scenarios:

```text
label as legacy
```

or adapt it to return scenario results produced by P4 where compatible.

Do not break current dashboard behavior during migration.

---

# 125. Rollback Strategy

Feature flag:

```text
SCENARIO_ENGINE_V2_ENABLED
```

Possible states:

```text
false:
legacy compatibility path

true:
P4 scenario engine
```

Rollback should disable new scenario execution without corrupting baseline RiskAssessment records.

---

# 126. Feature Flags

Recommended:

```text
SCENARIO_ENGINE_V2_ENABLED
SCENARIO_COUNTERFACTUAL_ENABLED
SCENARIO_BATCH_ENABLED
SCENARIO_AI_BUILDER_ENABLED
SCENARIO_GLOBE_ENABLED
SCENARIO_BLOCKCHAIN_ANCHOR_ENABLED
```

Default production behavior should favor safe, auditable paths.

---

# 127. Data Retention

Scenario result retention should follow organization policy.

Historical scenario packages should preserve:

```text
scenario state hash
risk assessment
model metadata
parameters
audit
evidence references
```

Deleting underlying live evidence must not silently rewrite historical scenario results.

---

# 128. Cost of Large Scenario Portfolios

For portfolio exploration, avoid calculating:

```text
2^N
```

all possible combinations for large N.

P4 should support bounded batch analysis.

P5 will perform constrained optimization using scenario outcomes and option metadata.

---

# 129. Scenario Candidate Generation

Possible candidate generation inputs:

```text
P3 top drivers
control gaps
critical vulnerabilities
high-exposure services
dependency concentration
risk appetite breaches
investment catalog
```

Candidate generation may be heuristic.

Final risk reduction must be calculated by P4/P2.

---

# 130. Example Candidate Flow

```text
Driver:
Critical vulnerability on internet-facing payment service

        |
        v
Recommendation:
Patch vulnerability

        |
        v
Scenario change:
VULNERABILITY.status = PATCHED

        |
        v
P2 recalculation

        |
        v
Avoided EAL = X

        |
        v
P5 investment option
```

This connects:

```text
risk driver
-> treatment
-> quantified outcome
-> investment decision
```

---

# 131. Scenario Governance Package

For a material scenario, create a package:

```text
Scenario metadata
Scenario state
Assumptions
Baseline assessment
Scenario assessment
Metric deltas
Driver changes
Evidence
Cost
Approval
Hashes
```

This package can later feed:

```text
audit
reporting
ledger anchor
investment decision
```

---

# 132. Decision Traceability

Final trace:

```text
Risk Driver
    |
    v
Scenario
    |
    v
Scenario Change
    |
    v
Scenario Risk Assessment
    |
    v
Risk Reduction
    |
    v
Investment Option
    |
    v
Optimization
    |
    v
Investment Decision
```

This is a core PS 26105 differentiator because it links technical risk to business investment without allowing the AI layer to invent the underlying numbers.

---

# 133. P4 Acceptance Matrix

| Area | Acceptance |
|---|---|
| Baseline immutability | Scenario never modifies operational baseline |
| State model | Scenario state is explicit and versioned |
| Changes | All changes typed and ordered |
| Validation | Invalid changes rejected |
| Calculation | P2 Risk Engine is reused |
| EAL | Scenario EAL calculated from scenario state |
| VaR | Scenario VaR uses loss-distribution quantile |
| Risk Score | Scenario score recalculated by P2 |
| Deltas | Signed deltas and reductions both available |
| Drivers | P3 attribution recalculated |
| Evidence | Baseline vs hypothetical state separated |
| Cost | Cost basis and currency explicit |
| Reproducibility | State/model/parameter hashes stored |
| Comparison | Baseline and scenarios independently calculated |
| Tenant security | Cross-tenant access denied |
| Performance | Expensive runs support async jobs |
| AI | Natural-language scenario proposals are backend validated |
| Blockchain | Optional integrity anchor only |
| Governance | Human approval separated from calculation |

---

# 134. P4 Definition of Done

P4 is accepted only when:

```text
1. Fixed EAL multipliers are no longer the authoritative scenario mechanism.
2. A scenario is represented as an immutable baseline plus explicit changes.
3. Scenario state can be resolved deterministically.
4. P2 Risk Engine v2 calculates the scenario result.
5. EAL, VaR95, VaR99, Financial Exposure and Risk Score are recalculated.
6. Baseline-to-scenario deltas are persisted.
7. P3 driver attribution can explain the resulting change.
8. Scenario assumptions are visible and versioned.
9. Hypothetical state is never represented as operational evidence.
10. Historical scenario runs remain reproducible.
11. Scenario comparison works across multiple alternatives.
12. Scenario costs can feed P5.
13. Human approval and calculation are separate.
14. Tenant isolation and no-mutation tests pass.
15. Expensive scenario work is bounded and asynchronous where necessary.
```

---

# Appendix A — Example MFA Scenario

```text
BASELINE
MFA coverage = 62%
EAL = ₹12.0M
VaR95 = ₹28.0M

SCENARIO
MFA coverage = 95%

COST
One-time = ₹4.5M
Annual = ₹1.2M

P2 RESULT
Scenario EAL = ₹9.1M
Scenario VaR95 = ₹21.8M

DERIVED
Avoided EAL = ₹2.9M
VaR95 reduction = ₹6.2M
Residual EAL = ₹9.1M
```

All numeric values are illustrative.

---

# Appendix B — Example Patch Scenario

```text
Baseline:
5 KEV vulnerabilities on critical internet-facing assets

Changes:
PATCH vulnerabilities 1–5

Expected engine effects:
reduced exploitation opportunity
updated frequency/likelihood inputs
updated aggregate loss distribution

Output:
new EAL
new VaR
new Risk Score
driver changes
```

The exact result is calculated by the Risk Engine.

---

# Appendix C — Example Combined Scenario

```text
Scenario:
"Critical attack-surface reduction"

Changes:
1. Patch critical KEVs
2. MFA 62% -> 95%
3. EDR 72% -> 100%
4. Segment internet-facing customer API

Cost:
₹...

Risk:
Baseline -> Scenario

Drivers:
vulnerability contribution decreases
identity-control contribution decreases
endpoint visibility improves
exposure contribution decreases

Residual:
remaining dependency and business-impact drivers
```

---

# Appendix D — Example API Result

```json
{
  "scenarioId": "scn-001",
  "scenarioRunId": "run-001",
  "baseline": {
    "eal": 12400000,
    "var95": 29000000,
    "riskScore": 78.4
  },
  "scenario": {
    "eal": 9600000,
    "var95": 22500000,
    "riskScore": 65.2
  },
  "delta": {
    "eal": -2800000,
    "var95": -6500000,
    "riskScore": -13.2
  },
  "reduction": {
    "eal": 2800000,
    "var95": 6500000,
    "riskScore": 13.2
  },
  "cost": {
    "oneTime": 4500000,
    "annual": 1200000,
    "currency": "INR"
  },
  "calculationHash": "sha256:..."
}
```

All numeric values are illustrative.

---

# Appendix E — Recommended Implementation Sequence

```text
P2 Risk Engine v2
       |
       v
P4 Database Models
       |
       v
Scenario State Resolver
       |
       v
Scenario Validator
       |
       v
Scenario Run Service
       |
       v
P2 Scenario Calculation
       |
       v
Scenario Result + Delta Persistence
       |
       v
P3 Driver Recalculation
       |
       v
API
       |
       v
Frontend Scenario Workspace
       |
       v
Batch/Sensitivity Analysis
       |
       v
P5 Investment Optimizer
```

---

# Appendix F — Engineering Guardrails

```text
DO:
- reuse P2
- preserve baseline
- persist assumptions
- version scenario state
- compare independently
- link to P3 evidence
- expose uncertainty
- make execution auditable

DO NOT:
- multiply EAL by a fixed scenario factor
- mutate production asset/control records
- claim hypothetical controls are deployed
- sum isolated scenario deltas as a substitute for combined calculation
- let LLM directly choose authoritative financial outcomes
- store sensitive enterprise data on-chain
- hide stale assumptions
```

---

# Status

**P4 Scenario Engine & What-If Recalculation Implementation Specification:** READY

P4 establishes the authoritative bridge from:

```text
risk driver
```

to:

```text
hypothetical treatment
```

to:

```text
quantified financial outcome
```

without changing the operational baseline.

The next dependent implementation phase is:

```text
P5 — Investment Optimization, Cost-Benefit, ROSI & Investment-vs-Risk-Reduction Curve
```

P5 will consume P4 scenario outcomes instead of relying on hardcoded risk-reduction percentages.
