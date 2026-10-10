# SentinelStack — Implementation & Repository Architecture Specification v1.1

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.1  
**Document Status:** Reconciled Implementation Engineering Baseline  
**Implementation Repository:** `github.com/ciphernet01/sentinelstack`  
**Primary Runtime:** Existing Next.js/React + Node.js/Express/TypeScript + Prisma/PostgreSQL application  
**Date:** 29 September 2026  
**Baselines:** PS 26105 • SRS v2.1 • SDD v1.2 • Data Dictionary & Database Schema v1.1 • Risk Quantification & Mathematical Model Specification v1.1 • ML Dataset & Training Specification v1.1 • API & Integration Contract v1.1 • Implementation Gap Analysis v1.0

> **Core reconciliation:** Implementation Architecture v1.0 described a greenfield-style monorepo with a FastAPI/Python primary API. v1.1 supersedes that topology for implementation. SentinelStack already exists as a substantial deployed application. This specification defines how PS 26105 is implemented **inside the existing repository**, while keeping Python as an optional, justified ML runtime rather than replacing the existing Express backend.

---

## Document Purpose

This document converts the approved SentinelStack requirements and design baselines into a repository-aware implementation plan.

It defines:

- repository structure;
- module boundaries;
- runtime architecture;
- migration strategy;
- data and risk-engine integration;
- ML integration;
- scenario and optimization integration;
- frontend/backend responsibilities;
- local and cloud deployment;
- CI/CD and quality gates;
- testing strategy;
- security and secrets handling;
- observability;
- implementation sequence;
- definition of done.

This document does **not** redefine the SRS.

Where the existing repository differs from the target design, this document records the implementation migration rather than silently treating planned functionality as already implemented.

---

# 1. Baseline and Reconciliation

## 1.1 Controlled Baseline Chain

```text
PS 26105
   |
   v
SRS v2.1
   |
   v
SDD v1.2
   |
   +--> Data Dictionary v1.1
   +--> Risk Model v1.1
   +--> ML Spec v1.1
   +--> API Contract v1.1
   +--> Implementation Gap Analysis v1.0
   |
   v
Implementation Architecture v1.1
   |
   v
Feature branches / migrations / code
```

## 1.2 Repository-Aware Reconciliation

| Area | Implementation Architecture v1.0 | v1.1 implementation decision |
|---|---|---|
| Repository | Proposed new monorepo structure | Use existing `ciphernet01/sentinelstack` repository. |
| Frontend | New `apps/web` | Preserve existing Next.js/React application. |
| API | FastAPI/Python primary | Preserve Express/TypeScript as primary API runtime. |
| Database | PostgreSQL | Keep existing PostgreSQL + Prisma. |
| ML | Python service | Optional Python training/inference boundary only where justified. |
| Risk engine | New service tree | Add modular `src/services/risk/*` domain behind compatibility façade. |
| Existing scanner product | Not repository-aware | Preserve assessments/findings/reports/scans/webhooks/auth/billing. |
| Scenario engine | Separate service | Add `src/services/scenario/*` within current backend first. |
| Optimizer | Separate service | Add `src/services/optimization/*` within current backend first. |
| NLQ | Separate service | Extend existing AI flows through read-only risk tools. |
| Ingestion | New monorepo service | Add modular connectors/normalizers inside existing backend until scale requires extraction. |
| Trust | SHA-256 + ledger adapter | Add provenance/hash module; optional ledger adapter later. |
| Deployment | Multi-container by default | Existing cloud deployment retained; split workers/services only when required. |
| Development sequence | Bootstrap first | Start from repository audit and migration guardrails; no destructive rebuild. |

## 1.3 Source-of-Truth Rule

The requirements/design documents describe the target product.

The repository describes what exists.

Therefore:

```text
Requirement != implementation status
```

A feature SHALL be described as implemented only after the corresponding code, persistence, tests and integration contract exist.

---

# 2. Implementation Principles

| Principle | Rule |
|---|---|
| PS-first | Every PS-26105 implementation item must map to a requirement or approved engineering task. |
| Preserve existing product | Do not break current authentication, scanning, assessment, reporting, compliance, billing or deployment flows. |
| Additive migration | Prefer additive schema/modules over destructive replacement. |
| Deterministic authority | Risk Engine owns authoritative EAL, VaR, Financial Exposure and Product Risk Score. |
| ML boundary | ML estimates uncertain variables and supplies versioned predictions; it does not own authoritative financial metrics. |
| LLM boundary | LLM explains verified backend results and cannot write authoritative risk values. |
| Evidence lineage | Material outputs trace to source state, model/parameter versions, assumptions and calculation hashes. |
| Free-first | Development and SIH demonstration must be possible without mandatory paid software licensing. |
| Local-first | Every important service path has a local development mode. |
| Secure by default | Tenant isolation, validation, RBAC, secrets and auditability are part of the core design. |
| Replaceable adapters | External security products are connectors, not embedded assumptions throughout business logic. |
| No false precision | Missing/stale/OOD inputs become visible uncertainty rather than fabricated numbers. |
| Version everything material | Risk, model, feature set, parameter bundle, scenario and API contracts are versioned. |
| Feature branch migration | Major risk-engine/schema changes are developed on feature branches and merged after regression. |

---

# 3. Current Repository Baseline

The existing repository is a substantial full-stack cybersecurity application.

## 3.1 Existing Runtime

```text
sentinelstack/
    Next.js / React frontend
            |
            v
    Node.js / Express / TypeScript backend
            |
            +--> PostgreSQL / Prisma
            +--> Firebase authentication
            +--> assessment/scanner pipeline
            +--> reporting/compliance
            +--> scheduled jobs / workers
            +--> public API/webhooks
            +--> AI/Genkit flows
            +--> PS-26105 risk foundation
```

## 3.2 Existing Repository Assets

The following areas are retained.

