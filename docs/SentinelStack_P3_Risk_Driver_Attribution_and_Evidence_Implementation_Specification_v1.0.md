# SentinelStack — P3 Risk Driver Attribution & Evidence Implementation Specification v1.0

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.0  
**Document Status:** P3 Implementation Engineering Baseline  
**Repository:** `github.com/ciphernet01/sentinelstack`  
**Primary Runtime:** Existing Express + TypeScript + Prisma/PostgreSQL  
**Primary P2 Dependency:** Risk Engine v2  
**Date:** 29 September 2026  
**Baselines:** PS 26105 • SRS v2.1 • SDD v1.2 • Data Dictionary v1.1 • Risk Model v1.1 • ML Spec v1.1 • API Contract v1.1 • Implementation Architecture v1.1 • P0/P1 Runbook v1.0 • P2 Risk Engine v2 Specification v1.0

> **Purpose:** Define how SentinelStack converts authoritative Risk Engine outputs into explainable, evidence-linked, persisted risk drivers that can be drilled from executive metrics to technical causes and source records.

> **Core rule:** A risk driver is not simply “the highest-risk asset.” It is a documented factor, condition, signal or business-context element that contributes to the modeled risk of a declared scope and can be traced to the calculation and supporting evidence.

---

# 1. Objective

P3 implements the **Risk Driver Attribution + Evidence** layer that follows P2.

The system must answer:

```text
Why is this risk high?
What changed?
Which factor contributed most?
How much financial risk is associated with that factor?
Which assets/services/business units are affected?
What evidence supports the conclusion?
Which calculation/model version produced it?
```

The output must support:

```text
Executive overview
      ->
Risk driver
      ->
Business/service/asset
      ->
Technical evidence
      ->
Source record
      ->
Risk run
      ->
Model / parameter bundle
      ->
Calculation result
```

---

# 2. Current Repository Gap

The current risk service exposes:

```text
topRiskDrivers
```

but those values are currently built from:

```text
asset-level risk rows sorted by expected annual loss
```

That is useful for prioritization but does not provide formal factor attribution.

The current persisted `RiskSnapshot` also stores driver-like information through a JSON field rather than a normalized evidence-linked risk-driver model.

P3 therefore adds:

```text
normalized RiskDriver
+
attribution method
+
contribution values
+
evidence references
+
calculation/run linkage
```

without discarding existing snapshot compatibility.

---

# 3. P3 Entry Criteria

P3 assumes P2 provides:

```text
RiskRun
RiskAssessment
EAL
VaR95
VaR99
Financial Exposure
Risk Score
control effectiveness
loss distribution
model/parameter versions
calculation hash
```

P3 must not create a second financial-risk calculation engine.

It consumes P2 outputs and explains them.

---

# 4. P3 Exit Criteria

P3 is complete when:

```text
[ ] Risk drivers are normalized
[ ] Drivers are linked to a RiskAssessment/RiskRun
[ ] Drivers have explicit attribution method
[ ] Contributions are numeric where the method supports it
[ ] Direction is explicit
[ ] Evidence references are persisted
[ ] Asset/service/BU hierarchy is retained
[ ] Drivers can be filtered by scope and type
[ ] Driver drill-down reaches source evidence
[ ] Driver output is reproducible for a fixed run
[ ] Driver changes can be compared across runs
[ ] UI no longer treats a sorted asset list as formal attribution
[ ] API exposes typed driver resources
[ ] Tenant isolation is enforced
[ ] Audit records exist for material driver/evidence mutations
```

---

# 5. Attribution Architecture

## 5.1 End-to-End Flow

```text
P2 RiskAssessment
        |
        v
Attribution Context
        |
        +--> Asset state
        +--> Vulnerabilities
        +--> Controls
        +--> Threat signals
        +--> Dependencies
        +--> Business impact parameters
        +--> Model outputs
        |
        v
Attribution Engine
        |
        +--> factor contribution
        +--> directional effect
        +--> scope hierarchy
        +--> confidence
        |
        v
RiskDriver records
        |
        +--> EvidenceReferences
        |
        v
Driver API
        |
        v
Executive + Technical UI
```

## 5.2 Authority Boundary

P3 does not alter:

```text
EAL
VaR
Financial Exposure
Risk Score
```

The attribution layer explains the authoritative result.

Where a counterfactual attribution requires recalculation, it must invoke the P2 Risk Engine through the same calculation contract rather than implement custom financial formulas.

---

# 6. Risk Driver Definition

A **Risk Driver** is a material factor whose observed or modeled state contributes to the risk result for a defined scope.

A driver has:

```text
identity
type
scope
entity reference
attribution method
contribution
direction
confidence
evidence
calculation linkage
version
```

## 6.1 Driver Types

Canonical types:

```text
VULNERABILITY
EXPOSURE
THREAT
CONTROL
DEPENDENCY
BUSINESS_IMPACT
ASSET_CRITICALITY
SERVICE_CRITICALITY
TELEMETRY_SIGNAL
MODEL_SIGNAL
DATA_COVERAGE
OTHER
```

