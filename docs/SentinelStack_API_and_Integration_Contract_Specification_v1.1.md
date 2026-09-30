# SentinelStack — API & Integration Contract Specification v1.1

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.1  
**Document Status:** Reconciled API / Integration Engineering Baseline  
**Implementation Baseline:** `ciphernet01/sentinelstack`  
**Runtime Baseline:** Existing Next.js + Express + Prisma/PostgreSQL application  
**Date:** 29 September 2026  
**Baselines:** PS 26105 • SRS v2.1 • SDD v1.2 • Data Dictionary & Database Schema v1.1 • Risk Quantification & Mathematical Model Specification v1.1 • ML Dataset & Training Specification v1.1

> **Revision principle:** API v1.0 remains the conceptual external contract. v1.1 reconciles it with the actual SentinelStack Express routes and the repository-aware SDD v1.2 architecture. Existing product endpoints are preserved where practical; PS-26105 capabilities are introduced through additive, versioned contracts rather than a greenfield API rewrite.

> **Authority rule:** Risk/EAL/VaR/Risk Score/Financial Exposure values returned by risk APIs originate from the governed Risk Quantification Engine. ML provides controlled estimation inputs. The LLM may explain verified values but cannot create or overwrite authoritative financial metrics.

---

## Contents

1. Purpose and Scope
2. Revision and Reconciliation Note
3. Contract Principles
4. API Architecture and Service Boundaries
5. Base Paths and Current SentinelStack Mapping
6. Authentication, Authorization and Tenant Scope
7. Transport, Headers and Representation Conventions
8. Common Resource, Pagination and Error Contracts
9. Integration Source and Ingestion APIs
10. Digital Twin and Security-State APIs
11. Risk Intelligence API
12. ML Prediction and Model Metadata Contract
13. AI Decision Support and Grounded NLQ API
14. What-If Scenario API
15. Recommendations API
16. Investment Optimization API
17. Governance, Compliance, Reporting and Audit APIs
18. Job, Async Processing and Webhook Contracts
19. Reliability, Idempotency and Concurrency
20. Security and Privacy Contract
21. Data Freshness, Provenance and Lineage Contract
22. Versioning and Compatibility
23. Rate Limits and Operational Behavior
24. SRS / SDD / Data / Risk / ML Traceability
25. API Verification Plan
26. Migration from Existing SentinelStack APIs
27. Implementation Sequence
28. Definition of API Done
Appendix A. Canonical Examples
Appendix B. OpenAPI Mapping Guidance
Appendix C. Error Code Registry
Appendix D. Security Test Matrix
Appendix E. Repository Implementation Mapping

---

# 1. Purpose and Scope

This specification defines the externally observable HTTP API and integration contracts for SentinelStack.

It translates the approved product requirements and engineering baselines into concrete contracts covering:

- security and business-context ingestion;
- asset/service/control digital-twin state;
- continuous financial cyber-risk calculation;
- risk trends and drivers;
- ML-backed predictive signals;
- grounded AI/NLQ;
- what-if scenarios;
- security recommendations;
- budget-constrained investment optimization;
- ROSI and investment-vs-risk-reduction analysis;
- governance and human investment decisions;
- compliance mappings;
- evidence-backed reporting;
- audit and provenance;
- asynchronous processing;
- connector/webhook behavior.

The API is tenant-aware and designed for incremental adoption inside the existing SentinelStack application.

## 1.1 Implementation Boundary

The contract is logical and API-first.

The existing implementation uses:

```text
Next.js / React
        |
        v
Express API
        |
        +--> PostgreSQL / Prisma
        +--> Existing scanners / assessments / reports
        +--> Existing Firebase authentication
        +--> Existing workers / queues
        +--> PS-26105 risk-intelligence domain
```

The API does not require a mandatory distributed microservice rewrite.

Logical service boundaries may remain modular code within the current Express application until measured scale requires separation.

## 1.2 Scope Boundary

The API:

- does not replace upstream SIEM, EDR, IAM, CSPM, vulnerability-management or asset-inventory products;
- does not function as an ERP/accounting system;
- does not make the LLM the source of truth for risk;
- does not place raw high-volume telemetry or sensitive enterprise data on blockchain;
- does not expose cross-tenant resource access through caller-selected organization identifiers.

---

# 2. Revision and Reconciliation Note

API Contract v1.0 was generated against the earlier conceptual architecture. v1.1 reconciles that baseline with the actual SentinelStack repository inspected for SDD v1.2.

| Area | v1.0 position | v1.1 reconciliation |
|---|---|---|
| Runtime | Generic API service boundary | Existing Express application remains the primary API runtime. |
| Authentication | OAuth2/OIDC-style contract | Existing Firebase bearer authentication remains for browser/user APIs; API-key authentication remains for the existing public API. |
| Current cyber-risk API | Target `/risk/*` surface | Existing `/api/cyber-risk/enterprise` and `/api/cyber-risk/snapshots` remain compatibility endpoints during migration. |
| Public API | `/api/v1/*` assessment/report/webhook surface | Existing public API remains intact; PS-26105 APIs should use a distinct documented risk-intelligence contract to avoid breaking scanner consumers. |
| Dashboard APIs | Conceptual risk endpoints | Existing `/api/dashboard/*` remain UI-specific read APIs and must not become the canonical external risk contract. |
| AI | Generic `/nlq/query` target | Existing `/api/ai/chat` remains; grounded risk NLQ gets a separate contract or versioned expansion. |
| Risk runs | Target `POST /risk/recalculate` | v1.1 requires an explicit risk-run/job contract and must expose calculation metadata. |
| Scenarios | Target scenario API | Scenario creation/simulation must be copy-on-write and use the same versioned risk/ML bundle. |
| Optimization | Target budget optimizer | Final portfolio must be re-evaluated through the Scenario/Risk Engine pipeline. |
| Lineage | Abstract evidence references | v1.1 requires source/feature/model/prediction/risk-run references and hashes where applicable. |
| Async jobs | Generic jobs | Existing worker capability is retained; heavy PS-26105 work uses a common Job contract. |
| Globe / geospatial UI | Not explicit | Geography is represented as optional asset/service context and is never a stand-alone country-risk feed. |
| Blockchain | Optional integrity layer | API exposes provenance/hash references where present; blockchain remains an adapter and not an API-calculation dependency. |

## 2.1 Current Repository Routes Observed

The current application exposes, among other product routes:

```text
/api/auth/*
/api/assessments/*
/api/dashboard/*
/api/reports/*
/api/org/*
/api/billing/*
/api/scheduled-scans/*
/api/webhooks/*
/api/api-keys/*
/api/v1/*
/api/branding/*
/api/compliance/*
/api/admin/*
/api/ai/chat
/api/cyber-risk/enterprise
/api/cyber-risk/snapshots
```

The PS-26105 target API is therefore introduced incrementally rather than replacing existing routes.

---

# 3. Contract Principles

