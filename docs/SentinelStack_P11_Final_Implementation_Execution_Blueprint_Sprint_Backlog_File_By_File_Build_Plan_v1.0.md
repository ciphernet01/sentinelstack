# SentinelStack — PS 26105
## P11 Final Implementation Execution Blueprint, Sprint Backlog, Dependency Graph, File-by-File Build Plan & SIH Delivery Checklist
### Version 1.0

> **Purpose:** Convert the completed P1–P10 architecture/specification chain into an executable engineering backlog for the existing SentinelStack repository, with explicit task ownership boundaries, dependencies, repository touchpoints, migration order, API/UI delivery order, testing gates, demo preparation, and release evidence.

---

# 1. Executive Purpose

P1–P10 defined the target platform. P11 is the **execution bridge** from specification to implementation.

This document does not introduce a new product architecture. It converts the agreed architecture into concrete engineering work that can be assigned, coded, tested, reviewed, merged, deployed, demonstrated, and evidenced.

The execution target is the existing SentinelStack application enhanced for **SIH PS 26105 — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform**.

The implementation must preserve these principles:

- The deterministic risk engine is authoritative for financial risk calculations.
- Statistical/ML models estimate uncertain variables and must be calibrated and validated.
- The optimizer computes constrained investment allocation; the LLM does not choose numbers by free-form reasoning.
- The Digital Twin is the enterprise context layer connecting assets, services, dependencies, business impact, controls, vulnerabilities, telemetry, threat intelligence, and location.
- Continuous ingestion produces normalized evidence and material events that trigger recalculation.
- Governance, compliance, and blockchain provide traceability/integrity rather than mathematical authority.
- The AI Copilot explains verified outputs and executes only typed, authorized tools.
- Synthetic demo data must remain explicitly identified as synthetic.
- Every tenant boundary must be enforced server-side.

---

# 2. P11 Outcome

At the end of P11, the engineering team should have a repeatable path to produce a release candidate containing:

1. Production-grade schema migrations for PS-26105 entities.
2. Stable ingestion and normalization pipelines.
3. A versioned Digital Twin.
4. Evidence lineage and freshness tracking.
5. Event-driven, idempotent risk recalculation.
6. Quantitative EAL/VaR outputs with uncertainty metadata.
7. Driver attribution with evidence references.
8. Scenario simulation that does not mutate live state.
9. Budget-constrained investment optimization.
10. Predictive ML with calibration, drift, and model registry support.
11. Grounded natural-language Copilot tooling.
12. Governance package generation and integrity anchoring.
13. Compliance mappings and evidence reporting.
14. Geospatial enterprise risk exploration.
15. Executive and technical dashboards.
16. End-to-end observability.
17. Automated unit, integration, security, recovery, performance, and E2E tests.
18. Deterministic SIH demo fixtures and one-command reset.
19. Deployment, rollback, backup, restore, and incident runbooks.
20. A release-evidence package suitable for final technical review.

---

# 3. Repository Baseline

## 3.1 Existing application shape

The implementation starts from the current SentinelStack repository rather than a greenfield rewrite.

Known stack:

- **Frontend:** Next.js + React + TypeScript
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Prisma
- **Authentication:** Firebase / Firebase Admin
- **Charts:** Recharts
- **Browser/reporting:** Puppeteer
- **Observability:** OpenTelemetry + Jaeger-compatible tracing
- **Security middleware:** Helmet, CORS allowlist, request IDs, rate limiting, JSON body limits
- **Deployment:** Render-oriented service configuration
- **AI:** Genkit / Google GenAI provider abstraction
- **Payments and external integrations:** existing application capabilities retained where unrelated to PS-26105

## 3.2 Existing PS-26105 foundation

The repository already contains risk-oriented data models and services including:

- `BusinessUnit`
- `CyberAsset`
- `AssetDependency`
- `SecurityControl`
- `AssetControl`
- `CyberVulnerability`
- `SecurityTelemetry`
- `ThreatIntelIndicator`
- `RiskSnapshot`
- `RiskScenario`

Existing cyber-risk routes and services are retained as the migration starting point.

## 3.3 Existing risk engine limitations to replace

The current foundation contains useful scaffolding, but the following are implementation gaps rather than final-state capabilities:

- hand-tuned likelihood heuristics,
- deterministic impact × annual likelihood only,
- VaR approximation rather than distribution-based quantile estimation,
- hardcoded recommendation costs and reductions,
- greedy recommendation selection rather than constrained optimization,
- fixed scenario multipliers rather than state mutation + true recalculation,
- asset-row drivers rather than evidence-linked attribution.

P11 therefore treats these existing components as migration points, not as authoritative final-state implementation.

---

# 4. Implementation Rules

## 4.1 Preserve numerical authority

The UI may format numbers, but must not calculate authoritative EAL, VaR, annual frequency, control effectiveness, or optimization outputs locally.

## 4.2 Preserve provenance

Every material risk value must be traceable to:

`source -> normalized record -> evidence -> digital twin state -> model/version -> calculation run -> result -> decision/report`

## 4.3 Preserve point-in-time semantics

Training data, risk calculations, and historical views must use timestamped states to avoid temporal leakage and accidental future-information use.

## 4.4 Preserve immutable history

New risk calculations create new runs/snapshots. Existing signed/approved history is never silently overwritten.

## 4.5 Prefer additive migration over large rewrites

New services should be introduced behind stable interfaces. Existing routes can be adapted to call the new service layer before legacy implementations are removed.

## 4.6 Make every external connector optional

The platform must function using synthetic and public datasets even when no customer connector is configured.

---

# 5. Master Dependency Graph

```text
P11-01 Repository Hardening
        |
        +--> P11-02 Schema / Migration Layer
        |          |
        |          +--> P11-03 Canonical Domain Types
        |                     |
        |                     +--> P11-04 Ingestion + Normalization
        |                     |          |
        |                     |          +--> P11-05 Evidence + Lineage
        |                     |                     |
        |                     |                     +--> P11-06 Digital Twin
        |                     |                                |
        |                     |                                +--> P11-07 Event Bus / Materiality
        |                     |                                             |
        |                     |                                             +--> P11-08 Risk Engine v2
        |                     |                                                        |
        |                     |                                                        +--> P11-09 Driver Attribution
        |                     |                                                        |
        |                     |                                                        +--> P11-10 Scenario Engine
        |                     |                                                        |
        |                     |                                                        +--> P11-11 Investment Optimizer
        |                     |
        +--> P11-12 ML Pipeline / Model Registry
        |          |
        |          +--> P11-13 Continuous Forecasting / Drift
        |
        P11-08 + P11-09 + P11-10 + P11-11 + P11-12
                          |
                          +--> P11-14 Grounded AI Copilot
                          |
                          +--> P11-15 Governance / Evidence Integrity / Compliance
                          |
                          +--> P11-16 Geo Risk Explorer / Globe Integration
                          |
                          +--> P11-17 Executive + Technical Dashboards
                                      |
                                      +--> P11-18 E2E Integration
                                      +--> P11-19 Security / Performance / Recovery
                                      +--> P11-20 SIH Demo + Release Evidence
```

---

# 6. Workstream Structure

P11 uses 20 work packages grouped into six engineering streams.