| Repository asset | Current role | v1.1 treatment |
|---|---|---|
| `src/server.ts` | Express runtime, middleware, health/readiness, worker startup | KEEP |
| `src/routes/index.ts` | Route mounting | EXTEND |
| `src/routes/cyber-risk.routes.ts` | Current enterprise risk/snapshot APIs | MODIFY behind risk façade |
| `src/controllers/cyber-risk.controller.ts` | Risk request handling | MODIFY |
| `src/services/cyberRiskQuantification.service.ts` | Current financial-risk foundation | REFACTOR behind Risk Engine v2 façade |
| `src/services/riskScoring.service.ts` | Legacy finding-severity score | KEEP separate |
| `src/routes/ai.routes.ts` | Existing AI chat | KEEP + grounded risk tool integration |
| `src/routes/public-api.routes.ts` | Existing API key public API | KEEP |
| `src/routes/dashboard.routes.ts` | UI-specific dashboard reads | KEEP |
| `src/hooks/use-cyber-risk.ts` | Current frontend risk contract | MODIFY |
| `src/app/dashboard/risk-intelligence/page.tsx` | Risk intelligence UI | MODIFY progressively |
| `src/components/dashboard/ExecutiveRiskOverview.tsx` | Executive risk presentation | MODIFY |
| `prisma/schema.prisma` | PostgreSQL schema | EXTEND incrementally |
| `scripts/seed-cyber-risk-digital-twin.js` | Existing PS risk demo context | EXTEND |
| `docs/` | Existing engineering documentation | UPDATE after implementation |

## 3.3 Existing PS-26105 Foundation

The repository already contains models/resources corresponding to:

```text
BusinessUnit
CyberAsset
AssetDependency
SecurityControl
AssetControl
CyberVulnerability
SecurityTelemetry
ThreatIntelIndicator
RiskSnapshot
RiskScenario
```

This means the implementation task is not “build the platform from zero.”

It is:

```text
existing cybersecurity platform
        +
existing PS-26105 foundation
        +
risk-engine / data / ML / governance hardening
        =
target PS-26105 platform
```

---

# 4. Target Repository Architecture

## 4.1 Existing Repository + Domain Modules

The target structure remains inside the current repository.

```text
sentinelstack/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed* / seed scripts
│
├── src/
│   ├── server.ts
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── config/
│   ├── ai/
│   │   └── flows/
│   │
│   ├── services/
│   │   ├── cyberRiskQuantification.service.ts   # compatibility façade
│   │   ├── risk/
│   │   ├── scenario/
│   │   ├── optimization/
│   │   ├── ingestion/
│   │   ├── provenance/
│   │   ├── evidence/
│   │   ├── model/
│   │   ├── compliance/
│   │   ├── reporting/
│   │   └── ...
│   │
│   ├── contracts/
│   │   ├── risk/
│   │   ├── ingestion/
│   │   ├── scenario/
│   │   ├── optimization/
│   │   └── api/
│   │
│   ├── types/
│   ├── utils/
│   └── logging/
│
├── ml/
│   ├── datasets/
│   ├── training/
│   ├── evaluation/
│   ├── registry/
│   └── models/
│
├── scripts/
│   ├── seed-cyber-risk-digital-twin.js
│   ├── build-ml-dataset.*
│   └── validate-risk-fixtures.*
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   ├── e2e/
│   ├── performance/
│   └── security/
│
├── docs/
│
├── public/
├── package.json
├── Dockerfile
├── docker-compose.yml
└── ...
```

## 4.2 Important Structural Rule

The goal is **modularity inside the existing repository**, not mandatory microservice decomposition.

Do not introduce:

```text
Kafka
Neo4j
OpenSearch
Kubernetes
separate graph database
separate vector database
multiple API gateways
```

merely because the conceptual architecture can show them.

Introduce a distributed component only after measured requirements justify the operational cost.

---

# 5. Domain Module Boundaries

## 5.1 Risk Domain

Recommended:

```text
src/services/risk/
├── riskRun.service.ts
├── evidenceContext.service.ts
├── likelihood.service.ts
├── severity.service.ts
├── lossDistribution.service.ts
├── riskScore.service.ts
├── driverAttribution.service.ts
├── calculationHash.service.ts
├── assumptions.service.ts
├── riskAssessment.service.ts
└── index.ts
```

### Responsibilities

`riskRun.service.ts`

- establish run identity;
- capture as-of timestamp;
- select model/parameter bundle;
- build input bundle;
- coordinate calculation;
- persist run state.

`evidenceContext.service.ts`

- load point-in-time asset/service/control/vulnerability/telemetry state;
- enforce evidence/coverage rules.

`likelihood.service.ts`

- consume baseline/statistical/ML probability estimates;
- apply the governed probability-to-frequency conversion;
- preserve model metadata.

`severity.service.ts`

- create/validate severity distributions;
- load financial-impact assumptions;
- enforce component semantics.

`lossDistribution.service.ts`

- sample incident frequency/severity;
- run Monte Carlo;
- create aggregate loss distribution;
- calculate EAL/VaR.

`riskScore.service.ts`

- calculate versioned 0–100 enterprise Product Risk Score;
- keep it separate from legacy finding score.

`driverAttribution.service.ts`

- calculate/evaluate risk drivers;
- store contribution and evidence references.

`calculationHash.service.ts`

- canonicalize calculation bundle;
- calculate hashes;
- support reproducibility/integrity.

`riskAssessment.service.ts`

- persist the final authoritative assessment;
- expose domain-level result.

## 5.2 Compatibility Façade

`src/services/cyberRiskQuantification.service.ts` remains temporarily available to existing callers.

Conceptually:

```text
Existing caller
     |
     v
CyberRiskQuantificationService
     |
     v
RiskAssessmentService
     |
     +--> RiskRun
     +--> Evidence Context
     +--> Likelihood
     +--> Severity
     +--> Loss Distribution
     +--> Drivers
     +--> Persist
```

The façade must not duplicate formulas.

Its purpose is compatibility during migration.

---

# 6. Scenario Domain

Recommended:

```text
src/services/scenario/
├── scenario.service.ts
├── scenarioState.service.ts
├── scenarioValidation.service.ts
├── scenarioExecution.service.ts
├── scenarioDelta.service.ts
└── index.ts
```

## 6.1 Scenario Contract

A scenario contains:

```text
baseline_assessment_id
scenario_version
changes[]
assumptions[]
model_bundle_version
parameter_bundle_version
```

## 6.2 Execution

```text
Baseline assessment
       |
       v
Copy relevant state
       |
       v
Apply explicit scenario changes
       |
       v
Build scenario evidence/feature context
       |
       v
Run same Risk Engine
       |
       v
Persist ScenarioAssessment
       |
       v
Compare baseline vs scenario
```

## 6.3 Scenario Invariants

