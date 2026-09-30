# SentinelStack — Data Dictionary & Database Schema v1.1

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.1  
**Document Status:** Reconciled Engineering Data Baseline  
**Date:** 26 September 2026  
**Baselines:** SRS v2.1 • SDD v1.2 • Risk Quantification & Mathematical Model v1.0 • ML Dataset & Training Specification v1.0 • API & Integration Contract v1.0  
**Repository Baseline:** `ciphernet01/sentinelstack` (`main`)

---

## 1. Purpose

This document reconciles the previously approved logical data contract with the **actual SentinelStack PostgreSQL/Prisma implementation**.

Version 1.0 described a PS-26105-aligned logical schema containing entities for ingestion, provenance, digital-twin state, risk assessment, model governance, scenarios, investments, recommendations, evidence, audit and compliance.

Version 1.1 does **not** discard that logical model. Instead, it establishes three layers:

1. **Existing operational schema** — entities already implemented in SentinelStack.
2. **PS-26105 extension schema** — entities/fields that must be added or strengthened to satisfy the target design.
3. **Future-scale/deployment schema** — entities that may remain adapters or optional persistence structures until enterprise integrations require them.

The repository remains the implementation source of truth for what exists today. This document is the target data contract for the next implementation stages.

---

## 2. Data Architecture Principles

| Principle | v1.1 rule |
|---|---|
| Operational truth | PostgreSQL/Prisma remains the authoritative operational store. |
| Tenant isolation | Every PS-26105 entity is organization-scoped directly or through a governed parent. |
| Point-in-time state | Risk calculations consume state available at the calculation timestamp. |
| Immutable history | Historical risk assessments are append-oriented; recalculation creates a new result rather than mutating prior results. |
| Provenance | Source identifiers, observation timestamps, collection metadata and hashes are preserved wherever available. |
| Model lineage | Every production ML-derived input identifies model version and feature/data version. |
| Financial units | Monetary values carry an explicit currency contract. INR remains the current implementation currency for the SIH reference deployment. |
| No false precision | Missing or weak inputs are represented as uncertainty/coverage limitations rather than silent zero-risk values. |
| Scenario isolation | What-if state mutations never modify production asset/control state. |
| Evidence traceability | Material risk and investment decisions retain references to the data/model/evidence used to produce them. |
| Schema evolution | Additive migrations are preferred; historical calculations remain interpretable after model/schema changes. |

---

## 3. Current Repository Data Model

The current Prisma schema already contains a meaningful PS-26105 foundation.

### 3.1 Existing core platform entities

These are pre-existing SentinelStack operational entities and should remain intact:

- `User`
- `Organization`
- `OrganizationMember`
- `OrganizationInvitation`
- `Assessment`
- `ScanJob`
- `Finding`
- `Report`
- `AuditLog`
- `ScheduledScan`
- `Webhook`
- `WebhookDelivery`
- `ApiKey`
- `OrganizationBranding`
- `ComplianceBadge`

These support the existing scanner-centric/security-assessment product and are **not to be replaced** by the financial-risk model.

### 3.2 Existing PS-26105 risk entities

The repository already contains:

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

These entities form the current Digital Twin + risk-calculation foundation.

Repository source:

`prisma/schema.prisma`

Risk foundation migration:

`prisma/migrations/20260824000001_add_cyber_risk_quantification/migration.sql`

---

## 4. Existing Entity Dictionary

### 4.1 `Organization`

**Purpose:** Tenant/business boundary.

Current repository fields relevant to PS-26105:

- `id`
- `name`
- subscription/billing fields
- `businessUnits`
- `cyberAssets`
- `securityControls`
- `riskSnapshots`
- `riskScenarios`

**v1.1 action:** KEEP.

**Target extension:** add organization-level risk configuration only when required, such as:

- reporting currency
- risk-calculation policy/version
- default VaR confidence
- source retention policy reference
- default risk horizon