| Stream | Work packages | Primary outcome |
|---|---|---|
| Foundation | 01–03 | stable contracts, migrations, types |
| Data Plane | 04–07 | evidence → Digital Twin → event triggers |
| Quantification | 08–13 | risk, drivers, scenarios, optimization, ML |
| Decision & Governance | 14–16 | AI Copilot, compliance, geospatial intelligence |
| Experience | 17 | executive + technical operating surfaces |
| Validation & Release | 18–20 | E2E, security, performance, SIH readiness |

---

# 7. P11-01 — Repository Hardening

## Objective

Create a clean implementation baseline before introducing PS-26105 production behavior.

## Tasks

### REP-001 — Branch strategy

Create or confirm:

```text
main
integration/ps26105
feature/<domain>-<ticket>
release/ps26105-rcX
```

Rules:

- no direct feature development on `main`,
- pull request required for release-bound changes,
- database migrations reviewed independently,
- test evidence attached to risk-engine and governance changes.

### REP-002 — Environment contract

Define required variables with `.env.example` and runtime validation.

Minimum groups:

- database,
- auth,
- AI provider,
- connector encryption key,
- blockchain/integrity anchor configuration,
- telemetry/exporter configuration,
- object/artifact storage,
- queue/worker configuration where enabled.

Secrets must never be committed.

### REP-003 — Package consistency

Run and document:

```bash
npm ci
npm run prisma:generate
npm test
npm run build
```

where scripts differ by package, use repository-equivalent commands without inventing new manual build steps.

### REP-004 — Static quality gate

Enable:

- TypeScript strictness where practical,
- ESLint,
- dependency audit review,
- secret scan,
- migration validation,
- import cycle check where tooling exists.

### Exit gate

A clean baseline must build and boot before domain implementation begins.

---

# 8. P11-02 — Database Migration Layer

## Objective

Move from the narrow current schema to the complete PS-26105 logical data model without destructive replacement.

## Task groups

### DB-001 — Version all schema changes

Every database change must have a named Prisma migration.

### DB-002 — Add lineage primitives

Introduce entities for:

- source systems,
- connector instances,
- ingestion runs,
- source records,
- evidence records,
- evidence lineage,
- data-quality observations,
- freshness state.

### DB-003 — Add Digital Twin entities

Add or extend:

- services,
- service dependencies,
- service ownership,
- asset locations,
- environment tags,
- identities,
- business dependency mappings.

### DB-004 — Add event/recalculation entities

Provide durable persistence for:

- domain events,
- outbox records,
- materiality decisions,
- recalculation requests,
- calculation runs,
- run status,
- failure state,
- retry metadata.

### DB-005 — Add quantification entities

Include versioned persistence for:

- risk metrics,
- loss distribution summaries,
- scenario runs,
- risk drivers,
- driver evidence links,
- optimization runs,
- investment candidates,
- portfolio selections,
- expected risk reductions.

### DB-006 — Add ML governance entities

Include:

- dataset versions,
- model versions,
- feature sets,
- training runs,
- evaluation metrics,
- calibration results,
- drift observations,
- approval state.

### DB-007 — Add governance/compliance entities

Include:

- governance events,
- evidence packages,
- package manifests,
- hash records,
- blockchain anchors,
- approvals,
- exceptions,
- risk acceptances,
- control mappings,
- framework versions,
- report definitions and artifact records.

## Migration sequencing

```text
existing schema
  -> additive columns / tables
  -> backfill synthetic baseline
  -> dual-read validation where needed
  -> switch production reads
  -> deprecate legacy fields after acceptance
```

## Exit gate

`prisma migrate deploy` succeeds on a clean database and a copy of the existing database without destructive loss.

---

# 9. P11-03 — Canonical Domain Types and Contracts

## Objective

Create shared TypeScript contracts that all ingestion, risk, AI, governance, and UI services consume.

## Core contract families

```text
SourceRecord
NormalizedAsset
NormalizedVulnerability
NormalizedTelemetry
NormalizedThreatIndicator
NormalizedControl
BusinessContext
EvidenceRecord
DigitalTwinState
RiskCalculationRequest
RiskCalculationResult
RiskDriver
RiskScenarioDefinition
ScenarioResult
InvestmentCandidate
OptimizationResult
ModelHealth
ComplianceEvidence
GovernancePackage
```

## Rules

- IDs are opaque stable strings.
- Dates are ISO-8601 timestamps.
- Monetary values carry currency.
- Probabilities are represented as `0..1`.
- Confidence is separate from probability.
- Unknown values are represented explicitly, not converted to zero.
- Source and evidence references are mandatory for material external observations.

## Example risk output contract

```ts
interface QuantifiedRiskResult {
  calculationRunId: string;
  asOf: string;
  scope: {
    organizationId: string;
    businessUnitIds: string[];
    assetIds: string[];
    serviceIds: string[];
  };
  eal: MoneyRange;
  var95: MoneyRange;
  annualEventProbability: number;
  lossDistributionRef: string;
  modelVersion: string;
  confidence: number;
  stale: boolean;
  drivers: RiskDriverRef[];
  evidenceRefs: string[];
}
```

## Exit gate

Backend, frontend, test fixtures, and AI tool outputs compile against the same typed domain contracts.

---

# 10. P11-04 — Ingestion and Normalization

## Objective

Create a common ingestion plane so different security products become normalized enterprise evidence rather than one-off integrations.

## Connector implementation order

### Tier 1 — public/free evidence

1. NVD
2. CISA KEV
3. EPSS-compatible feed
4. MITRE ATT&CK
5. public threat-intelligence fixtures

### Tier 2 — SIH synthetic enterprise feeds

1. vulnerability scanner CSV/JSON fixture,
2. SIEM JSON fixture,
3. EDR JSON fixture,
4. IAM JSON fixture,
5. CSPM JSON fixture,
6. business asset inventory fixture.

### Tier 3 — optional real enterprise connectors

Implement adapter contracts before specific vendors.

## Normalization pipeline

```text
raw payload
 -> payload hash
 -> schema validation
 -> source record
 -> normalization
 -> entity resolution
 -> data-quality scoring
 -> evidence creation
 -> Digital Twin update proposal
 -> domain event
```

## Security requirements

- outbound requests must be SSRF-protected,
- timeouts mandatory,
- response-size limits mandatory,
- TLS verification enabled by default,
- authentication secrets encrypted at rest,
- connector logs redact tokens/passwords,
- payloads stored according to retention policy.

## Exit gate

The same vulnerability observation ingested twice must not create duplicate authoritative state.

---

# 11. P11-05 — Evidence, Lineage, Quality and Freshness

## Objective

Make every material risk input explainable and time-aware.

## Required evidence fields

- evidence ID,
- source system,
- source record ID,
- observed at,
- received at,
- valid-from / valid-to where known,
- canonical hash,
- entity references,
- transformation version,
- quality status,
- freshness state,
- reviewer state if required.

## Freshness states

```text
FRESH
AGING
STALE
UNKNOWN
FAILED
```

Freshness must be domain-specific. An hourly SIEM feed and a monthly business-impact review do not have the same acceptable latency.

## Data-quality checks

- duplicate rate,
- null critical fields,
- schema conformity,
- referential integrity,
- timestamp anomalies,
- improbable values,
- source outage duration,
- entity-resolution confidence.

## Exit gate

A risk result with stale material evidence must expose the stale state rather than appearing fully current.

---

# 12. P11-06 — Cyber Risk Digital Twin

## Objective

Represent the enterprise as a graph-like operational model.

## Minimum node types