- Baseline operational state must not change.
- Scenario changes must be explicit.
- Scenario output must be reproducible.
- Same model/parameter version is used unless the scenario definition explicitly changes them.
- Deltas are computed from comparable authoritative outputs.

---

# 7. Optimization Domain

Recommended:

```text
src/services/optimization/
├── candidateCatalog.service.ts
├── constraint.service.ts
├── optimizer.service.ts
├── portfolioEvaluation.service.ts
├── investmentCurve.service.ts
├── rosi.service.ts
└── index.ts
```

## 7.1 Pipeline

```text
Candidate Options
       |
       v
Applicability filtering
       |
       v
Dependency / exclusion rules
       |
       v
Cost + quantified benefit
       |
       v
Constrained optimization
       |
       v
Selected portfolio
       |
       v
Scenario recomputation
       |
       v
Residual EAL / VaR / Exposure
       |
       v
ROSI + investment curve
```

## 7.2 Solver Strategy

For an initial binary candidate set:

- exact dynamic programming may be used where constraints are simple;
- OR-Tools / ILP may be used when dependency/interactions become richer.

The implementation must document the actual objective and constraints.

## 7.3 No Greedy-Only Final Result

The current repository uses a greedy risk-reduction/cost approach.

That remains a screening mechanism only.

A final PS-26105 portfolio must use the governed optimizer semantics.

---

# 8. Ingestion and Normalization Domain

Recommended:

```text
src/services/ingestion/
├── connectorRegistry.service.ts
├── ingestionRun.service.ts
├── normalization.service.ts
├── entityResolution.service.ts
├── deduplication.service.ts
├── quality.service.ts
├── freshness.service.ts
└── adapters/
    ├── nvd/
    ├── epss/
    ├── kev/
    ├── siem/
    ├── iam/
    ├── edr/
    ├── cspm/
    ├── vulnerability/
    ├── threatIntel/
    └── assetInventory/
```

## 8.1 Connector Rule

Connectors convert source-specific data into canonical internal contracts.

Do not allow source-specific field names to propagate into the Risk Engine.

Example:

```text
SIEM event
   ->
SIEM adapter
   ->
CanonicalSecurityEvent
   ->
Evidence store
   ->
Risk context
```

## 8.2 Ingestion Run

Every ingestion run should record:

```text
source_id
started_at
completed_at
source_version
records_seen
records_accepted
records_rejected
quality_status
schema_version
ingestion_hash
```

---

# 9. Provenance and Evidence Domain

Recommended:

```text
src/services/provenance/
├── canonicalHash.service.ts
├── sourceLineage.service.ts
├── evidenceReference.service.ts
└── ledgerAdapter.service.ts
```

## 9.1 Evidence Chain

```text
source record
     |
     v
ingestion run
     |
     v
canonical record
     |
     v
feature/input bundle
     |
     v
model prediction
     |
     v
risk run
     |
     v
risk assessment
     |
     v
scenario/recommendation/decision
```

## 9.2 Hashing

Use SHA-256 over canonical representations.

A risk assessment should be reproducible from:

```text
risk_run_id
input_state_hash
model_bundle_version
parameter_bundle_version
simulation_configuration
result_hash
```

## 9.3 Blockchain Adapter

Optional:

```text
canonical risk hash
        |
        v
ledger anchor
```

The blockchain layer must not contain:

- raw SIEM logs;
- PII;
- secrets;
- raw financial records;
- large telemetry payloads;
- ML model computation.

---

# 10. Model / ML Integration Architecture

## 10.1 Repository Position

ML training is best maintained under:

```text
ml/
```

rather than making the existing API runtime depend on notebooks or training code.

Recommended:

```text
ml/
├── datasets/
│   ├── raw/
│   ├── canonical/
│   ├── snapshots/
│   └── manifests/
├── training/
├── evaluation/
├── registry/
└── models/
```

Large raw datasets and model binaries must not be committed to Git.

## 10.2 Runtime Boundary

```text
Risk Engine
    |
    v
ML Inference Adapter
    |
    +--> local model artifact
    |
    OR
    |
    +--> Python inference service
```

The risk domain should depend on the contract, not on the Python implementation.

## 10.3 Why Python Is Optional

Python is useful for:

- scikit-learn;
- XGBoost;
- Pandas;
- SciPy;
- model evaluation.

But a separate Python service adds:

- deployment overhead;
- authentication/service-to-service concerns;
- extra observability;
- version synchronization.

Therefore:

```text
offline training -> Python is preferred
simple inference -> local/runtime adapter may be sufficient
complex model serving -> optional Python service
```

---

# 11. Frontend Architecture

The existing frontend remains the presentation layer.

## 11.1 Responsibilities

Frontend code may:

- request API resources;
- render charts;
- render risk distributions;
- render drivers;
- render scenarios;
- render optimizer results;
- render confidence/provenance;
- provide interaction state.

Frontend code must not:

- calculate authoritative EAL;
- calculate VaR;
- calculate risk score;
- solve the optimizer;
- implement scenario financial formulas.

## 11.2 Risk Hook Migration

Current:

```text
src/hooks/use-cyber-risk.ts
```

Target direction:

```text
useRiskCurrent()
useRiskTrends()
useRiskDrivers()
useRiskScenario()
useOptimization()
useInvestmentOptions()
```

The hooks may share an API client and typed contracts.

## 11.3 Risk Intelligence Page

Current:

```text
src/app/dashboard/risk-intelligence/page.tsx
```

Target capabilities:

```text
current financial risk
risk score
EAL
true VaR
financial exposure
loss distribution
drivers
trends
data freshness
uncertainty
scenario builder
optimizer
investment curve
evidence drill-down
```

The migration should be incremental.

---

# 12. Global Cyber Risk Explorer / Globe Integration

The globe remains a frontend visualization but should consume real organization context.

## 12.1 Primary Role

The globe is a:

> **Geospatial control plane for understanding where enterprise cyber exposure, business dependencies, threat context and financial risk are concentrated.**

It is not a decorative country-risk heatmap.

## 12.2 Data Flow

```text
Asset / Service location
        |
        v
Risk API
        |
        +--> financial exposure
        +--> risk score
        +--> drivers
        +--> threat context
        |
        v
Globe / map projection
```

## 12.3 Interaction

Clicking an asset/service/location should scope:

```text
globe
   ->
selected scope
   ->
risk overview
   ->
drivers
   ->
dependencies
   ->
scenario / blast radius
```