Do not overload `Organization` with high-frequency telemetry or model-run data.

---

### 4.2 `BusinessUnit`

Current fields:

- `id`
- `organizationId`
- `name`
- `owner`
- `annualRevenueInr`
- `criticality`
- timestamps

**Purpose:** Business grouping and impact context.

**v1.1 action:** KEEP + EXTEND later.

Target additions may include:

- service/business dependency metadata
- business-impact override parameters
- risk scope configuration

`annualRevenueInr` is useful context but must not by itself be treated as an incident-loss estimate.

---

### 4.3 `CyberAsset`

Current fields include:

- organization and business-unit linkage
- `assetId`
- hostname/IP/service
- owner
- environment
- criticality
- internet exposure
- revenue dependency
- downtime cost/hour
- maximum tolerable downtime
- data sensitivity
- regulatory exposure
- breach cost
- recovery cost
- reputation cost

**Purpose:** Central Digital Twin technical/business object.

**v1.1 action:** KEEP + EXTEND.

Target additions:

- explicit `assetType`
- service identifier/reference
- state freshness metadata
- first/last observed timestamps
- external source references
- active/retired state
- canonicalization/provenance metadata

The present financial columns are appropriate as a practical SIH starting point but should eventually be generalized through versioned financial-parameter records.

---

### 4.4 `AssetDependency`

Current fields:

- source asset
- target asset
- dependency type
- criticality
- organization

**Purpose:** Dependency propagation and anti-double-counting context.

**v1.1 action:** KEEP + STRENGTHEN.

Target requirements:

- direction semantics
- dependency strength
- effective dates
- optional service-level relationships
- propagation-rule versioning at calculation time

The mathematical model requires deterministic dependency propagation and explicit anti-double-counting behavior.

---

### 4.5 `SecurityControl`

Current fields:

- `controlId`
- name/description
- category
- `baseCostInr`
- ISO 27001 mapping
- NIST CSF mapping
- CIS mapping
- RBI mapping
- SEBI mapping

**Purpose:** Control catalog and compliance mapping.

**v1.1 action:** KEEP + EXTEND.

Target additions:

- version/status
- implementation class
- default effectiveness model
- control dependency definitions
- evidence requirements
- applicability conditions
- standardized framework mapping records

The existing string-array framework fields are acceptable for compatibility, but normalized mapping entities should become the canonical long-term representation.

---

### 4.6 `AssetControl`

Current fields:

- asset
- control
- coverage percentage
- effectiveness percentage
- status
- last observed timestamp

**Purpose:** Point-in-time control posture at asset level.

**v1.1 action:** KEEP + EXTEND.

This should become an explicitly temporal control-state concept.

Target additions:

- `validFrom`
- `validTo`
- observation/source reference
- configuration strength
- evidence reference
- calculation/state version

The risk engine should use this state rather than hard-coded control multipliers.

---

### 4.7 `CyberVulnerability`

Current fields:

- CVE
- title
- CVSS
- EPSS
- exploit availability
- patch availability
- first/last seen
- status
- mapped controls
- source

**Purpose:** Vulnerability state attached to an asset.

**v1.1 action:** KEEP + EXTEND.

Required target additions:

- KEV indicator
- canonical vulnerability catalog separation
- normalized severity
- patch state
- exploit-observed flag
- observation timestamps suitable for point-in-time feature construction
- source identifier/provenance

The ML specification requires point-in-time observations rather than one static row per vulnerability.

---

### 4.8 `SecurityTelemetry`

Current fields:

- organization
- optional asset
- source
- event type
- severity
- signal score
- observed timestamp
- JSON metadata

**Purpose:** Lightweight normalized security telemetry.

**v1.1 action:** KEEP + EXTEND.

Target additions:

- source-native event ID
- canonical event ID
- ingestion/run ID
- source confidence
- entity type/reference
- content hash
- normalization version
- retention class
- raw-payload pointer
- deduplication key

