SentinelStack  |  API & Integration Contract Specification  |  PS 26105 

# **SentinelStack** 

## **API and Integration Contract Specification** 

AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform 

|**Field**|**Value**|
|---|---|
|Problem Statement|26105|
|Source Baseline|SRS v2.1|
|Architecture Baseline|SDD v1.1|
|Data Baseline|Data Dictionary/ Database Schema v1.0<br>ii|
|Model Baseline|RiskQuantification & Mathematical Model Specification v1.0<br>i|
|ML Baseline|ML Dataset & TrainingSpecification v1.0|
|API Version|v1.0.0|
|Status|Final EngineeringAPI Baseline|



SentinelStack — API Contract v1.0  •  Engineering Baseline 

SentinelStack  |  API & Integration Contract Specification  |  PS 26105 

### **Contents** 

1 Purpose and Scope 

2 Contract Principles 

3 API Surface Map 

4 Authentication, Authorization and Tenant Scope 

5 Transport, Headers and Conventions 

6 Common Data and Error Contracts 

7 Ingestion API 

8 Digital Twin and Security Data APIs 

9 Risk API 

10 AI Decision Support API 

11 What-If Scenario API 

12 Recommendations API 

13 Investment Optimization API 

14 Governance, Compliance, Reporting and Audit APIs 

15 Asynchronous Processing and Webhooks 

16 Reliability, Idempotency and Concurrency 

17 Security and Privacy Contract 

18 Versioning and Compatibility 

19 SRS / SDD / Data / Model Traceability 

20 API Verification Plan 

Appendix A OpenAPI Artifact Usage 

SentinelStack — API Contract v1.0  •  Engineering Baseline 

SentinelStack  |  API & Integration Contract Specification  |  PS 26105 

### **1. Purpose and Scope** 

This specification defines the externally observable API contract for SentinelStack. It translates the finalized SRS, SDD, data dictionary/database schema and risk/ML design into stable service interfaces. The contract is API-first and tenant-aware; implementations may deploy these logical services as separate containers or as a lean modular application while preserving the same interfaces. 

- Supports enterprise security and business-context ingestion required by FR-01/FR-02. 

- 

   - Exposes authoritative continuous risk metrics required by FR-03–FR-09 and FR-20–FR-22. 

- Exposes predictive, recommendation, natural-language and scenario capabilities required by FR-10–FR-13. 

- 

- 

- 

- Exposes budget optimization, ROSI, cost-benefit and investment-curve workflows required by FR-14–FR-19. 

- Exposes compliance mapping, evidence, reporting and audit access required by FR-23/FR-24 and NFR-08. 

- Provides cloud-ready, secure, observable integration behavior corresponding to NFR-01–NFR-10. 

### **2. Contract Principles** 

|**Principle**|**Contract rule**|
|---|---|
|Authoritative calculations|Risk/EAL/VaR/Risk Score values returned by risk APIs originate from the<br>governed Risk Engine;the LLM cannot write or overwrite these values.<br>i|
|Grounded AI|NLQ responses must reference verified API data, metric IDs and<br>calculation hashes.|
|Point-in-time integrity|Risk and ML inputs are timestamped/versioned; scenario and scoring<br>requests identifythe model/parameter bundle used.|
|Tenant isolation|Every protected request is evaluated against the authenticated<br>organization membership; callers cannot select another tenant<br>through an arbitraryidentifier.|
|Evidence lineage|Material outputs expose references to input snapshots, model<br>versions,evidence records and calculation hashes.<br>i|
|Backward compatibility|Additive fields are preferred; breaking changes require a new API major<br>version.|
|Async for heavy work|Recalculation, simulation, optimization, compliance assessment and<br>reportgeneration return 202 + Job resources.|



### **3. API Surface Map** 

The public API is organized around the same logical boundaries established in the SDD: ingestion, Digital Twin/context, risk, AI decision support, scenarios, recommendations, optimization, governance, compliance, reporting and audit. 

**Platform:** GET /health; GET /ready; GET /jobs/{job_id}; POST /webhooks/subscriptions 

**Ingestion:** GET/POST /integrations/sources; POST /integrations/sources/{source_id}/test; POST /ingestion/batch; POST /ingestion/events; GET /ingestion/runs 

**Digital Twin:** GET/POST/PATCH /assets; GET /services; GET /vulnerabilities; GET /controls 

