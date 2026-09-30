# SentinelStack — PS 26105 P0/P1 Implementation Runbook v1.0

**Purpose:** Convert the completed PS 26105 documentation baseline into the first safe coding phase.  
**Repository:** `ciphernet01/sentinelstack`  
**Status:** Implementation execution baseline  
**Scope:** P0 Baseline & Guardrails + P1 Risk-Run / Lineage Foundation  
**Date:** 29 September 2026

---

# 1. Objective

The documentation phase is complete.

The next step is **not** to redesign the UI first. The next step is to create the foundation that makes every later PS-26105 feature reproducible.

P0/P1 must establish:

```text
feature branch
    ->
regression baseline
    ->
database migration safety
    ->
RiskRun identity
    ->
RiskAssessment lineage
    ->
canonical input hash
    ->
calculation metadata
    ->
compatibility façade
```

After P1, SentinelStack should be able to answer:

> “Exactly what data, assumptions, versions and code produced this risk result?”

---

# 2. Current Repository Facts

The current repository already has:

- Next.js/React frontend;
- Express + TypeScript backend;
- Prisma + PostgreSQL;
- Firebase authentication;
- organization-scoped access;
- existing assessment/scanning/reporting;
- existing `RiskSnapshot`;
- existing `RiskScenario`;
- existing `CyberRiskQuantificationService`;
- existing `/api/cyber-risk/enterprise`;
- existing `/api/cyber-risk/snapshots`;
- existing worker capability;
- existing security middleware and request IDs.

The current risk service is transitional.

Current behavior includes:

```text
hand-tuned likelihood
point impact
VaR proxy
fixed scenario multipliers
greedy recommendation optimizer
```

These must not be treated as the final PS-26105 implementation.

---

# 3. P0 — Baseline & Guardrails

## 3.1 Create Feature Branch

Do not perform the migration directly on `main`.

Example:

```bash
git checkout main
git pull origin main

git checkout -b feature/ps26105-risk-foundation
```

Record the starting commit:

```bash
git rev-parse HEAD
```

Store this commit SHA in the implementation notes.

---

# 4. P0.1 — Capture a Clean Regression Baseline

Before changing the risk domain:

```bash
npm install
npm run prisma:generate
npm run build
npm run security:secrets
```

Run whatever existing test suite is currently available in the repository.

Also verify:

```bash
npm run dev
```

Expected:

- frontend starts;
- backend starts;
- PostgreSQL is reachable;
- existing authentication still works;
- `/health` returns success;
- `/health/ready` returns database readiness.

## 4.1 Baseline Record

Create a simple record:

```text
BASELINE_COMMIT=
BASELINE_BUILD=PASS/FAIL
BASELINE_SECURITY_SCAN=PASS/FAIL
BASELINE_DB=PASS/FAIL
BASELINE_HEALTH=PASS/FAIL
BASELINE_FRONTEND=PASS/FAIL
BASELINE_EXISTING_RISK_ENDPOINT=PASS/FAIL
```

Do not proceed with destructive migrations while the baseline is unknown.

---

# 5. P0.2 — Establish a Migration Safety Rule

Before touching Prisma:

```text
schema change
    ->
migration
    ->
generate client
    ->
application compile
    ->
migration verification
    ->
regression
```

Never manually edit the production database schema to “make the code work.”

For local development:

```bash
npx prisma migrate dev --name ps26105_risk_lineage_foundation
```

For deployment:

```bash
npx prisma migrate deploy
```

The production migration path must use the committed Prisma migration.

---

# 6. P0.3 — Add Contract Test Fixtures

Create deterministic fixtures for:

```text
organization
business unit
asset
service
dependency
vulnerability
control
telemetry
```

The fixture must be small enough for CI and stable enough for exact/reproducible tests.

Recommended location:

```text
tests/fixtures/risk/
```

Suggested files:

```text
enterprise.json
assets.json
vulnerabilities.json
controls.json
telemetry.json
expected-risk-input.json
```

Do not put real customer data in Git.

---

# 7. P0.4 — Add a PS 26105 Test Boundary

Create:

```text
tests/unit/risk/
tests/integration/risk/
tests/contract/risk/
```

The first P0 tests should verify:

```text
tenant isolation
risk input scope
hash determinism
version metadata presence
legacy endpoint regression
```

---

# 8. P1 — Risk-Run / Lineage Foundation

