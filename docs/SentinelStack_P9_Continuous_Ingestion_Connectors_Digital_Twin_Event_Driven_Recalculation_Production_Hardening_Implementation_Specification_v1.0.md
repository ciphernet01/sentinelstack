# SentinelStack — P9 Continuous Ingestion, Connector Framework, Telemetry Normalization, Digital Twin Synchronization, Event-Driven Risk Recalculation, Observability & Production Hardening Implementation Specification v1.0

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.0  
**Document Status:** P9 Implementation Engineering Baseline  
**Repository:** `github.com/ciphernet01/sentinelstack`  
**Primary Runtime:** Existing Express + TypeScript + Prisma/PostgreSQL  
**Worker Runtime:** Existing worker/queue architecture  
**Primary Dependencies:** P1 + P2 + P3 + P4 + P5 + P6 + P7 + P8  
**Date:** 29 September 2026  

> **Purpose:** Operationalize SentinelStack as a continuous cyber-risk platform by securely ingesting changing technical and business state, normalizing heterogeneous sources, synchronizing the Cyber Risk Digital Twin, detecting material changes, triggering governed P6/P2/P3 recalculation, and preserving P8 lineage, audit and integrity.

> **Core rule:** Ingest continuously, calculate selectively, preserve history, and never publish an unvalidated “current” risk value.

# 1. Purpose

P9 operationalizes SentinelStack as a continuously updating cyber-risk platform. It connects external and internal security/business data to the Digital Twin, detects material state changes, refreshes predictive inputs, triggers governed P2 recalculation, updates P3 attribution, and preserves P8 lineage and governance.

---

# 2. Core Principle

Continuous monitoring does not mean recalculating enterprise risk for every event. The platform must ingest broadly, normalize safely, detect materiality, coalesce noisy changes, and calculate only when a governed policy says the change can materially affect risk.

---

# 3. Scope

Connector framework, ingestion, normalization, provenance, entity resolution, Digital Twin synchronization, data quality, freshness, materiality, risk triggers, incremental/full recalculation, queueing, retries, reconciliation, observability, security hardening, production deployment, and live dashboard/globe updates.

---

# 4. Non-Goals

P9 does not replace SIEM, EDR, VMS, IAM, CSPM, CMDB, SOAR, or a generic data lake. It integrates those systems and makes their state usable by the existing SentinelStack risk architecture.

---

# 5. Entry Criteria

P1 lineage foundation; P2 Risk Engine v2; P3 drivers/evidence; P4 scenario state engine; P5 investment optimization; P6 model/prediction registry; P7 grounded Copilot; P8 governance/integrity/compliance.

---

# 6. Exit Criteria

Connector registry; secure source configuration; ingestion runs; idempotency; canonical normalization; evidence lineage; Digital Twin synchronization; freshness/quality; materiality policy; risk triggers; incremental/full runs; retry/dead-letter; reconciliation; metrics/traces; production hardening; real dashboard/globe state.

---

# 7. Continuous Operating Loop

```text
SOURCE -> CONNECTOR -> INGEST -> NORMALIZE -> EVIDENCE -> DIGITAL TWIN
       -> MATERIALITY -> RISK TRIGGER -> P6 -> P2 -> P3 -> P8
       -> CURRENT RISK -> DASHBOARD / GLOBE / COPILOT
```

---

# 8. Source Classes

Initial supported classes should cover vulnerability intelligence, asset inventory, SIEM, IAM, EDR, CSPM, threat intelligence, cloud metadata, business context, control state, CMDB/application inventory, and generic REST/webhook/file sources.

---

# 9. Free-First Source Strategy

For the SIH build, prioritize public vulnerability/threat feeds and generic connectors, then demonstrate enterprise telemetry through a secure webhook/file fixture. Paid enterprise connectors remain optional adapters, not hard dependencies.

---

# 10. Connector Architecture

```text
Connector Registry -> Connector Instance -> Ingestion Engine -> Normalizer
                                                    -> Quality/Freshness
                                                    -> Evidence/Digital Twin
```

---

# 11. Connector Interface

```ts
interface Connector {
  getType(): string;
  healthCheck(ctx: ConnectorContext): Promise<ConnectorHealth>;
  testConnection(ctx: ConnectorContext): Promise<ConnectorTestResult>;
  pull?(ctx: ConnectorContext, cursor?: string): Promise<ConnectorBatch>;
  receive?(ctx: ConnectorContext, payload: unknown, headers: Record<string,string>): Promise<ConnectorBatch>;
  normalize(record: unknown, ctx: ConnectorContext): Promise<NormalizedRecord[]>;
}
```

---

# 12. Connector Context

```ts
type ConnectorContext = {
  organizationId: string;
  connectorId: string;
  credentialReference?: string;
  sourceConfiguration: Record<string, unknown>;
  requestId: string;
};
```
`organizationId` is server-derived and cannot be supplied by the source or LLM.

---

# 13. Connector Types

Provide adapters for `REST`, `WEBHOOK`, `FILE`, plus source-specific implementations such as `NVD`, `KEV`, `EPSS`, and enterprise feeds. Source-specific adapters should reuse common retry, auth, pagination, hashing and quality utilities.

---

# 14. Connector Registry

Create `src/services/ingestion/connectorRegistry.service.ts`. It resolves connector implementations, validates configuration versions, exposes supported capabilities, and returns health metadata.

---

# 15. Connector Instance

A connector type is reusable code; a connector instance is one organization's configured source. The instance carries tenant, scope, configuration version, credential reference, status, owner and last-success timestamps.

---

# 16. Connector Configuration Version

Material configuration changes create new versions. Historical ingestion remains tied to the configuration/mapping version that produced it; old versions are never silently rewritten.

---

# 17. Credential Model

Store a `credentialReference`, not plaintext secrets. Use environment/platform secrets or a secret manager. Connector workers are the only layer permitted to resolve credentials.

---

# 18. Credential Rotation

Support current and previous credential versions during controlled rotation. Rotating a secret must not alter historical ingestion runs.

---

# 19. Connector Health

Health must distinguish transport availability, source freshness, schema compatibility and successful normalization. A responding API can still be operationally stale.

---

# 20. Health States

```text
HEALTHY | WARNING | DEGRADED | FAILED | UNKNOWN
```
Use source-specific thresholds and record the policy version used.

---

# 21. Ingestion Run

Persist one `IngestionRun` per pull, webhook batch or file import. Track start/end, cursor, record counts, mapping/schema versions, accepted/rejected/duplicate counts, status, request ID and input hash.

---

# 22. Ingestion Run Status

```text
QUEUED | RUNNING | COMPLETED | COMPLETED_WITH_WARNINGS | FAILED | CANCELLED
```