`SecurityTelemetry` is appropriate for normalized operational state, but long-term high-volume raw telemetry should not be treated as the primary relational store.

---

### 4.9 `ThreatIntelIndicator`

Current fields:

- indicator type/value
- CVE
- threat actor
- campaign
- sector
- TTP
- confidence
- active
- observed timestamp

**Purpose:** Threat intelligence context.

**v1.1 action:** KEEP + EXTEND.

Target additions:

- source/feed identifier
- indicator confidence semantics
- valid-from/valid-to
- asset/service relationships
- STIX/TAXII provenance
- source hash

Threat intelligence should contribute evidence/features to likelihood estimation, not directly become a financial-loss number.

---

### 4.10 `RiskSnapshot`

Current fields:

- organization
- scope
- scope reference
- total financial exposure
- EAL
- 95% VaR
- average likelihood
- control effectiveness
- top drivers JSON
- assumptions JSON
- calculation timestamp

**Purpose:** Current persisted risk result.

**v1.1 action:** MODIFY substantially.

The existing model is too compact for the target governance model.

Target state:

```text
RiskAssessment
 ├── assessment identity / scope / timestamp
 ├── calculation bundle version
 ├── data snapshot reference
 ├── model version references
 ├── EAL
 ├── VaR(alpha)
 ├── financial exposure
 ├── product risk score
 ├── uncertainty/confidence
 ├── coverage
 ├── assumptions
 ├── calculation hash
 └── child driver / input / evidence records
```

For compatibility, `RiskSnapshot` can remain as a facade/table initially, but the long-term canonical concept should be `RiskAssessment`.

---

### 4.11 `RiskScenario`

Current fields:

- name/type
- budget
- baseline EAL
- simulated EAL
- risk reduction
- implementation cost
- ROSI
- modeled changes
- creator/timestamp

**Purpose:** Persisted what-if result.

**v1.1 action:** MODIFY.

Target scenario model must distinguish:

- baseline assessment ID
- immutable scenario definition
- state mutations
- scenario calculation run
- result assessment
- delta metrics
- feasibility result
- assumptions
- evidence/model bundle

A scenario must be recomputed through the same risk pipeline rather than applying a fixed global EAL multiplier.

---

## 5. Gap Between v1.0 Logical Schema and Current Prisma

The previous v1.0 data dictionary described entities such as:

- `integration_sources`
- `ingestion_runs`
- `source_records`
- `data_quality_issues`
- `services`
- `service_dependencies`
- `vulnerabilities`
- `asset_vulnerabilities`
- `financial_parameters`
- `incidents`
- `model_versions`
- `model_predictions`
- `risk_assessments`
- `risk_assessment_inputs`
- `risk_drivers`
- `scenarios`
- `scenario_changes`
- `investment_options`
- `recommendations`
- `optimization_runs`
- `optimization_results`
- `investment_decisions`
- `evidence`
- `evidence_links`
- `audit_events`
- framework mapping entities

The current Prisma repository does **not** yet contain all of those structures.

This is not a documentation failure; it is the implementation gap that v1.1 now records explicitly.

### 5.1 Reconciliation policy