## 8.1 Purpose

A risk result should no longer be just:

```text
"computed now"
```

It must become:

```text
RiskRun
    ->
input state
    ->
model/parameter bundle
    ->
calculation
    ->
RiskAssessment
```

---

# 9. P1.1 — Add RiskRun Persistence

Target logical model:

```text
RiskRun
```

Minimum fields:

```text
id
organizationId
scopeType
scopeId
asOf
createdAt
status
riskEngineVersion
parameterVersion
modelBundleVersion
featureSetVersion
simulationConfigVersion
inputStateHash
resultHash
coverageState
startedAt
completedAt
errorCode
```

Use explicit version strings.

Example:

```text
risk-engine-v2.0
params-2026-09
bundle-001
features-v2
mc-config-v1
```

Do not hardcode these only in UI responses.

---

# 10. P1.2 — Add Canonical Risk Assessment Identity

Existing:

```text
RiskSnapshot
```

should remain compatible.

Target:

```text
RiskAssessment
```

The transition should be additive.

Preferred direction:

```text
RiskRun
    |
    v
RiskAssessment
    |
    +--> EAL
    +--> VaR
    +--> Financial Exposure
    +--> Risk Score
    +--> drivers
    +--> evidence
```

Do not delete `RiskSnapshot` yet.

---

# 11. P1.3 — Add Model / Parameter Metadata

At minimum, risk results need references to:

```text
risk_engine_version
parameter_version
model_bundle_version
feature_set_version
simulation_config_version
```

This is required even before a production ML model exists.

For the current deterministic implementation:

```text
model_bundle_version = deterministic-baseline-v0
```

or another explicit version.

The point is lineage, not pretending ML exists.

---

# 12. P1.4 — Add Canonical Input Hash

Create:

```text
src/services/provenance/
    canonicalHash.service.ts
```

The service should:

1. construct a canonical JSON representation;
2. sort object keys deterministically;
3. normalize timestamps/numeric representations according to contract;
4. hash the canonical string using SHA-256;
5. return the hash.

Example output:

```text
sha256:4f9d...
```

## 12.1 Hash Input

The hash should include the material state used by the calculation:

```text
organization scope
as_of
assets
vulnerabilities
controls
telemetry summary
business impact parameters
risk parameters
model bundle version
simulation configuration
```

Do not include volatile fields such as:

```text
request IDs
HTTP timings
random log lines
```

unless specifically part of the calculation configuration.

---

# 13. P1.5 — Create Risk Context Snapshot

Create a service such as:

```text
src/services/risk/evidenceContext.service.ts
```

Responsibilities:

```text
load point-in-time state
validate organization scope
resolve assets
resolve vulnerabilities
resolve controls
resolve telemetry
resolve business context
calculate coverage
produce canonical input bundle
produce input hash
```

The output should be immutable for that risk run.

---

# 14. P1.6 — Refactor the Existing Risk Service Behind a Façade

Current:

```text
src/services/cyberRiskQuantification.service.ts
```

Do not delete it.

Transform it into:

```text
compatibility façade
```

Conceptually:

```ts
CyberRiskQuantificationService
        |
        v
RiskAssessmentService
        |
        +--> RiskRunService
        +--> EvidenceContextService
        +--> Existing deterministic calculator
```

The old callers keep working while the new foundation becomes authoritative.

---

# 15. P1.7 — Preserve Existing API Compatibility

Keep:

```text
GET /api/cyber-risk/enterprise
POST /api/cyber-risk/snapshots
```

but internally route them through the new domain.

The old response may continue during the migration window.

Do not create a second independent calculation.

---

# 16. P1.8 — Add RiskRun Metadata to Responses

The enterprise risk response should progressively expose:

```json
{
  "riskRunId": "uuid",
  "assessmentId": "uuid",
  "computedAt": "2026-09-29T10:00:00Z",
  "asOf": "2026-09-29T10:00:00Z",
  "riskEngineVersion": "deterministic-baseline-v0",
  "parameterVersion": "params-2026-09",
  "modelBundleVersion": "deterministic-baseline-v0",
  "inputStateHash": "sha256:...",
  "resultHash": "sha256:..."
}
```

These fields should be additive so existing UI clients do not immediately break.

---

# 17. P1.9 — Tenant Isolation Hardening

The current controller permits an admin query override:

```text
?organizationId=
```