---

# 23. Raw Source Record

Persist source identity, connector, source record ID, source/event timestamp, receive/process timestamps, payload hash, payload reference, schema version and processing status. Large raw payloads should live in durable object storage when appropriate.

---

# 24. Source Record Hash

Use SHA-256 over canonical raw payload representation where practical. The hash detects record changes and supports idempotency/provenance; it is not encryption.

---

# 25. Source Record Retention

Raw-source retention follows NFR-10 and source/governance policy. Keep references, hashes and lineage metadata long enough to reconstruct governed analytics even when raw retention expires.

---

# 26. Idempotency

Replaying a source batch must not create duplicate logical state. Use connector ID + source record ID + payload hash where the source provides stable IDs; otherwise use canonical identity/hashes.

---

# 27. Duplicate Policy

Same source ID + same payload => duplicate/no-op. Same source ID + changed payload => new source-record version. Different IDs + identical content => potential duplicate requiring source-aware logic.

---

# 28. Event Time vs Processing Time

Persist `observed/event time`, `receivedAt`, `processedAt`, and when applicable `publishedAt`. Risk calculation uses declared as-of semantics, not worker execution time by accident.

---

# 29. Late Data

Late-arriving data becomes new current state when valid. Historical RiskRuns remain immutable. A new run can incorporate the late data and clearly reference the new input state.

---

# 30. Out-of-Order Data

Do not implement “last message wins” globally. Use source sequence, event time, version and domain semantics to prevent an older record from overwriting newer state.

---

# 31. Cursor Management

Pull connectors must persist `cursorBefore` and `cursorAfter`. Advance a checkpoint only after the batch is durably processed under the connector's transaction semantics.

---

# 32. Cursor Recovery

Worker restart resumes from the last safe checkpoint. Replay safety depends on idempotent processing, so re-reading a page is acceptable.

---

# 33. Pagination

Support page, offset, cursor and next-link semantics through a common adapter. Protect against cursor loops and unbounded pages.

---

# 34. Rate Limits

Respect provider limits and `Retry-After` when available. Track remaining quota/reset time if exposed. Use source-aware backoff rather than hammering a failing provider.

---

# 35. Connector Retry

Transient timeout, 5xx and rate-limit failures may retry with bounded exponential backoff + jitter. Permanent authentication/schema failures should move to controlled degraded/error state.

---

# 36. Circuit Breaker

Repeated source failure should open a circuit, stop expensive retries, and periodically test recovery. A circuit state does not erase previously valid source data.

---

# 37. Webhook Ingestion

Webhook flow: signature/auth validation -> size/type validation -> replay check -> raw record persistence -> normalization -> state synchronization. Reject unauthenticated or malformed payloads before expensive work.

---

# 38. Webhook Authentication

Prefer HMAC, mTLS or provider-signed requests. Credential/signing-key versions should be auditable and rotatable.

---

# 39. Webhook Replay Protection

Persist event ID, timestamp, signature/hash and processing state. Reject or safely ignore repeated events according to source semantics.

---

# 40. File Ingestion

Support CSV/JSON/NDJSON/Parquet where required. Validate file size, type, schema, encoding and structure. Never execute uploaded files.

---

# 41. Generic REST Connector

Support controlled HTTP(S), pagination, authentication, field mapping and source-specific retry. This connector is powerful and therefore must use outbound allowlists and SSRF protections.

---

# 42. SSRF Protection

Block `file://`, loopback, cloud metadata endpoints and disallowed private destinations unless explicitly allowlisted for a trusted deployment. Validate redirects as well as the original hostname.

---

# 43. TLS

Production connectors must validate TLS certificates. Never disable certificate verification as a generic troubleshooting shortcut.

---

# 44. Payload Limits

Enforce maximum request size, record size, batch size, nesting depth and total bytes. Oversized payloads should be rejected before unbounded parsing or memory use.

---

# 45. Normalization Pipeline

```text
RAW -> SCHEMA VALIDATION -> SOURCE MAPPING -> UNIT/TIMESTAMP NORMALIZATION
    -> ENTITY RESOLUTION -> QUALITY -> CANONICAL RECORD -> EVIDENCE/STATE
```

---

# 46. Canonical Domains

Canonical domains include Asset, BusinessUnit, Service, Vulnerability, SecurityControl, SecurityTelemetry, ThreatIndicator, AssetDependency, AssetLocation and Evidence.

---

# 47. Field Mapping

Version every source-to-canonical mapping. A mapping entry identifies source path, target path, controlled transformation, required flag and mapping version.

---

# 48. Transformation Registry

Use controlled functions such as `normalizeSeverity`, `normalizeTimestamp`, `toNumber`, `normalizeCve`, `normalizeCoverage` and `parseCurrency`. Do not execute arbitrary mapping code from configuration.

---

# 49. Unknown Values

Prefer `UNKNOWN`, `UNRESOLVED` or `NOT_APPLICABLE` where semantics are known. Do not guess missing security or business values.

---

# 50. Numeric Units

Normalize units explicitly: milliseconds vs seconds, percent vs ratio, hours vs days, INR vs USD. Persist source-unit metadata where useful.

---

# 51. Severity Normalization

Map vendor values to canonical severity classes but do not turn severity alone into financial risk. Financial risk comes from P2 with business/context inputs.

---

# 52. Timestamp Normalization

Use canonical UTC timestamps internally while optionally preserving original source timestamp and timezone semantics for provenance.

---

# 53. Vulnerability Normalization

Canonical vulnerability state can include CVE, CVSS, EPSS, KEV state, exploit availability, vendor/product, published/modified dates, detection/resolution timestamps and asset linkage.

---

# 54. SIEM Normalization

Canonical telemetry can include event type, severity, source, time, asset, identity, destination, technique, confidence and status. Retain vendor-specific details behind provenance where permitted.

---

# 55. IAM Normalization

Canonical identity state can include account, role, privilege level, MFA state, authentication method, failed attempts, last-seen and account status. Credentials and secrets are never normalized as data values.

---

# 56. EDR Normalization

Canonical endpoint state can include asset, detection, severity, technique, process category, timestamp, status and containment state.

---

# 57. CSPM Normalization

Canonical cloud posture can include cloud account, resource, finding, severity, configuration issue, exposure, mapped control and timestamps.

---

# 58. Asset Inventory Normalization

Canonical assets include type, identifier, service, business unit, environment, criticality, exposure, cloud region, location, owner and lifecycle state.

---

# 59. Threat Intelligence Normalization

Canonical indicators can include indicator type/value, campaign, technique, severity, confidence, first/last seen, source and relevance.

---

# 60. Business Context Normalization