```text
BusinessUnit
Asset
Service
Identity
SecurityControl
Vulnerability
ThreatIndicator
Evidence
Location
RiskCalculation
```

## Minimum edge types

```text
OWNS
HOSTS
DEPENDS_ON
EXPOSES
AFFECTS
PROTECTED_BY
USED_BY
LOCATED_IN
SUPPORTED_BY
EVIDENCED_BY
```

## Example graph

```text
Business Unit: Payments
        |
        +--> Service: Payment API
                  |
                  +--> Asset: Internet-facing API node
                  |       |
                  |       +--> Vulnerability: CVE-X
                  |       +--> Control: WAF
                  |       +--> Control: EDR
                  |
                  +--> Depends on: Identity Service
                  +--> Depends on: Database
```

## Sync rule

The Digital Twin is a materialized enterprise context model. It is rebuilt or incrementally synchronized from authoritative normalized sources; it is not a manually edited copy detached from evidence.

## Exit gate

A single asset change can be traced to affected services, business units, controls, and risk calculations.

---

# 13. P11-07 — Event and Materiality Layer

## Objective

Turn evidence changes into controlled recalculation triggers.

## Event classes

```text
ASSET_CHANGED
VULNERABILITY_CHANGED
THREAT_INTEL_CHANGED
CONTROL_CHANGED
TELEMETRY_ANOMALY
BUSINESS_CONTEXT_CHANGED
SERVICE_DEPENDENCY_CHANGED
MODEL_CHANGED
DATA_FRESHNESS_CHANGED
```

## Materiality policy

A change is material if it can alter:

- likelihood,
- impact,
- control effectiveness,
- loss-distribution parameters,
- scope/dependency structure,
- model applicability,
- data confidence,
- governance status.

## Event handling

Use:

```text
producer -> outbox -> consumer -> idempotency key -> materiality -> recalculation request
```

## Storm protection

- coalesce equivalent events,
- debounce repeated updates,
- cap retry rates,
- prioritize business-critical scopes,
- preserve newest state,
- never allow an older completed calculation to overwrite a newer state.

## Exit gate

A burst of 100 related telemetry changes creates bounded recalculation work rather than 100 independent full-enterprise recalculations.

---

# 14. P11-08 — Quantitative Risk Engine v2

## Objective

Replace the legacy heuristic implementation with the versioned quantitative engine defined in P2/P6.

## Calculation layers

### Layer A — Event probability

Estimate event probability over a declared time horizon.

For a calibrated probability `p_H` over horizon `H` years:

```text
lambda = -ln(1 - p_H) / H
```

### Layer B — Loss severity

Construct a loss distribution from modeled components such as:

- incident response,
- recovery,
- downtime,
- data/breach response,
- legal/regulatory exposure where modeled,
- fraud/transaction loss where relevant,
- third-party/service interruption,
- other documented financial impact categories.

### Layer C — Aggregate loss

For simulation run `m`:

```text
S^(m) = sum over incident events of severity_m
```

Expected annual loss:

```text
EAL = (1/M) * sum(S^(m))
```

VaR:

```text
VaR_alpha = Quantile_alpha(S)
```

## Monte Carlo requirement

Production benchmark target:

```text
M >= 50,000 simulations
```

A lower count may be used in local developer tests where runtime is the purpose, but release evidence must use the declared production benchmark configuration.

## Risk score

Use the documented composite score only as a presentation/decision index, not as a replacement for monetary risk.

Example:

```text
S_E = 100 * clamp(EAL / EAL_appetite, 0, 1)
S_L = 100 * P_annual
S_C = 100 * (1 - CE_enterprise)
RiskScore = w_E*S_E + w_L*S_L + w_C*S_C
```

with:

```text
w_E + w_L + w_C = 1
```

## Numerical controls

- decimal-safe or integer minor-unit currency arithmetic,
- seeded simulation mode for tests,
- explicit random-number generator version,
- confidence intervals for estimated quantities,
- model/config version recorded in every calculation run.

## Exit gate

A fixed reference input produces deterministic seeded output within the documented tolerance.

---

# 15. P11-09 — Risk Driver Attribution

## Objective

Move from “risky asset” rows to actual explainable drivers.

## Driver taxonomy

```text
EXPLOITABILITY
EXPOSURE
ASSET_CRITICALITY
BUSINESS_IMPACT
CONTROL_WEAKNESS
THREAT_ACTIVITY
VULNERABILITY_AGE
IDENTITY_RISK
CLOUD_POSTURE
DEPENDENCY_CONCENTRATION
DATA_QUALITY
MODEL_UNCERTAINTY
```

## Driver contract

Each driver should contain:

```text
driverId
name
contribution
contributionType
direction
confidence
evidenceRefs
affectedEntities
calculationRunId
```

## Attribution methods

Use the method matching the layer:

- deterministic sensitivity for model parameters,
- SHAP or equivalent for ML components,
- scenario delta for intervention-specific effects,
- dependency propagation for service/network relationships.

## Anti-double-counting rule

Shared services must have one primary service association for aggregate financial attribution, with normalized dependency strength used for propagation.

## Exit gate

Every top-level driver displayed to executives can be opened into the underlying evidence or model component that produced it.

---

# 16. P11-10 — Scenario Engine

## Objective

Provide what-if analysis using an isolated mutable copy of relevant state.

## Scenario lifecycle

```text
DRAFT
 -> VALIDATED
 -> QUEUED
 -> RUNNING
 -> COMPLETED
 -> EXPIRED / ARCHIVED
```

## Scenario inputs

Examples:

- enable MFA,
- patch a vulnerability,
- segment a service,
- increase control effectiveness,
- remove public exposure,
- reduce downtime,
- change business criticality,
- modify service dependency,
- introduce a new compensating control.

## Core result

```text
DeltaEAL = EAL_current - EAL_scenario
```

Also return:

- delta VaR,
- annual event probability delta,
- affected services,
- affected business units,
- assumptions,
- uncertainty,
- evidence/model versions.

## Safety

Scenario execution must never mutate production Digital Twin state unless a separately approved change process applies.

## Exit gate

Running the same scenario twice against the same frozen state produces equivalent outputs under seeded simulation conditions.

---

# 17. P11-11 — Investment Optimization

## Objective

Select mitigation actions under explicit budgets.

## Candidate structure

```text
candidateId
control/action
cost
implementationTime
riskReductionEstimate
uncertainty
prerequisites
conflicts
scope
```

## Baseline optimization

Binary form:

```text
maximize   Σ RiskReduction_i * x_i
subject to Σ Cost_i * x_i <= Budget
           x_i ∈ {0,1}
```

Use an explicit solver. OR-Tools, scipy.optimize, or another approved solver may be used depending on deployment constraints.

## Required outputs

- selected portfolio,
- total cost,
- expected risk reduction,
- residual EAL,
- residual VaR where modeled,
- unselected candidates,
- binding constraints,
- solver status,
- sensitivity/what-if explanation.

## Guardrails

- budget must never be exceeded,
- infeasible must remain infeasible,
- optimality must only be claimed when verified by the solver,
- optimizer recommendations are advisory until approved.

## Exit gate

Automated tests verify cost constraints across dozens of randomized candidate sets.

---

# 18. P11-12 — ML Pipeline and Model Registry

## Objective

Implement predictive exploitation/risk models with reproducible training and governance.

## Primary target

Example supervised target:

```text
exploited_within_window ∈ {0,1}
```

## Candidate features