**Risk:** GET /risk/current; GET /risk/assessments/{assessment_id}; POST /risk/recalculate; GET /risk/trends; GET /risk/drivers 

**AI / What-If:** POST /nlq/query; GET/POST /recommendations; POST /recommendations/generate; POST/GET /scenarios; POST /scenarios/{scenario_id}/simulate; GET /scenarios/{scenario_id}/result 

**Optimization:** GET /investment-options; POST /optimization/runs; GET /optimization/runs/{optimization_run_id}; POST /investment-decisions 

**Governance:** GET /compliance/mappings; POST /compliance/assessments; POST /reports; GET /reports/{report_id}; GET /audit/events 

SentinelStack — API Contract v1.0  •  Engineering Baseline 

SentinelStack  |  API & Integration Contract Specification  |  PS 26105 



_Figure 1. Logical API and integration flow_ 

### **4. Authentication, Authorization and Tenant Scope** 

- Authentication: OAuth2/OIDC-compatible bearer JWT. Authentication secrets/tokens are never persisted as application data. 

- Authorization: RBAC using the organization membership context and least privilege. Roles may include executive, security/risk, technical, compliance/governance and administrative scopes. 

- Tenant context: organization_id is derived from the validated identity/session. Any explicit scope_id in a request must belong to that organization. 

- Sensitive actions: investment decisions, configuration changes, connector registration and report generation are authorization-checked and audit logged. 

- Service-to-service calls use short-lived service credentials or workload identity and are separately authorized. 

### **5. Transport, Headers and Conventions** 

|**Element**|**Contract**|
|---|---|
|Transport|HTTPS/TLS 1.2+ forproduction deployments.|
|Format|JSON UTF-8 for standard request/response bodies.|
|Date/time|ISO-8601 timestamps in UTC.|
|Currency|ISO-4217 currency code; monetary amounts represented as decimal<br>numbers with documentedprecision.|
|IDs|UUIDs for SentinelStack resources; source-native IDs preserved in<br>lineage records.|
|Correlation|X-Correlation-ID accepted/returned on everyrequest.|
|Idempotency|Idempotency-Key required for POST operations that create or trigger<br>heavy jobs where duplicate execution would be harmful.|
|Caching|ETag/If-None-Match may be used for read-heavy immutable/versioned<br>resources.|
|Pagination|Cursorpagination;default 50,maximum 200.<br>ii|
|Sorting|Explicit sort field + direction;server must reject unsupported fields.|



### **6. Common Data and Error Contracts** 

#### **6.1 Error Contract** 

{ 

"type": "https://api.sentinelstack.example.com/problems/validation-error", 

- "title": "Validation error", 

- "status": 400, 

- "detail": "Invalid scope identifier", 

"correlation_id": "6c7d...", 

- "code": "SCOPE_NOT_FOUND" 

- } 

SentinelStack — API Contract v1.0  •  Engineering Baseline 

SentinelStack  |  API & Integration Contract Specification  |  PS 26105 

#### **6.2 Standard Status Semantics** 

|**Status**|**Meaning**|
|---|---|
|200|Successful synchronous retrieval/update|
|201|Resource created|
|202|Accepted for asynchronousprocessing|
|204|Successful action with no response body|
|400|Malformed/invalid request|
|401|Missing/invalid authentication|
|403|Authenticated but unauthorized|
|404|Resource not found within tenant scope<br>l|
|409|Conflict / stale version / duplicate request|
|422|Semanticallyinvalid request|
|429|Rate limit exceeded|
|500|Unexpected server failure|
|503|Dependencyunavailable / temporaryservice degradation|



### **7. Ingestion API** 

The ingestion contract directly supports vulnerability management, SIEM, IAM, EDR, CSPM, asset inventory, threat intelligence and business-context sources. Connectors may use REST/webhooks, scheduled files, agent collectors or STIX/TAXII where applicable. Raw source lineage and normalized records remain linked. 

|**Endpoint**|**Purpose**|**Sync**|**Key inputs / outputs**|
|---|---|---|---|
|POST /integrations/sources|Register/update a source<br>connector|Sync|source class, mechanism,<br>schema version → source_id|
|POST<br>/integrations/sources/{id}/test|Validate connectivity/schema<br>i|Sync|source_id → success/details|
|POST /ingestion/batch|Submit file/batchpayload|Async|source_id + records →job_id|
|POST /ingestion/events|Submit normalized security<br>events|Async|canonical events → job_id<br>i|
|GET /ingestion/runs|Review source runs and quality|Sync|filters → run status, counts,<br>quality|
|POST<br>/integrations/sources/{id}/test|Detect connector/auth/schema<br>errors|Sync|test result + diagnostic detail|