Business inputs can include service criticality, downtime cost/hour, RTO/RPO, revenue sensitivity and regulatory sensitivity. These are controlled business assumptions unless sourced from an authoritative enterprise system.

---

# 61. Evidence Creation

Accepted normalized records should create or update canonical evidence with source, observation/collection time, connector, source record, mapping version, content hash, quality and retention class.

---

# 62. Evidence Lineage

The minimum lineage is `source -> connector -> ingestion run -> source record -> normalized state -> evidence -> Digital Twin -> RiskRun`. P8 can govern each material link.

---

# 63. Data Quality

Quality must be explicit: `VALID`, `PARTIAL`, `SUSPECT`, `REJECTED`. Every rejection stores a reason code and source record reference.

---

# 64. Data Quality Issues

Create `DataQualityIssue` for missing fields, invalid ranges, broken identifiers, schema mismatch and normalization conflicts. Issues have owner/status and can be replayed after correction.

---

# 65. Quality Dashboard

Track accepted/rejected/duplicate counts, unresolved entities, schema errors, stale sources and top quality rules by connector.

---

# 66. Freshness

Track source freshness separately from connector health. A healthy transport channel can be stale if the provider is not producing new records.

---

# 67. Freshness States

```text
FRESH | AGING | STALE | UNKNOWN
```
Thresholds are connector/source specific and versioned.

---

# 68. Coverage

Coverage should be measurable for assets, services, vulnerabilities, controls and telemetry. Never expose a synthetic organization-wide coverage number in production.

---

# 69. Entity Resolution

Map source identifiers to canonical assets/services/controls with evidence-based matching. Use stable cloud IDs, agent IDs, CMDB IDs, hostnames, serials or other source-specific identifiers.

---

# 70. Resolution Confidence

```text
HIGH | MEDIUM | LOW | UNRESOLVED
```
Unresolved entities must remain unresolved rather than being assigned arbitrarily.

---

# 71. Alias Mapping

Maintain `AssetAlias` or equivalent source-to-canonical mappings so repeated identifiers from cloud/CMDB/EDR systems converge on one canonical asset.

---

# 72. Manual Resolution

Authorized users may map unresolved source identifiers to canonical resources. The mapping itself is versioned and audited.

---

# 73. Digital Twin Definition

The Digital Twin is the current computational representation of organization -> business unit -> service -> asset -> vulnerability/control/dependency/location plus telemetry and threat context. It is not required to be a 3D visualization.

---

# 74. Digital Twin Purpose

The Digital Twin connects technical state to business service impact and financial-risk calculation. It is the stateful bridge between ingestion and P2.

---

# 75. Digital Twin Synchronizer

Create `src/services/digitalTwin/digitalTwinSync.service.ts`. It applies canonical changes transactionally, versions state, attaches provenance, and emits durable domain events.

---

# 76. State Change

```ts
type StateChange = {
  entityType: string; entityId: string; fieldPath: string;
  previousValue: unknown; newValue: unknown;
  sourceRecordId?: string; observedAt?: string; processedAt: string;
};
```

---

# 77. Change Categories

Use explicit domain events such as `ASSET_CREATED`, `VULNERABILITY_OPENED`, `VULNERABILITY_RESOLVED`, `CONTROL_CHANGED`, `THREAT_CHANGED`, `DEPENDENCY_CHANGED`, `BUSINESS_CONTEXT_CHANGED` and `LOCATION_CHANGED`.

---

# 78. Dependency Synchronization

Dependency changes must update the same canonical graph P2 uses. Shared-service relationships are particularly important because they can expand calculation scope and create anti-double-counting requirements.

---

# 79. Location Synchronization

Location can be cloud region, data center, city/region, country or coordinates. Preserve source and confidence. The globe uses this actual enterprise geography rather than invented country-risk scores.

---

# 80. Business Service Synchronization

Services may be discovered from CMDB/application inventory/manual configuration. Each service should have a criticality and explicit asset/dependency relationships.

---

# 81. State Versioning

Material state changes create a new state version. Current state is queryable; historical state is reconstructable enough for RiskRun lineage.

---

# 82. Domain Events

Publish a normalized `CyberStateChanged` event after state persistence. Event delivery should be at-least-once and consumers must be idempotent.

---

# 83. Outbox Pattern

Use a transactional outbox so the database state change and event intent are committed together. Workers publish the outbox asynchronously.

---

# 84. Event Envelope

```ts
type DomainEvent = {
  id: string; organizationId: string; type: string;
  resourceType: string; resourceId: string;
  occurredAt: string; publishedAt?: string;
  correlationId: string; source: string; payloadHash: string;
};
```

---

# 85. Event Delivery

At-least-once delivery is preferred. Consumers use event IDs/idempotency keys to avoid duplicate logical processing.

---

# 86. Materiality Engine

Create `src/services/ingestion/materiality.service.ts`. Its purpose is to answer: “Does this state change justify a new predictive/risk calculation?”

---

# 87. Materiality Inputs

Consider event type, asset/service criticality, exposure, KEV state, threat relevance, control degradation, dependency propagation, business criticality and policy thresholds.

---

# 88. Materiality Output

```ts
type MaterialityDecision = {
  material: boolean; reasons: string[];
  scope: { type: string; ids: string[] };
  recommendedAction: 'NO_RECALC' | 'PARTIAL_RISK_RUN' | 'FULL_RISK_RUN';
  policyVersion: string;
};
```

---

# 89. No-Recalc Events

Low-value heartbeat, duplicate informational events or non-material metadata changes should be recorded without forcing an enterprise risk calculation.

---

# 90. Partial Recalculation

Use for localized state changes where the P2 aggregation model can safely isolate scope. Clearly label the resulting assessment as partial/local if that is what it is.

---

# 91. Full Recalculation

Use when a change affects shared services, enterprise controls, major business dependencies, material threat state, model/parameter bundles or other broad scope.

---

# 92. Dependency Propagation

A materiality decision may traverse asset -> service -> business unit -> enterprise dependencies. Apply depth/weight limits to prevent graph explosion.

---

# 93. Trigger Policy

Create versioned `RiskTriggerPolicy` records specifying event types, materiality conditions, priority, scope rules, cooldown/coalescing and action.

---

# 94. Trigger Record

Every automated recalculation should have a `RiskTrigger` referencing the source event, policy version, materiality decision, scope, priority and requested run type.

---

# 95. Trigger Coalescing

Events affecting the same scope within a short policy-defined window can be coalesced into one logical trigger and one RiskRun. The merged event list remains traceable.

---

# 96. Event Storm Protection

Do not create thousands of full enterprise RiskRuns from noisy telemetry. Use materiality, debounce, coalescing and queue priority while retaining the raw events.

---