Types may be extended through versioned schema change.

## 6.2 Examples

### Vulnerability

```text
CVE-YYYY-NNNN on internet-facing customer API
```

### Exposure

```text
Publicly reachable production service
```

### Control

```text
Privileged MFA coverage below target
```

### Dependency

```text
Identity service failure propagates to customer services
```

### Business impact

```text
High hourly downtime cost on critical service
```

### Data coverage

```text
Incomplete EDR visibility reduces confidence
```

A data-coverage driver may explain confidence limitations, but it must not be presented as a substantive cause of cyber loss unless the mathematical model explicitly defines it that way.

---

# 7. Attribution Methods

P3 supports more than one attribution strategy.

## 7.1 Method A — Model-Based Attribution

Used where an ML/statistical model exposes interpretable contributions.

Examples:

```text
SHAP
coefficient contribution
feature importance adjusted to observation
```

Required metadata:

```text
model_version
feature_set_version
prediction_id
attribution_method
```

## 7.2 Method B — Counterfactual Attribution

For deterministic model components:

```text
baseline risk
-
risk with selected driver neutralized
=
driver contribution estimate
```

Example:

```text
baseline EAL = ₹12M

remove internet exposure factor
counterfactual EAL = ₹9M

estimated contribution = ₹3M
```

This is a modeled attribution, not an observed realized loss.

## 7.3 Method C — Hierarchical Allocation

A total enterprise contribution can be allocated across:

```text
enterprise
    ->
business unit
    ->
service
    ->
asset
    ->
vulnerability/control/evidence
```

The allocation rule must avoid duplicating the same loss at multiple hierarchy levels.

## 7.4 Method D — Evidence Ranking

Some technical evidence is important but not directly convertible into monetary contribution.

Examples:

```text
critical alert
new KEV listing
control failure
stale EDR source
```

Such evidence can be ranked as supporting context with:

```text
materiality
relevance
recency
confidence
```

It must not be given a fake rupee contribution unless the risk model supports that conversion.

---

# 8. Driver Attribution Model

## 8.1 Driver Record

Recommended logical structure:

```ts
type RiskDriver = {
  id: string;
  riskAssessmentId: string;
  riskRunId: string;

  type: RiskDriverType;
  entityType: string;
  entityId: string;

  name: string;
  description?: string;

  attributionMethod:
    | "MODEL"
    | "COUNTERFACTUAL"
    | "HIERARCHICAL"
    | "EVIDENCE_RANKING";

  contributionToEal?: number;
  contributionToVar95?: number;
  contributionToVar99?: number;
  contributionToRiskScore?: number;

  direction:
    | "INCREASES_RISK"
    | "REDUCES_RISK"
    | "LIMITS_CONFIDENCE";

  confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

  rank: number;

  evidenceRefs: string[];

  attributionVersion: string;
  createdAt: string;
};
```

## 8.2 Contribution Semantics

Contributions must always declare the metric:

```text
EAL contribution
VaR95 contribution
VaR99 contribution
Risk Score contribution
```

Do not mix:

```text
₹ contribution to EAL
```

with:

```text
0–100 contribution to Risk Score
```

in one unnamed field.

---

# 9. Contribution Sign and Direction

A driver may:

```text
increase risk
reduce risk
limit confidence
```

Examples:

```text
Critical exploitable vulnerability
    -> INCREASES_RISK

Effective MFA control
    -> REDUCES_RISK

Missing EDR coverage
    -> LIMITS_CONFIDENCE
```

A confidence-limiting factor must not be represented as “negative cyber loss.”

---

# 10. Driver Decomposition

## 10.1 Enterprise-Level Drivers

Example:

```text
Enterprise Risk
    |
    +--> External exposure
    +--> Privileged identity weakness
    +--> Critical exploitable vulnerabilities
    +--> Service dependency concentration
    +--> High business impact
```

## 10.2 Business Unit Drivers

```text
Retail Banking
    |
    +--> customer API exposure
    +--> identity dependency
    +--> payment-service criticality
```

## 10.3 Service Drivers

```text
Customer API
    |
    +--> internet exposure
    +--> CVE vulnerability
    +--> low control coverage
```

## 10.4 Asset Drivers

```text
asset-001
    |
    +--> vulnerable package
    +--> exposed ingress
    +--> weak EDR
```

The same driver can appear at different scopes only when the attribution rule explicitly allocates it without double counting.

---

# 11. Evidence Model

A driver becomes materially more useful when the system can answer:

```text
Where did this driver come from?
```

## 11.1 Evidence Reference

Recommended:

```ts
type EvidenceReference = {
  id: string;

  sourceType:
    | "VULNERABILITY"
    | "SIEM"
    | "IAM"
    | "EDR"
    | "CSPM"
    | "ASSET_INVENTORY"
    | "THREAT_INTEL"
    | "BUSINESS_CONTEXT"
    | "MODEL"
    | "CALCULATION";

  sourceRecordId?: string;
  canonicalEntityType?: string;
  canonicalEntityId?: string;

  observedAt?: string;
  collectedAt?: string;
  ingestedAt?: string;

  sourceVersion?: string;
  evidenceHash?: string;

  reliability?: "HIGH" | "MEDIUM" | "LOW";
  metadata?: Record<string, unknown>;
};
```