- CVSS,
- EPSS,
- KEV presence,
- exploit availability,
- vulnerability age,
- internet exposure,
- asset criticality,
- control effectiveness,
- patch status,
- threat activity,
- MFA/control state where relevant,
- historical remediation behavior.

## Training rules

- point-in-time feature extraction,
- time-aware train/validation/test split,
- no future leakage,
- baseline logistic regression,
- candidate gradient boosting model,
- feature schema versioned,
- dataset snapshot hashed.

## Metrics

At minimum:

- Precision,
- Recall,
- F1,
- ROC-AUC,
- PR-AUC,
- calibration error / calibration curve,
- Brier score where appropriate.

## Model registry status

```text
DRAFT
VALIDATED
APPROVED
SHADOW
PRODUCTION
DEPRECATED
RETIRED
```

## Exit gate

A model cannot enter `PRODUCTION` without stored dataset, code, feature, metric, calibration, and approval metadata.

---

# 19. P11-13 — Forecasting, Calibration and Drift

## Objective

Detect changes that make previous risk estimates less trustworthy.

## Monitoring dimensions

### Data drift

Track shifts in feature distributions.

### Prediction drift

Track changes in predicted probabilities.

### Calibration drift

Compare predicted vs observed event frequencies over time.

### Outcome drift

Track changes in actual incident/exploitation patterns.

## Operational policy

Drift should produce one of:

```text
NO_ACTION
REVIEW
RECALIBRATE
RETRAIN
ROLLBACK
```

The policy itself must be versioned.

## Black-swan boundary

The platform must not claim to predict black-swan events.

Instead it should:

- detect major environment changes,
- incorporate newly observed threat evidence,
- stress-test loss distributions,
- expose elevated uncertainty,
- identify out-of-distribution conditions.

## Exit gate

Synthetic drift fixtures trigger the expected governance state without silently replacing production models.

---

# 20. P11-14 — Grounded AI Copilot

## Objective

Expose verified risk intelligence through natural language without making the LLM the computational authority.

## Request flow

```text
user question
 -> authentication/context
 -> intent classification
 -> entity/scope resolution
 -> typed tool call
 -> verified backend result
 -> grounding context
 -> LLM explanation
 -> numeric consistency validation
 -> response + trace
```

## Required tool groups

- current risk,
- historical risk,
- risk changes,
- risk drivers,
- evidence,
- asset/service lookup,
- scenario preview/run,
- investment candidates,
- optimization,
- model health,
- compliance,
- audit/governance.

## Authority hierarchy

```text
Database / verified source
    > domain service
    > risk / optimizer / model registry
    > tool output
    > LLM explanation
```

## Forbidden behavior

The LLM must not:

- invent financial values,
- bypass organization isolation,
- access raw SQL,
- execute shell commands,
- modify live scenarios without confirmation,
- claim unsupported compliance/legal conclusions,
- change optimizer constraints without typed input.

## Exit gate

Every financial number shown in a Copilot response exists in a verified tool result or approved derived field.

---

# 21. P11-15 — Governance, Evidence Integrity and Compliance

## Objective

Turn important decisions into reviewable, tamper-evident records.

## Governance chain

```text
risk identified
 -> quantified
 -> driver reviewed
 -> scenario evaluated
 -> mitigation proposed
 -> investment approved/rejected
 -> implementation evidence
 -> risk recalculated
 -> final decision archived
```

## Evidence package

Each governance package should contain:

- manifest,
- package version,
- source identifiers,
- resource versions,
- canonical hashes,
- calculation/model versions,
- approvals,
- timestamps.

## Blockchain rule

Only integrity metadata should be anchored:

```text
packageHash
anchorId
network
transaction/reference
anchoredAt
```

Do not place on-chain:

- raw telemetry,
- PII,
- secrets,
- customer financial details,
- full ML artifacts,
- AI conversations.

Blockchain proves record integrity/provenance, not that a risk calculation was mathematically correct.

## Compliance implementation order

1. NIST CSF mappings
2. ISO/IEC 27001 mappings
3. CIS Controls mappings
4. RBI mappings
5. SEBI mappings

Framework versions must be explicit because mappings change over time.

## Exit gate

A reviewer can reconstruct why a risk/investment decision existed at a historical point in time.

---

# 22. P11-16 — Geospatial Risk Explorer / Globe

## Objective

Turn the globe from decorative UI into an enterprise geospatial control plane.

## Modes

```text
EXPOSURE
FINANCIAL RISK
THREAT INTELLIGENCE
BLAST RADIUS
```

## Required location record

```text
AssetLocation {
  assetId
  countryCode
  region
  city
  latitude
  longitude
  cloudRegion
  locationType
  source
  confidence
  validFrom
  validTo
}
```

## Interaction model

```text
click geography
  -> apply scope
  -> fetch enterprise assets/services
  -> show financial risk
  -> show drivers
  -> show dependency paths
```

## Blast radius

Clicking an asset/service should expose:

- directly affected assets,
- dependent services,
- dependent business units,
- control coverage,
- scenario loss delta.

## Truth boundary

The globe must not imply generic country-level cyberattack intensity unless that data is actually sourced and represented as such.

The visualization should reflect enterprise-scoped records.

## Exit gate

Every visualized point can be traced to a stored enterprise location record.

---

# 23. P11-17 — Executive and Technical Dashboards

## Executive surface

Prioritize:

- enterprise EAL,
- VaR,
- risk appetite gap,
- annual probability,
- top drivers,
- top concentration points,
- budget,
- expected risk reduction,
- residual risk,
- confidence/freshness.

## Technical surface

Prioritize:

- vulnerabilities,
- telemetry anomalies,
- controls,
- assets/services,
- evidence freshness,
- ingestion health,
- unresolved entities,
- model health,
- recalculation status.

## Decision cards

Recommended card types:

```text
RiskCard
DriverCard
ScenarioCard
InvestmentCard
OptimizationCard
ModelHealthCard
EvidenceCard
GovernanceCard
```

## Visual rule

Do not make every number a huge KPI. Emphasize the few values needed for the decision and expose supporting detail through progressive disclosure.

## Exit gate

The executive screen can answer:

1. How much risk exists?
2. Why does it exist?
3. What changed?
4. What should be considered?
5. What would that action cost?
6. How much modeled risk could it reduce?
7. How confident/current is the result?

---

# 24. P11-18 — End-to-End Integration

## Objective

Connect all workstreams into a single causal chain.

## Canonical flow

```text
External source
    ↓
Connector
    ↓
Source Record
    ↓
Normalization
    ↓
Evidence
    ↓
Entity Resolution
    ↓
Digital Twin Update
    ↓
Domain Event
    ↓
Materiality Decision
    ↓
Risk Recalculation
    ↓
Risk Snapshot
    ↓
Driver Attribution
    ↓
Scenario / Investment Optimization
    ↓
Copilot / Dashboard
    ↓
Governance Package
    ↓
Integrity Anchor
```

## Golden-path test

A single vulnerability change must be observable end-to-end:

```text
CVE severity/exploitability changes
 -> evidence hash changes
 -> vulnerability state changes
 -> event emitted
 -> materiality=true
 -> recalculation queued
 -> risk changes
 -> driver changes
 -> dashboard refreshes
 -> Copilot sees new verified value
 -> governance timeline records change
```

## Exit gate

Golden-path test passes from fixture ingestion through executive UI and audit timeline.

---