# 97. Critical Event Protection

Critical triggers retain priority even during overload. Low-priority recalculation can be deferred rather than silently discarded.

---

# 98. Risk Recalculation Worker

Create/extend a worker that resolves trigger scope, snapshots the current Digital Twin, obtains P6 predictions, invokes P2, invokes P3, writes P8 governance events, and publishes a validated RiskAssessment.

---

# 99. Recalculation Flow

```text
RiskTrigger -> scope -> feature refresh -> P6 -> P2 -> P3 -> P8 -> publish
```

---

# 100. Risk Job Payload

Job payload contains organization, trigger, run type, scope, requested time, priority and optional state/model hints. It does not carry unnecessary raw telemetry payloads.

---

# 101. Risk Job Idempotency

Compute an idempotency key from organization + scope + state version/trigger cluster + model bundle + parameter bundle. Duplicate queued/running jobs should coalesce.

---

# 102. Obsolete Jobs

A queued job can become `OBSOLETE` when a newer materially different state supersedes it. This avoids wasting compute on stale snapshots.

---

# 103. Failed Recalculation

A failed run must not overwrite the last valid current risk. Preserve the failure and show the last valid assessment as stale/pending/degraded according to policy.

---

# 104. Current Risk Publication

Publish current risk only after P2/P3 validation and persistence succeed. A read model/projection may be updated for low-latency dashboards, but it is not the source of calculation truth.

---

# 105. Risk Freshness

Track current assessment age independently from source freshness. States: `FRESH`, `AGING`, `STALE`, `RECALCULATION_PENDING`, `FAILED`.

---

# 106. Scheduled Full Run

Even with event-driven recalculation, schedule comprehensive full runs as reconciliation against missed events, late data, state-sync defects and accumulated changes.

---

# 107. Event vs Schedule

Event-driven runs provide timeliness; scheduled full runs provide completeness. Neither should silently rewrite historical results.

---

# 108. P6 Integration

If a changed feature affects the predictive model, refresh the relevant ML prediction using the current approved model bundle. Prediction cache keys include feature hash, model bundle, target and horizon.

---

# 109. Scenario Compatibility

P4 scenarios can reuse the same feature-building/inference path. If a scenario changes an ML-consumed state such as MFA coverage, scenario predictions must be recomputed rather than reused blindly.

---

# 110. P2 Integration

P2 consumes calibrated probability/frequency inputs through `LikelihoodProvider`. P9 supplies current state and trigger context; it does not implement the financial math.

---

# 111. P3 Integration

After a successful risk run, P3 recalculates risk drivers and evidence relationships so the dashboard/Copilot can explain what changed.

---

# 112. P8 Integration

Material ingestion and recalculation actions create governance events. The resulting RiskAssessment can be packaged, hashed and optionally ledger-anchored by P8.

---

# 113. Risk Change Event

After publication, emit a structured event containing previous/current assessment IDs, scope, metric deltas, trigger and timestamps. UI and P7 may consume this event.

---

# 114. Dashboard Updates

The dashboard can use polling, SSE or WebSocket depending on the existing frontend architecture. Structured numbers come from backend read models/APIs, not generated AI prose.

---

# 115. Globe Integration

The globe consumes synchronized asset/service locations plus current risk/scenario scope. It should show actual enterprise concentration, blast radius or sourced threat context; never fabricate attack paths.

---

# 116. Globe Live State

When a real risk update is published, the globe can refresh affected markers and scope. Show last-sync and last-risk timestamps where useful.

---

# 117. Threat Geography

Threat-intelligence geography must be sourced from actual threat records. Organization risk by location must be derived from enterprise asset/service scope, not a generic country score.

---

# 118. Blast Radius

Clicking a service/asset can traverse dependencies to affected services/business units and show the P2 impact/risk result. The graph and financial outputs must be sourced from the same Digital Twin/P2 state.

---

# 119. Source Outage

A source outage changes connector/freshness state. It does not create an arbitrary increase/decrease in EAL. Risk interpretation should disclose degraded input coverage.

---

# 120. Source Recovery

On recovery, reconcile the source checkpoint/snapshot with the Digital Twin and create new state changes for missed records.

---

# 121. Reconciliation

Use full source snapshots where possible to compare source inventory with current Digital Twin state. Track created, updated, missing and conflict counts.

---

# 122. Reconciliation Run

Persist connector, timestamps, snapshot hash, counts and status. Reconciliation should be auditable and rerunnable.

---

# 123. Backfill

Authorized operators can request bounded historical backfills. Backfill creates a new ingestion run and can trigger new current risk calculations; it does not mutate historical RiskRuns.

---

# 124. Replay

Dead-letter or failed records can be replayed after fixing the source/mapping. Replay remains idempotent and retains original source identifiers/hashes.

---

# 125. Dead-Letter Queue

Permanent or repeatedly failing records go to dead-letter state with source, error code, record ID, retries and timestamps. Operators can investigate/replay.

---

# 126. Queue Architecture

Reuse the repository's existing queue/worker architecture. Add ingestion, reconciliation, domain-event and risk-recalculation jobs rather than introducing an unrelated job system.

---

# 127. Queue Priorities

Suggested priorities: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`. Priority is operational scheduling, not the same as P2 financial risk severity.

---

# 128. Queue Fairness

Apply per-tenant concurrency and quotas so one organization cannot monopolize worker capacity.

---

# 129. Backpressure

When ingestion/risk queues grow, slow consumers and defer low-priority calculations rather than allowing unbounded memory growth or dropping source events.

---

# 130. Worker Leases

Long-running jobs should have a lease/heartbeat so crashed workers are recoverable. Abandoned jobs can return to `QUEUED` after lease expiry.

---

# 131. Retry Boundaries

Retry transient external/service failures. Do not retry deterministic validation failures indefinitely. Dead-letter after bounded retries.

---

# 132. Batch Processing

Process large batches in bounded chunks and use bulk writes where safe. Avoid huge database transactions that create lock/memory pressure.

---

# 133. Database Pressure

Monitor connection pool and query latency. Cap worker concurrency to protect PostgreSQL and avoid creating one connection per event.

---

# 134. Telemetry Storage

High-volume SecurityTelemetry/SourceRecord tables may require date partitioning and retention/archive policies as deployment scale grows.

---

# 135. Object Storage

Large raw payloads, reports and evidence artifacts should use durable object storage when size/retention makes PostgreSQL unsuitable. Store metadata and hashes in PostgreSQL.

---

# 136. Data Retention

Apply per-source and per-data-class retention. Governance-required hashes/references may remain after raw payload deletion.

---

# 137. Data Classification

Potential classes: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`, `REGULATORY`. Classification should influence access/export/logging policies.