---

# 12. Evidence Lineage

Canonical chain:

```text
Source Record
      |
      v
Ingestion Run
      |
      v
Canonical Record
      |
      v
Feature / Context
      |
      v
Prediction / Model Signal
      |
      v
Risk Run
      |
      v
Risk Assessment
      |
      v
Risk Driver
      |
      v
Recommendation / Scenario / Decision
```

Every material driver should be traceable to one or more nodes in this chain.

---

# 13. Current-to-Target Data Migration

## 13.1 Current

`RiskSnapshot.topDrivers` currently stores JSON-like driver information.

## 13.2 Target

Add normalized records:

```text
RiskAssessment
    |
    +--> RiskDriver
             |
             +--> EvidenceReference
```

## 13.3 Compatibility

Keep:

```text
RiskSnapshot.topDrivers
```

temporarily.

The new normalized API becomes canonical.

Legacy `topDrivers` can be generated from the normalized records.

---

# 14. Attribution Context

Create:

```text
src/services/risk/driverAttribution.service.ts
```

P3 service responsibilities:

```text
load assessment
load risk inputs
load model contributions
load evidence
calculate/store drivers
```

Suggested interface:

```ts
interface DriverAttributionService {
  attribute(
    context: RiskAttributionContext
  ): Promise<RiskDriverResult[]>;
}
```

---

# 15. Attribution Context Schema

```ts
type RiskAttributionContext = {
  organizationId: string;

  riskRunId: string;
  riskAssessmentId: string;

  scope: {
    type: "ENTERPRISE" | "BUSINESS_UNIT" | "SERVICE" | "ASSET";
    id: string;
  };

  asOf: Date;

  baseline: {
    eal: number;
    var95: number;
    var99: number;
    financialExposure: number;
    riskScore: number;
  };

  assets: unknown[];
  services: unknown[];
  vulnerabilities: unknown[];
  controls: unknown[];
  dependencies: unknown[];
  telemetry: unknown[];

  predictions: unknown[];

  parameters: unknown;
  modelBundle: unknown;

  inputStateHash: string;
};
```

---

# 16. Attribution Algorithm — Recommended First Implementation

P3 should initially use a controlled, auditable strategy rather than immediately depending on complex explainability tooling.

## 16.1 Stage 1 — Candidate Generation

Generate candidates from:

```text
open exploitable vulnerabilities
internet exposure
criticality
control gaps
threat activity
service dependencies
business impact
material telemetry
```

## 16.2 Stage 2 — Materiality Filter

Remove candidates that are:

```text
duplicate
stale
outside scope
non-material
unsupported by current evidence
```

## 16.3 Stage 3 — Contribution

Use one of:

```text
model attribution
counterfactual recomputation
approved deterministic contribution
```

depending on driver type.

## 16.4 Stage 4 — Normalize

Store:

```text
metric
contribution
direction
rank
confidence
```

## 16.5 Stage 5 — Evidence Linkage

Attach:

```text
source refs
prediction refs
calculation refs
```

## 16.6 Stage 6 — Persist

Write:

```text
RiskDriver
EvidenceReference
RiskDriverEvidence
```

or the equivalent reconciled data model.

---

# 17. Counterfactual Attribution

Counterfactual attribution should call the same Risk Engine.

## 17.1 Example

```text
BASELINE
   |
   v
Risk Engine
   |
   v
EAL = 10M

MUTATE ONE DRIVER
   |
   v
Risk Engine
   |
   v
EAL = 7M

Difference
   |
   v
3M modeled EAL contribution
```

## 17.2 Isolation

Only one controlled factor should be changed for one-at-a-time attribution unless a grouped attribution policy is explicitly configured.

## 17.3 Interaction Effects

Drivers may interact.

Example:

```text
internet exposure
+
critical vulnerability
```

may have a combined effect larger/different than the sum of isolated effects.

Therefore P3 should support:

```text
individual contribution
interaction contribution
```

when the mathematical model can identify it.

Do not claim additive contributions where interactions invalidate the assumption.

---

# 18. Driver Ranking

Ranking is a presentation property.

The API may sort by:

```text
contribution_to_eal
contribution_to_var95
contribution_to_risk_score
materiality
confidence
```

The ordering itself must not be treated as an additional risk metric.

## 18.1 Default Executive View

Use:

```text
Top financial contributors to modeled risk
```

rather than:

```text
Top vulnerable assets
```

unless the latter is specifically the requested view.

---

# 19. Evidence Quality

Each evidence record should have a quality state:

```text
HIGH
MEDIUM
LOW
UNAVAILABLE
```

Quality may reflect:

```text
source reliability
freshness
completeness
entity resolution certainty
observation confidence
```

Do not turn source freshness into a hidden numeric risk multiplier unless the Risk Model explicitly defines it.

---

# 20. Evidence Freshness

Track:

```text
observed_at
collected_at
ingested_at
processed_at
```