## 12.4 Anti-Fabrication Rule

Do not show:

- fake attack arcs;
- random breach markers;
- unsupported country-level risk;
- synthetic “attacks” presented as real threat activity.

Geographic visualization must correspond to actual modeled/source-backed organization context.

---

# 13. Grounded AI / NLQ Architecture

Current AI functionality is preserved.

Target:

```text
User question
      |
      v
NLQ controller
      |
      v
Intent / scope parsing
      |
      v
Approved risk tools
      |
      +--> risk/current
      +--> drivers
      +--> trends
      +--> scenarios
      +--> optimizer
      |
      v
Verified structured result
      |
      v
LLM explanation
```

## 13.1 AI Security Boundary

The LLM must not receive unrestricted:

```text
SQL
database credentials
raw tenant database dumps
risk-write tools
investment approval mutation tools
```

It may receive approved read-only tool responses.

## 13.2 Answer Metadata

Risk-grounded answers should preserve:

```text
metric_refs
risk_assessment_id
calculation_hash
model_bundle_version
warnings
scope
```

---

# 14. Data Model Migration Strategy

The current Prisma schema is a foundation, not the final PS-26105 persistence model.

## 14.1 Existing-to-Target Direction

```text
RiskSnapshot
    |
    +--> preserve historical data
    |
    +--> associate with RiskRun
    |
    +--> evolve toward RiskAssessment
```

```text
RiskScenario
    |
    +--> preserve compatibility
    |
    +--> add explicit ScenarioChange records
    |
    +--> add ScenarioAssessment
```

## 14.2 Additive Migration

Recommended pattern:

```text
1. Add new tables/columns
2. Deploy code that can read old + new
3. Dual-write where needed
4. Backfill safe historical records
5. Switch reads to new canonical domain
6. Retain compatibility fields
7. Deprecate old fields only after migration evidence
```

## 14.3 Never Destructively Rewrite Historical Risk

Historical values must remain interpretable.

A model change must create a new versioned assessment rather than silently altering previous numbers.

---

# 15. Database and Prisma Implementation

## 15.1 Recommended New/Strengthened Domains

Implementation should incrementally cover:

```text
RiskRun
RiskAssessment
RiskDriver
ModelVersion
ModelPrediction
EvidenceRecord
SourceRecord
IngestionRun
IntegrationSource
Scenario
ScenarioChange
ScenarioAssessment
InvestmentOption
OptimizationRun
OptimizationSelection
InvestmentDecision
AuditEvent
AssetLocation
```

Exact table names follow Data Dictionary v1.1.

## 15.2 Organization Scoping

Every new persisted domain must be:

```text
directly organization-scoped
```

or:

```text
scoped through a parent with guaranteed organization ownership
```

## 15.3 Monetary Values

Current SIH implementation may remain INR-first.

Target schema should still retain explicit:

```text
currency_code
amount
precision / scale semantics
```

Do not infer currency from UI text.

---

# 16. Runtime Data Flow

## 16.1 Standard Continuous Risk Flow

```text
Source update
    |
    v
Ingestion
    |
    v
Validation
    |
    v
Canonicalization
    |
    v
Entity resolution
    |
    v
Digital Twin update
    |
    v
Materiality check
    |
    +---- no material change ----> normal scheduled run
    |
    +---- material change -------> priority risk run
                                  |
                                  v
                           Evidence context
                                  |
                                  +--> ML prediction
                                  |
                                  v
                           Risk Engine v2
                                  |
                                  v
                           Loss distribution
                                  |
                                  v
                      EAL / VaR / Exposure / Score
                                  |
                                  v
                           Driver attribution
                                  |
                                  v
                           Persist assessment
                                  |
                     +------------+-------------+
                     |                          |
                     v                          v
                  Dashboard                 Audit/evidence
```

## 16.2 Continuous Recalculation Triggers

| Trigger | Action |
|---|---|
| Critical vulnerability / known exploitation | Priority recalculation |
| Material control coverage/effectiveness change | Recalculate impacted scope |
| Material threat-intelligence change | Recalculate linked scope |
| Asset/service/dependency criticality change | Recalculate affected graph |
| Routine feed refresh | Scheduled batch recalculation |
| Manual analyst request | On-demand audited run |
| Approved remediation | Optional verification recalculation |

## 16.3 Materiality Layer

Materiality prevents every low-value event from launching a full enterprise simulation.

The materiality decision should consider:

```text
severity
asset criticality
scope
known exploitation
threat relevance
control change
business dependency
staleness
```

The exact policy must be configurable and versioned.

---

# 17. Job and Worker Architecture

The existing application already has a database-backed queue/worker pattern.

Extend that mechanism rather than replacing it immediately.

## 17.1 Heavy Operations

Use jobs for:

```text
large ingestion
risk recalculation
Monte Carlo simulation
scenario execution
optimization
compliance assessment
report generation
model evaluation
```

## 17.2 Worker Flow

```text
API
 |
 | create Job
 v
PostgreSQL job state
 |
 v
Worker loop
 |
 +--> execution
 |
 +--> progress
 |
 +--> result reference
 |
 v
completed/failed
```

## 17.3 Isolation

A worker must carry:

```text
organization scope
job ID
correlation ID
risk run ID
model bundle
parameter bundle
```

A worker must never derive tenant scope from untrusted job payload alone.

---

# 18. Local Development Architecture

## 18.1 Minimum Local Mode

Existing application should remain runnable with:

```text
Next.js
Express API
PostgreSQL
worker loop
```

Optional:

```text
Python ML environment
Prometheus/Grafana
local LLM
```

## 18.2 Free-First Principle

The SIH reference implementation must be buildable using:

- open-source packages;
- public data;
- synthetic fixtures;
- local services;
- available free tiers;
- existing infrastructure.

Paid enterprise connectors are optional.

## 18.3 Local Data Modes

Recommended:

```text
DATA_MODE=fixture
DATA_MODE=public
DATA_MODE=hybrid
DATA_MODE=enterprise
```

The active mode must be explicit.

---

# 19. Environment and Configuration

Configuration must be environment-driven.

## 19.1 Existing Configuration Direction

Examples:

```env
NODE_ENV=development
DATABASE_URL=postgresql://...
CLIENT_URL=http://localhost:3000
LLM_PROVIDER=disabled|free_api|local
MODEL_REGISTRY_MODE=filesystem|database
TELEMETRY_MODE=fixture|live
RISK_RECALC_HIGH_SEVERITY_MINUTES=15
RISK_RECALC_ROUTINE_HOURS=24
RISK_HISTORY_RETENTION_MONTHS=36
AUDIT_RETENTION_MONTHS=36
```

Actual variable names must match the repository implementation.

Do not invent a second configuration system.

## 19.2 Secret Rules

Never commit:

```text
API keys
Firebase private keys
database passwords
connector secrets
model-provider secrets
webhook signing secrets
```

Use environment/runtime secret injection.

---

# 20. Docker and Deployment

## 20.1 Existing Deployment Baseline

Retain the existing deployed application topology unless PS-26105 requirements create a measured need for separation.

## 20.2 Lean Deployment

```text
Web
 |
 v
Express API
 |
 +--> PostgreSQL
 |
 +--> Worker
 |
 +--> optional ML inference service
```

## 20.3 Scale-Out Path

When required:

```text
Load balancer
   |
   +--> API instances
   |
   +--> Worker instances
   |
   +--> ML inference instances
   |
   +--> PostgreSQL
```

No Kubernetes requirement exists for the SIH baseline.

---

# 21. CI/CD and Quality Gates

## 21.1 Commit Gate

Required where applicable:

```text
format
lint
type checks
unit tests
secret checks
```

## 21.2 Pull Request Gate

```text
unit tests
contract tests
migration validation
security checks
build
OpenAPI validation
```

## 21.3 Main Branch Gate

```text
integration tests
schema validation
container build
```

## 21.4 Release Gate

```text
E2E
security regression
performance smoke
risk math fixtures
scenario isolation
optimizer constraints
ML artifact validation
```

## 21.5 Demo Release Gate

Before SIH demonstration:

```text
database backup / seed reproducibility
health checks
risk calculation evidence
deterministic fixture replay
one full vertical slice
```

---

# 22. Testing Strategy

## 22.1 Unit Tests

Focus on:

```text
probability conversion
frequency calculations
severity distributions
Monte Carlo
VaR
risk score transforms
driver attribution
feature transforms
scenario deltas
optimizer constraints
ROSI
hash calculation
```

## 22.2 Integration Tests

Test:

```text
API -> Prisma -> Risk Run -> Risk Engine
API -> Scenario -> Risk Engine
API -> Optimization -> Scenario -> Risk Engine
Ingestion -> Canonicalization -> Risk
NLQ -> verified tools -> response
Audit -> material mutation
```

## 22.3 Contract Tests

Verify API implementations match the approved OpenAPI schemas.

## 22.4 Security Tests

Include:

- tenant isolation;
- RBAC;
- authentication;
- authorization bypass;
- injection;
- malformed connector payloads;
- oversized payloads;
- secret leakage;
- webhook signature verification;
- unauthorized risk writes;
- LLM tool boundary.

## 22.5 Mathematical Validation

Required:

### Probability

```text
0 <= p_h <= 1
```

### Frequency

```text
lambda >= 0
```

### Loss

```text
loss >= 0
```

### VaR

For `alpha1 < alpha2`:

```text
VaR(alpha1) <= VaR(alpha2)
```

### Monte Carlo reproducibility

Same:

```text
input state
+
model bundle
+
simulation configuration
+
seed
```

must produce equivalent outputs within declared tolerance.

### Scenario delta

```text
DeltaEAL = EAL_scenario - EAL_baseline
```

and similarly for VaR/exposure/score according to their defined semantics.

### Optimization

Verify:

```text
selected_cost <= budget
```

and all declared dependencies/exclusions.

---

# 23. Observability

## 23.1 Application Metrics

Track:

```text
API latency
HTTP error rate
job duration
queue depth
database latency
worker failures
```

## 23.2 Risk Metrics

Track:

```text
risk run count
risk run duration
simulation count
stale assessments
calculation failures
input coverage
hash verification
```

## 23.3 ML Metrics

Track:

```text
model version
prediction volume
missingness
OOD rate
drift indicators
calibration metrics
prediction distribution
```

## 23.4 Data Quality

Track:

```text
freshness
duplicates
unknown entities
schema failures
source rejection count
lineage coverage
```

## 23.5 Operational Distinction

Do not classify every stale assessment as a risk-engine failure.

Examples:

```text
source outage
    ->
stale input
    ->
lower coverage
    ->
visible freshness warning
```

versus:

```text
source available
    ->
risk engine crashed
    ->
calculation failure
```

The UI and operations layer must distinguish these.

---

# 24. Security Architecture

The existing security middleware is inherited.

The PS-26105 extension must preserve:

```text
Helmet
CORS allowlist
request IDs
rate limiting
Firebase authentication
RBAC
organization scoping
structured logs
health/readiness
```

## 24.1 Data Access Rule

Every new service method must receive authorized organization scope from the application context.

Do not accept:

```text
organization_id
```

as an unchecked arbitrary query parameter.

## 24.2 Risk Data Rule

Risk APIs return only records within authorized organization scope.

## 24.3 LLM Data Rule

LLM tools expose only the minimum structured data required to answer a request.

## 24.4 Audit Rule

Material events should include:

```text
actor
organization
timestamp
resource
action
source refs
run ID
content hash
```

---

# 25. Data Retention

PS-26105 requires retained risk history and source-to-decision lineage.

## 25.1 Retained

Keep according to policy:

```text
risk assessments
risk runs
model versions
predictions
calculation hashes
evidence references
audit events
decision records
```

## 25.2 Raw Telemetry

Raw telemetry may have shorter retention.

The design target is:

```text
raw telemetry ages out
        |
        v
derived lineage / hashes / evidence references remain
        |
        v
historical risk decision remains explainable within policy
```

Retention implementation must preserve the ability to replay or explain authoritative decisions when required.

---

# 26. Risk Calculation Implementation Plan

## 26.1 Current → Target

| Function | Current state | Target |
|---|---|---|
| Likelihood | Hand-tuned factors | Calibrated statistical/ML provider |
| Impact | Point impact | Distributional severity |
| EAL | Point impact × annual likelihood | Mean annual aggregate loss |
| VaR | Multiplier proxy | Quantile of annual loss distribution |
| Score | Legacy finding severity | Versioned enterprise financial-risk score |
| Drivers | High-EAL assets | Evidence/model attribution |
| Scenario | Fixed multipliers | Explicit state mutation + recomputation |
| Optimizer | Greedy ratio | Exact/declared constrained portfolio solver |
| AI | Summary | Grounded verified-metric explanation |
| Audit | Generic AuditLog | PS-specific analytical lineage + hashes |
| Blockchain | Not demonstrated | Optional hash-anchor adapter |