---

# 138. PII Minimization

Do not ingest or retain employee/customer identifiers unless required. Prefer derived features/pseudonymous IDs for analytics where practical.

---

# 139. Sensitive Telemetry

Raw telemetry may contain usernames, IPs, URLs and internal hostnames. Restrict access and avoid logging payloads by default.

---

# 140. Connector Authorization

Connector administration requires appropriate integration/admin roles. Runtime ingestion is server-side and must inherit the connector instance's tenant scope.

---

# 141. Tenant Isolation

Every query/write requires organization scope. A connector from Tenant A must never create/update/read resources in Tenant B. This must be enforced in backend services, not only the UI.

---

# 142. Webhook Tenant Binding

A webhook URL or connector ID must resolve to a specific authorized organization before payload processing. Never accept an organization ID from the webhook body as the authoritative tenant.

---

# 143. Secret Handling

Never log or expose API keys, OAuth refresh tokens, HMAC secrets, certificates or ledger keys. Connector health messages should use safe error codes.

---

# 144. SSRF / Egress

Generic REST connectors must use hostname allowlists, safe DNS/redirect handling and blocked metadata/private destinations. Outbound network access is an explicit security boundary.

---

# 145. File Security

Uploaded files must be size/type/schema validated and stored outside executable paths. Do not shell out to arbitrary parsers or run uploaded content.

---

# 146. API Security

P9 APIs inherit Firebase authentication, RBAC, Helmet, CORS, rate limiting, request IDs and input validation already present in SentinelStack.

---

# 147. Audit

Material connector configuration changes, replays, materiality decisions, RiskTriggers, recalculation outcomes and production overrides should create audit/governance records.

---

# 148. Observability Architecture

```text
Metrics + structured logs + distributed traces
                 |
                 v
Connector -> Ingestion -> Digital Twin -> Trigger -> P6 -> P2 -> P3 -> P8
```
The repository's OpenTelemetry/Jaeger direction should be extended rather than duplicated.

---

# 149. Core Metrics

Track ingestion runs, records read/accepted/rejected/duplicate, connector latency/errors, queue depth, job duration, trigger volume, risk-run duration/failure, Digital Twin sync lag and data quality.

---

# 150. End-to-End Latency

Measure from `eventTime` -> `receivedAt` -> normalized -> Digital Twin -> trigger -> prediction -> risk calculation -> published RiskAssessment. This is a key continuous-risk operational KPI.

---

# 151. Source Freshness Metrics

Track newest source event, last successful ingestion, expected interval, freshness age and number of stale connectors.

---

# 152. Risk Freshness Metrics

Track current assessment age, pending run age, failed run count and time since last valid risk publication.

---

# 153. Queue Metrics

Track queue depth, wait time, active jobs, retries, dead-letter volume and stale/obsolete job count.

---

# 154. Error Taxonomy

Use stable error codes such as `AUTH_FAILED`, `TIMEOUT`, `RATE_LIMIT`, `SCHEMA_MISMATCH`, `ENTITY_UNRESOLVED`, `CURSOR_INVALID`, `RUN_FAILED`, `QUALITY_REJECTED`, `SSRF_BLOCKED`.

---

# 155. Health Aggregation

Expose separate status dimensions: Source Health, Data Health, Digital Twin Health, Risk Health, ML Health, Governance Health and Infrastructure Health. Avoid one opaque universal “health score.”

---

# 156. Health Endpoint

Extend internal health/readiness checks to include database, queue, required worker/model runtime and enabled critical integrations. Optional connectors should not make the entire platform unready.

---

# 157. Graceful Shutdown

Stop accepting new work, drain or safely checkpoint active jobs, close connections, and preserve queue/outbox state. Existing server shutdown handling should be extended rather than replaced.

---

# 158. Failure Injection

Test connector outage, DB transient failure, worker crash, ML service outage, queue failure and object-storage failure. The goal is controlled degradation and recoverability, not perfect availability.

---

# 159. Risk Recovery

If a worker crashes during risk calculation, either safely resume/retry or mark the job failed/obsolete. Never publish partial values.

---

# 160. Source Failure Recovery

On source failure, preserve the last known state, expose freshness degradation, retry according to policy, and reconcile after recovery.

---

# 161. Current Risk Projection

A denormalized `CurrentRiskProjection` can make dashboards fast. It must be updated only after a validated RiskAssessment is published.

---

# 162. Cache Safety

Cache keys must include tenant, scope and assessment version. Cached values must be invalidated on new valid publication.

---

# 163. No Fake Current State

Never show new EAL/VaR/Risk Score before the associated P2 run completes and publishes a valid assessment.

---

# 164. Materiality Audit

Persist every trigger decision with event, materiality policy version, reasons, affected scope and recommended action. This lets P7 explain why an alert did or did not trigger recalculation.

---

# 165. Continuous Risk Explanation

The Copilot can answer “Why did risk recalculate?” from RiskTrigger and “Why is risk stale?” from source freshness + pending run data. It should not infer these from conversational guesses.

---

# 166. Risk Coalescing

When several events arrive before a worker starts, combine them only when their scope, policy, state and model context permit safe coalescing. Retain all source/event references.

---

# 167. Full vs Partial

Partial risk results must never be presented as enterprise-wide current risk unless the P2 aggregation contract explicitly authorizes the projection. Scope is part of the risk result.

---

# 168. Scheduled Reconciliation

Run a periodic full Digital Twin reconciliation and full P2 calculation to catch missed or corrupted event paths.

---

# 169. Continuous Risk Freshness

Expose `last data ingested`, `last valid risk`, `pending calculation` and `model version` together so users can see the freshness of the complete chain.

---

# 170. Governance Package Linkage

For material risk changes, link the ingestion trigger, RiskRun, RiskAssessment, P3 drivers and P8 GovernanceEvent. P8 may later seal and anchor this chain as a governance package.

---

# 171. API Surface

Recommended APIs:
- `GET/POST /api/v1/integrations/connectors`
- `POST /api/v1/integrations/connectors/{id}/test`
- `POST /api/v1/integrations/webhooks/{connectorId}`
- `GET /api/v1/ingestion/runs`
- `POST /api/v1/ingestion/connectors/{id}/run`
- `POST /api/v1/ingestion/runs/{id}/replay`
- `GET /api/v1/ingestion/freshness`
- `GET /api/v1/ingestion/data-quality`
- `GET /api/v1/digital-twin/summary`
- `GET /api/v1/digital-twin/changes`
- `GET /api/v1/risk/triggers`
- `GET /api/v1/risk/recalculation/{jobId}`
- `GET /api/v1/system/health`

---

# 172. Connector UI