| Logical entity from v1.0 | Current repository | v1.1 disposition |
|---|---|---|
| Organization | Implemented | KEEP |
| Business Unit | Implemented | KEEP |
| Service | represented by `CyberAsset.serviceName` | ADD normalized service entity later |
| Asset | `CyberAsset` | KEEP / EXTEND |
| Vulnerability catalog | asset-bound `CyberVulnerability` | SPLIT later |
| Asset vulnerability observation | `CyberVulnerability` | EXTEND |
| Security event | `SecurityTelemetry` | EXTEND |
| Threat signal | `ThreatIntelIndicator` | EXTEND |
| Control catalog | `SecurityControl` | KEEP / EXTEND |
| Control state | `AssetControl` | EXTEND into temporal state |
| Incident | not implemented | ADD |
| Financial parameter | asset fields currently embedded in `CyberAsset` | ADD versioned parameter entity |
| Model version | not implemented | ADD |
| Model prediction | not implemented | ADD |
| Risk assessment | partially represented by `RiskSnapshot` | MODIFY/ADD canonical assessment |
| Risk input lineage | not implemented | ADD |
| Risk driver | JSON inside snapshot | NORMALIZE |
| Scenario | `RiskScenario` | MODIFY |
| Scenario changes | JSON inside scenario | NORMALIZE |
| Investment option | recommendation objects are in service code only | ADD |
| Recommendation | service-generated only | ADD persistence |
| Optimization run/result | not persisted | ADD |
| Investment decision | not implemented | ADD |
| Evidence | existing generic report/audit concepts are insufficient | ADD dedicated evidence model |
| Evidence links | not implemented | ADD |
| Audit event | existing `AuditLog` is auth/product audit | ADD PS-26105 audit-event lineage model |
| Framework controls/mappings | arrays inside `SecurityControl` | normalize later |
| Integration source | not implemented as canonical risk connector entity | ADD |
| Ingestion run | not implemented | ADD |
| Source record | not implemented | ADD |
| Data-quality issue | not implemented | ADD |
| Retention metadata | not implemented for risk telemetry | ADD |

---

## 6. Target PS-26105 Data Domains

The target schema should be organized into the following logical domains.

### Domain A — Tenant & Business Context

- `Organization`
- `BusinessUnit`
- `Service`
- `Asset`
- `FinancialParameter`

### Domain B — Security State

- `Vulnerability`
- `AssetVulnerability`
- `SecurityEvent`
- `ThreatSignal`
- `Incident`

### Domain C — Control State

- `SecurityControl`
- `ControlState`
- `ControlFrameworkMapping`
- `FrameworkControl`

### Domain D — Integration & Provenance

- `IntegrationSource`
- `IngestionRun`
- `SourceRecord`
- `DataQualityIssue`

### Domain E — Risk Analytics

- `RiskAssessment`
- `RiskAssessmentInput`
- `RiskDriver`
- `ModelVersion`
- `ModelPrediction`

### Domain F — Scenarios

- `Scenario`
- `ScenarioChange`
- `ScenarioAssessment`

### Domain G — Investment Optimization

- `InvestmentOption`
- `Recommendation`
- `OptimizationRun`
- `OptimizationResult`
- `InvestmentDecision`

### Domain H — Governance & Trust

- `Evidence`
- `EvidenceLink`
- `AuditEvent`
- `CalculationArtifact`
- optional ledger/blockchain anchor metadata

---

## 7. Recommended Target Relationships

```text
Organization
  ├── BusinessUnit
  │     └── Service
  │           └── Asset
  │
  ├── IntegrationSource
  │     └── IngestionRun
  │           └── SourceRecord
  │
  ├── SecurityControl
  │     └── ControlFrameworkMapping
  │
  ├── RiskAssessment
  │     ├── RiskAssessmentInput
  │     ├── RiskDriver
  │     ├── ModelVersion
  │     └── EvidenceLink
  │
  ├── Scenario
  │     ├── ScenarioChange
  │     └── ScenarioAssessment
  │
  ├── InvestmentOption
  │     └── Recommendation
  │
  ├── OptimizationRun
  │     └── OptimizationResult
  │
  ├── InvestmentDecision
  └── AuditEvent
```

---

## 8. Financial Data Model

### 8.1 Current implementation

The repository currently stores financial-impact inputs directly on `CyberAsset`:

- revenue dependency
- downtime cost/hour
- tolerable downtime
- regulatory exposure
- breach cost
- recovery cost
- reputation cost

This is sufficient for the current ACME Bank reference seed.

### 8.2 Target model

Financial impact should become a versioned entity:

```text
FinancialParameter
- id
- organization_id
- scope_type
- scope_id
- parameter_type
- value
- currency
- valid_from
- valid_to
- source_type
- source_reference
- assumption_flag
- confidence
- created_at
```