---

# 27. Risk Engine Versioning

Risk engine calculations must identify:

```text
risk_engine_version
parameter_version
model_bundle_version
feature_set_version
simulation_config_version
```

Example:

```text
risk-engine-v2.0
params-2026-09
bundle-001
features-v2
mc-50000-v1
```

The exact strings are implementation-defined.

Historical assessments must retain these values.

---

# 28. ML Implementation Sequence

## Phase P6

```text
1. Dataset ingestion
2. Canonical point-in-time builder
3. Label builder
4. Leakage scanner
5. Temporal split
6. Logistic baseline
7. Tree challenger
8. Calibration
9. Temporal evaluation
10. Model registry
11. Inference adapter
12. Risk Engine integration
```

## Promotion Modes

```text
Experimental
   ->
Shadow
   ->
Advisory
   ->
Promoted
   ->
Retired
```

A model is not production-authoritative simply because training completed successfully.

---

# 29. Frontend Delivery Sequence

The UI work follows the underlying domain maturity.

## Stage 1

Display:

```text
current risk
EAL
VaR
financial exposure
risk score
freshness
```

only from the governed backend contract.

## Stage 2

Add:

```text
drivers
evidence
risk trend
loss distribution
```

## Stage 3

Add:

```text
scenario editor
what-if comparison
```

## Stage 4

Add:

```text
investment options
budget selector
optimizer
ROSI
investment curve
```

## Stage 5

Add:

```text
grounded NLQ
decision pack
governance evidence
```

This sequencing prevents presentation features from creating unsupported claims.

---

# 30. Minimum Complete Vertical Slice

The first implementation milestone must prove:

```text
Security input
    |
    v
Canonical normalized record
    |
    v
Evidence context
    |
    v
Risk calculation
    |
    v
Financial exposure
    |
    v
Risk driver
    |
    v
Mitigation candidate
    |
    v
Scenario
    |
    v
Budget optimization
    |
    v
Investment decision
    |
    v
Audit / evidence chain
```

The vertical slice should use:

- deterministic fixtures;
- explicit assumptions;
- reproducible calculation settings;
- no unsupported claims about real enterprises.

---

# 31. Development Sequence

The repository-aware implementation order is:

| Phase | Work package | Main targets | Exit evidence |
|---|---|---|---|
| P0 | Baseline + guardrails | Branch, tests, migration policy | Existing product regression passes |
| P1 | Risk-run + lineage foundation | Prisma, run façade, hashes | Run is persisted/replayable |
| P2 | Risk Engine v2 | `src/services/risk/*` | Distributional EAL/VaR passes tests |
| P3 | Drivers | Attribution + evidence | UI driver traces to evidence |
| P4 | Scenario engine | `src/services/scenario/*` | Scenario isolated + recomputed |
| P5 | Optimizer | `src/services/optimization/*` | Constraints + portfolio evaluation pass |
| P6 | ML likelihood | `ml/*`, model adapter | Temporal/calibration evidence |
| P7 | Grounded NLQ | AI tool boundary | Verified metrics match response |
| P8 | Governance/trust | Audit/evidence/ledger adapter | Decision chain auditable |
| P9 | Hardening | Performance/security/drift | Release gates pass |

---

# 32. Migration Safety Rules

## 32.1 Branching

Major migration work must use a feature branch.

Recommended:

```text
feature/ps26105-risk-engine-v2
feature/ps26105-risk-lineage
feature/ps26105-scenarios
feature/ps26105-optimizer
feature/ps26105-ml-likelihood
```

Exact naming is optional.

## 32.2 No Direct Main Migration

Do not perform a broad Prisma/risk-engine migration directly on `main`.

## 32.3 Backward Compatibility

During transition:

```text
old route
   ->
compatibility controller
   ->
new domain service
```

rather than maintaining two separate risk implementations.

---

# 33. Git and Change Management

Every significant implementation change should include:

```text
requirement reference
design reference
migration impact
API impact
test impact
rollback considerations
```

Commit messages should identify meaningful domains, for example:

```text
risk: add versioned calculation runs
risk: implement aggregate loss simulation
scenario: add copy-on-write execution
optimizer: enforce dependency constraints
ml: add temporal likelihood baseline
api: add risk trends endpoint
```

---

# 34. Documentation Synchronization Rules

When code changes:

| Change | Documentation impact |
|---|---|
| Database model | Data Dictionary v1.x |
| Risk formula | Risk Model v1.x |
| ML target/features | ML Spec v1.x |
| API path/schema | API Contract/OpenAPI v1.x |
| Repository topology | Implementation Architecture v1.x / SDD |
| Requirement change | SRS review |
| Deployment change | SDD + Implementation Architecture |
| New trust mechanism | SDD + Risk/API docs |

Never allow code and controlled documentation to drift silently.

---

# 35. Free-First Technology Baseline

| Layer | Preferred implementation | Reason |
|---|---|---|
| Frontend | Existing Next.js + React + TypeScript + Tailwind + Recharts | Already deployed |
| API | Existing Express + TypeScript | Avoid unnecessary rewrite |
| Auth | Existing Firebase | Already integrated |
| DB | PostgreSQL + Prisma | Existing production data layer |
| Risk statistics | TypeScript initially; Python where quantitative libraries are materially useful | Minimize unnecessary services |
| ML | scikit-learn + XGBoost candidate | Free/open-source |
| Numerical simulation | NumPy/SciPy where Python is used | Mature statistical tooling |
| Optimization | Exact DP or OR-Tools | Free/open-source |
| Jobs | Existing DB-backed worker pattern | Already available |
| AI | Existing Genkit integration + replaceable provider/local mode | Preserve current product |
| Evidence integrity | SHA-256 | Simple and portable |
| Blockchain | Optional testnet/local/permitted permissioned ledger | Theme-specific extension |
| Containers | Docker / Docker Compose | Reproducible local deployment |
| CI/CD | GitHub Actions | Repository-integrated |
| Observability | Existing structured logging + incremental metrics | Avoid premature infrastructure |

---