High-severity changes must be eligible to trigger risk recalculation within the SRS freshness target; routine changes are reflected in the full recalculation cycle. The API does not guarantee that upstream sources emit changes with a particular latency; it exposes ingestion receipt and processing timestamps for observability. 

### **8. Digital Twin and Security Data APIs** 

- Assets expose business-unit linkage, criticality, environment and internet exposure. 

- Services expose business criticality and dependency relationships. 

- Vulnerability resources expose standardized identifiers and evidence signals such as CVSS/EPSS/KEV where available. 

- Controls expose definition plus current effectiveness/coverage state; implementation state is separate from the control definition. 

- Source-native identifiers remain available through evidence/lineage rather than replacing canonical IDs. 

### **9. Risk API** 

Risk APIs expose the authoritative results of the Risk Engine. A risk assessment is a versioned snapshot of the organization/business-unit/service/asset state at a point in time. The API must return not only monetary metrics but also data coverage, uncertainty, model bundle version, parameter version and calculation hash. 

|**Endpoint**|**Purpose**|**Primary output**|
|---|---|---|
|GET /risk/current|Current risk at selected scope|RiskAssessment|
|GET /risk/assessments/{id}|Historical/auditable assessment|RiskAssessment|
|POST /risk/recalculate|Trigger material/routine recalculation|Job|
|GET /risk/trends|Time-series risk visibility|EAL/VaR/score/exposurepoints|
|GET /risk/drivers|Model/data-derived drivers|Ranked RiskDriver[]|



SentinelStack — API Contract v1.0  •  Engineering Baseline 

SentinelStack  |  API & Integration Contract Specification  |  PS 26105 

Risk response invariant: 

risk_score, eal, var, financial_exposure are authoritative engine outputs. 

AI/NLQ may explain them, but may not recalculate or overwrite them. 

### **10. AI Decision Support API** 

#### **10.1 Predictive and Recommendation Workflows** 

Predictive models are accessed internally by the Risk Engine and decision layer. Public-facing APIs expose model-backed outputs rather than raw model execution controls unless an administrative scoring endpoint is explicitly enabled. Recommendations must retain their originating risk assessment, quantified risk reduction when optimization-eligible, expected cost, uncertainty/evidence references and priority factors. 

#### **10.2 Natural Language Query** 

POST /api/v1/nlq/query 

- { "query": "Which vulnerabilities contribute most to expected losses?", "response_detail": "standard" } 

Response includes: 

- answer 

- data_refs 

- metric_refs 

- calculation_hashes 

- warnings 

The NLQ layer obtains verified structured results through approved backend tools and then produces business-language explanations. It does not receive unrestricted database access and cannot write authoritative financial metrics. 

### **11. What-If Scenario API** 

Scenarios are copy-on-write mutations over a baseline assessment. Operational state is not changed by scenario creation or simulation. Example changes include MFA coverage increases or remediation delay. Simulation returns baseline vs. scenario EAL, VaR, Risk Score and financial exposure, plus the delta and model/parameter versions used. 

|**Endpoint**|**Purpose**<br>i|**Notes**|
|---|---|---|
|POST /scenarios|Create immutable scenario definition|Baseline assessment required|
|POST /scenarios/{id}/simulate|Execute scenario<br>i|Async;returnsjob_id|
|GET /scenarios/{id}|Inspect scenario definition/status|No mutation of operational baseline|
|GET /scenarios/{id}/result|Retrieve comparison|Baseline vs scenario metrics + deltas|



### **12. Recommendations API** 

Recommendations are decision-support records generated from model/data evidence. The prioritization logic may consider risk reduction, urgency, materiality, affected business scope, cost, dependencies, feasibility and uncertainty. An option becomes optimization-eligible only when a defensible quantified risk reduction and valid cost/applicability record exist. 

### **13. Investment Optimization API** 

Optimization consumes candidate investments produced by scenario analysis and approved option data. The reference objective is maximum modeled risk reduction subject to budget and applicability/dependency constraints. The API must expose total cost, modeled risk reduction, residual EAL/VaR/exposure where supported, objective value, constraints status and the selected option set. 