| Principle | API rule |
|---|---|
| Authoritative calculations | Risk metrics are produced by the governed Risk Engine. |
| ML authority boundary | ML returns estimates/uncertainty; it does not own EAL/VaR/score calculations. |
| Grounded AI | NLQ responses must be grounded in verified structured backend results and include references. |
| Point-in-time integrity | Risk and ML inputs identify the observation/cutoff timestamp and applicable version bundle. |
| Tenant isolation | Organization scope is derived from the authenticated identity or API key; arbitrary cross-tenant IDs are rejected. |
| Evidence lineage | Material outputs expose references to data sources, models, assumptions and calculation hashes where policy permits. |
| Copy-on-write scenarios | Scenario simulation does not mutate operational baseline state. |
| Async for heavy work | Recalculation, simulation, optimization and report generation use the Job contract. |
| Backward compatibility | Additive changes are preferred; breaking changes require a new major version. |
| Least privilege | Read/write permissions are enforced separately. |
| Idempotency | Heavy POST operations use idempotency keys. |
| Deterministic retries | Retried requests either return the original resource/job or a deterministic conflict. |
| No false precision | Missing/low-confidence data is surfaced explicitly rather than converted into silent zero-risk assumptions. |

---

# 4. API Architecture and Service Boundaries

The logical API flow is:

```text
Security / Business Sources
          |
          v
Integration + Ingestion APIs
          |
          v
Normalization / Evidence / Provenance
          |
          v
Digital Twin + Point-in-Time State
          |
          v
Risk Run Orchestrator
          |
          +--> ML Inference Adapter
          |
          +--> Risk Engine v2
          |
          +--> Scenario Engine
          |
          +--> Investment Optimizer
          |
          v
Authoritative Risk / Decision Outputs
          |
          +--> Executive Dashboard
          +--> Technical Dashboard
          +--> Grounded NLQ
          +--> Reporting / Compliance
          +--> Audit / Trust
```

## 4.1 Logical Components

| Component | API responsibility |
|---|---|
| Integration Gateway | Register source connectors and ingest source data. |
| Digital Twin API | Manage business units, services, assets, dependencies and controls. |
| Risk API | Trigger and retrieve authoritative risk calculations. |
| ML Adapter | Supply versioned likelihood/severity predictions to the Risk Engine. |
| Scenario API | Define and execute copy-on-write what-if state changes. |
| Recommendation API | Expose governed mitigation candidates and their modeled values. |
| Optimization API | Solve investment portfolio selection under constraints. |
| AI/NLQ API | Convert verified backend results into business language. |
| Governance API | Persist human decisions, evidence and audit events. |
| Job API | Track long-running operations. |

## 4.2 Canonical Authority Flow

```text
POST risk recalculation
        |
        v
Risk Run
        |
        +--> feature/input bundle
        +--> model bundle
        +--> parameters
        +--> evidence refs
        |
        v
Risk Engine
        |
        v
RiskAssessment
        |
        +--> EAL
        +--> VaR
        +--> Financial Exposure
        +--> Product Risk Score
        +--> Drivers
        +--> Uncertainty / coverage
```

---

# 5. Base Paths and Current SentinelStack Mapping

## 5.1 Existing Compatibility Paths

Existing user-facing application paths remain:

```text
/api/cyber-risk/enterprise
/api/cyber-risk/snapshots
/api/ai/chat
/api/dashboard/*
/api/v1/assessments
/api/v1/reports
/api/v1/webhooks
```

These are not deleted merely because the new contract is richer.

## 5.2 Target Risk-Intelligence API

The preferred PS-26105 API family is:

```text
/api/v1/risk/*
/api/v1/scenarios/*
/api/v1/recommendations/*
/api/v1/investment-options/*
/api/v1/optimization/*
/api/v1/investment-decisions/*
/api/v1/integrations/*
/api/v1/ingestion/*
/api/v1/nlq/*
/api/v1/audit/*
/api/v1/compliance/*
```

Where the current repository already has a route under `/api`, the implementation may initially expose a compatibility route and map internally to the canonical domain handler.

## 5.3 Canonical Resource Naming

Recommended canonical nouns:

```text
Organization
BusinessUnit
Service
Asset
Dependency
Vulnerability
Control
TelemetryEvent
ThreatIndicator
IntegrationSource
IngestionRun
RiskRun
RiskAssessment
RiskDriver
ModelVersion
ModelPrediction
Scenario
Recommendation
InvestmentOption
OptimizationRun
InvestmentDecision
EvidenceRecord
AuditEvent
Job
Report
ComplianceMapping
```

---

# 6. Authentication, Authorization and Tenant Scope

## 6.1 User Authentication

Browser and user-facing application APIs SHALL use the existing authenticated user/session mechanism.

The current application uses Firebase-based authentication.

The API layer SHALL validate:

- bearer token;
- token validity;
- user identity;
- organization membership;
- applicable role.

## 6.2 API-Key Authentication

Existing `/api/v1/*` scanner/public APIs continue to use the current API-key mechanism.

API keys are:

- organization-scoped;
- permission-scoped;
- never returned in plaintext after creation;
- unsuitable for selecting a different organization through a request parameter.

## 6.3 Roles

The risk domain may use role capabilities such as:

| Role capability | Example permissions |
|---|---|
| Executive | Read enterprise risk, trends, scenarios, reports |
| Security/Risk | Read/write risk calculations, scenarios, recommendations |
| Technical | Read assets, findings, vulnerabilities, controls, technical risk |
| Compliance/Governance | Read mappings/evidence, create assessments, generate reports |
| Administrator | Manage organization configuration, connectors, API keys |
| Decision Approver | Create/approve/defer/reject investment decisions |

The existing organization role system remains the implementation anchor; detailed role-to-permission mapping is configuration, not an API shortcut.

## 6.4 Tenant Scope

The API MUST NOT trust:

```json
{
  "organization_id": "arbitrary-user-supplied-id"
}
```

as sufficient authorization.

Tenant context is derived from:

```text
authenticated identity / API key
        ->
organization membership
        ->
authorized organization scope
```

Explicit scope filters are validated against that derived tenant.

## 6.5 Sensitive Operations

The following operations must be authorization-checked and audit logged:

- connector registration/update;
- risk parameter changes;
- severity assumption changes;
- investment decisions;
- report generation containing sensitive evidence;
- retention-policy changes;
- API-key creation/revocation;
- administrative model promotion or retirement.

---

# 7. Transport, Headers and Representation Conventions

| Element | Contract |
|---|---|
| Transport | HTTPS/TLS 1.2+ in production |
| Content type | `application/json; charset=utf-8` |
| Time | ISO-8601 UTC |
| Currency | ISO-4217 code |
| Monetary representation | JSON number where precision is sufficient; otherwise documented decimal-string representation for high-precision interfaces |
| Resource IDs | UUIDs for SentinelStack resources |
| Source IDs | Preserve source-native identifiers in lineage |
| Correlation | `X-Correlation-ID` accepted/returned |
| Request ID | Existing application request ID may be returned as `X-Request-ID` |
| Idempotency | `Idempotency-Key` required for heavy POST requests |
| Conditional requests | `ETag` / `If-Match` for mutable resources where applicable |
| Pagination | Cursor pagination for canonical PS-26105 collection APIs |
| Default page size | 50 |
| Maximum page size | 200 |
| Compression | gzip/br where supported |
| Schema | JSON objects with explicit version metadata |