This allows the system to distinguish:

- observed business values
- approved assumptions
- derived values
- historical values

and prevents a change in business assumptions from silently rewriting historical risk assessments.

---

## 9. Risk Assessment Persistence

The canonical risk result should contain enough information to reproduce a displayed number.

Minimum fields:

```text
RiskAssessment
- id
- organization_id
- scope_type
- scope_id
- assessed_at
- calculation_run_id
- data_snapshot_id
- risk_model_version
- likelihood_model_version
- severity_model_version
- score_model_version
- eal
- var_alpha
- var_value
- financial_exposure
- risk_score
- confidence
- coverage
- assumptions_json
- calculation_hash
- created_at
```

Child persistence:

```text
RiskAssessmentInput
RiskDriver
EvidenceLink
```

A dashboard number must never depend exclusively on an unstructured JSON blob.

---

## 10. Model Governance Data

The ML specification requires explicit model lineage.

### `ModelVersion`

Minimum concept:

```text
ModelVersion
- id
- name
- model_type
- version
- status
- artifact_hash
- feature_schema_hash
- training_dataset_id
- calibration_method
- metrics_json
- limitations_json
- approved_at
- retired_at
```

### `ModelPrediction`

Minimum concept:

```text
ModelPrediction
- id
- model_version_id
- assessment_id
- entity_id
- target
- horizon
- prediction
- confidence
- uncertainty_json
- features_hash
- created_at
```

Production risk calculations must reference an approved model version.

---

## 11. Risk Drivers

The current repository stores `topDrivers` as JSON on `RiskSnapshot`.

Target normalization:

```text
RiskDriver
- id
- assessment_id
- entity_type
- entity_id
- driver_type
- driver_name
- contribution_value
- contribution_direction
- rank
- explanation
- source_refs
- model_version
- created_at
```

Examples:

- high exploitation probability
- internet exposure
- weak MFA control
- high downtime dependency
- high data sensitivity
- active threat signal
- excessive vulnerability age

The driver record must allow the UI to explain **why** a service or asset contributes to financial risk.

---

## 12. Scenario Persistence

Target structure:

```text
Scenario
- baseline_assessment_id
- created_by
- scenario_type
- name
- budget
- status
- parameter_bundle_version

ScenarioChange
- scenario_id
- entity_type
- entity_id
- field
- baseline_value
- scenario_value

ScenarioAssessment
- scenario_id
- eal
- var
- financial_exposure
- risk_score
- confidence
- calculation_hash
```

Required invariant:

> Scenario execution must not mutate baseline production records.

---

## 13. Investment Optimization Persistence

The target data model separates options from optimizer runs.

```text
InvestmentOption
- id
- organization_id
- name
- category
- cost
- affected_scope
- applicability_rules
- dependencies
- expected_risk_reduction
- confidence
- evidence_refs
- status
```

```text
OptimizationRun
- id
- organization_id
- baseline_assessment_id
- budget
- objective
- constraint_bundle
- optimizer_version
- status
- created_at
```

```text
OptimizationResult
- run_id
- option_id
- selected
- modeled_risk_reduction
- spend
- residual_risk
- marginal_value
- rank
```

```text
InvestmentDecision
- id
- optimization_run_id
- decision
- approved_by
- decision_at
- rationale
- evidence_refs
```

This is required for reproducibility and board-level governance.

---

## 14. Evidence & Audit

The existing `AuditLog` should remain for product/account activity.

PS-26105 requires a separate analytical audit concept.

### Evidence

```text
Evidence
- id
- organization_id
- source_type
- source_reference
- collected_at
- content_hash
- retention_until
- metadata
```

### EvidenceLink

```text
EvidenceLink
- evidence_id
- entity_type
- entity_id
- relationship
```

### AuditEvent