Then calculate:

```text
evidence_age
```

relative to:

```text
risk_run.asOf
```

## 20.1 Stale Evidence

If evidence exceeds its allowed freshness window:

```text
mark stale
reduce confidence
surface warning
```

Do not silently keep presenting it as fresh.

---

# 21. Risk Change Attribution

P3 should answer not only:

```text
Why is risk high?
```

but also:

```text
Why did risk change?
```

## 21.1 Run-to-Run Comparison

Given:

```text
RiskAssessment A
RiskAssessment B
```

compute:

```text
ΔEAL
ΔVaR95
ΔVaR99
ΔExposure
ΔRiskScore
```

Then compare drivers.

## 21.2 Driver Change Categories

```text
NEW
REMOVED
INCREASED
DECREASED
UNCHANGED
EVIDENCE_STALE
MODEL_CHANGED
PARAMETER_CHANGED
```

## 21.3 Example

```text
EAL increased by ₹2.4M

Contributing changes:
+ new internet exposure
+ critical vulnerability added
- MFA coverage improved
```

The amounts must be sourced from the same authoritative run comparison.

---

# 22. Model / Parameter Change Attribution

A risk change can come from:

```text
environmental state change
model change
parameter change
```

These must be separated.

Example:

```text
Risk increased

Environmental delta:
    new vulnerability

Model delta:
    likelihood model version changed

Parameter delta:
    business-impact assumption changed
```

P3 should not falsely attribute a model-version change to a cyber-control failure.

---

# 23. Evidence-Backed Drill-Down

Recommended hierarchy:

```text
Enterprise Risk
    |
    v
Driver
    |
    v
Business Unit
    |
    v
Service
    |
    v
Asset
    |
    v
Vulnerability / Control / Threat / Evidence
    |
    v
Source record
```

## 23.1 Executive Layer

Show:

```text
driver name
financial contribution
direction
confidence
affected business scope
```

## 23.2 Technical Layer

Show:

```text
CVE
CVSS
EPSS
KEV
asset
control state
telemetry
source timestamps
```

## 23.3 Governance Layer

Show:

```text
risk run
calculation hash
model bundle
parameter version
evidence references
decision history
```

---

# 24. API Contract

## 24.1 List Drivers

### `GET /api/v1/risk/drivers`

Query:

```text
scope_type
scope_id
risk_assessment_id
driver_type
direction
min_contribution
confidence
cursor
limit
```

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "riskAssessmentId": "uuid",
      "riskRunId": "uuid",
      "type": "VULNERABILITY",
      "entityType": "ASSET",
      "entityId": "uuid",
      "name": "Critical exploitable vulnerability on customer API",
      "attributionMethod": "COUNTERFACTUAL",
      "contributionToEal": 1200000,
      "contributionToVar95": 2500000,
      "contributionToRiskScore": 8.5,
      "direction": "INCREASES_RISK",
      "confidence": "HIGH",
      "rank": 1,
      "evidenceRefs": [
        "uuid"
      ],
      "attributionVersion": "driver-attribution-v1"
    }
  ]
}
```

## 24.2 Get Driver

### `GET /api/v1/risk/drivers/{driver_id}`

Return:

```text
driver
+
attribution
+
evidence
+
risk assessment
+
risk run
+
scope hierarchy
```

## 24.3 Evidence

### `GET /api/v1/evidence/{evidence_id}`

Return:

```text
source type
source record ID
canonical entity
timestamps
source version
hash
quality
```

Sensitive raw data should remain access-controlled.

## 24.4 Risk Changes

### `GET /api/v1/risk/changes`

Return:

```text
previous assessment
current assessment
metric deltas
driver changes
model/parameter changes
```

---

# 25. Database Design

## 25.1 RiskDriver

Recommended fields:

```text
id
organizationId
riskAssessmentId
riskRunId
type
entityType
entityId
name
description
attributionMethod
contributionToEal
contributionToVar95
contributionToVar99
contributionToRiskScore
direction
confidence
rank
attributionVersion
createdAt
```

Indexes:

```text
organizationId + riskAssessmentId
organizationId + type
riskRunId
entityType + entityId
```

## 25.2 EvidenceRecord

Recommended:

```text
id
organizationId
sourceType
sourceRecordId
canonicalEntityType
canonicalEntityId
observedAt
collectedAt
ingestedAt
sourceVersion
evidenceHash
reliability
metadata
createdAt
```

## 25.3 Driver-Evidence Link

Many-to-many is preferred:

```text
RiskDriverEvidence
    riskDriverId
    evidenceRecordId
    relationshipType