# 36. Deferred Infrastructure Decisions

The following are deliberately not mandatory for the SIH baseline:

```text
Kafka
Neo4j
OpenSearch
Kubernetes
vector database
service mesh
dedicated API gateway
distributed feature store
enterprise model-serving platform
```

These may become valid later if evidence demonstrates:

```text
scale requirement
latency requirement
volume requirement
operational need
```

Architecture quality is not measured by the number of infrastructure products introduced.

---

# 37. Failure Modes and Fallbacks

| Failure | Required response |
|---|---|
| Database unavailable | Fail writes safely; readiness fails |
| Source connector unavailable | Retry + stale/coverage state |
| ML unavailable | Approved deterministic/statistical fallback or limited-confidence result |
| OOD model input | Flag OOD; suppress false-precision authoritative calculation when material |
| Scenario invalid | Validation error; no fabricated result |
| Optimization infeasible | Return explicit constraints conflict |
| LLM unavailable | Core risk functionality remains usable |
| Hash mismatch | Surface integrity warning and audit event |
| External threat feed delayed | Keep previous evidence timestamp and freshness state |
| Model artifact missing | Do not silently substitute unknown artifact |
| Migration conflict | Stop/reconcile before destructive retry |

---

# 38. Performance Strategy

The existing synchronous enterprise risk calculation should evolve toward job-backed execution for heavier PS-26105 calculations.

## 38.1 Performance-Sensitive Areas

```text
large-tenant evidence assembly
Monte Carlo simulation
portfolio optimization
trend aggregation
source ingestion
large scenario trees
```

## 38.2 Performance Techniques

Use only when measured:

```text
incremental recalculation
scope-level caching
result reuse
batch queries
database indexes
bounded simulation counts
worker parallelism
precomputed trend read models
```

Do not trade correctness for a dashboard response time target.

---

# 39. Caching and Read Models

The dashboard should preferably read persisted risk assessments/read models rather than recomputing the entire risk engine on every page load.

Preferred flow:

```text
Risk Run
    |
    v
Persist RiskAssessment
    |
    v
Read API
    |
    v
Dashboard
```

A read endpoint may calculate lightweight presentation transformations, but not a new authoritative financial risk calculation.

---

# 40. API Implementation Mapping

The v1.1 API contract maps to existing Express routes.

| Target capability | Existing / planned implementation |
|---|---|
| Current risk | Keep `/api/cyber-risk/enterprise`; introduce canonical `/api/v1/risk/current` mapping |
| Persist assessment | Keep `/api/cyber-risk/snapshots` during migration; map to RiskRun/RiskAssessment |
| Risk recalculation | Add job-backed route |
| Risk trends | Add canonical endpoint |
| Risk drivers | Add canonical endpoint |
| Scenario simulation | Add new scenario route |
| Recommendations | Add typed recommendation route |
| Optimization | Add job-backed optimization route |
| NLQ | Extend AI layer through grounded tools |
| Audit | Add PS-specific analytical audit route |
| Evidence | Add evidence/lineage read endpoint |
| Model metadata | Add controlled model/prediction read contract |

---

# 41. Repository-to-Requirement Traceability

| Requirement | Primary implementation area | Supporting code |
|---|---|---|
| FR-01/02 | Ingestion domain | routes, connectors, normalizers, Prisma |
| FR-03 | Risk-run orchestration | job worker + risk domain |
| FR-04 | Likelihood + ML adapter | `risk/likelihood`, `ml/*` |
| FR-05 | Severity/loss model | `risk/severity`, `risk/lossDistribution` |
| FR-06 | Risk assessment | `risk/riskAssessment`, Prisma |
| FR-06B | Risk score | `risk/riskScore` |
| FR-07 | Digital Twin | assets/services/dependencies |
| FR-08 | Controls | controls + asset-control |
| FR-09 | Drivers | attribution/evidence domain |
| FR-10 | ML/anomaly/trends | ML + trend read models |
| FR-11 | Recommendations | recommendation domain |
| FR-12/12A | Business translation/NLQ | AI tools + verified API |
| FR-13 | Scenarios | scenario domain |
| FR-14–19 | Optimization/investment | optimizer + investment domain |
| FR-20 | Executive dashboard | current risk UI + read APIs |
| FR-21 | Technical dashboard | technical risk views |
| FR-22 | Drill-down | driver/evidence APIs |
| FR-23 | Compliance | compliance module |
| FR-24 | Reporting/evidence | reporting + evidence |
| NFR-01/02/06 | Security | middleware + tenant/RBAC |
| NFR-07 | Interoperability | integration contracts |
| NFR-08 | Auditability | provenance + audit + hashes |
| NFR-09 | Cloud readiness | current modular runtime + workers |
| NFR-10 | Retention/lineage | ingestion/evidence/retention services |

---

# 42. Definition of Done

A PS-26105 implementation feature is complete only when applicable conditions are met.

## Product correctness

- mapped to a requirement/task;
- current behavior is preserved unless intentionally changed;
- authoritative risk logic resides in the Risk Engine domain.

## Data correctness

- point-in-time semantics enforced;
- tenant scope enforced;
- provenance stored;
- synthetic/private/public data identified correctly.

## API correctness

- canonical request/response schema exists;
- OpenAPI is updated;
- errors use the common problem contract;
- async/idempotency behavior is implemented where required.

## Mathematical correctness

- formulas tested;
- simulation reproducible;
- VaR derived from a declared distribution;
- scenario deltas consistent;
- optimizer constraints verified.

## ML correctness

- target defined;
- temporal split used;
- calibration tested;
- uncertainty/OOD visible;
- model version persisted;
- inference contract tested.

## Security

- authentication;
- authorization;
- tenant isolation;
- secret safety;
- input validation;
- rate limiting;
- audit for material actions.

## Operations

- logs;
- request/correlation IDs;
- health/readiness;
- job monitoring;
- failure behavior;
- rollback plan.

## Documentation

- affected controlled document updated;
- migration notes recorded;
- example payloads reflect current implementation.

---

# Appendix A — Concrete Repository Change Map