## 7.1 Recommended Standard Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
X-Correlation-ID: <uuid>
Idempotency-Key: <uuid>
If-Match: "<etag>"
```

---

# 8. Common Resource, Pagination and Error Contracts

## 8.1 Envelope

Canonical collection response:

```json
{
  "data": [],
  "pagination": {
    "next_cursor": "opaque-cursor",
    "has_more": true
  },
  "meta": {
    "request_id": "uuid"
  }
}
```

Canonical single resource:

```json
{
  "data": {},
  "meta": {
    "request_id": "uuid"
  }
}
```

## 8.2 Problem Details Error

```json
{
  "type": "https://api.sentinelstack.tech/problems/validation-error",
  "title": "Validation error",
  "status": 400,
  "detail": "Invalid scope identifier",
  "instance": "/api/v1/risk/current",
  "correlation_id": "uuid",
  "code": "SCOPE_NOT_FOUND",
  "field_errors": [
    {
      "field": "scope_id",
      "message": "Resource is outside organization scope"
    }
  ]
}
```

## 8.3 Status Semantics

| Status | Meaning |
|---:|---|
| 200 | Successful synchronous request |
| 201 | Resource created |
| 202 | Accepted for asynchronous processing |
| 204 | Successful action with no body |
| 400 | Malformed request |
| 401 | Missing/invalid authentication |
| 403 | Authenticated but unauthorized |
| 404 | Resource not found in authorized scope |
| 409 | Conflict, stale version, duplicate action |
| 422 | Semantically invalid request |
| 429 | Rate limit exceeded |
| 500 | Unexpected server failure |
| 503 | Temporary dependency/service degradation |

## 8.4 Pagination

Canonical cursor parameters:

```text
?limit=50&cursor=<opaque>&sort=created_at&direction=desc
```

The server must reject unsupported sort fields.

---

# 9. Integration Source and Ingestion APIs

These APIs support the security and business-context inputs required by PS 26105.

## 9.1 Source Registration

### `POST /api/v1/integrations/sources`

Purpose:

- register a source;
- define connector type;
- define transport;
- establish normalized source metadata.

Example:

```json
{
  "name": "Production SIEM",
  "source_type": "SIEM",
  "mechanism": "REST",
  "schema_version": "1.0",
  "enabled": true,
  "configuration": {
    "endpoint": "https://example.internal/api"
  }
}
```

Credentials SHALL use secure secret storage and must never be returned in normal read responses.

## 9.2 List Sources

### `GET /api/v1/integrations/sources`

Filters may include:

```text
source_type
enabled
health
created_after
created_before
```

## 9.3 Test Source

### `POST /api/v1/integrations/sources/{source_id}/test`

Returns a diagnostic result:

```json
{
  "data": {
    "source_id": "uuid",
    "status": "SUCCESS|FAILED|DEGRADED",
    "schema_valid": true,
    "latency_ms": 184,
    "diagnostics": []
  }
}
```

No secrets are returned.

## 9.4 Batch Ingestion

### `POST /api/v1/ingestion/batch`

Heavy ingestion returns `202`.

Request:

```json
{
  "source_id": "uuid",
  "observed_at": "2026-09-29T10:00:00Z",
  "records": [],
  "schema_version": "1.0"
}
```

Response:

```json
{
  "data": {
    "job_id": "uuid",
    "ingestion_run_id": "uuid",
    "status": "QUEUED"
  }
}
```

## 9.5 Event Ingestion

### `POST /api/v1/ingestion/events`

Used for normalized security events.

The API must support at-least-once delivery semantics and downstream deduplication.

Recommended event fields:

```json
{
  "source_record_id": "source-native-id",
  "event_type": "authentication.failure",
  "observed_at": "2026-09-29T10:01:00Z",
  "asset_ref": "uuid",
  "service_ref": "uuid",
  "severity": "HIGH",
  "attributes": {}
}
```

## 9.6 Ingestion Runs

### `GET /api/v1/ingestion/runs`

Returns:

- source;
- start/end;
- status;
- row counts;
- accepted/rejected counts;
- quality result;
- lineage references.

## 9.7 Supported Source Families

The connector contract should allow adapters for:

```text
Vulnerability Management
SIEM
IAM
EDR
CSPM
Asset Inventory / CMDB
Threat Intelligence
Business Context / Service Mapping
```

STIX/TAXII-compatible threat ingestion may be added through an adapter rather than embedded into the core risk engine.

---

# 10. Digital Twin and Security-State APIs

The Digital Twin provides business, service, asset, dependency and control context.

## 10.1 Assets

### `GET /api/v1/assets`

Supports filters:

```text
business_unit_id
service_id
environment
criticality
internet_exposed
cloud_region
location
status
```

### `POST /api/v1/assets`

Creates or imports an asset.

Required concepts:

```json
{
  "name": "customer-api-01",
  "environment": "PRODUCTION",
  "criticality": "CRITICAL",
  "internet_exposed": true,
  "service_id": "uuid",
  "business_unit_id": "uuid"
}
```

## 10.2 Services

### `GET /api/v1/services`

Returns service criticality and dependency information.

## 10.3 Dependencies

A dependency is represented explicitly rather than inferred from arbitrary asset names.

Conceptual relationship:

```text
consumer_service
    |
    v
provider_service / asset
    |
    +--> dependency_strength
    +--> dependency_type
    +--> validity window
```

## 10.4 Vulnerabilities

### `GET /api/v1/vulnerabilities`

Canonical vulnerability output may include:

```json
{
  "id": "uuid",
  "cve_id": "CVE-YYYY-NNNN",
  "cvss": {},
  "epss": {},
  "kev": {},
  "status": "OPEN",
  "first_observed_at": "timestamp",
  "asset_refs": []
}
```

## 10.5 Controls

### `GET /api/v1/controls`

A control definition and implementation state must remain distinct.

```text
Control Definition
        +
Asset/Service Control State
        +
Coverage
        +