# 25. P11-19 — Security, Performance and Recovery Validation

## Security tests

### Authentication

- expired token,
- malformed token,
- missing token.

### Authorization

- viewer cannot mutate,
- analyst cannot approve restricted governance action,
- cross-tenant resource access returns denial.

### Injection

- SQL-like inputs,
- JSON payload abuse,
- prompt injection,
- oversized input,
- malformed tool arguments.

### SSRF

- loopback URLs,
- metadata IPs,
- internal hostnames,
- redirect chains.

### Secrets

- connector secrets never appear in logs,
- governance packages exclude secrets,
- client bundles contain no backend secrets.

## Performance benchmark categories

### API latency

Measure p50/p95/p99 for:

- enterprise summary,
- asset search,
- current risk,
- driver list,
- scenario validation,
- optimizer request.

### Ingestion throughput

Measure records/minute for synthetic bulk import.

### Recalculation throughput

Measure:

- asset-level recalculation,
- service-level recalculation,
- enterprise full recalculation.

### Monte Carlo

Benchmark 50k+ simulation runs with representative loss distributions.

### AI Copilot

Measure tool latency separately from model response latency.

## Recovery tests

- database connection loss,
- source outage,
- queue/worker restart,
- duplicate event replay,
- partial ingestion failure,
- failed recalculation,
- rollback of model version.

## Exit gate

All severe security findings are closed or formally waived with evidence. Recovery tests preserve data integrity and latest-valid-state semantics.

---

# 26. P11-20 — SIH Demo, Release Evidence and Final Delivery

## Demo principle

The presentation should show **causal system behavior**, not only static dashboards.

## Recommended live demo sequence

### Scene 1 — Enterprise baseline

Show:

- enterprise EAL,
- VaR,
- risk appetite,
- top drivers,
- globe,
- current control posture.

### Scene 2 — New threat/vulnerability evidence

Inject synthetic change:

```text
DEMO-CVE-017
Asset: AST-22
Service: SVC-PAYMENTS-API
exploitAvailable: false -> true
controlEffectiveness: 0.82 -> 0.72
```

### Scene 3 — Continuous reaction

Show:

```text
evidence received
 -> event
 -> materiality
 -> recalculation
 -> EAL change
 -> driver refresh
```

### Scene 4 — Financial translation

Copilot question:

> “What changed financially and what are the biggest drivers?”

The response must be grounded in returned tool values.

### Scene 5 — Scenario

Ask what would happen if the identified control weakness were remediated.

Show:

```text
Current EAL
Scenario EAL
Delta EAL
Cost
Uncertainty
Affected services
```

### Scene 6 — Investment optimization

Set budget.

Show:

```text
Budget
Candidates
Selected portfolio
Cost
Expected risk reduction
Residual risk
```

### Scene 7 — Governance

Generate governance package.

Show:

```text
manifest
hash
anchor
verification
approval state
```

### Scene 8 — Compliance

Show a mapped control and supporting evidence.

### Scene 9 — Historical audit

Open timeline and reconstruct the decision path.

## Demo reset

Provide a deterministic command such as:

```bash
npm run demo:reset
```

Equivalent repository script is acceptable where naming differs.

The reset must restore:

- synthetic assets,
- vulnerabilities,
- controls,
- baseline risk,
- scenario state,
- optimizer state,
- governance fixtures,
- audit timeline.

## Release-evidence package

```text
release-evidence/
├── build/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── security/
│   ├── recovery/
│   └── performance/
├── numerical-reference/
├── ml-validation/
├── governance-integrity/
├── database-migrations/
├── sih-demo/
├── screenshots/
├── architecture/
├── deployment/
├── monitoring/
└── waivers/
```

---

# 27. File-by-File Implementation Map

The exact repository tree can evolve, but the following logical structure should be established.

```text
src/
├── server.ts
├── routes/
│   ├── cyber-risk.routes.ts
│   ├── risk-scenarios.routes.ts
│   ├── investments.routes.ts
│   ├── optimization.routes.ts
│   ├── evidence.routes.ts
│   ├── ingestion.routes.ts
│   ├── digital-twin.routes.ts
│   ├── model-governance.routes.ts
│   ├── compliance.routes.ts
│   ├── governance.routes.ts
│   ├── geospatial.routes.ts
│   └── ai.routes.ts
│
├── services/
│   ├── cyberRiskQuantification.service.ts
│   ├── riskEngineV2.service.ts
│   ├── lossDistribution.service.ts
│   ├── monteCarlo.service.ts
│   ├── riskDriverAttribution.service.ts
│   ├── riskScenario.service.ts
│   ├── investmentOptimization.service.ts
│   ├── evidence.service.ts
│   ├── ingestion.service.ts
│   ├── entityResolution.service.ts
│   ├── digitalTwin.service.ts
│   ├── materiality.service.ts
│   ├── recalculation.service.ts
│   ├── governance.service.ts
│   ├── integrityAnchor.service.ts
│   ├── compliance.service.ts
│   ├── geospatialRisk.service.ts
│   └── aiCopilot.service.ts
│
├── domain/
│   ├── risk/
│   ├── evidence/
│   ├── ingestion/
│   ├── digital-twin/
│   ├── optimization/
│   ├── governance/
│   ├── compliance/
│   └── ai/
│
├── connectors/
│   ├── nvd/
│   ├── cisa-kev/
│   ├── mitre/
│   ├── epss/
│   └── synthetic/
│
├── workers/
│   ├── ingestion.worker.ts
│   ├── event.worker.ts
│   ├── recalculation.worker.ts
│   ├── ml.worker.ts
│   └── governance.worker.ts
│
└── lib/
    ├── hashing.ts
    ├── currency.ts
    ├── probabilities.ts
    ├── idempotency.ts
    ├── authorization.ts
    └── validation.ts

frontend/
├── src/
│   ├── app/
│   │   └── dashboard/
│   │       ├── risk-intelligence/
│   │       ├── investments/
│   │       ├── scenarios/
│   │       ├── governance/
│   │       ├── compliance/
│   │       └── model-governance/
│   ├── components/
│   │   ├── risk/
│   │   ├── investment/
│   │   ├── scenario/
│   │   ├── governance/
│   │   ├── compliance/
│   │   ├── geospatial/
│   │   └── copilot/
│   ├── hooks/
│   └── lib/
│
prisma/
├── schema.prisma
└── migrations/

tests/
├── unit/
├── integration/
├── e2e/
├── security/
├── recovery/
├── performance/
├── numerical-reference/
└── fixtures/

docs/
├── architecture/
├── implementation/
├── runbooks/
├── compliance/
└── release/
```

This is a target implementation map, not a claim that every path currently exists in the repository.

---

# 28. API Delivery Order

Implement API surfaces in this order to reduce frontend rework.

## Group A — Core risk

```text
GET  /api/cyber-risk/enterprise
GET  /api/cyber-risk/snapshots
POST /api/cyber-risk/recalculate
GET  /api/cyber-risk/drivers
```

## Group B — Data and twin

```text
GET  /api/evidence
GET  /api/ingestion/runs
GET  /api/digital-twin/assets
GET  /api/digital-twin/services
GET  /api/digital-twin/dependencies
```

## Group C — Scenario and investment

```text
POST /api/risk-scenarios/preview
POST /api/risk-scenarios/run
GET  /api/investments/candidates
POST /api/investments/optimize
```

## Group D — ML