SentinelStack — API Contract v1.0  •  Engineering Baseline 

SentinelStack  |  API & Integration Contract Specification  |  PS 26105 

POST /api/v1/optimization/runs 

{ 

- "budget": 10000000, 

- "currency": "INR", 

- "objective": "maximize_risk_reduction", 

- "candidate_option_ids": ["..."], 

- "constraints": {"excluded_option_ids": []} 

- } 

- → 202 { "job_id": "..." } 

#### **13.1 Portfolio interaction rule** 

Individual option reduction may be used for screening, but the final selected portfolio should be re-evaluated through the Scenario Engine whenever feasible. This prevents additive double counting when controls interact or overlap. 

### **14. Governance, Compliance, Reporting and Audit APIs** 

|**Endpoint**|**Purpose**|
|---|---|
|POST /investment-decisions|Persist human approval/rejection/defer decision with rationale|
|GET /compliance/mappings|Retrieve framework mappingrecords|
|POST /compliance/assessments|Run framework assessment|
|POST /reports|Generate evidence-backed PDF/CSV/JSON report|
|GET /reports/{id}|Retrieve report metadata/download reference|
|GET /audit/events|Querymaterial changes andprovenance trail|



- Supported frameworks: ISO/IEC 27001, NIST CSF, CIS Controls, RBI CSF and SEBI Cybersecurity and Cyber Resilience Framework. 

- Report generation returns evidence references and content hash where applicable. 

- Audit events include actor, time, resource, source data references and content hash for tamper-evidence workflows. 

### **15. Asynchronous Processing and Webhooks** 

Long-running work returns HTTP 202 with a Job resource. Clients poll GET /jobs/{job_id}; deployments may additionally deliver signed webhooks for completion events. 

|**Event**|**When emitted**|**Payload minimum**|
|---|---|---|
|ingestion.completed|Batch or source run completed|run_id,source_id,counts, quality|
|risk.assessment.completed|Material risk assessment persisted|assessment_id, scope, metrics_summary,<br>calculation_hash|
|scenario.completed|Scenario simulation completed|scenario_id,baseline_id,result_ref|
|optimization.completed|Budget optimization completed|optimization_run_id,result_ref|
|report.generated|Report artifact available|report_id,content_hash,download reference|



### **16. Reliability, Idempotency and Concurrency** 

- POST requests that launch jobs must accept Idempotency-Key. Repeated requests with the same key and equivalent payload return the original job/resource reference. 

- Optimistic concurrency should use ETag / If-Match for mutable resources such as connector configuration and investment decision records. 

- Retries must use exponential backoff for 429/503 responses; clients must not blindly retry 4xx validation/auth failures. 

- At-least-once delivery from connectors is expected. The ingestion layer deduplicates by source-native record identity plus source/version rules. 

- Material risk recalculation must be serialized per affected scope/model bundle so stale calculations cannot silently overwrite newer authoritative assessments. 

SentinelStack — API Contract v1.0  •  Engineering Baseline 

SentinelStack  |  API & Integration Contract Specification  |  PS 26105 

### **17. Security and Privacy Contract** 

- TLS 1.2+ in transit; encrypted storage at rest using organization-approved encryption equivalent to AES-256. 

- RBAC and least privilege; no tenant-crossing identifiers accepted without authorization validation. 

- Secrets are stored in a deployment secret manager; never in logs or API payloads unless explicitly designed as write-only credential fields. 

- Raw SIEM/EDR/IAM telemetry may remain inside the enterprise boundary in private/hybrid deployments; APIs support feature/aggregate submission when raw transfer is not appropriate. 

- Sensitive financial context is minimized to parameters required for impact estimation; the platform does not function as an accounting/ERP system. 

- Audit events are tamper-evident and retained according to governance policy; computed risk snapshots have the required 36-month minimum history. 

### **18. Versioning and Compatibility** 

|**Rule**<br>i|**Contract**|
|---|---|
|Versionprefix|/api/v1<br>i|
|Breaking change<br>i|New major version; previous version remains supported for a defined<br>migration window.<br>i|
|Additive field|Backward-compatible;clients must ignore unknown response fields.|
|Enum extension|Treated as potentially breaking for strict clients; documented before<br>rollout.|
|Schema evolution|Canonical internal data contracts versioned independently; source-<br>specific schemas retain lineage.<br>i|
|OpenAPI artifact|This specification is the machine-readable source of truth for endpoint<br>shapes.|