Connector administration should show name/type/scope/status/last success/freshness/records/errors/owner and configuration version. Secrets are never displayed.

---

# 173. Ingestion UI

Ingestion detail should show run ID, connector, time range, records read/accepted/rejected/duplicates, cursor state, error codes and replay status.

---

# 174. Digital Twin UI

Show recent state changes, entity resolution, source provenance and affected service/business context. Do not use a generic decorative graph disconnected from backend state.

---

# 175. Continuous Risk UI

Show risk freshness, source freshness, pending recalculation, recent triggers and latest valid assessment. Distinguish “pending” from “failed” and “stale.”

---

# 176. Globe UI

The globe is a geospatial control-plane view over synchronized enterprise state. Modes may include exposure, financial risk, threat context and blast radius. Every visual should trace to actual backend data.

---

# 177. Globe Data Contract

Provide asset/service location, scope, risk, dependency and last-updated metadata from the Digital Twin/risk read model. Do not invent random lines, attacks or country-level risk.

---

# 178. Production Rollout

Roll out in stages: observe-only ingestion -> normalization -> Digital Twin -> shadow materiality -> shadow triggers -> partial risk -> full event-driven risk -> full reconciliation.

---

# 179. Shadow Materiality

During rollout, compute materiality but do not launch RiskRuns. Compare the decisions and expected scopes before enabling automated recalculation.

---

# 180. Connector Canary

Enable a new enterprise connector for a small scope first, validate identity resolution/quality/freshness, then expand to enterprise scope.

---

# 181. Risk Trigger Canary

Enable one high-value event class first, such as critical vulnerability state change, then progressively add control, threat and dependency events.

---

# 182. Production Rollback

Feature flags can disable event-driven recalculation while preserving ingestion and scheduled/manual risk calculation. A connector can be disabled independently.

---

# 183. Configuration Flags

Recommended: `INGESTION_ENGINE_V2_ENABLED`, `CONNECTOR_REGISTRY_ENABLED`, `DIGITAL_TWIN_SYNC_ENABLED`, `MATERIALITY_ENGINE_ENABLED`, `EVENT_DRIVEN_RISK_ENABLED`, `RISK_COALESCING_ENABLED`, `FULL_RECONCILIATION_ENABLED`, `INGESTION_MONITORING_ENABLED`.

---

# 184. Database Model Targets

Recommended entities: `ConnectorType`, `ConnectorInstance`, `ConnectorConfigurationVersion`, `ConnectorHealthSnapshot`, `IngestionRun`, `SourceRecord`, `SourceRecordVersion`, `FieldMappingVersion`, `DataQualityIssue`, `SourceCheckpoint`, `ReconciliationRun`, `DigitalTwinChange`, `DomainEvent`, `DomainEventOutbox`, `RiskTriggerPolicy`, `RiskTrigger`, `RiskFreshnessSnapshot`, `CurrentRiskProjection`.

---

# 185. ConnectorInstance Fields

`id`, `organizationId`, `connectorTypeId`, `name`, `status`, `scope`, `configurationVersionId`, `credentialReference`, `ownerId`, timestamps.

---

# 186. IngestionRun Fields

`id`, `organizationId`, `connectorId`, status, start/end, cursor before/after, record counters, schema/mapping versions, error metadata, input hash.

---

# 187. SourceRecord Fields

`id`, `organizationId`, `connectorId`, `ingestionRunId`, `sourceRecordId`, source/processing timestamps, payload hash/reference, version/status.

---

# 188. DataQualityIssue Fields

`id`, `organizationId`, `ingestionRunId`, `sourceRecordId`, rule code, severity, status, details, timestamps.

---

# 189. DigitalTwinChange Fields

`id`, organizationId, entity type/ID, field path, previous/new values, source record, timestamps, state version and change hash.

---

# 190. DomainEventOutbox Fields

`id`, organizationId, eventId, event type, bounded payload, status, created/processed timestamps and retry count.

---

# 191. RiskTriggerPolicy Fields

`id`, organizationId`, version, event type, conditions, priority, scope rule, cooldown, action and status.

---

# 192. RiskTrigger Fields

`id`, organizationId`, eventId, policy version, material flag, reasons, priority, scope, requested run type, status and timestamps.

---

# 193. CurrentRiskProjection Fields

`organizationId`, scope, riskAssessmentId, EAL, VaR95, VaR99, Risk Score and publishedAt. This is a read projection, not the authoritative risk record.

---

# 194. Repository Map

Suggested modules:
```text
src/services/ingestion/
  connectorRegistry.service.ts
  connectorInstance.service.ts
  connectorHealth.service.ts
  ingestionRun.service.ts
  ingestion.service.ts
  normalization.service.ts
  deduplication.service.ts
  checkpoint.service.ts
  reconciliation.service.ts
  materiality.service.ts
  freshness.service.ts
  dataQuality.service.ts
  replay.service.ts
src/services/ingestion/connectors/
src/services/digitalTwin/
src/services/events/
src/services/risk/
src/workers/
```

---

# 195. Existing Repository Reuse

Reuse Express/TypeScript, Prisma/PostgreSQL, current worker/queue patterns, OpenTelemetry, security middleware, Docker and existing audit/auth foundations. P9 is an extension of SentinelStack, not a greenfield ingestion platform.

---

# 196. Test Matrix

Unit: mappings, deduplication, hashing, entity resolution, materiality, state transitions. Integration: connector -> ingestion -> Digital Twin -> trigger -> P2/P6/P3/P8. Security: tenant, webhook auth, SSRF, payload abuse, secrets. Resilience: retries, crash recovery, dead-letter, reconciliation.

---

# 197. Connector Test Fixtures

Every connector requires fixtures for valid data, malformed data, duplicate, changed record, late event, out-of-order event, schema drift, rate limit and authentication failure.

---

# 198. Idempotency Test

Replay the same source batch multiple times and assert no duplicate logical state, evidence or risk trigger.

---

# 199. Materiality Test

Critical KEV on internet-facing critical asset should create a material trigger under the configured policy; a heartbeat event should not.

---

# 200. Failure Test

If P2 fails, last valid current RiskAssessment remains available and the new run is recorded as failed/degraded. No partial publication is allowed.

---

# 201. Freshness Test

Move source timestamp beyond the configured threshold and assert `STALE` without changing EAL merely because freshness changed.

---

# 202. Replay Test

Fix mapping, replay dead-letter records, and assert idempotent state update plus new provenance.

---

# 203. Tenant Test

Tenant A connector/event cannot create or mutate Tenant B resources. Test connectors, ingestion runs, source records, Digital Twin state and triggers separately.

---

# 204. Webhook Security Test

Invalid signature, stale timestamp, replayed ID and oversized payload must be rejected/contained before state mutation.