New canonical risk APIs should not rely on arbitrary caller-selected organization IDs.

Target pattern:

```text
authenticated user
      |
      v
validated membership
      |
      v
organization scope
      |
      v
risk service
```

Admin cross-organization workflows, if required, must be explicit and audited.

Do not copy the current query-parameter behavior into every new endpoint.

---

# 18. P1.10 — RiskRun State Machine

Recommended states:

```text
QUEUED
RUNNING
SUCCEEDED
FAILED
STALE
```

Transitions:

```text
QUEUED -> RUNNING
RUNNING -> SUCCEEDED
RUNNING -> FAILED
SUCCEEDED -> STALE
```

Do not allow arbitrary state transitions.

---

# 19. P1.11 — Make Risk Results Append-Oriented

A historical assessment must never be silently overwritten.

Correct:

```text
Run A -> Assessment A
Run B -> Assessment B
```

Not:

```text
Run A -> update Assessment A with new numbers
```

This preserves historical reproducibility.

---

# 20. P1.12 — Snapshot Compatibility

During migration:

```text
new RiskAssessment
       |
       v
optional compatibility RiskSnapshot
```

Do not force all existing snapshot consumers to migrate on day one.

A compatibility adapter can populate the older snapshot shape from the canonical assessment.

---

# 21. P1.13 — First P1 API Contract

Add or prepare:

```text
POST /api/v1/risk/recalculate
GET  /api/v1/risk/current
GET  /api/v1/risk/assessments/{id}
GET  /api/v1/jobs/{job_id}
```

The first release can expose only the minimum viable subset.

Suggested initial behavior:

### Recalculate

```http
POST /api/v1/risk/recalculate
```

returns:

```http
202 Accepted
```

with:

```json
{
  "data": {
    "jobId": "uuid",
    "riskRunId": "uuid",
    "status": "QUEUED"
  }
}
```

### Current

```http
GET /api/v1/risk/current
```

returns the latest successful authoritative assessment for the authorized scope.

---

# 22. P1.14 — Worker Integration

The repository already has a database-backed worker pattern.

Use it.

Risk calculation flow:

```text
POST /risk/recalculate
       |
       v
create Job
       |
       v
create RiskRun
       |
       v
worker picks Job
       |
       v
build evidence context
       |
       v
calculate
       |
       v
persist RiskAssessment
       |
       v
hash result
       |
       v
Job = SUCCEEDED
```

Do not perform large Monte Carlo/risk runs synchronously inside the HTTP controller later.

The architecture should be ready now.

---

# 23. P1.15 — Add Minimal Audit Event

For material risk operations:

```text
RISK_RUN_CREATED
RISK_RUN_COMPLETED
RISK_RUN_FAILED
RISK_ASSESSMENT_PERSISTED
```

Record:

```text
organization
actor
timestamp
riskRunId
assessmentId
action
inputStateHash
resultHash
```

The existing generic `AuditLog` may remain intact while a PS-specific analytical audit model is introduced.

---

# 24. P1.16 — Acceptance Tests

## Risk run creation

Given:

```text
authorized organization
valid scope
```

expect:

```text
RiskRun created
organization correct
status correct
version metadata present
```

## Tenant isolation

Given:

```text
user A
resource belonging to organization B
```

expect:

```text
403/404
no data leakage
```

## Hash determinism

Given identical input bundle twice:

```text
hash A == hash B
```

Given one material input changes:

```text
hash A != hash B
```

## Historical immutability

Given two runs at different times:

```text
assessment A remains unchanged
assessment B is a separate record
```

## Compatibility

Existing:

```text
GET /api/cyber-risk/enterprise
```

must still return successfully after migration.

Existing:

```text
POST /api/cyber-risk/snapshots
```

must continue to work through the compatibility path.

---

# 25. Files to Add / Modify

## P0

```text
tests/fixtures/risk/*
tests/unit/risk/*
tests/integration/risk/*
tests/contract/risk/*
```

## P1

```text
prisma/schema.prisma

src/services/cyberRiskQuantification.service.ts
src/controllers/cyber-risk.controller.ts
src/routes/cyber-risk.routes.ts
src/routes/index.ts

src/services/risk/
    riskRun.service.ts
    riskAssessment.service.ts
    evidenceContext.service.ts
    calculationHash.service.ts
    index.ts

src/services/provenance/
    canonicalHash.service.ts
    index.ts

src/routes/risk.routes.ts
```