```text
GET /api/model-governance/models
GET /api/model-governance/health
GET /api/model-governance/drift
```

## Group E — AI

```text
POST /api/ai/chat
GET  /api/ai/conversations/:id
```

## Group F — Governance/compliance

```text
POST /api/governance/packages
POST /api/governance/anchors
GET  /api/governance/timeline
GET  /api/compliance/frameworks
GET  /api/compliance/evidence
```

## Group G — Geospatial

```text
GET /api/geospatial/locations
GET /api/geospatial/risk
GET /api/geospatial/blast-radius/:entityId
```

Actual final paths may retain existing SentinelStack routes where compatibility is desirable.

---

# 29. Frontend Delivery Order

The UI should not be developed from isolated screenshots. Build each surface against the real API contract.

```text
1. Existing dashboard shell
2. Executive risk overview
3. Risk drivers
4. Asset/service drilldown
5. Scenario workspace
6. Investment optimizer
7. Evidence explorer
8. Governance timeline
9. Compliance center
10. Model health
11. Globe / geospatial explorer
12. Copilot
```

## Globe implementation note

The globe should remain visually consistent with the bright glass design direction already established, but its data source must become real enterprise geospatial state.

The visual layer is presentation; the location service is the source of truth.

---

# 30. Data Fixture Strategy

## 30.1 Enterprise synthetic baseline

Create a deterministic fictional enterprise with:

```text
5 business units
15 services
40–60 assets
50–100 vulnerabilities
10–20 security controls
20+ dependencies
100+ telemetry observations
20+ threat indicators
multiple locations
```

The exact counts may change, but the topology should be rich enough to demonstrate aggregation and dependencies.

## 30.2 Synthetic event scenarios

Prepare fixed fixtures for:

1. new KEV-listed vulnerability,
2. exploit availability change,
3. control effectiveness decline,
4. internet exposure change,
5. service dependency addition,
6. criticality increase,
7. SIEM anomaly increase,
8. source outage,
9. stale evidence,
10. model drift.

## 30.3 Public evidence fixtures

Include snapshots of selected public feeds with retrieval timestamp and source URL/identifier.

Do not make a live internet connection a mandatory dependency for the SIH presentation.

---

# 31. Numerical Reference Tests

Each mathematical component gets at least one hand-checkable fixture.

## Example probability fixture

Given `p_H = 0.2` over `H = 1 year`:

```text
lambda = -ln(0.8)
```

The test should compare implementation output to a reference value within the documented tolerance.

## Example EAL fixture

Given a deterministic severity distribution and event frequency, independently calculate expected annual loss and compare to engine output.

## Example VaR fixture

Given a small fixed loss array:

```text
[10, 20, 30, 40, 100]
```

Validate quantile semantics explicitly rather than relying on library defaults without documentation.

## Example optimizer fixture

Given three candidate controls and a fixed budget, verify selected controls, total cost, and objective value against a manually enumerated optimum.

---

# 32. Acceptance Test Matrix

| ID | Test | Expected result |
|---|---|---|
| AT-001 | clean build | pass |
| AT-002 | migration deploy | pass |
| AT-003 | tenant isolation | enforced |
| AT-004 | role enforcement | enforced |
| AT-005 | duplicate ingestion | idempotent |
| AT-006 | stale source | visible |
| AT-007 | source outage | status retained |
| AT-008 | entity unresolved | explicit unresolved state |
| AT-009 | asset graph sync | updated |
| AT-010 | material event | recalculation queued |
| AT-011 | non-material event | no unnecessary full recalculation |
| AT-012 | risk calculation | valid result |
| AT-013 | seeded Monte Carlo | reproducible |
| AT-014 | VaR quantile | correct |
| AT-015 | EAL reference | within tolerance |
| AT-016 | driver attribution | evidence-linked |
| AT-017 | scenario isolation | live state unchanged |
| AT-018 | scenario delta | recalculated |
| AT-019 | optimizer budget | never exceeded |
| AT-020 | infeasible portfolio | explicit infeasible status |
| AT-021 | solver optimality | only claimed when verified |
| AT-022 | ML dataset version | recorded |
| AT-023 | temporal split | enforced |
| AT-024 | calibration metric | stored |
| AT-025 | drift fixture | expected alert/state |
| AT-026 | model rollback | previous valid model restored |
| AT-027 | Copilot risk answer | grounded |
| AT-028 | Copilot hallucinated number test | rejected/corrected |
| AT-029 | prompt injection isolation | blocked |
| AT-030 | governance package | reproducible |
| AT-031 | hash verification | passes |
| AT-032 | tampered package | fails verification |
| AT-033 | on-chain payload inspection | no sensitive data |
| AT-034 | compliance mapping | versioned |
| AT-035 | report lineage | complete |
| AT-036 | globe point provenance | valid |
| AT-037 | geography scope | filters enterprise state |
| AT-038 | blast radius | dependency-aware |
| AT-039 | dashboard refresh | current state displayed |
| AT-040 | failed recalculation | last valid state retained |
| AT-041 | stale result overwrite | blocked |
| AT-042 | event replay | no duplicate side effects |
| AT-043 | worker restart | recoverable |
| AT-044 | database interruption | graceful failure |
| AT-045 | backup | successful |
| AT-046 | restore | successful |
| AT-047 | API p95 | within declared target |
| AT-048 | bulk ingestion | throughput target met |
| AT-049 | 50k simulation benchmark | completed within target |
| AT-050 | rate limiting | enforced |
| AT-051 | SSRF | blocked |
| AT-052 | oversized payload | rejected |
| AT-053 | secret logging | absent |
| AT-054 | CORS | allowlist only |
| AT-055 | security headers | present |
| AT-056 | demo reset | deterministic |
| AT-057 | demo fixture ingestion | visible |
| AT-058 | demo financial change | visible |
| AT-059 | demo optimization | visible |
| AT-060 | demo governance anchor | verifiable |
| AT-061 | demo compliance | visible |
| AT-062 | audit timeline | causally complete |
| AT-063 | release evidence manifest | complete |
| AT-064 | rollback | documented and tested |
| AT-065 | health/readiness | reflects dependency state |

---

# 33. CI/CD Gates

## Pull request gate

```text
Typecheck
Lint
Unit tests
Schema validation
Security scan
Build
```

## Integration gate

```text
Integration tests
Numerical reference tests
Connector fixture tests
Authorization tests
```

## Release candidate gate

```text
E2E
Performance
Security
Recovery
ML validation
Governance integrity
Demo reset
```

## Production gate

```text
All release-candidate tests pass
No open critical findings
No unexplained numerical mismatches
Migration rehearsal passed
Rollback rehearsal passed
Backup verified
Monitoring configured
Runbooks approved
```

---

# 34. Observability Requirements

Every critical operation should emit structured telemetry.

## Required identifiers

```text
requestId
organizationId
traceId
calculationRunId
scenarioRunId
optimizationRunId
ingestionRunId
evidenceId
modelVersion
governancePackageId
```

## Key metrics

### Ingestion

- records received,
- records accepted,
- records rejected,
- duplicates,
- lag,
- source freshness.

### Risk

- calculations/min,
- calculation duration,
- failure rate,
- queue depth,
- stale-result count.

### ML

- model calls,
- prediction latency,
- drift state,
- calibration metrics.

### AI

- Copilot requests,
- tool latency,
- grounding failures,
- blocked tool calls.

### Governance

- package generation failures,
- hash verification failures,
- approval latency,
- anchor failures.