---

# 205. SSRF Test

Generic REST connector attempts to reach blocked loopback/private/metadata targets must be rejected by the outbound policy.

---

# 206. Queue Recovery Test

Kill a worker after job acquisition; after lease expiry the job is retried or requeued without duplicate logical effects.

---

# 207. Reconciliation Test

Source snapshot missing a canonical asset must produce an explicit missing/conflict outcome according to source semantics, not an immediate destructive delete.

---

# 208. Full-Chain Test

Create a controlled synthetic event -> ingestion -> normalized evidence -> Digital Twin -> materiality -> P6 -> P2 -> P3 -> P8 -> current read model, and assert all references are linked.

---

# 209. Performance Test

Load test concurrent connectors, high-volume records, multiple risk triggers and overlapping tenants. Measure throughput, P95/P99 latency, DB connections, memory, queue depth and failure rate.

---

# 210. Soak Test

Run the workers for hours to detect memory leaks, connection leaks, queue growth and stale leases.

---

# 211. Failure Injection

Simulate source outage, database transient error, queue failure, ML outage and object-storage failure. The expected behavior is visible degradation + recovery, not silent data loss.

---

# 212. Security Monitoring

Monitor unauthorized connector access, webhook failures, SSRF blocks, mass ingestion/export, unusual trigger spikes and secret access errors.

---

# 213. Event Storm Handling

During event storms, preserve source events, prioritize critical triggers, coalesce related recalculations and defer low-priority work rather than dropping events.

---

# 214. Critical-Only Degradation

A controlled overload mode may process critical triggers first while preserving lower-priority data for later coalesced recalculation.

---

# 215. Risk Drift Reconciliation

Compare event-driven risk with scheduled full-run risk. Material differences should become operational investigations, not manually smoothed values.

---

# 216. Data-to-Risk SLO

Define and benchmark an end-to-end target for critical events. The engineering goal is minutes rather than manual assessment cycles, but exact SLOs must be established from measured workload.

---

# 217. Risk Freshness SLO

Measure the percentage of time current risk remains inside the configured freshness window for each in-scope organization.

---

# 218. Connector Freshness SLO

Measure the percentage of source observations processed inside the source-specific freshness target.

---

# 219. Governance of Configuration

Material changes to connector mappings, materiality policies, trigger policies, retention and scope rules are versioned and audited because they can alter analytical behavior.

---

# 220. Policy Evaluation

A policy evaluator should return `PASS`, `WARNING`, or `BLOCK` with rule ID/version and reason. Avoid hard-coded hidden governance logic across multiple services.

---

# 221. Production Health Dashboard

```text
Sources | Data | Digital Twin | Risk | ML | Governance | Infrastructure
```
Each dimension shows current state, timestamp, warnings and relevant drill-down.

---

# 222. Connector Health Dashboard

Show connector status, last success, newest source event, freshness, records, quality issues and error trend.

---

# 223. Risk Operations Dashboard

Show triggers queued/running/completed/failed/obsolete, pending age and current risk freshness.

---

# 224. Digital Twin Dashboard

Show asset/service/dependency sync, unresolved entity rate, recent changes and source provenance.

---

# 225. Data Quality Dashboard

Show top quality failures by source, rejected rows, duplicate rate, unresolved mappings and stale data.

---

# 226. AI Integration

P7 can expose read-only operational tools such as `get_connector_health`, `get_ingestion_freshness`, `get_recent_risk_triggers`, `get_recalculation_status` and `get_digital_twin_changes`. These tools remain backend-authorized.

---

# 227. AI Safety

P7 cannot disable connectors, change materiality policy, alter risk values or bypass ingestion authorization through natural language. High-impact admin actions stay in governed backend workflows.

---

# 228. Business Translation

The Copilot can translate “critical source stale” into business language such as “the current risk view has reduced telemetry freshness,” while preserving the exact technical state.

---

# 229. Globe + Ingestion

When asset/service state changes, the globe can update scope/markers from synchronized data. It should never create visual attack paths simply to imply activity.

---

# 230. Regulatory/Governance Link

P8 can use ingestion provenance and RiskRun lineage to build evidence packages showing how current state was sourced and when it influenced risk decisions.

---

# 231. Deployment Modes

`DEMO`, `DEVELOPMENT`, `STAGING`, `PRODUCTION` should separate credentials, connector scopes, synthetic data, ledger/submission behavior and approval policies.

---

# 232. Demo Mode

Synthetic connector events are allowed for SIH demonstration only when clearly labeled as `SYNTHETIC DEMO`. The actual ingestion, normalization, Digital Twin and P2 code path should still execute.

---

# 233. SIH Demo Flow

```text
1. Trigger synthetic critical vulnerability webhook
2. Validate signature
3. Ingest/source record
4. Normalize/evidence
5. Digital Twin changes
6. Materiality decision
7. RiskTrigger
8. P6 prediction
9. P2 updated EAL/VaR/Risk Score
10. P3 driver
11. P8 governance event
12. Dashboard/globe update
13. Ask Copilot why risk changed
```

---

# 234. Demo Failure Flow

Demonstrate a source outage or stale connector, show degraded freshness and preserved last-valid risk, then restore source and run reconciliation. This proves resilience without inventing risk values.

---

# 235. Demo Coalescing

Send several related events rapidly and show one coalesced RiskRun while retaining each source/event reference.

---

# 236. Demo Integrity

P8 can later package the resulting RiskAssessment and hash the governance package. Blockchain anchoring, if enabled, must use a real local/test adapter and real package hash.

---

# 237. Migration Strategy

Phase A: connector/ingestion schema. Phase B: source records/normalization. Phase C: Digital Twin sync. Phase D: shadow materiality. Phase E: active triggers. Phase F: P6/P2/P3 automation. Phase G: reconciliation/health. Phase H: hardening and scale tests.

---

# 238. Feature Flags

Keep new paths behind feature flags until validated. Rollback should disable event-driven risk while preserving stored source data and scheduled/manual risk calculation.

---

# 239. Operational Runbooks

Create runbooks for connector failure, schema drift, entity resolution conflict, risk-run failure, queue overload, dead-letter replay, Digital Twin conflict and source recovery.

---

# 240. Security Runbooks

Create response paths for credential compromise, webhook abuse, SSRF detection, cross-tenant attempt, raw-data exposure and integrity anomalies.

---

# 241. Acceptance Matrix

| Area | Acceptance |
|---|---|
| Connectors | versioned, scoped, authenticated |
| Ingestion | idempotent, resumable |
| Normalization | canonical, versioned |
| Quality | issues/rejections recorded |
| Digital Twin | versioned state |
| Materiality | policy-driven |
| Risk | P2 authoritative |
| ML | P6 integrated |
| Governance | P8 linked |
| Resilience | retry/dead-letter/reconcile |
| Security | tenant/RBAC/SSRF/secrets |
| Observability | logs/metrics/traces |
| Globe | real enterprise data |