```

Relationship examples:

```text
PRIMARY_SUPPORT
SECONDARY_SUPPORT
CONTEXT
MODEL_INPUT
```

---

# 26. Tenant Isolation

Every driver/evidence query must enforce:

```text
authenticated organization
```

Examples:

```text
GET /risk/drivers/{id}
```

must verify:

```text
driver.organizationId == authorizedOrganizationId
```

Evidence lookup must perform the same validation.

Never rely only on:

```text
driver ID
```

because IDs can be guessed/leaked or cross-domain.

---

# 27. Audit Requirements

Material evidence mutations should create audit events.

Examples:

```text
EVIDENCE_LINK_CREATED
EVIDENCE_LINK_REMOVED
DRIVER_OVERRIDE_CREATED
DRIVER_OVERRIDE_UPDATED
ATTRIBUTION_RECALCULATED
```

## 27.1 Human Overrides

Human analysts may need to mark a driver as:

```text
confirmed
dismissed
needs-review
```

These are governance annotations.

They must not overwrite the original model attribution.

Store:

```text
original attribution
human annotation
actor
timestamp
rationale
```

---

# 28. Human Review

P3 should support an explicit review state:

```text
UNREVIEWED
REVIEWED
DISPUTED
ACCEPTED
REJECTED
```

This is a governance field, not a mathematical confidence score.

---

# 29. Confidence vs Review Status

Do not conflate:

```text
confidence = model/evidence certainty
```

with:

```text
review status = human governance state
```

Example:

```text
confidence: HIGH
review status: UNREVIEWED
```

is valid.

---

# 30. Frontend Integration

## 30.1 Current Executive Component

Existing:

```text
ExecutiveRiskOverview.tsx
```

currently presents:

```text
topRiskDrivers
```

from asset rows.

P3 changes the UI to consume:

```text
RiskDriver[]
```

## 30.2 Executive Driver Card

Show:

```text
Driver
Financial contribution
Direction
Affected scope
Confidence
Evidence count
```

## 30.3 Technical Drill-Down

Clicking a driver opens:

```text
driver
   |
   +--> affected service
   +--> affected assets
   +--> vulnerabilities
   +--> controls
   +--> telemetry
   +--> evidence
   +--> calculation
```

## 30.4 Do Not Show

Avoid unsupported UI such as:

```text
"Attack definitely caused ₹5M risk"
```

Use modeled wording:

```text
"Modeled EAL contribution"
```

or:

```text
"Evidence-linked contribution to modeled risk"
```

---

# 31. Global Cyber Risk Explorer Integration

The globe can use driver data as a scope-aware interaction surface.

## 31.1 Example

```text
Click location
     |
     v
assets in location
     |
     v
risk drivers
     |
     v
business/service impact
     |
     v
blast radius
```

## 31.2 Globe Rule

The globe must not create independent driver claims.

It visualizes drivers already present in the authoritative backend context.

---

# 32. Driver Change Timeline

A driver timeline can show:

```text
Date
Driver
Contribution
Direction
Evidence
Model version
```

Example:

```text
Sep 25
Critical vulnerability
+₹0.9M EAL contribution

Sep 27
MFA coverage improved
-₹0.4M modeled contribution

Sep 29
CSPM evidence stale
confidence reduced
```

The exact values must be generated from stored calculations.

---

# 33. Attribution Recalculation

Attribution should be recalculated when:

```text
risk assessment changes materially
model bundle changes
relevant evidence changes
parameter bundle changes
attribution method version changes
```

A driver recalculation should create a new attribution set rather than mutate historical records.

---

# 34. Caching

Driver APIs can use read caching if safe.

Cache key should include:

```text
organization
riskAssessmentId
driverType
scope
```

Do not serve one organization's driver list to another.

---

# 35. Performance

Driver attribution can become expensive if every candidate uses counterfactual recomputation.

Recommended staged approach:

```text
candidate generation
    ->
cheap deterministic/model attribution
    ->
top-N counterfactual validation
    ->
persist final drivers
```

Example:

```text
1000 candidates
    ->
rank/filter to 50
    ->
counterfactual top 20
    ->
persist top 10
```

The exact N is configuration, not a universal requirement.

---

# 36. Attribution Cost Controls

Configuration should define:

```text
MAX_DRIVER_CANDIDATES
MAX_COUNTERFACTUAL_RUNS
TOP_DRIVER_COUNT
ATTRIBUTION_TIMEOUT_SECONDS
```

If attribution exceeds budget/time:

```text
return partial result
+
warning
+
unprocessed candidate count
```

Do not fabricate completed attribution.

---

# 37. Data Quality Handling

P3 should handle:

```text
missing evidence
duplicate evidence
stale source records
unresolved entity
conflicting sources
```

## 37.1 Conflicting Evidence

When sources disagree:

```text
preserve both
record source precedence/policy
surface conflict
```

Do not silently choose one without a governed rule.

---

# 38. Evidence Provenance Rules

Every material evidence record should retain:

```text
source
source record ID
observed timestamp
collection timestamp
ingestion timestamp
source version
canonical entity
hash where applicable
```

Evidence should be immutable once used in a historical risk calculation, or historical references must point to a versioned copy.

---

# 39. Hashing

A driver record can carry:

```text
attribution_hash
```

computed from:

```text
riskAssessmentId
riskRunId
driver identity
attribution method/version
contribution values
evidence IDs
model bundle
parameter version
```

This helps detect accidental historical changes.

---

# 40. Blockchain Integration

For the Blockchain & Cybersecurity theme, an optional adapter can anchor:

```text
risk assessment hash
+
driver attribution set hash
+
decision/evidence package hash
```

Only minimal non-sensitive metadata should be anchored.

Recommended flow:

```text
Driver Set
    |
    v