---

# 35. Error Semantics

Do not collapse failures into generic `500` responses when the UI needs state-specific behavior.

Recommended classes:

```text
VALIDATION_ERROR
AUTHENTICATION_ERROR
AUTHORIZATION_ERROR
NOT_FOUND
CONFLICT
STALE_STATE
DEPENDENCY_UNAVAILABLE
SOURCE_FAILURE
CALCULATION_FAILURE
OPTIMIZATION_INFEASIBLE
MODEL_UNAVAILABLE
GROUNDING_FAILURE
INTEGRITY_FAILURE
RATE_LIMITED
```

The frontend should display the operational meaning rather than a generic error toast.

---

# 36. Risk Result State Machine

```text
REQUESTED
  ↓
QUEUED
  ↓
RUNNING
  ├──> SUCCEEDED
  ├──> FAILED_RETAINING_LAST_VALID
  └──> CANCELLED
```

Only `SUCCEEDED` runs become current authoritative risk state.

A failed run may expose diagnostics while the last valid successful run remains visible with explicit freshness/status metadata.

---

# 37. Model Lifecycle State Machine

```text
TRAINED
  ↓
EVALUATED
  ↓
CALIBRATED
  ↓
APPROVED
  ↓
SHADOW
  ↓
PRODUCTION
  ├──> DEPRECATED
  └──> ROLLED_BACK
```

A model in `DRAFT`, `TRAINED`, or `SHADOW` cannot silently become authoritative for production financial outputs.

---

# 38. Governance Approval State Machine

```text
PROPOSED
  ↓
REVIEWED
  ├──> REJECTED
  └──> APPROVED
          ↓
      IMPLEMENTED
          ↓
      VALIDATED
          ↓
      CLOSED
```

Risk acceptance and investment approval are separate decisions and should not be inferred from calculated risk alone.

---

# 39. Rollout Strategy

## Phase A — Shadow

- ingest data,
- normalize,
- build Digital Twin,
- calculate new risk in shadow,
- compare with legacy outputs,
- no executive decision authority.

## Phase B — Internal validation

- numerical validation,
- driver review,
- optimizer review,
- Copilot grounding validation,
- governance integrity checks.

## Phase C — Pilot

- selected synthetic/customer-like tenant,
- controlled connectors,
- monitored recalculation.

## Phase D — SIH demo release

- freeze demo fixture version,
- freeze model/config versions,
- disable nonessential network dependencies,
- rehearse reset and backup.

## Phase E — Production transition

- documented migration,
- approved rollback point,
- monitoring active,
- support runbooks active.

---

# 40. Rollback Design

## Application rollback

Revert to previously verified application build.

## Database rollback

Prefer forward-compatible schema migration and data repair over destructive down-migrations in production.

## Model rollback

Switch model registry pointer to previously approved model version.

## Risk-result rollback

Never delete historical calculations merely because a newer calculation failed. Point the current projection at the latest valid run according to freshness and ordering rules.

## Connector rollback

Disable the failing connector while retaining previously ingested source data and last-known state.

---

# 41. Backup and Restore

Back up:

- PostgreSQL data,
- migration metadata,
- governance packages,
- release manifests,
- model registry metadata,
- approved model artifacts,
- demo fixtures,
- configuration templates without secrets.

Do not treat blockchain anchoring as a backup.

Restore test must verify:

```text
data integrity
+ lineage integrity
+ risk reconstruction
+ governance reconstruction
```

---

# 42. Team Allocation Model

The work can be split into parallel tracks.

## Engineer A — Risk/Math

Owns:

- P11-08,
- P11-09,
- P11-10,
- P11-11,
- numerical tests.

## Engineer B — Data/Platform

Owns:

- P11-02,
- P11-03,
- P11-04,
- P11-05,
- P11-06,
- P11-07.

## Engineer C — ML/AI

Owns:

- P11-12,
- P11-13,
- P11-14.

## Engineer D — Governance/UI

Owns:

- P11-15,
- P11-16,
- P11-17.

## Shared / Lead

Owns:

- P11-01,
- P11-18,
- P11-19,
- P11-20,
- architecture decisions,
- release sign-off.

For a smaller team, these streams can be collapsed, but ownership must remain explicit.

---

# 43. Suggested Execution Cadence

## Sprint 0 — Baseline

Deliver:

- branch strategy,
- environment contract,
- build baseline,
- migration rehearsal.

## Sprint 1 — Data foundation

Deliver:

- canonical types,
- source records,
- evidence,
- ingestion framework,
- public-feed fixtures.

## Sprint 2 — Digital Twin + events

Deliver:

- assets/services/dependencies,
- entity resolution,
- materiality,
- outbox/events,
- recalculation queue.

## Sprint 3 — Risk v2

Deliver:

- event probability,
- loss distributions,
- EAL,
- VaR,
- risk score,
- deterministic numerical tests.

## Sprint 4 — Drivers + scenarios

Deliver:

- attribution,
- evidence drilldown,
- scenario preview/run,
- scenario isolation.

## Sprint 5 — Optimization

Deliver:

- candidate catalogue,
- solver integration,
- budget constraints,
- portfolio views.

## Sprint 6 — ML

Deliver:

- dataset pipeline,
- baseline model,
- candidate model,
- calibration,
- model registry,
- drift.

## Sprint 7 — Copilot

Deliver:

- typed tool registry,
- grounding layer,
- numeric validator,
- Copilot UI,
- audit trail.

## Sprint 8 — Governance + compliance

Deliver:

- evidence packages,
- hashing,
- anchor integration,
- approvals,
- mappings.

## Sprint 9 — Experience

Deliver:

- executive dashboard,
- technical dashboard,
- globe,
- blast radius,
- governance screens.

## Sprint 10 — Validation and release

Deliver:

- E2E,
- performance,
- security,
- recovery,
- demo fixtures,
- release evidence.

This sequence is intentionally dependency-driven. Parallelization is possible, but a later workstream must not become the hidden source of truth for an earlier unfinished foundation.

---

# 44. Definition of Done

A task is not “done” merely because the code executes.

A PS-26105 task is complete only when:

1. implementation exists,
2. contract is documented,
3. tests exist,
4. failure behavior is covered,
5. authorization is covered,
6. observability is included,
7. provenance is preserved,
8. relevant UI state is handled,
9. migration is reproducible,
10. runbook/evidence is updated where operationally relevant.

---

# 45. Technical Debt Register

Known items to track rather than hide:

| Debt | Impact | Action |
|---|---|---|
| legacy heuristic risk engine | high | migrate behind v2 interface |
| approximate VaR | high | replace with loss-distribution quantile |
| greedy optimizer | high | solver-backed optimizer |
| fixed scenarios | high | true state mutation + recompute |
| limited driver attribution | high | evidence-linked attribution |
| narrow current schema | high | additive migrations |
| connector-specific payload shapes | medium | canonical normalization |
| static globe semantics | medium | enterprise geo service |
| AI free-form numeric explanations | high | typed tools + validator |
| thin governance history | high | governance event/package layer |

Every debt item should have an issue/ticket and target release.

---

# 46. “Do Not Build” List

To avoid scope drift, do not prioritize:

- custom SIEM replacement,
- full EDR replacement,
- custom vulnerability scanner for every technology,
- consumer-facing cyber insurance pricing,
- generic country cyber-risk ranking,
- public blockchain storage of enterprise records,
- autonomous remediation without approval,
- unrestricted autonomous AI agents,
- animated visuals presented as telemetry,
- a second independent risk scoring system that conflicts with the quantitative engine.