```text
AuditEvent
- id
- organization_id
- actor_user_id
- action
- entity_type
- entity_id
- occurred_at
- payload_hash
- previous_event_hash
- metadata
```

The hash chain proves historical record integrity. It does not prove the underlying calculation is scientifically correct.

---

## 15. Integration & Raw Telemetry Retention

The SDD requires configurable raw/high-volume telemetry retention while preserving lineage.

Target separation:

```text
SourceRecord
  = provenance + canonical source metadata + content hash + raw pointer

SecurityEvent
  = normalized operational event used by risk analytics
```

When raw payloads age out:

- retain source ID
- retain timestamps
- retain content hash
- retain lineage
- retain references from assessments/evidence
- preserve enough metadata to explain why the historical calculation existed

The database should not become an unlimited raw telemetry warehouse.

---

## 16. Currency and Numeric Semantics

### Current implementation

Risk API/database values are primarily INR and use PostgreSQL `BigInt` for monetary fields.

### v1.1 rule

For the SIH reference implementation:

- `INR` remains the active currency.
- API responses may continue to expose numeric INR values for compatibility.
- Monetary calculations must avoid floating-point arithmetic where exact rupee precision matters.
- Future multi-currency support should store both:
  - numeric amount
  - ISO-4217 currency code

Recommended logical semantic:

```text
money_amount >= 0
currency = ISO-4217
```

Probability/confidence:

```text
0 <= p <= 1
```

VaR confidence:

```text
0 < alpha < 1
```

Risk Score:

```text
0 <= score <= 100
```

---

## 17. Indexing Requirements

Minimum target indexes:

```text
organization_id + assessed_at
organization_id + scope + scope_id
asset_id + observed_at
organization_id + source + observed_at
organization_id + status
organization_id + created_at
model_version_id
assessment_id
scenario_id
optimization_run_id
evidence_id
```

Large historical assessment/event tables should be partitionable by time if deployment volume requires it.

---

## 18. Tenant Isolation Rules

Every persisted PS-26105 record must satisfy:

1. Organization scope is explicit or derivable through a controlled foreign-key path.
2. Application queries always bind to authenticated organization context.
3. Admin cross-tenant access must be an explicit privileged path.
4. Client-supplied organization IDs must never override authorization.
5. Historical risk records must remain tenant-isolated.

---

## 19. Migration Strategy

Do not replace the current schema in one migration.

### Phase A — Compatibility

Add new nullable tables/columns while existing risk APIs continue to work.

### Phase B — Dual write

During transition:

```text
existing RiskSnapshot
        +
new RiskAssessment / supporting entities
```

are populated from the same calculation run.

### Phase C — Read migration

Move dashboard/API readers to the canonical risk-assessment structures.

### Phase D — Deprecation

Retain legacy columns/tables for backward compatibility until historical data has been migrated and verified.

Never edit an already-applied production migration in place.

---

## 20. Repository Implementation Mapping

| Data concern | Current code | v1.1 target |
|---|---|---|
| Prisma schema | `prisma/schema.prisma` | Extend additively |
| Risk foundation migration | `prisma/migrations/20260824000001_add_cyber_risk_quantification/` | Add new migrations |
| Enterprise risk calculation | `src/services/cyberRiskQuantification.service.ts` | Refactor behind canonical risk services |
| Risk API | `src/routes/cyber-risk.routes.ts` | Extend with versioned analytics/scenario endpoints |
| Risk controller | `src/controllers/cyber-risk.controller.ts` | Return canonical assessment contracts |
| Risk UI types | `src/hooks/use-cyber-risk.ts` | Versioned API schemas |
| Risk Intelligence page | `src/app/dashboard/risk-intelligence/page.tsx` | Consume canonical assessment/trend/scenario data |
| Executive overview | `src/components/dashboard/ExecutiveRiskOverview.tsx` | Render driver/evidence/model metadata |
| Seed | `scripts/seed-cyber-risk-digital-twin.js` | Extend with provenance and model-ready data |
| Foundation notes | `docs/SENTINELSTACK_26105_FOUNDATION.md` | Update after canonical schema implementation |