canonical serialization
    |
    v
SHA-256
    |
    v
optional blockchain anchor
```

The blockchain anchor demonstrates integrity/provenance.

It does not prove that the driver attribution method is statistically correct.

---

# 41. Reporting

Risk reports should be able to include:

```text
Top financial drivers
Driver contribution
Evidence
Affected services
Affected business units
Control state
Confidence
Calculation hash
Model/parameter versions
```

A report must use persisted driver records, not recompute ad hoc in the PDF renderer.

---

# 42. Compliance Evidence Linkage

A driver/control may be associated with framework mappings:

```text
ISO/IEC 27001
NIST CSF
CIS Controls
RBI Cyber Security Framework
SEBI Cybersecurity and Cyber Resilience Framework
```

The implementation should keep:

```text
framework mapping
```

separate from:

```text
risk contribution
```

A control can be mapped to a framework without automatically receiving a financial contribution.

---

# 43. Recommendation Integration

P3 provides the evidence needed by P5.

Example:

```text
Driver:
Privileged MFA weakness

      |
      v
Affected controls:
CTRL-IAM-MFA

      |
      v
Recommendation:
Raise coverage

      |
      v
Scenario:
95% coverage

      |
      v
P4 scenario result:
ΔEAL / ΔVaR

      |
      v
P5 optimizer
```

This creates a traceable chain from problem to investment decision.

---

# 44. Driver-to-Scenario Linkage

When a scenario is created from a driver:

```text
scenario.sourceDriverId
```

may reference the originating driver.

The resulting scenario record should retain:

```text
driver
risk assessment
scenario
scenario assessment
delta
```

---

# 45. Risk Change Explanation API

Recommended endpoint:

### `GET /api/v1/risk/assessments/{id}/changes`

Response:

```json
{
  "data": {
    "previousAssessmentId": "uuid",
    "currentAssessmentId": "uuid",
    "metricDeltas": {
      "eal": 2400000,
      "var95": 5100000,
      "riskScore": 4.2
    },
    "driverChanges": [
      {
        "driverId": "uuid",
        "changeType": "NEW",
        "contributionToEal": 1800000
      }
    ],
    "modelChanges": [],
    "parameterChanges": [],
    "warnings": []
  }
}
```

---

# 46. Grounded AI Integration

The NLQ layer may ask:

```text
Why did EAL increase this week?
```

The backend should retrieve:

```text
previous/current assessments
+
driver changes
+
evidence
+
model/parameter changes
```

Then the LLM explains that verified result.

The LLM must not:

```text
invent drivers
invent contribution values
invent evidence
```

---

# 47. Explainability Rules

The API/UI should use precise wording:

### Supported

```text
"Modeled contribution to EAL"
"Evidence-linked risk driver"
"Counterfactual estimate"
"Model-derived contribution"
```

### Avoid

```text
"Guaranteed loss caused by..."
"Confirmed attack caused..."
"Exact future financial loss..."
```

unless the evidence/model semantics actually establish that statement.

---

# 48. Driver Override Governance

A human may correct:

```text
incorrect mapping
irrelevant evidence
duplicate driver
wrong business ownership
```

The system should store:

```text
original driver
human action
rationale
actor
timestamp
```

The original model-generated state must remain recoverable.

---

# 49. Audit/Event Model

Recommended event types:

```text
RISK_DRIVER_CREATED
RISK_DRIVER_RECALCULATED
RISK_DRIVER_REVIEWED
RISK_DRIVER_DISPUTED
RISK_DRIVER_ACCEPTED
RISK_DRIVER_REJECTED
RISK_DRIVER_EVIDENCE_LINKED
RISK_DRIVER_EVIDENCE_UNLINKED
```

Material events should include:

```text
organization
actor
resource
run
timestamp
hash
rationale where applicable
```

---

# 50. P3 File Change Plan

## New

```text
src/services/risk/driverAttribution.service.ts
src/services/risk/driverCandidate.service.ts
src/services/risk/driverCounterfactual.service.ts
src/services/risk/evidenceContext.service.ts
src/services/provenance/evidenceReference.service.ts

src/routes/risk-drivers.routes.ts