The product is a **continuous cyber-risk decision platform**, not a replacement for every underlying security product.

---

# 47. SIH Evaluation Traceability Matrix

| PS-26105 need | SentinelStack implementation area | Evidence to show |
|---|---|---|
| continuous cyber risk | ingestion + event + recalculation | live risk change |
| monetary impact | loss distribution + EAL/VaR | ₹ risk metrics |
| dynamic likelihood | ML + threat/environment context | probability/calibration |
| key risk drivers | attribution service | driver card + evidence |
| cost-effective mitigation | scenarios + optimizer | budget portfolio |
| business translation | executive dashboard + Copilot | business explanation |
| varied telemetry | connectors + normalization | ingestion record |
| asset criticality | Digital Twin/business context | asset/service graph |
| control effectiveness | control model | control impact |
| governance | evidence package + audit | decision timeline |
| integrity | SHA-256 + optional blockchain anchor | verify screen |
| compliance | framework mappings | evidence mapping |
| forecasting | ML registry + drift | model health |
| geo context | enterprise AssetLocation | globe |

---

# 48. SIH Demo Narrative — Technical Version

The system should tell one coherent story:

> “A cyber event changes. SentinelStack ingests the new evidence, verifies and normalizes it, updates the enterprise Digital Twin, determines that the change is material, recalculates the affected risk distribution, quantifies the updated financial exposure, identifies the evidence-backed drivers, evaluates mitigation scenarios, optimizes investments under a declared budget, exposes the result to executives through grounded AI, and records the decision and evidence in a traceable governance timeline.”

Every statement in this narrative should be demonstrable through a backend event, database record, calculation run, tool result, or governance record.

---

# 49. Final Build Freeze Checklist

Before final SIH packaging, verify:

## Code

- no debug bypasses,
- no hardcoded production secrets,
- no accidental test endpoints exposed,
- no dead feature flags required by the demo.

## Database

- migrations reproducible,
- seed deterministic,
- demo reset deterministic,
- no inconsistent foreign keys.

## Risk

- EAL validated,
- VaR validated,
- annual probability semantics documented,
- uncertainty visible,
- model/version metadata stored.

## AI

- tools typed,
- grounding verified,
- tenant isolation enforced,
- mutating actions confirmed,
- numeric consistency tested.

## Governance

- package generation works,
- hash verification works,
- historical reconstruction works,
- blockchain anchor optional/non-blocking where appropriate.

## UI

- executive view coherent,
- technical view coherent,
- globe tied to real enterprise records,
- loading/error/stale states handled,
- no decorative animation implies unsupported telemetry.

## Operations

- health/readiness works,
- logs contain correlation IDs,
- alerts configured,
- backup validated,
- restore rehearsed,
- rollback rehearsed.

---

# 50. Final P11 Release Gate

The implementation is ready for SIH engineering freeze only when all of the following are true:

```text
[ ] P1–P10 specifications mapped to implementation tickets
[ ] database migrations reproducible
[ ] canonical contracts stable
[ ] ingestion + evidence pipeline operational
[ ] Digital Twin operational
[ ] materiality + recalculation operational
[ ] risk engine v2 validated
[ ] driver attribution validated
[ ] scenario engine validated
[ ] optimizer validated
[ ] ML model registry operational
[ ] calibration/drift operational
[ ] grounded Copilot operational
[ ] governance package operational
[ ] integrity verification operational
[ ] compliance mappings operational
[ ] geospatial explorer operational
[ ] executive + technical dashboards operational
[ ] E2E golden path passing
[ ] security suite passing
[ ] performance targets met or documented
[ ] recovery suite passing
[ ] SIH demo reset deterministic
[ ] release evidence package complete
[ ] deployment/rollback runbooks approved
```

---

# 51. Final Architecture-to-Code Handoff

The sequence for implementation should now be:

```text
READ THE SPEC
    ↓
CREATE / UPDATE TICKETS
    ↓
LOCK DOMAIN CONTRACTS
    ↓
MIGRATE SCHEMA
    ↓
IMPLEMENT DATA PLANE
    ↓
IMPLEMENT RISK PLANE
    ↓
IMPLEMENT DECISION PLANE
    ↓
IMPLEMENT GOVERNANCE
    ↓
WIRE UI
    ↓
RUN REFERENCE TESTS
    ↓
RUN E2E
    ↓
RUN SECURITY / PERFORMANCE / RECOVERY
    ↓
FREEZE DEMO FIXTURE
    ↓
BUILD RELEASE EVIDENCE
    ↓
DEPLOY RC
    ↓
FINAL SIH REHEARSAL
```

The critical change from the earlier project state is that engineering should now proceed from **contracts and acceptance tests**, not from UI screens alone.

---

# 52. Recommended First Coding Order

When implementation begins, the first concrete coding sequence should be:

```text
1. Prisma schema/migrations
2. Shared domain contracts
3. Evidence + source-record persistence
4. Canonical normalization interfaces
5. Digital Twin persistence/service
6. Outbox + event contracts
7. Recalculation orchestration
8. Risk Engine v2
9. Numerical reference tests
10. Driver attribution
11. Scenario engine
12. Optimizer
13. ML registry + prediction adapter
14. Copilot typed tools
15. Governance packages/hashing
16. Geospatial API
17. Dashboard API integration
18. Frontend surfaces
19. E2E + security + performance
20. SIH demo hardening
```

Do not begin with the Copilot or the globe as the primary engineering dependency. They are presentation/interaction layers over the underlying authoritative data plane.

---

# 53. Final Guardrails

1. **Never fabricate authoritative risk.**
2. **Never allow UI state to become the source of truth.**
3. **Never let the LLM calculate financial authority.**
4. **Never overwrite a newer risk state with an older run.**
5. **Never mutate live state during scenario simulation.**
6. **Never let optimization exceed budget.**
7. **Never expose secrets through evidence, logs, or blockchain.**
8. **Never present synthetic evidence as observed enterprise evidence.**
9. **Never weaken tenant or role isolation for the SIH demo.**
10. **Never make blockchain availability a prerequisite for core risk quantification.**
11. **Never claim model output is predictive certainty.**
12. **Never describe a black-swan event as predicted.**
13. **Never let a decorative visualization imply unsupported security telemetry.**
14. **Never ship a release whose migration or reset process exists only in someone's memory.**
15. **Never call a system production-ready without reproducible validation evidence.**

---

# Status

**P11 Final Implementation Execution Blueprint, Sprint Backlog, Dependency Graph, File-by-File Build Plan & SIH Delivery Checklist:** READY

P11 converts the completed P1–P10 specification chain into an actionable build sequence for the existing SentinelStack repository.

```text
P1 -> Foundation
P2 -> Quantify
P3 -> Attribute
P4 -> Simulate
P5 -> Optimize
P6 -> Predict / Calibrate / Monitor
P7 -> Explain / Translate
P8 -> Govern / Prove Integrity
P9 -> Continuously Ingest / Synchronize / Recalculate
P10 -> Validate / Benchmark / Secure / Deploy / Operate / Demonstrate
P11 -> Execute / Integrate / Test / Freeze / Deliver
```

**Final handoff:** engineering can now create implementation tickets directly from this document and proceed file-by-file without changing the agreed PS-26105 architecture.