Effectiveness
```

A control API must not represent “MFA exists somewhere in the organization” as equivalent to per-asset coverage.

## 10.6 Geographic Context

Optional asset/service location metadata may include:

```json
{
  "country_code": "IN",
  "region": "NCR",
  "city": "Greater Noida",
  "latitude": 0.0,
  "longitude": 0.0,
  "cloud_region": "ap-south-1",
  "location_type": "CLOUD_REGION|OFFICE|DATACENTER|CUSTOM",
  "source": "ASSET_INVENTORY",
  "confidence": "HIGH"
}
```

This is intended for the Global Cyber Risk Explorer and blast-radius workflows.

It must not be interpreted as an independent country-level cyber-risk score unless a separate evidence-backed model exists.

---

# 11. Risk Intelligence API

The Risk API exposes the authoritative outputs of the Risk Engine.

## 11.1 Current Risk

### `GET /api/v1/risk/current`

Query:

```text
scope_type=ENTERPRISE|BUSINESS_UNIT|SERVICE|ASSET
scope_id=<uuid>
as_of=<timestamp>
include=drivers,uncertainty,evidence,model
```

Example response:

```json
{
  "data": {
    "risk_assessment_id": "uuid",
    "risk_run_id": "uuid",
    "scope": {
      "type": "ENTERPRISE",
      "id": "uuid"
    },
    "as_of": "2026-09-29T10:00:00Z",
    "currency": "INR",
    "financial_exposure": 0,
    "eal": 0,
    "var": {
      "alpha": 0.95,
      "amount": 0
    },
    "risk_score": 0,
    "control_effectiveness": 0,
    "uncertainty": {},
    "drivers": [],
    "model_bundle": {},
    "evidence_refs": [],
    "calculation_hash": "sha256:..."
  }
}
```

## 11.2 Recalculate Risk

### `POST /api/v1/risk/recalculate`

Request:

```json
{
  "scope": {
    "type": "ENTERPRISE",
    "id": "uuid"
  },
  "as_of": "2026-09-29T10:00:00Z",
  "priority": "NORMAL|HIGH",
  "reason": "MATERIAL_TELEMETRY_CHANGE"
}
```

Response:

```http
202 Accepted
```

```json
{
  "data": {
    "job_id": "uuid",
    "risk_run_id": "uuid",
    "status": "QUEUED"
  }
}
```

## 11.3 Risk Assessment History

### `GET /api/v1/risk/assessments/{assessment_id}`

Returns an immutable historical assessment with:

- scope;
- calculation timestamp;
- as-of timestamp;
- EAL;
- VaR;
- Financial Exposure;
- Risk Score;
- model bundle;
- parameter bundle;
- evidence;
- drivers;
- uncertainty;
- calculation hash.

## 11.4 Risk Trends

### `GET /api/v1/risk/trends`

Parameters may include:

```text
scope_type
scope_id
metric=eal|var|financial_exposure|risk_score
from
to
interval=day|week|month
```

The response must preserve the timestamp and calculation version for every point.

## 11.5 Risk Drivers

### `GET /api/v1/risk/drivers`

Returned drivers should be evidence/model-derived contributors, not merely a list of high-risk assets.

Example:

```json
{
  "data": [
    {
      "driver_id": "uuid",
      "type": "VULNERABILITY|EXPOSURE|THREAT|CONTROL|DEPENDENCY|BUSINESS_IMPACT",
      "entity_ref": "uuid",
      "name": "Internet-facing critical service",
      "contribution_to_eal": 0,
      "contribution_to_score": 0,
      "direction": "INCREASES_RISK",
      "confidence": "HIGH",
      "evidence_refs": []
    }
  ]
}
```

## 11.6 Risk Authority Invariant

The following fields must originate from the Risk Engine:

```text
risk_score
eal
var
financial_exposure
scenario_delta_eal
scenario_delta_var
scenario_delta_exposure
optimization_objective_value
```

Clients and AI services cannot supply replacement values for these fields.

---

# 12. ML Prediction and Model Metadata Contract

ML is internal infrastructure but prediction lineage can be exposed in controlled risk responses.

## 12.1 Likelihood Prediction

Canonical internal resource:

### `GET /api/v1/risk/predictions/{prediction_id}`

Example:

```json
{
  "data": {
    "prediction_id": "uuid",
    "model_version": "likelihood-v1",
    "feature_set_version": "risk-features-v2",
    "observation_time": "2026-09-29T10:00:00Z",
    "entity_scope": "ASSET",
    "p_h": 0.18,
    "horizon_days": 30,
    "calibration_version": "cal-v1",
    "confidence_level": "MEDIUM",
    "data_coverage": {
      "vulnerability": 1,
      "asset_context": 1,
      "controls": 0.94,
      "telemetry": 0.81
    },
    "ood_flag": false,
    "feature_attribution": {},
    "input_bundle_hash": "sha256:...",
    "model_artifact_hash": "sha256:..."
  }
}
```

## 12.2 Severity Prediction

The severity contract may expose:

```json
{
  "distribution_family": "LOGNORMAL",
  "parameters": {},
  "quantiles": {
    "q10": 0,
    "q50": 0,
    "q90": 0
  }
}
```

The Risk Engine remains responsible for aggregate-loss simulation.

## 12.3 Prediction Non-Authority

A low-confidence or OOD prediction can be returned as advisory data, but the Risk Engine determines whether it is admissible as a required calculation input.

The API must never imply:

```text
model prediction == EAL
```

or:

```text
anomaly score == confirmed incident
```

---

# 13. AI Decision Support and Grounded NLQ API

## 13.1 Current Compatibility Endpoint

Existing:

```text
POST /api/ai/chat
```

remains available for current product workflows.

## 13.2 Canonical Risk NLQ

### `POST /api/v1/nlq/query`

Request:

```json
{
  "query": "Which vulnerabilities contribute most to expected annual loss?",
  "scope": {
    "type": "ENTERPRISE",
    "id": "uuid"
  },
  "response_detail": "STANDARD"
}
```

Response:

```json
{
  "data": {
    "answer": "Verified backend analysis identifies the largest modeled contributors in the selected enterprise scope.",
    "data_refs": [
      {
        "type": "RISK_ASSESSMENT",
        "id": "uuid"
      }
    ],
    "metric_refs": [
      {
        "name": "EAL",
        "value": 0,
        "currency": "INR"
      }
    ],
    "calculation_hashes": [
      "sha256:..."
    ],
    "warnings": [],
    "model_context": {
      "risk_engine_version": "risk-engine-v2",
      "model_bundle_version": "bundle-v1"
    }
  }
}
```

## 13.3 Grounding Rule

The NLQ layer gets information through approved read-only backend tools.

It must not receive unrestricted database credentials.

It must not:

- update authoritative metrics;
- invent missing financial values;
- bypass tenant authorization;
- suppress warnings;
- convert uncertainty into fabricated certainty.

## 13.4 Natural-Language Business Translation

Questions may cover:

```text
What is our expected annual loss?
What is driving the financial exposure?
What changed this week?
What happens if MFA coverage rises to 95%?
Which controls should be evaluated under a ₹1 crore budget?
Which business service has the largest modeled blast radius?
```

Each answer is grounded in structured results.

---

# 14. What-If Scenario API

Scenarios are copy-on-write mutations over a baseline risk state.

## 14.1 Create Scenario

### `POST /api/v1/scenarios`

Request:

```json
{
  "name": "Increase MFA coverage",
  "baseline_assessment_id": "uuid",
  "changes": [
    {
      "target_type": "CONTROL",
      "target_id": "uuid",
      "field": "coverage",
      "from": 0.65,
      "to": 0.95
    }
  ]
}
```

Response:

```http
201 Created
```

The operational baseline remains unchanged.

## 14.2 Get Scenario

### `GET /api/v1/scenarios/{scenario_id}`

Returns:

- scenario metadata;
- baseline assessment;
- changes;
- status;
- created-by;
- version;
- model bundle intended for simulation.

## 14.3 Simulate Scenario

### `POST /api/v1/scenarios/{scenario_id}/simulate`

Response:

```http
202 Accepted
```

```json
{
  "data": {
    "job_id": "uuid",
    "scenario_id": "uuid"
  }
}
```

## 14.4 Scenario Result

### `GET /api/v1/scenarios/{scenario_id}/result`

Example:

```json
{
  "data": {
    "baseline": {
      "eal": 0,
      "var": 0,
      "financial_exposure": 0,
      "risk_score": 0
    },
    "scenario": {
      "eal": 0,
      "var": 0,
      "financial_exposure": 0,
      "risk_score": 0
    },
    "delta": {
      "eal": 0,
      "var": 0,
      "financial_exposure": 0,
      "risk_score": 0
    },
    "assumptions": [],
    "model_bundle": {},
    "calculation_hashes": []
  }
}
```

## 14.5 Scenario Invariants

- Baseline state is unchanged.
- Same risk/model pipeline is reused.
- Explicit state changes are persisted.
- Delta is calculated from comparable baseline/scenario outputs.
- Scenario output is reproducible under the declared version bundle.

---

# 15. Recommendations API

Recommendations represent decision-support candidates rather than ungoverned text suggestions.

## 15.1 List Recommendations

### `GET /api/v1/recommendations`

Filters may include:

```text
status
scope
priority
control_type
optimization_eligible
```

## 15.2 Create / Generate

### `POST /api/v1/recommendations/generate`

The recommendation generator may use:

- materiality;
- risk-driver contribution;
- quantified scenario delta;
- urgency;
- cost;
- feasibility;
- dependencies;
- uncertainty.

## 15.3 Recommendation Contract

```json
{
  "recommendation_id": "uuid",
  "title": "Patch critical internet-facing vulnerability",
  "scope_refs": ["uuid"],
  "risk_driver_refs": ["uuid"],
  "expected_cost": {
    "amount": 0,
    "currency": "INR"
  },
  "quantified_risk_reduction": {
    "eal_delta": 0,
    "var_delta": 0
  },
  "optimization_eligible": true,
  "dependencies": [],
  "evidence_refs": [],
  "assumptions": [],
  "confidence_level": "MEDIUM"
}
```

A recommendation should not become optimizer-eligible until its cost and defensible quantified risk reduction are available.

---

# 16. Investment Optimization API

## 16.1 Investment Options

### `GET /api/v1/investment-options`

Each candidate should contain:

- cost;
- currency;
- affected assets/services;
- dependency requirements;
- modeled risk reduction;
- applicability;
- implementation assumptions;
- confidence;
- evidence.

## 16.2 Optimization Run

### `POST /api/v1/optimization/runs`

Request:

```json
{
  "budget": {
    "amount": 10000000,
    "currency": "INR"
  },
  "objective": "MAXIMIZE_RISK_REDUCTION",
  "candidate_option_ids": [
    "uuid-1",
    "uuid-2"
  ],
  "constraints": {
    "excluded_option_ids": [],
    "required_option_ids": [],
    "dependency_rules": []
  }
}
```

Response:

```http
202 Accepted
```

```json
{
  "data": {
    "job_id": "uuid",
    "optimization_run_id": "uuid",
    "status": "QUEUED"
  }
}
```

## 16.3 Optimization Result

### `GET /api/v1/optimization/runs/{optimization_run_id}`

Response must expose:

```text
selected options
total cost
budget
modeled portfolio risk reduction
residual EAL
residual VaR
residual financial exposure
objective value
constraint status
model/parameter bundle
scenario/risk-run references
```

## 16.4 Portfolio Interaction Rule

Individual option reductions can be used for screening.

The final selected portfolio should be re-evaluated through the Scenario Engine and Risk Engine when feasible because controls can:

- overlap;
- interact;
- depend on one another;
- have diminishing returns.

The portfolio result must therefore not simply sum independent percentages.

## 16.5 Investment-vs-Risk-Reduction Curve

### `GET /api/v1/optimization/runs/{optimization_run_id}/curve`

Each point may include:

```json
{
  "budget": 5000000,
  "selected_option_count": 3,
  "portfolio_eal": 0,
  "portfolio_risk_reduction": 0,
  "marginal_reduction": 0
}
```

The curve is a decision-analysis output, not a prediction of future market/election-style outcomes.

---

# 17. Governance, Compliance, Reporting and Audit APIs

## 17.1 Investment Decisions

### `POST /api/v1/investment-decisions`

Records a human action:

```json
{
  "optimization_run_id": "uuid",
  "decision": "APPROVE|REJECT|DEFER",
  "rationale": "Human-entered rationale",
  "selected_option_ids": ["uuid"]
}
```

The API must not infer approval from optimizer output.

The human decision remains a separate governance event.

## 17.2 Compliance Mappings

### `GET /api/v1/compliance/mappings`

Supported framework families include:

```text
ISO/IEC 27001
NIST CSF
CIS Controls
RBI Cyber Security Framework
SEBI Cybersecurity and Cyber Resilience Framework
```

The API should return mapping identifiers, control references, status and evidence links.

## 17.3 Compliance Assessment

### `POST /api/v1/compliance/assessments`

Heavy assessment may return `202 + Job`.

## 17.4 Reports

### `POST /api/v1/reports`

Supports generation of:

```text
PDF
CSV
JSON
```

The report resource should retain:

- source risk assessment;
- calculation hash;
- evidence references;
- report artifact hash;
- generation timestamp.

## 17.5 Audit Events

### `GET /api/v1/audit/events`

Supports filters:

```text
actor
resource_type
resource_id
event_type
from
to
```

Audit events should include:

```json
{
  "event_id": "uuid",
  "actor_id": "uuid",
  "organization_id": "uuid",
  "event_type": "RISK_ASSESSMENT_CREATED",
  "resource_type": "RiskAssessment",
  "resource_id": "uuid",
  "occurred_at": "timestamp",
  "source_refs": [],
  "content_hash": "sha256:..."
}
```

---

# 18. Job, Async Processing and Webhook Contracts

## 18.1 Job Resource

### `GET /api/v1/jobs/{job_id}`

Example:

```json
{
  "data": {
    "job_id": "uuid",
    "type": "RISK_RECALCULATION",
    "status": "QUEUED|RUNNING|SUCCEEDED|FAILED|CANCELLED",
    "progress": {
      "percent": 45,
      "stage": "AGGREGATE_LOSS_SIMULATION"
    },
    "created_at": "timestamp",
    "started_at": "timestamp",
    "completed_at": null,
    "result_ref": null,
    "error_code": null
  }
}
```

## 18.2 Async Work Types

Recommended types:

```text
INGESTION
RISK_RECALCULATION
SCENARIO_SIMULATION
OPTIMIZATION
COMPLIANCE_ASSESSMENT
REPORT_GENERATION
```

## 18.3 Completion Events

The webhook event contract may include:

```text
ingestion.completed
risk.assessment.completed
scenario.completed
optimization.completed
report.generated
```

Example:

```json
{
  "event_id": "uuid",
  "event_type": "risk.assessment.completed",
  "occurred_at": "timestamp",
  "organization_id": "uuid",
  "resource": {
    "type": "RiskAssessment",
    "id": "uuid"
  },
  "data": {
    "risk_run_id": "uuid",
    "calculation_hash": "sha256:..."
  }
}
```

## 18.4 Webhook Security

Webhook deliveries should support:

```text
signed payload
timestamp
event ID
delivery ID
retry count
```

Consumers should reject stale signatures according to the configured tolerance.

---

# 19. Reliability, Idempotency and Concurrency

## 19.1 Idempotency

POST requests that create jobs or expensive resources SHALL accept:

```http
Idempotency-Key: <unique-key>
```

Repeated equivalent submissions return the original job/resource reference.

## 19.2 Conflict Semantics

Return:

```http
409 Conflict
```

for:

- stale ETag/If-Match;
- duplicate decision where only one final decision is allowed;
- duplicate idempotency key with non-equivalent payload;
- incompatible state transition.

## 19.3 Retries

Clients should retry:

```text
429
503
```

using exponential backoff.

Do not blindly retry:

```text
400
401
403
404
422
```

## 19.4 Ingestion Deduplication

At-least-once upstream delivery is expected.

Canonical deduplication uses source-native identity plus source/version semantics.

## 19.5 Risk Run Concurrency

Material risk recalculation should be serialized per:

```text
organization
+
scope
+
risk/model bundle
```

so stale calculations cannot silently become the latest authoritative result.

A stale run may complete as a historical run, but it must not overwrite a newer assessment.

---

# 20. Security and Privacy Contract

## 20.1 Transport

Production APIs require TLS 1.2+.

## 20.2 Storage

Sensitive data should use organization-approved encryption-at-rest controls equivalent to modern strong symmetric encryption.

## 20.3 Secret Handling

Secrets:

- never appear in logs;
- never appear in ordinary connector read responses;
- are stored through deployment secret management;
- are write-only when API fields require them.

## 20.4 Raw Telemetry

Raw SIEM/EDR/IAM telemetry may remain inside a private/hybrid enterprise environment.

The API must support:

- aggregate submissions;
- derived feature submissions;
- controlled event forwarding;

when raw transfer is inappropriate.

## 20.5 Financial Data Minimization

The platform receives only financial-impact parameters required for cyber-risk modeling.

Examples:

```text
downtime cost/hour
recovery cost profile
regulatory exposure parameters
business-impact assumptions
```

The API should avoid unnecessary accounting data.

## 20.6 Tenant Data Leakage Tests

Resource lookup by ID must always be authorized in tenant context.

Expected policy:

```text
authorized resource -> 200
nonexistent resource -> 404
cross-tenant resource -> 403 or policy-defined 404
```

The exact behavior must remain consistent.

---

# 21. Data Freshness, Provenance and Lineage Contract

Every material risk output should be traceable to:

```text
source record(s)
     ->