---

## 21. SRS / SDD Traceability

| Requirement | Data realization |
|---|---|
| FR-01/02 | IntegrationSource, IngestionRun, SourceRecord, DataQualityIssue |
| FR-03 | point-in-time security/control state + RiskAssessment |
| FR-04 | ModelVersion + ModelPrediction |
| FR-05 | FinancialParameter + Incident + severity/model records |
| FR-06/06A/06B | RiskAssessment + historical snapshots + drivers |
| FR-07 | Service + Asset + AssetDependency |
| FR-08 | SecurityControl + ControlState |
| FR-09 | RiskDriver + EvidenceLink |
| FR-10 | ModelVersion + ModelPrediction + monitoring metadata |
| FR-11/12 | Recommendation + verified risk/driver references |
| FR-13 | Scenario + ScenarioChange + ScenarioAssessment |
| FR-14/15/16 | InvestmentOption + OptimizationRun + OptimizationResult |
| FR-17/18/19 | OptimizationResult + InvestmentDecision |
| FR-20/21/22 | Assessment/driver/asset/service query structures |
| FR-23/24 | FrameworkControl + mappings + Evidence + reporting links |
| NFR-08 | AuditEvent + hashes |
| NFR-10 | SourceRecord retention metadata + Evidence lineage |

---

## 22. v1.1 Decisions

### Decision 1 — Do not replace `CyberAsset`

The current asset model already anchors the Digital Twin. Extend it incrementally.

### Decision 2 — Separate financial parameters from the asset model long-term

Embedded fields remain for compatibility; versioned financial parameters become the governed analytical source.

### Decision 3 — Separate product audit from analytical audit

`AuditLog` remains for existing platform activity. `AuditEvent` will cover model/risk/investment traceability.

### Decision 4 — Normalize risk drivers

A JSON-only `topDrivers` field is insufficient for reproducibility, filtering and evidence-level traceability.

### Decision 5 — Introduce canonical `RiskAssessment`

`RiskSnapshot` is retained as a compatibility layer during migration.

### Decision 6 — Do not add a graph database now

The current relational Digital Twin is sufficient for the SIH reference architecture. Graph-scale infrastructure remains an optional future optimization.

### Decision 7 — Keep raw telemetry outside the core relational analytical store at scale

Use normalized event tables plus object-storage pointers/hashes when raw volume grows.

---

## 23. Definition of Done

The v1.1 data model is considered implemented when:

- [ ] Existing SentinelStack tables remain backward compatible.
- [ ] Canonical risk-assessment persistence is implemented.
- [ ] Model version/prediction lineage is persisted.
- [ ] Financial parameters are versioned.
- [ ] Risk drivers are normalized and queryable.
- [ ] Scenario state mutations are isolated from baseline state.
- [ ] Investment options and optimizer runs are persisted.
- [ ] Investment decisions are auditable.
- [ ] Evidence and evidence links support displayed material outputs.
- [ ] Analytical audit events are hash-linked.
- [ ] Source provenance survives telemetry retention.
- [ ] Tenant isolation tests cover all new entities.
- [ ] Historical risk calculations remain interpretable after schema/model changes.
- [ ] Database migrations are additive and reversible at the application rollout level.
- [ ] API contracts expose model/calculation lineage without leaking sensitive raw telemetry.

---

## 24. Next Implementation Artifact

The next specification is:

**Risk Quantification & Mathematical Model Specification v1.1**

That revision will translate this reconciled schema into the actual implementation contract for:

`point-in-time evidence → calibrated likelihood → frequency → severity distribution → Monte Carlo annual loss → EAL → VaR → Risk Score → drivers → what-if → mitigation value → optimization`

It will also define exactly which current calculations in `cyberRiskQuantification.service.ts` are retained, replaced or split into dedicated services.