| Priority | Path | Change |
|---|---|---|
| P0 | `prisma/schema.prisma` | Add/strengthen RiskRun, RiskAssessment and lineage domains |
| P0 | `src/services/cyberRiskQuantification.service.ts` | Convert to compatibility façade |
| P0 | `src/services/risk/` | Create modular Risk Engine |
| P0 | `src/controllers/cyber-risk.controller.ts` | Add run/version/coverage behavior |
| P0 | `src/routes/cyber-risk.routes.ts` | Preserve old paths + introduce versioned capability routes |
| P0 | `src/routes/index.ts` | Mount new route families |
| P0 | `src/hooks/use-cyber-risk.ts` | Migrate to versioned contract |
| P1 | `src/services/provenance/` | Canonical hash/evidence chain |
| P1 | `src/services/scenario/` | Copy-on-write scenario engine |
| P1 | `src/services/optimization/` | Candidate/constraint/solver services |
| P1 | `src/services/ingestion/` | Source registry + canonicalization |
| P2 | `ml/` | Dataset/training/evaluation/registry pipeline |
| P2 | `src/services/model/` | ML inference adapter |
| P2 | AI flows | Verified risk-tool grounding |
| P2 | `src/app/dashboard/risk-intelligence/page.tsx` | Consume canonical risk contract |
| P2 | `src/components/dashboard/ExecutiveRiskOverview.tsx` | Replace proxy wording with authoritative metrics |
| P3 | Globe components | Bind geographic context to real asset/service risk scope |
| P3 | `scripts/seed-cyber-risk-digital-twin.js` | Add reproducible synthetic provenance |
| P4 | `tests/` | Expand mathematical/security/contract/E2E coverage |
| P4 | `docs/SENTINELSTACK_26105_FOUNDATION.md` | Record actual post-implementation state |

---

# Appendix B — Recommended Internal Contracts

## B.1 Risk Run

```ts
type RiskRun = {
  id: string;
  organizationId: string;
  scopeType: "ENTERPRISE" | "BUSINESS_UNIT" | "SERVICE" | "ASSET";
  scopeId: string;
  asOf: string;
  createdAt: string;
  riskEngineVersion: string;
  parameterVersion: string;
  modelBundleVersion: string;
  featureSetVersion: string;
  simulationConfigVersion: string;
  inputStateHash: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "STALE";
};
```

## B.2 Risk Assessment

```ts
type RiskAssessment = {
  id: string;
  riskRunId: string;
  currency: string;
  eal: number;
  var: {
    alpha: number;
    amount: number;
  };
  financialExposure: number;
  riskScore: number;
  uncertainty: unknown;
  drivers: unknown[];
  evidenceRefs: string[];
  calculationHash: string;
};
```

## B.3 ML Prediction

```ts
type ModelPrediction = {
  predictionId: string;
  modelVersion: string;
  featureSetVersion: string;
  calibrationVersion?: string;
  entityScope: string;
  observationTime: string;
  pH?: number;
  horizonDays?: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  dataCoverage: Record<string, number>;
  oodFlag: boolean;
  featureAttribution?: unknown;
  inputBundleHash: string;
  modelArtifactHash: string;
};
```

---

# Appendix C — Risk Engine Authority Boundary

The following values are **not allowed to be calculated authoritatively in UI or LLM code**:

```text
EAL
VaR
Financial Exposure
Enterprise Product Risk Score
Scenario financial deltas
Optimization objective value
Portfolio residual risk
```

The only authoritative source is:

```text
Governed Risk Quantification Engine
```

ML may provide:

```text
probability
severity parameters
forecast
anomaly signal
uncertainty
```

The optimizer may provide:

```text
selected candidate set
objective solution
constraint status
```

but residual portfolio risk must still be calculated/validated through the Risk Engine.

---

# Appendix D — First Engineering Milestones

## Milestone 1 — Safe Foundation

```text
feature branch
+
migration
+
RiskRun
+
calculation hash
+
compatibility façade
+
regression suite
```

## Milestone 2 — Risk Engine v2

```text
frequency
+
severity
+
Monte Carlo
+
EAL
+
true VaR
+
Risk Score
```

## Milestone 3 — Decisions

```text
drivers
+
scenario
+
optimizer
+
investment curve
```

## Milestone 4 — Intelligence

```text
ML likelihood
+
grounded NLQ
+
trend prediction
```

## Milestone 5 — Trust

```text
audit
+
evidence
+
hash chain
+
optional blockchain anchor
```

---

# Appendix E — Engineering Guardrails

1. Do not rebuild SentinelStack as a new application.
2. Do not replace Express with FastAPI solely because an earlier conceptual document used FastAPI.
3. Do not replace Prisma/PostgreSQL with another database without a measured requirement.
4. Do not create a second risk calculation implementation beside `cyberRiskQuantification.service.ts`; refactor behind the façade.
5. Do not let the existing legacy Finding score be mislabeled as the PS-26105 enterprise financial risk score.
6. Do not call a VaR multiplier proxy a genuine VaR percentile.
7. Do not use fixed scenario EAL multipliers as the final what-if implementation.
8. Do not let a greedy optimizer represent the final constrained portfolio solution.
9. Do not promote an uncalibrated ML probability into authoritative financial risk.
10. Do not expose unrestricted database access to the LLM.
11. Do not treat synthetic SIH context as real-enterprise evidence.
12. Do not put raw telemetry, secrets, PII or financial records on a blockchain.
13. Do not mutate baseline operational state during scenarios.
14. Do not bypass organization-level authorization in new services.
15. Do not merge major migrations directly to `main` without regression.
16. Do not populate a dashboard card with fabricated precision when required inputs are unavailable.

---

# Baseline Status

This document is the **Implementation & Repository Architecture Specification v1.1 — Reconciled Engineering Baseline**.

It supersedes the **implementation topology** assumptions of v1.0 while preserving its free-first, secure-by-default, test-driven principles.

The key architectural decision is now explicit:

```text
Existing SentinelStack repository
            |
            +--> preserve current product
            |
            +--> add modular PS-26105 risk domain
            |
            +--> add data/provenance layer
            |
            +--> add scenario + optimization
            |
            +--> add ML behind stable contracts
            |
            +--> add grounded AI
            |
            +--> add governance/trust
            |
            v
Continuous Cyber Risk Quantification
+
Investment Optimization
+
Executive Decision Intelligence
```

The implementation source of truth remains the repository. The controlled design baselines define the required behavior and architecture. Any future deviation must be documented through versioned change control.

**Next operational step:** begin P0/P1 repository work — migration guardrails, RiskRun lineage, compatibility façade, and deterministic contract tests — before implementing new dashboard promises.