### **19. SRS / SDD / Data / Model Traceability** 

|**Baseline requirement**|**Design/data realization**|**API realization**|
|---|---|---|
|FR-01–02|Ingestion APIs +<br>IntegrationSource/IngestionRun/SourceRecor<br>d|/integrations/*, /ingestion/*|
|FR-03,NFR-03A|Risk recalculation + Jobs|/risk/recalculate,/jobs/*|
|FR-04–06B|Risk Engine contract + RiskMetrics|/risk/current,/risk/assessments/*|
|FR-07–08|Digital Twin + Control APIs|/assets,/services,/controls|
|FR-09|RiskDriver schema /risk drivers|/risk/drivers|
|FR-10–12A|AI Decision + NLQ grounding|/nlq/query,/recommendations/*|
|FR-13|Scenario Engine|/scenarios/*|
|FR-14–19|Optimization + InvestmentOption/Result|/investment-options, /optimization/*,<br>/investment-decisions|
|FR-20–22|Risk/trend/reportingendpoints|/risk/trends,/risk/*,/reports/*|
|FR-23–24|Compliance/reporting/audit|/compliance/*,/reports/*,/audit/events|
|NFR-01–02|Bearer auth,RBAC,tenant checks|Allprotected endpoints|
|NFR-05|Drivers, evidence, warnings, calculation<br>hashes|Risk/Scenario/NLQ/Optimization responses|
|NFR-07|REST/JSON + STIX/TAXII-compatible ingestion|Ingestion APIs|
|NFR-08|Audit Events + content hashes|/audit/events +persisted audit store|
|NFR-09|Stateless APIs + independent workers/jobs|Gateway/Core/Ingestion/Risk workers|
|NFR-10|Configurable telemetry retention|Ingestion/store policy; not exposed as tenant-<br>unbounded deletion|



### **20. API Verification Plan** 

|**Test area**|**Acceptance condition**|
|---|---|
|Contract validation|OpenAPI YAML and JSON parse successfully; every referenced schema<br>exists.|
|Authentication|Protected endpoints reject absent/invalid tokens and accept valid<br>tenant-scoped identities.|
|Authorization / tenant isolation|Cross-tenant resource IDs return 403/404 according to policy; no data<br>leakage.|



SentinelStack — API Contract v1.0  •  Engineering Baseline 

SentinelStack  |  API & Integration Contract Specification  |  PS 26105 

|**Test area**|**Acceptance condition**|
|---|---|
|Ingestion|REST/webhook/batch payloads normalize into canonical contracts;<br>provenancepreserved.|
|Risk authority|Risk endpoints return stored authoritative metrics; NLQ cannot mutate<br>those fields.|
|Continuous risk|High-severity recalculation request produces a Job and completes<br>within the configured freshness target inperformance testing.|
|Scenario|Scenario execution does not change baseline operational state; result<br>contains comparable metrics and deltas.|
|Optimization|Budget and dependency constraints are enforced and returned as<br>satisfied/violated status.|
|ROSI / cost-benefit|Optimization/investment responses contain values needed for ROSI<br>and cost-benefitpresentation.|
|Compliance/reporting|Framework and evidence APIs return mappings and report<br>metadata/content hashes.|
|Audit|Material mutations produce auditable events with actor, timestamp,<br>source refs and hash.|
|Reliability|Idempotency prevents duplicate job/resource creation; retry<br>semantics are deterministic.|
|Security|TLS, RBAC, secret handling, rate limiting, input validation and audit<br>controlspass securitytesting.|



### **Appendix A. OpenAPI Artifact Usage** 

The companion SentinelStack_OpenAPI_v1.0_FINAL.yaml is the machine-readable contract. Import it into an OpenAPIcompatible tooling chain to generate server stubs, client SDKs, interactive documentation and contract tests. The JSON companion is a format-equivalent serialization for tooling that expects JSON. 

Files: 

SentinelStack_OpenAPI_v1.0_FINAL.yaml SentinelStack_OpenAPI_v1.0_FINAL.json 

SentinelStack_API_and_Integration_Contract_Specification_v1.0_FINAL.docx 

SentinelStack — API Contract v1.0  •  Engineering Baseline 