tests/unit/risk/drivers/*
tests/integration/risk/drivers/*
tests/contract/risk/drivers/*
```

Actual file organization may reuse an existing risk/provenance module when already created by P1/P2.

## Modify

```text
prisma/schema.prisma
src/services/risk/riskAssessment.service.ts
src/routes/cyber-risk.routes.ts
src/routes/index.ts
src/controllers/cyber-risk.controller.ts

src/hooks/use-cyber-risk.ts
src/app/dashboard/risk-intelligence/page.tsx
src/components/dashboard/ExecutiveRiskOverview.tsx
```

---

# 51. Recommended Prisma Relationship Direction

Conceptually:

```text
Organization
   |
   +--> RiskRun
   |      |
   |      +--> RiskAssessment
   |               |
   |               +--> RiskDriver
   |                        |
   |                        +--> RiskDriverEvidence
   |
   +--> EvidenceRecord
```

This allows:

```text
one evidence record
    ->
support multiple drivers
```

while preserving organization scope.

---

# 52. Driver Persistence Semantics

Historical driver records are append-oriented.

Correct:

```text
Assessment A
   ->
Driver Set A

Assessment B
   ->
Driver Set B
```

Do not update:

```text
Driver Set A
```

to represent the state of B.

---

# 53. Attribution Versioning

Every attribution calculation should store:

```text
attributionVersion
```

Example:

```text
driver-attribution-v1
```

Change the version when:

```text
ranking method changes
counterfactual policy changes
allocation policy changes
candidate rules change
driver semantics change
```

---

# 54. Reproducibility

Given:

```text
same RiskAssessment
same RiskRun
same model bundle
same parameter bundle
same attribution version
same evidence snapshot
```

P3 should produce the same driver set within declared numerical tolerance.

If stochastic attribution is used, record:

```text
seed
simulation count
attribution configuration
```

---

# 55. Driver Quality Tests

## 55.1 Identity

Driver must reference a valid:

```text
organization
risk assessment
risk run
entity
```

## 55.2 Metric

If:

```text
contributionToEal
```

is present, it must be in the risk assessment currency.

## 55.3 Direction

A driver marked:

```text
REDUCES_RISK
```

must not have a positive “risk-increase” semantic without documented sign convention.

## 55.4 Confidence

Confidence must come from:

```text
evidence/model coverage
```

or an explicit governance rule.

## 55.5 Evidence

Material financial drivers should have at least one supporting evidence reference unless the driver is explicitly a model/configuration factor.

---

# 56. Attribution Consistency Tests

For a selected test fixture:

```text
baseline EAL
```

and driver counterfactual:

```text
counterfactual EAL
```

should satisfy the documented attribution equation.

Example:

```text
ΔEAL_driver = EAL_baseline - EAL_counterfactual
```

when the driver is defined as risk-increasing.

The sign convention must be consistent across UI, API and stored records.

---

# 57. Interaction Tests

Test:

```text
Driver A only
Driver B only
A + B
```

If:

```text
effect(A+B) != effect(A)+effect(B)
```

the system should identify interaction/non-additivity rather than silently forcing additive totals.

---

# 58. Evidence Freshness Tests

Test:

```text
fresh evidence
stale evidence
missing evidence
```

Expected:

```text
fresh -> usable
stale -> warning/confidence impact
missing -> explicit limitation
```

---

# 59. Tenant Security Tests

Given:

```text
Organization A driver
Organization B user
```

expect:

```text
403/404
```

for driver and evidence retrieval.

Cross-tenant identifiers must not reveal:

```text
driver name
amount
entity
source
```

even in errors.

---

# 60. API Verification

## Drivers

```text
GET /risk/drivers
GET /risk/drivers/{id}
```

Verify:

- tenant filtering;
- pagination;
- filtering;
- stable schema;
- provenance.

## Evidence

```text
GET /evidence/{id}
```

Verify:

- tenant filtering;
- source fields;
- timestamp semantics;
- hash display.

## Changes

```text
GET /risk/assessments/{id}/changes
```

Verify:

- comparable assessments;
- metric deltas;
- driver changes;
- model/parameter changes.

---

# 61. Performance Strategy

## 61.1 Cheap Path

Use:

```text
precomputed model attribution
+
stored deterministic contributors
```

for normal dashboard loading.

## 61.2 Expensive Path

Use asynchronous job for:

```text
large counterfactual driver analysis
```

Example:

```text
POST /risk/drivers/recalculate
    ->
202
    ->
Job
```

## 61.3 Dashboard Rule

Do not trigger hundreds of counterfactual risk runs merely by opening a page.

---

# 62. Job Contract

Suggested job types:

```text
DRIVER_ATTRIBUTION
DRIVER_COUNTERFACTUAL
EVIDENCE_REINDEX
RISK_CHANGE_ANALYSIS
```

Job metadata:

```text
organization
riskAssessmentId
riskRunId
attributionVersion
candidate count
status
result reference
```

---

# 63. Observability

Track:

```text
driver_attribution_duration
driver_candidate_count
counterfactual_run_count
driver_evidence_link_count
driver_attribution_failures
stale_evidence_count
unresolved_evidence_count
```

Log:

```text
riskRunId
riskAssessmentId
attributionVersion
organizationId
```

Do not log raw sensitive source payloads by default.

---

# 64. Failure Handling

| Failure | Response |
|---|---|
| Missing risk assessment | 404 / no attribution |
| Missing evidence | Driver may be returned with limitation if mathematically valid |
| Counterfactual timeout | Partial result + warning |
| Entity unresolved | Driver marked unresolved, no fabricated mapping |
| Conflicting evidence | Preserve conflict + apply documented precedence |
| Attribution service failure | Risk assessment remains valid; attribution marked unavailable |
| Hash failure | Do not persist an unverifiable material result |
| Cross-tenant request | 403/404 |
| Invalid attribution version | 422 |

---

# 65. P3 Acceptance Matrix

| Area | Acceptance |
|---|---|
| Driver identity | Every driver links to scope + RiskAssessment + RiskRun |
| Attribution | Method stored and versioned |
| Financial contribution | Metric + currency semantics explicit |
| Evidence | Supporting references persisted |
| Freshness | Observation/collection times preserved |
| Confidence | Separate from human review status |
| Hierarchy | Enterprise → BU → service → asset supported |
| Run-to-run change | Driver additions/removals/changes detectable |
| Interactions | Non-additive effects not falsely summed |
| UI | Executive + technical drill-down use normalized drivers |
| AI | NLQ grounded in stored driver/evidence data |
| Audit | Material driver/evidence changes logged |
| Security | Tenant isolation validated |
| Performance | Counterfactual work bounded/asynchronous |
| Reproducibility | Same input/version bundle produces equivalent output |

---

# 66. P3 Definition of Done

P3 is accepted only when:

```text
1. The platform no longer treats "top assets by EAL" as its only driver mechanism.
2. Risk drivers have typed, persisted attribution records.
3. Drivers link to the exact RiskAssessment/RiskRun.
4. Contributions identify which metric they affect.
5. Evidence can be traced to source records.
6. Attribution method/version is persisted.
7. Run-to-run driver changes are explainable.
8. Human annotations do not destroy original model attribution.
9. Dashboard drill-down works from executive driver to technical evidence.
10. NLQ can answer "why did risk change?" from verified data.
11. Counterfactual attribution reuses the same Risk Engine when required.
12. Historical driver records remain immutable/append-oriented.
13. Tenant and security tests pass.
14. No unsupported contribution is presented as observed financial loss.
```

---

# Appendix A — Example Driver

The following is illustrative:

```json
{
  "id": "drv-001",
  "riskAssessmentId": "risk-001",
  "riskRunId": "run-001",
  "type": "VULNERABILITY",
  "entityType": "ASSET",
  "entityId": "asset-001",
  "name": "Critical exploitable vulnerability on customer API",
  "attributionMethod": "COUNTERFACTUAL",
  "contributionToEal": 1200000,
  "contributionToVar95": 2500000,
  "direction": "INCREASES_RISK",
  "confidence": "HIGH",
  "rank": 1,
  "attributionVersion": "driver-attribution-v1",
  "evidenceRefs": [
    "evidence-001",
    "evidence-002"
  ]
}
```

The values are illustrative only.

---

# Appendix B — Example Drill-Down

```text
Enterprise EAL
₹12.4M
    |
    v
Driver #1
Critical exploitable vulnerability
₹2.1M modeled contribution
    |
    v
Service
Customer API
    |
    v
Asset
customer-api-01
    |
    v
CVE
CVE-YYYY-NNNN
    |
    +--> CVSS
    +--> EPSS
    +--> KEV
    +--> patch state
    |
    v
Control State
MFA / EDR / network controls
    |
    v
Source Evidence
Vulnerability feed
Asset inventory
EDR
Threat intelligence
    |
    v
RiskRun
run-001
    |
    v
Calculation Hash
sha256:...
```

---

# Appendix C — Example Risk Change Explanation

```text
Previous EAL: ₹10.0M
Current EAL:  ₹12.4M
Change:       +₹2.4M

New/increased drivers:
+ Critical exploitable vulnerability       +₹1.5M
+ Internet exposure                         +₹0.8M
+ Dependency concentration                  +₹0.4M

Risk-reducing change:
- Improved MFA coverage                    -₹0.3M

Model/parameter changes:
None

Evidence warnings:
CSPM coverage stale for one cloud scope
```

These figures are illustrative. Production values must come from persisted risk assessments and driver calculations.

---

# Appendix D — Recommended API / Hook Split

Frontend hooks can evolve from:

```text
useCyberRisk()
```

to:

```text
useRiskCurrent()
useRiskDrivers()
useRiskChanges()
useRiskEvidence()
```

Shared query keys should include:

```text
organization
scope
riskAssessmentId
```

where the API client already derives the organization context from the authenticated session.

---

# Appendix E — Implementation Sequence

```text
P1
RiskRun + lineage
    |
    v
P2
Authoritative Risk Engine
    |
    v
P3
Driver attribution + evidence
    |
    +--> executive drill-down
    +--> technical evidence
    +--> risk-change explanation
    |
    v
P4
Scenario Engine
    |
    v
P5
Investment Optimizer
```

P3 therefore becomes the bridge between:

```text
calculated risk
```

and:

```text
decision support
```

---

# Status

**P3 Risk Driver Attribution + Evidence Implementation Specification:** READY

P3 must consume P2's authoritative results and must not introduce a second financial-risk calculation path.

The next dependent implementation phase is:

```text
P4 — Scenario Engine / What-If Recalculation
```

P4 will reuse the P2 calculation pipeline and P3 driver/evidence context to model control or state changes without mutating the operational baseline.