ingestion run
     ->
canonical state
     ->
feature/input bundle
     ->
model/parameter bundle
     ->
prediction(s)
     ->
risk run
     ->
risk assessment
     ->
scenario/recommendation/decision
```

## 21.1 Required Timestamps

Where relevant, the API should distinguish:

```text
observed_at
collected_at
ingested_at
processed_at
calculated_at
as_of
```

Do not collapse these into a single timestamp.

## 21.2 Required Version References

Risk-related responses should identify:

```text
risk_engine_version
parameter_version
model_bundle_version
feature_set_version
calibration_version
simulation_config_version
```

## 21.3 Coverage Metadata

Example:

```json
{
  "data_coverage": {
    "asset_inventory": 1.0,
    "vulnerability_management": 0.98,
    "siem": 0.81,
    "iam": 0.94,
    "edr": 0.87,
    "cspm": 0.72,
    "threat_intelligence": 0.91
  },
  "confidence_level": "MEDIUM",
  "warnings": [
    "CSPM coverage is incomplete for the selected scope"
  ]
}
```

## 21.4 Calculation Hash

A canonical calculation hash should be generated from the canonicalized input/output lineage bundle.

Example:

```text
sha256:<hex>
```

This supports reproducibility and historical integrity.

Hashing does not prove statistical correctness.

## 21.5 Blockchain Adapter

If blockchain is enabled, the API may expose:

```json
{
  "integrity_anchor": {
    "status": "ANCHORED",
    "ledger_type": "PERMISSIONED|TESTNET|LOCAL",
    "anchor_hash": "sha256:...",
    "recorded_at": "timestamp"
  }
}
```

The API must not require blockchain availability for normal risk calculation unless an explicitly configured governance policy says otherwise.

---

# 22. Versioning and Compatibility

## 22.1 API Version

The canonical API version remains:

```text
/api/v1
```

## 22.2 Additive Changes

Backward-compatible changes include:

- additional response fields;
- optional request fields;
- new collection filters;
- new event types documented as ignorable.

Clients must tolerate unknown response fields.

## 22.3 Breaking Changes

Breaking changes require:

```text
/api/v2
```

or another explicitly versioned major contract.

## 22.4 Enum Changes

Adding enum values can break strict clients.

Enum additions must therefore be:

- documented before release;
- tested against known consumers;
- accompanied by compatibility notes.

## 22.5 Schema Versioning

Internal canonical schemas can version independently from public API versions.

Source-native schemas retain their own lineage.

---

# 23. Rate Limits and Operational Behavior

The exact production limit is deployment-specific, but the API should distinguish:

```text
standard reads
heavy analytical operations
ingestion
AI/NLQ
administrative operations
```

The existing global application limiter remains part of the runtime security layer.

Response on throttling:

```http
429 Too Many Requests
Retry-After: <seconds>
```

The API should include a machine-readable error code.

Examples:

```text
RATE_LIMITED
AI_RATE_LIMITED
INGESTION_RATE_LIMITED
JOB_QUOTA_EXCEEDED
```

---

# 24. SRS / SDD / Data / Risk / ML Traceability

| Baseline requirement | Design/data realization | API realization |
|---|---|---|
| FR-01–02 | Integrations, ingestion, source records | `/integrations/*`, `/ingestion/*` |
| FR-03 / NFR-03A | Risk runs + Jobs | `/risk/recalculate`, `/jobs/*` |
| FR-04 | ML likelihood + calibrated prediction | `/risk/current`, prediction lineage in risk response |
| FR-05 | Severity distribution + impact parameters | `/risk/*` and model metadata |
| FR-06 | EAL / VaR / Financial Exposure | `/risk/current`, `/risk/assessments/*` |
| FR-06B | Product Risk Score | `/risk/current`, trends |
| FR-07 | Business unit/service/asset/dependency | `/assets`, `/services` |
| FR-08 | Controls and effectiveness | `/controls` |
| FR-09 | Risk-driver attribution | `/risk/drivers` |
| FR-10 | ML trends/anomaly/prediction | risk/ML metadata + trend APIs |
| FR-11 | Recommendations | `/recommendations/*` |
| FR-12 / FR-12A | Business translation + NLQ | `/nlq/query` |
| FR-13 | Copy-on-write scenarios | `/scenarios/*` |
| FR-14–19 | Investment options, optimizer, ROSI/curve, decisions | `/investment-options`, `/optimization/*`, `/investment-decisions` |
| FR-20 | Risk history/trends | `/risk/trends` |
| FR-21–22 | Technical/executive read models and drill-down | risk/current + resource APIs |
| FR-23 | Framework mappings | `/compliance/mappings` |
| FR-24 | Evidence reports | `/reports/*`, `/audit/events` |
| NFR-01–02 | Auth/RBAC/tenant checks | All protected endpoints |
| NFR-05 | Drivers/evidence/warnings/hashes | Risk, scenario, optimizer, NLQ responses |
| NFR-07 | REST/JSON + ingestion adapters | Integration/ingestion APIs |
| NFR-08 | Audit + hashes | `/audit/events` + evidence lineage |
| NFR-09 | Stateless APIs + workers | `/jobs/*`, worker-backed heavy operations |
| NFR-10 | Retention + lineage | ingestion/store policy + lineage references |

---

# 25. API Verification Plan

## 25.1 Contract Validation

The OpenAPI artifact SHALL:

- parse successfully;
- define every referenced schema;
- define every documented endpoint;
- use consistent authentication declarations;
- use valid response/status combinations.

## 25.2 Authentication

Tests:

- no token -> 401;
- invalid token -> 401;
- valid token -> authorized scope only.

## 25.3 Authorization / Tenant Isolation

Tests:

- resource within tenant -> success;
- cross-tenant ID -> 403/404 according to policy;
- no data leakage in errors.

## 25.4 Ingestion

Tests:

- valid source payload normalizes correctly;
- duplicate source event is deduplicated;
- source provenance persists;
- invalid schema is rejected;
- missing timestamps are handled according to contract;
- ingestion run records quality outcomes.

## 25.5 Risk Authority

Tests:

- risk API returns stored authoritative values;
- risk run has calculation hash;
- model metadata is linked;
- NLQ cannot mutate risk values;
- client cannot submit replacement EAL/VaR/score values.

## 25.6 Continuous Risk

Tests:

- high-severity recalculation enters the job queue;
- job exposes state transitions;
- stale run cannot overwrite a newer assessment;
- material changes trigger recalculation according to policy.

## 25.7 Scenario

Tests:

- scenario creation leaves baseline state unchanged;
- simulation uses same model/parameter versions;
- baseline vs scenario metrics are comparable;
- delta arithmetic is internally consistent.

## 25.8 Optimization

Tests:

- budget constraints enforced;
- dependency constraints enforced;
- excluded candidates remain excluded;
- final portfolio has a reproducible result;
- portfolio is re-evaluated through scenario/risk engine when configured.

## 25.9 NLQ

Tests:

- tenant scope is preserved;
- responses include evidence/metric refs;
- unsupported questions receive a grounded limitation response;
- LLM output cannot alter authoritative fields.

## 25.10 Security

Tests include:

- TLS configuration;
- RBAC;
- input validation;
- rate limiting;
- secret handling;
- webhook signature verification;
- cross-tenant access;
- mass-assignment attempts;
- injection payloads;
- oversized payload behavior.

---

# 26. Migration from Existing SentinelStack APIs

The migration must preserve current product behavior.

## 26.1 Existing Risk API

Current:

```text
GET  /api/cyber-risk/enterprise
POST /api/cyber-risk/snapshots
```

Treatment:

```text
Compatibility façade
        |
        v
Risk Engine v2
```

The existing caller can continue to function while the internal implementation migrates.

## 26.2 Existing AI API

Current:

```text
POST /api/ai/chat
```

Treatment:

- preserve existing report/assistant workflows;
- add grounded risk context through approved tools;
- avoid silently changing existing response semantics.

## 26.3 Existing Public API

Current:

```text
/api/v1/assessments
/api/v1/reports
/api/v1/webhooks
```

Treatment:

- preserve scanner/public-API consumers;
- do not repurpose assessment endpoints into financial-risk endpoints;
- extend with risk-intelligence resources only through explicit documented additions if compatibility remains valid.

## 26.4 Dashboard APIs

Current:

```text
/api/dashboard/summary
/api/dashboard/analytics
/api/dashboard/target
```

Treatment:

These remain UI-specific read models.

The canonical risk-intelligence endpoints are the source of truth for new PS-26105 financial-risk UI.

## 26.5 Migration Principle

```text
Existing endpoint
      |
      v
Compatibility controller
      |
      v
New risk-intelligence domain
      |
      v
Versioned authoritative outputs
```

Do not duplicate risk formulas in old and new controllers.

---

# 27. Implementation Sequence

This API contract follows the SDD v1.2 execution order.

| Phase | API work | Exit evidence |
|---|---|---|
| P0 | Contract fixtures, auth/tenant tests, OpenAPI validation | Baseline contract tests pass |
| P1 | Risk-run/job/evidence models and endpoints | Versioned run can be persisted/replayed |
| P2 | Risk Engine v2 APIs | EAL/VaR/score contract passes mathematical tests |
| P3 | Drivers/evidence endpoints | Driver API links to stored attribution |
| P4 | Scenario endpoints | Scenario simulation is copy-on-write and reproducible |
| P5 | Investment/optimization endpoints | Budget/dependency constraints enforced |
| P6 | ML prediction metadata + inference adapter | Prediction contract validated |
| P7 | Grounded NLQ | Responses match verified backend metrics |
| P8 | Audit/compliance/reporting/integrity | Decision chain auditable |
| P9 | Hardening | Security/performance/observability gates pass |

## 27.1 Build-Order Rule

Do not build the polished dashboard against endpoints whose underlying calculation semantics are still transitional.

The first complete vertical slice is:

```text
input source
   ->
normalized evidence
   ->
risk run
   ->
authoritative risk
   ->
driver
   ->
mitigation
   ->
scenario
   ->
optimization
   ->
decision/audit
```

---

# 28. Definition of API Done

A PS-26105 endpoint is considered implementation-complete when:

- authentication and tenant scope are enforced;
- request/response schema is validated;
- OpenAPI contract is updated;
- persistence lineage is implemented where needed;
- errors map to the standard problem contract;
- idempotency/concurrency behavior is declared where relevant;
- audit behavior is implemented for material mutations;
- unit tests pass;
- contract tests pass;
- integration tests pass;
- security tests cover affected paths;
- observability includes correlation/request identifiers;
- documentation examples match actual behavior;
- no authoritative metric can be supplied by an untrusted caller or LLM.

---

# Appendix A — Canonical Examples

## A.1 Current Risk Request

```http
GET /api/v1/risk/current?scope_type=ENTERPRISE&scope_id=00000000-0000-0000-0000-000000000001
Authorization: Bearer <token>
X-Correlation-ID: 5e6c...
```

## A.2 Risk Recalculation

```http
POST /api/v1/risk/recalculate
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: 1aa4...

{
  "scope": {
    "type": "ENTERPRISE",
    "id": "00000000-0000-0000-0000-000000000001"
  },
  "priority": "HIGH",
  "reason": "NEW_CRITICAL_VULNERABILITY"
}
```

## A.3 Grounded NLQ

```http
POST /api/v1/nlq/query
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "What changed in expected annual loss since last week?",
  "scope": {
    "type": "ENTERPRISE",
    "id": "00000000-0000-0000-0000-000000000001"
  }
}
```

## A.4 Scenario

```http
POST /api/v1/scenarios
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: 2bb8...

{
  "name": "Patch critical internet-facing vulnerabilities",
  "baseline_assessment_id": "uuid",
  "changes": [
    {
      "target_type": "VULNERABILITY_SET",
      "target_id": "uuid",
      "field": "status",
      "to": "PATCHED"
    }
  ]
}
```

## A.5 Optimization

```http
POST /api/v1/optimization/runs
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: 3cc9...

{
  "budget": {
    "amount": 10000000,
    "currency": "INR"
  },
  "objective": "MAXIMIZE_RISK_REDUCTION",
  "candidate_option_ids": [
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ]
}
```

---

# Appendix B — OpenAPI Mapping Guidance

The companion machine-readable OpenAPI contract should remain the shape authority for implementation.

The v1.1 Markdown document is the engineering narrative and reconciliation source.

The eventual OpenAPI v1.1 artifact should define at minimum:

```text
Health
Job
IntegrationSource
IngestionRun
Asset
Service
Vulnerability
Control
RiskAssessment
RiskDriver
ModelVersion
ModelPrediction
Scenario
ScenarioResult
Recommendation
InvestmentOption
OptimizationRun
InvestmentDecision
ComplianceMapping
Report
AuditEvent
EvidenceReference
ProblemDetail
Pagination
```

## B.1 OpenAPI Naming Rules

Use:

```text
camelCase
```

for JSON properties.

Use:

```text
snake_case
```

only when the existing external API or source-native contract requires preservation.

Do not mix two names for the same semantic field inside one canonical resource.

Examples:

```text
riskAssessmentId
riskRunId
financialExposure
calculationHash
modelBundleVersion
```

## B.2 OpenAPI Security Schemes

The contract may define separate schemes for:

```text
firebaseBearer
apiKey
serviceCredential
```

but route-level authorization remains explicit.

---

# Appendix C — Error Code Registry

Recommended standard codes:

| Code | Meaning |
|---|---|
| `AUTH_REQUIRED` | Authentication missing |
| `AUTH_INVALID` | Authentication invalid |
| `FORBIDDEN` | Authorization denied |
| `TENANT_SCOPE_VIOLATION` | Resource outside tenant scope |
| `VALIDATION_ERROR` | Invalid request shape |
| `SCOPE_NOT_FOUND` | Scope does not exist |
| `RESOURCE_NOT_FOUND` | Resource unavailable |
| `STALE_VERSION` | ETag/version conflict |
| `IDEMPOTENCY_CONFLICT` | Reused key with different request |
| `JOB_NOT_FOUND` | Unknown job |
| `JOB_FAILED` | Async operation failed |
| `SOURCE_UNAVAILABLE` | Integration unavailable |
| `SOURCE_SCHEMA_INVALID` | Source schema mismatch |
| `INGESTION_REJECTED` | Ingestion data rejected |
| `RISK_INPUT_INSUFFICIENT` | Essential risk input missing |
| `RISK_CALCULATION_UNAVAILABLE` | Risk calculation unavailable |
| `MODEL_NOT_ADMISSIBLE` | Model not allowed for authoritative use |
| `MODEL_OOD` | Out-of-distribution state detected |
| `SCENARIO_INVALID` | Scenario state change invalid |
| `OPTIMIZATION_INFEASIBLE` | No portfolio satisfies constraints |
| `RATE_LIMITED` | Request rate exceeded |
| `DEPENDENCY_UNAVAILABLE` | Required service unavailable |

---

# Appendix D — Security Test Matrix

| Threat / condition | Expected result |
|---|---|
| Missing bearer token | 401 |
| Invalid bearer token | 401 |
| Valid token + wrong organization resource | 403/404 according to policy |
| Member attempts admin-only investment action | 403 |
| Connector secret in GET response | Never returned |
| Connector secret in logs | Never logged |
| Duplicate heavy POST | Same job/resource returned |
| Same idempotency key + different payload | 409 |
| Invalid cursor | 400 |
| Unsupported sort | 400 |
| Excessive page size | Clamp/reject according to contract |
| Oversized ingestion payload | 413/400 according to parser policy |
| Malformed webhook signature | 401/403 |
| Replay of stale webhook | Rejected or ignored according to timestamp policy |
| Client-supplied EAL | Ignored/rejected |
| Client-supplied Risk Score | Ignored/rejected |
| LLM tool attempts write to RiskAssessment | Denied |
| Scenario modifies operational record | Denied by service boundary |
| Stale risk run attempts latest overwrite | Rejected/recorded as stale |

---

# Appendix E — Repository Implementation Mapping

| Repository path | API role | v1.1 treatment |
|---|---|---|
| `src/server.ts` | Express runtime, middleware, health, request IDs, rate limiting | KEEP |
| `src/routes/index.ts` | Route registration | EXTEND |
| `src/routes/cyber-risk.routes.ts` | Existing enterprise risk/snapshot APIs | MODIFY into compatibility + new route families |
| `src/controllers/cyber-risk.controller.ts` | Risk request orchestration | MODIFY for risk-run/version/coverage metadata |
| `src/routes/ai.routes.ts` | Current `/api/ai/chat` | KEEP; add grounded risk contract separately |
| `src/routes/public-api.routes.ts` | Existing `/api/v1` assessment/report/webhook API | KEEP; preserve existing consumer behavior |
| `src/routes/dashboard.routes.ts` | Dashboard read models | KEEP; do not make it the canonical external risk API |
| `src/services/cyberRiskQuantification.service.ts` | Current deterministic financial-risk foundation | REFACTOR behind risk façade |
| `src/services/riskScoring.service.ts` | Legacy Finding severity score | KEEP separately from enterprise financial Risk Score |
| `prisma/schema.prisma` | Persistence | EXTEND incrementally for RiskRun/RiskAssessment/model/prediction/evidence/optimization lineage |
| `scripts/seed-cyber-risk-digital-twin.js` | SIH reference data | EXTEND with versioned synthetic provenance |
| `src/hooks/use-cyber-risk.ts` | Frontend risk contract | MODIFY for canonical response metadata |
| `src/app/dashboard/risk-intelligence/page.tsx` | Risk UI | Consume canonical risk/run/scenario/optimization read models |
| `src/components/dashboard/ExecutiveRiskOverview.tsx` | Executive presentation | Render authoritative metrics + confidence/provenance |

## E.1 Route Migration Pattern

Recommended implementation pattern:

```text
HTTP Route
   |
   v
Controller
   |
   v
Application Service
   |
   +--> Risk/Scenario/Optimization Domain
   |
   +--> Persistence
   |
   +--> Evidence / Audit
```

Controllers should not contain:

- risk formulas;
- ML calculations;
- portfolio solver logic;
- scenario mutation logic;
- tenant-bypass logic.

---

# Baseline Status

This document is the **API & Integration Contract v1.1 reconciled engineering baseline**.

It retains the API v1.0 conceptual surface while making the contract truthful about the existing SentinelStack implementation.

The authoritative implementation sequence is:

```text
API Contract v1.1
        +
SDD v1.2
        +
Data Dictionary v1.1
        +
Risk Model v1.1
        +
ML Spec v1.1
        |
        v
Implementation & Repository Architecture v1.1
        |
        v
Code
```

Changes to any of the following require versioned review:

- API paths;
- request/response semantics;
- tenant authorization;
- authoritative metric authority;
- model inference schema;
- risk-run lineage;
- scenario semantics;
- optimization semantics;
- webhook event contracts;
- breaking schema behavior.

**Next documentation baseline:** Implementation & Repository Architecture Specification v1.1.