---

# 242. Definition of Done

P9 is complete when a source event can be securely ingested, normalized, linked to canonical state and evidence, evaluated for materiality, trigger an auditable P6/P2/P3 run when necessary, publish a validated current risk, preserve the last valid result on failure, and surface freshness/health/lineage through dashboards and Copilot.

---

# 243. A. Recommended Repository Tree

```text
src/
  services/
    ingestion/
      connectorRegistry.service.ts
      connectorInstance.service.ts
      connectorHealth.service.ts
      ingestionRun.service.ts
      ingestion.service.ts
      normalization.service.ts
      deduplication.service.ts
      checkpoint.service.ts
      reconciliation.service.ts
      materiality.service.ts
      freshness.service.ts
      dataQuality.service.ts
      replay.service.ts
      connectors/
    digitalTwin/
      digitalTwinSync.service.ts
      entityResolution.service.ts
      stateChange.service.ts
      dependencySync.service.ts
      locationSync.service.ts
    events/
      domainEvent.service.ts
      outbox.service.ts
      eventPublisher.service.ts
    risk/
      riskTrigger.service.ts
      riskRecalculation.service.ts
      riskPublication.service.ts
      riskFreshness.service.ts
  workers/
    ingestion.worker.ts
    reconciliation.worker.ts
    riskRecalculation.worker.ts
    domainEvent.worker.ts
```

---


# 244. B. End-to-End Trace Example

```text
Source Event EVT-001
  -> Connector CON-001
  -> IngestionRun ING-001
  -> SourceRecord SRC-001
  -> Evidence EV-001
  -> DigitalTwinChange DTC-001
  -> RiskTrigger TRG-001
  -> MLPrediction PRED-001
  -> RiskRun RUN-001
  -> RiskAssessment RA-001
  -> RiskDriver DRV-001
  -> GovernanceEvent GE-001
```
Identifiers are illustrative.

---


# 245. C. Example Materiality Policy

```json
{
  "eventType": "VULNERABILITY_OPENED",
  "conditions": [
    "kev=true",
    "asset.criticality=CRITICAL",
    "asset.internetExposure=true"
  ],
  "action": "FULL_RISK_RUN",
  "priority": "CRITICAL",
  "policyVersion": "1.0"
}
```
This is an example policy structure; thresholds must be calibrated to the deployment.

---


# 246. D. Example Failure Behavior

```text
Critical event
   -> trigger created
   -> worker starts
   -> ML service unavailable
   -> approved fallback or visible failure, per policy
   -> P2 either completes with explicit fallback metadata or fails safely
   -> previous valid RiskAssessment remains current
```

---


# 247. E. Example Freshness View

```text
NVD        HEALTHY  last data 2m ago
KEV        HEALTHY  last data 3m ago
SIEM       WARNING  last event 18m ago
EDR        STALE    last event 3h ago
Risk       FRESH    last valid run 5m ago
```
Values are illustrative.

---


# 248. F. Example Event Storm

```text
20 vulnerability/telemetry changes in 45 seconds
      -> materiality groups 7 events
      -> 2 scopes
      -> 2 RiskTriggers
      -> 2 coalesced RiskRuns
```
The raw 20 events remain traceable.

---


# 249. G. Recommended Error Codes

```text
INT-001 AUTH_FAILED
INT-002 TIMEOUT
INT-003 RATE_LIMIT
INT-004 NETWORK_ERROR
INT-005 SCHEMA_MISMATCH
INT-006 INVALID_PAYLOAD
INT-007 DUPLICATE
INT-008 ENTITY_UNRESOLVED
INT-009 SOURCE_UNAVAILABLE
INT-010 CURSOR_INVALID
INT-011 PAYLOAD_TOO_LARGE
INT-012 SSRF_BLOCKED
ING-001 RUN_FAILED
ING-002 NORMALIZATION_FAILED
ING-003 QUALITY_REJECTED
RISK-TRG-001 INVALID_SCOPE
RISK-TRG-002 MATERIALITY_POLICY_ERROR
```

---


# 250. H. Engineering Guardrails

```text
DO:
- preserve source provenance
- version mappings/configuration
- make processing idempotent
- separate event time from processing time
- make entity resolution explicit
- use outbox + at-least-once events
- use materiality/coalescing to control recalculation
- preserve last valid risk
- expose stale/degraded states
- reuse existing worker infrastructure
- enforce tenant isolation
- secure generic connectors against SSRF
- benchmark end-to-end data-to-risk latency

DO NOT:
- let source data silently rewrite history
- treat every event as a full risk trigger
- drop malformed records without reasons
- advance source cursors before durable acceptance
- disable TLS verification in production
- let generic connectors reach cloud metadata services
- log raw secrets/payloads by default
- publish partial risk
- overwrite the last valid risk on failure
- use the read projection as risk calculation authority
- fabricate source health or continuous updates
```

---


# 251. I. Final Architecture

```text
Security / Business Sources
          |
          v
  Connector + Ingestion
          |
          v
      Normalization
          |
          v
    Canonical Evidence
          |
          v
      Digital Twin
          |
          v
   Materiality Engine
          |
          v
      Risk Trigger
          |
       +--+--+
       |     |
       v     v
      P6     P2
       |     |
       +--+--+
          |
          v
         P3
          |
          v
         P8
          |
          v
   Current Risk Projection
       |           |
       v           v
   Dashboard      Globe
          
          +----> P7 Copilot
```

---

# Status

**P9 Continuous Ingestion, Connector Framework, Telemetry Normalization, Digital Twin Synchronization, Event-Driven Risk Recalculation, Observability & Production Hardening Implementation Specification:** READY

P9 operationalizes the previously defined quantitative, predictive, optimization and governance capabilities into a continuous runtime loop:

```text
P2 -> Quantify
P3 -> Attribute
P4 -> Simulate
P5 -> Optimize
P6 -> Predict
P7 -> Explain
P8 -> Govern
P9 -> Continuously Ingest / Synchronize / Trigger / Recalculate
```

**Next phase:**

```text
P10 — End-to-End Integration, System Validation, Performance Benchmarking, Security Validation, SIH Demo Hardening, Deployment Runbooks, Monitoring Runbooks, Acceptance Test Plan & Final Production Readiness
```

P10 becomes the final engineering-validation layer proving that P1–P9 operate together inside the existing SentinelStack repository and that the PS-26105 solution is reproducible, testable, observable and SIH-ready.