Potentially:

```text
src/services/job/*
```

only if the existing worker abstraction needs a clean generic job interface.

---

# 26. Files Not to Rewrite Yet

Do not make these the main implementation target during P0/P1:

```text
globe UI
landing page
marketing UI
full NLQ
ML training pipeline
optimizer UI
investment curve
blockchain adapter
```

They depend on the foundation.

---

# 27. P1 Data Migration Strategy

Use:

```text
ADD
    |
    v
BACKFILL
    |
    v
DUAL READ/WRITE
    |
    v
CANONICAL READ
    |
    v
DEPRECATE
```

Do not use:

```text
DROP
RECREATE
MASS REWRITE
```

for existing live risk records.

---

# 28. P1 Exit Evidence

P1 is complete when all are true:

```text
[ ] Feature branch exists
[ ] Existing application baseline passes
[ ] Prisma migration committed
[ ] RiskRun persists
[ ] RiskAssessment persists or compatibility mapping exists
[ ] Input hash is deterministic
[ ] Result hash is deterministic
[ ] Model/parameter versions are stored
[ ] Organization scope is enforced
[ ] Existing risk routes still work
[ ] Risk calculation can be executed through a run ID
[ ] Historical results are append-oriented
[ ] Material risk actions are auditable
[ ] Integration tests pass
[ ] Security/tenant tests pass
[ ] Documentation updated with actual implementation status
```

---

# 29. What Comes Immediately After P1

Once P1 passes, do **not** jump directly to UI polishing.

The next sequence is:

```text
P2 Risk Engine v2
    |
    +--> probability-to-frequency
    +--> severity distributions
    +--> aggregate loss
    +--> Monte Carlo
    +--> genuine VaR
    +--> enterprise Risk Score

P3 Driver attribution

P4 Scenario engine

P5 Investment optimizer

P6 ML likelihood

P7 Grounded NLQ

P8 Governance / trust

P9 Hardening
```

This matches the reconciled SDD v1.2 execution order.

---

# 30. P2 Entry Contract

P2 must receive from P1:

```text
RiskRun
Risk input bundle
Input hash
Version metadata
Evidence context
Persistence path
Worker/job execution path
```

P2 must then replace the **internal calculation implementation**, not the whole application.

---

# 31. Practical Coding Order

When actually editing the repository, use this order:

```text
1. Branch
2. Baseline tests
3. Prisma models
4. Prisma migration
5. Prisma generate
6. RiskRun service
7. canonical hashing
8. EvidenceContext
9. RiskAssessment persistence
10. compatibility façade
11. controller update
12. route update
13. worker integration
14. audit event
15. contract tests
16. tenant-security tests
17. local end-to-end test
18. merge
```

---

# 32. P0/P1 Anti-Goals

Do not:

- rebuild the whole repository;
- migrate Express to FastAPI;
- replace Prisma;
- add a graph database;
- add Kafka;
- add Kubernetes;
- add blockchain before hash/audit works;
- train an ML model before the input contract is stable;
- claim true VaR before P2;
- claim exact optimization before P5;
- expose unsupported metrics in the dashboard.

---

# 33. First Vertical Slice

The P0/P1 implementation should be able to demonstrate:

```text
ACME Bank synthetic digital twin
        |
        v
authorized organization scope
        |
        v
risk calculation request
        |
        v
Job
        |
        v
RiskRun
        |
        v
point-in-time evidence bundle
        |
        v
canonical input hash
        |
        v
existing deterministic risk calculation
        |
        v
RiskAssessment / compatibility snapshot
        |
        v
result hash
        |
        v
audit event
```

This is the first real engineering proof that the PS-26105 platform is becoming a traceable system rather than a collection of dashboard calculations.

---

# 34. Final P0/P1 Gate

The implementation team should refuse to start broad P2/P3 work if:

```text
Risk results cannot be reproduced
OR
tenant isolation is not proven
OR
historical runs can be overwritten
OR
the input bundle cannot be identified
OR
the application baseline is broken
```

The objective of P0/P1 is not feature count.

It is to make the **risk calculation trustworthy, traceable and safely evolvable**.

---

# Status

**P0/P1 Runbook:** READY

**Current code status:** This runbook does not claim that these changes have already been implemented.

**Next coding target:** `feature/ps26105-risk-foundation` → RiskRun + lineage foundation.
