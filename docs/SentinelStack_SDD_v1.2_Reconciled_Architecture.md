# SentinelStack — Software Design Document v1.2

**Problem Statement:** 26105  
**Document:** AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Version:** 1.2 — Reconciled Architecture Baseline  
**Status:** Design baseline aligned to SRS v2.1 and audited against the existing SentinelStack repository  
**Primary Repository:** `ciphernet01/sentinelstack`  
**Deployment Baseline:** Existing Next.js + Express + Prisma/PostgreSQL application; current cloud deployment retained

Software Design Document

AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform

| Field | Value |
| --- | --- |
| Problem Statement | 26105 |
| Organization | All India Council for Technical Education (Cyber Security Cell) |
| Document Version | 1.2 — Reconciled Architecture Baseline |
| Status | Design baseline aligned to SRS v2.1 and audited against the existing SentinelStack repository |
| Primary Repository | ciphernet01/sentinelstack |
| Deployment Baseline | Existing Next.js + Express + Prisma/PostgreSQL application; current cloud deployment retained |
| Purpose of Revision | Reconcile the phase-generated target design with the actual codebase and define the concrete PS 26105 extension architecture |

> **Note:** Design position: SentinelStack is an existing deployed product. This revision does not introduce a greenfield replacement architecture. It defines the additive financial cyber-risk intelligence layer, the boundaries between existing functionality and new PS 26105 capabilities, and the engineering changes required to reach the documented target state.

**Figure 1. Reconciled current-to-target transition.**

## Revision and Reconciliation Note

SDD v1.1 remains the conceptual design baseline. SDD v1.2 is the implementation-facing reconciliation baseline created after inspection of the actual SentinelStack repository. The purpose is not to weaken the PS 26105 target; it is to make the architecture truthful about what already exists, what is partially implemented, and what must still be built.

| Area | SDD v1.1 position | v1.2 reconciliation |
| --- | --- | --- |
| Repository | Generic reference implementation boundaries | Use the existing SentinelStack repository as the baseline; preserve established auth, tenancy, scanning, assessment, reporting and deployment paths. |
| Risk engine | Distributional / statistical target | Current code is simplified deterministic v0.1; v1.2 defines a versioned Risk Engine v2 migration path without changing the authority boundary. |
| Database | Full logical PS 26105 model | Actual Prisma schema currently contains a narrower PS-26105 foundation; schema additions will be incremental and migration-safe. |
| ML | Calibrated likelihood / impact workloads | The repository does not yet prove a trained production model; v1.2 treats ML as an implementation track behind a stable inference contract. |
| Optimization | Constrained portfolio optimization | Current recommendation selector is greedy; v1.2 replaces it with an exact/declared optimization method with dependency and budget constraints. |
| Scenarios | State mutation + recomputation | Current presets rely on fixed EAL multipliers; v1.2 makes scenarios mutate explicit model inputs and rerun the same risk pipeline. |
| AI | Grounded, tool-scoped decision support | Existing AI report summarization remains valid but must be extended with a read-only verified-metrics tool boundary for risk NLQ. |
| Trust | Audit + optional ledger | Use application audit records + SHA-256 canonical hashes; blockchain remains an optional integrity/provenance anchoring adapter, not a calculation engine. |
| Deployment | Potential Python/FastAPI reference | Retain Express/TypeScript as the primary API in the existing product. Add Python only where the ML workload provides a measurable benefit. |

### Source baseline chain

| Artifact | Role | v1.2 treatment |
| --- | --- | --- |
| PS 26105 | Problem definition and named capabilities | Unchanged target |
| SRS v2.1 | Master functional/non-functional requirements | Master requirements baseline; no scope rewrite |
| SDD v1.1 | Conceptual architecture | Reconciled into v1.2 |
| Data Dictionary v1.0 | Target logical relational model | Reconcile against actual Prisma schema |
| Risk Model v1.0 | Mathematical contract | Implement as Risk Engine v2; preserve authority boundary |
| ML Spec v1.0 | Dataset/training/governance contract | Use as training/inference contract; implementation status explicitly staged |
| API Contract v1.0 | Target API surface | Map to current Express routes and add only required gaps |
| Implementation Architecture v1.0 | Free-first build plan | Superseded for implementation topology by this repository-specific baseline |
| Implementation Gap Analysis v1.0 | Repository-to-requirement gap map | Execution roadmap for code and documentation changes |

## 1. Design Objectives and Principles

The architecture SHALL implement the full SRS v2.1 scope while remaining compatible with the existing SentinelStack product. The central design problem is to turn heterogeneous cyber evidence into traceable financial risk and investment decision support without allowing any AI component to fabricate authoritative financial values.

### 1.1 Primary Objectives

- Continuously contextualize existing assessments, findings, vulnerabilities, telemetry, threat signals and business context into a point-in-time enterprise risk state.
- Produce authoritative Expected Annual Loss (EAL), Value at Risk (VaR), Financial Exposure and product Risk Score using a governed, reproducible risk engine.
- Introduce calibrated statistical/ML estimators only for uncertain inputs such as exploitation likelihood or loss-severity parameters.
- Quantify the financial effect of mitigation choices through what-if recomputation rather than fixed narrative claims.
- Optimize candidate security investment under explicit budgets, dependencies, applicability and modeled risk reduction.
- Preserve the existing deployed product surface and migrate PS 26105 functionality through additive, versioned changes.
- Provide evidence, provenance, auditability and optional tamper-evident ledger anchoring without putting raw sensitive data on-chain.
### 1.2 Non-Negotiable Principles

| Principle | Architectural rule |
| --- | --- |
| Calculation authority | Only the governed Risk Engine may publish authoritative EAL, VaR, Financial Exposure and Risk Score values. |
| Probabilistic honesty | Probabilities are calibrated/versioned; uncertainty or low coverage is surfaced rather than hidden. |
| Point-in-time correctness | Risk and ML inputs are scored from a declared observation timestamp and data version. |
| No double counting | Multiple alerts/vulnerabilities are not assumed to be separate financial incidents without an aggregation rule. |
| Scenario isolation | What-if scenarios mutate a copied analytical state and never modify the production baseline. |
| Human approval | Material risk acceptance and investment approval remain human decisions. |
| Backward compatibility | Existing assessment/report/security routes remain operational while new risk APIs are added or versioned. |
| Free-first implementation | Open-source, public-data, free-tier and current-stack options are preferred for the SIH reference build. |

## 2. System Context and Actors

| Actor | Primary interactions | Authority |
| --- | --- | --- |
| CISO / Security Leadership | Enterprise risk, trends, drivers, scenarios, investment options | Enterprise or assigned tenant scope |
| Risk Officer | Risk analysis, scenarios, evidence, governance | Enterprise / BU / assigned scope |
| Security / IT Team | Assets, vulnerabilities, controls, remediation | Technical assigned scope |
| Executive / Board Stakeholder | Financial exposure, budget, ROSI, strategic decision pack | Executive views; approval actions where permitted |
| Compliance / Governance | Framework mapping, evidence, reporting | Governance scope |
| Connector / Collector | Ingestion of external security and business data | Machine identity / connector scope |
| Risk / ML Worker | Feature computation, prediction, simulation, optimization | Service-to-service only |
| LLM Service | Grounded explanation and natural-language querying | Read-only tool-scoped context |

### System boundary

SentinelStack begins when source data enters through an integration, import, webhook, assessment result or controlled business-context input. It ends at risk, decision, reporting, compliance and audit outputs. It does not replace source security controls and it is not an ERP/accounting system.

**Figure 2. Reconciled logical architecture.**

## 3. Repository-Aware Architecture

The actual repository already contains the product foundation required to host the PS 26105 extension. The architecture therefore uses a modular-domain approach inside the existing application rather than forcing a distributed microservice rewrite.

### 3.1 Existing repository assets confirmed

| Existing asset | Observed role | v1.2 disposition |
| --- | --- | --- |
| src/server.ts | Express runtime, middleware, health/readiness, route mounting, worker loop | KEEP; add risk-worker observability and new routes without changing the security middleware contract. |
| src/routes/index.ts | Central API route mounting | EXTEND for new risk-intelligence domains while retaining /api/cyber-risk compatibility. |
| src/routes/cyber-risk.routes.ts | Existing enterprise risk + snapshot endpoints | MODIFY; add versioned/expanded risk, scenario, trend and optimization routes or a v2 route family. |
| src/controllers/cyber-risk.controller.ts | Current risk request handling | MODIFY; validate scoped inputs and return calculation-run metadata. |
| src/services/cyberRiskQuantification.service.ts | Current deterministic financial risk foundation | REFACTOR behind a domain façade; split pipeline into likelihood, severity, aggregation, attribution and optimization components. |
| src/services/riskScoring.service.ts | Existing Finding-severity score | KEEP for legacy assessment scoring; do not conflate it with enterprise financial Risk Score. |
| src/services/aiReport.service.ts | AI executive summary for assessments | KEEP; extend separately for verified financial-risk explanation. |
| src/ai/flows/* | Genkit business-language translation flows | EXTEND with read-only risk tool context; no direct risk-number generation. |
| src/hooks/use-cyber-risk.ts | React Query contract for current cyber-risk API | MODIFY for v2 response types, model metadata and confidence/provenance. |
| src/app/dashboard/risk-intelligence/page.tsx | Current risk intelligence page | MODIFY to expose trend, what-if and investment workflows. |
| src/components/dashboard/ExecutiveRiskOverview.tsx | Current financial risk dashboard components | MODIFY for distribution-aware VaR, score, driver attribution and investment curves. |
| prisma/schema.prisma | Operational database schema | EXTEND with versioned risk-run, attribution, model, evidence and optimization entities as required. |
| scripts/seed-cyber-risk-digital-twin.js | ACME Bank demo digital twin | EXTEND with point-in-time source provenance and scenario-ready context. |
| docs/SENTINELSTACK_26105_FOUNDATION.md | Earlier implementation note | UPDATE after v1.2 implementation to describe actual state. |

### 3.2 New domain boundary

The recommended source-code boundary is a risk-intelligence domain inside the current backend: a compatibility façade preserves the existing CyberRiskQuantificationService interface while delegating to smaller internal services. This keeps deployed consumers stable during migration.

> src/services/risk/
>   riskRun.service.ts
>   evidenceContext.service.ts
>   likelihood.service.ts
>   severity.service.ts
>   lossDistribution.service.ts
>   riskScore.service.ts
>   driverAttribution.service.ts
>   scenario.service.ts
>   mitigationValue.service.ts
>   optimizer.service.ts
>   provenance.service.ts
>   types.ts
> 
> src/services/cyberRiskQuantification.service.ts
>   -> compatibility façade / orchestration entry point

## 4. Component Design

| Component | Responsibility | Trust level | Primary persistence |
| --- | --- | --- | --- |
| Integration / adapters | Source registration, ingestion, parsing, normalization, idempotency | External input | Source metadata + normalized records |
| Digital Twin | Assets, services/business context, dependencies, controls, criticality | Operational context | Prisma relational models |
| Risk Engine | Frequency, severity, loss aggregation, EAL, VaR, financial exposure, score | Authoritative | Risk run + assessment records |
| ML subsystem | Likelihood/severity estimation, anomaly/trend support | Predictive input | Model + prediction records |
| Scenario Engine | Mutated state + recomputation + delta | Analytical | Scenario + scenario run records |
| Optimizer | Budget/dependency constrained portfolio selection | Decision support | Optimization run/results |
| AI Decision Support | NLQ, summarization, business-language translation | Read-only explanation | Conversation/audit metadata |
| Governance/Trust | Evidence, audit, hash, framework/report linkage | Integrity support | Evidence/audit records |
| Experience layer | Dashboards, charts, reports, drill-downs | Presentation | No independent risk truth |

## 5. Data Architecture Reconciliation

The phase-generated Data Dictionary defines a richer PS 26105 relational contract than the current Prisma schema. The current schema already contains BusinessUnit, CyberAsset, AssetDependency, SecurityControl, AssetControl, CyberVulnerability, SecurityTelemetry, ThreatIntelIndicator, RiskSnapshot and RiskScenario. The v1.2 architecture therefore treats the existing tables as a foundation and introduces missing logical entities incrementally rather than replacing the schema wholesale.

### 5.1 Current-to-target data mapping

| Target logical entity | Current repository state | v1.2 action |
| --- | --- | --- |
| Organization / BusinessUnit | Organization + BusinessUnit exist | KEEP / extend currency + time context if required. |
| Service | Service is currently represented mainly through CyberAsset.serviceName | INTRODUCE explicit service identity only when needed for dependency/impact correctness; preserve asset compatibility. |
| Asset | CyberAsset exists with business impact fields | KEEP; add temporal state/provenance where necessary. |
| Vulnerability | CyberVulnerability exists | EXTEND for KEV/source freshness/point-in-time attributes where supported. |
| Control / ControlState | SecurityControl + AssetControl exist | EXTEND into explicit temporal control state if required by auditability. |
| ThreatSignal | ThreatIntelIndicator exists | EXTEND source/provenance and relationships. |
| SecurityEvent | SecurityTelemetry exists | EXTEND normalized event identity/fingerprint and retention lineage. |
| FinancialParameter | Stored directly on CyberAsset and BusinessUnit | NORMALIZE into versioned financial parameter records while preserving compatibility fields. |
| RiskAssessment / RiskRun | RiskSnapshot exists | EXTEND with run ID, calculation/model/schema versions, confidence and distribution metadata. |
| RiskDriver | Currently embedded in JSON topDrivers | ADD normalized attribution records with evidence references. |
| Scenario | RiskScenario exists | EXTEND with baseline run/state hash, changes and scenario assessment. |
| InvestmentOption | Recommendations are ephemeral arrays | ADD persisted candidate option entities. |
| OptimizationRun / Result | Current optimizer output is ephemeral | ADD persisted run/result records. |
| Evidence / Audit | Generic AuditLog exists | ADD risk evidence + hash-linked audit model; keep generic audit log for application events. |
| ModelVersion / Prediction | Not yet represented as a full governed domain | ADD model registry/prediction records for production scoring. |

### 5.2 Data lineage invariant

A displayed financial-risk metric must be reconstructable to a calculation run, the point-in-time input state, model bundle, parameter bundle and evidence lineage retained by policy. Raw payloads may age out; their source identifier, collection metadata, content hash and lineage reference must remain sufficient to explain the surviving assessment record.

### 5.3 Currency and numeric conventions

| Field class | Rule |
| --- | --- |
| Money | Store exact currency and use fixed-precision database types for persisted monetary values. Avoid floating-point money in persistence. |
| Probability | Persist [0,1] numeric probability, never a formatted percentage string. |
| CVSS | Preserve source score 0-10. |
| Risk Score | 0-100 product index; versioned and not presented as a regulatory rating. |
| VaR | Declared percentile of annual aggregate loss distribution, with confidence and horizon metadata. |
| Assumptions | Explicit source_type and assumption flag; assumptions cannot silently masquerade as observed data. |

## 6. Ingestion and Normalization Design

The current repository has source-specific cybersecurity functionality but does not yet implement the full generic integration-source/data-lineage model described by the phase-generated data dictionary. v1.2 defines the normalized contract while allowing the SIH build to use a small set of practical adapters first.

| Source | Preferred MVP mechanism | Normalization target |
| --- | --- | --- |
| Vulnerability management | REST / scheduled export / CSV | Vulnerability + asset finding |
| SIEM / EDR | Webhook or batch JSON | Normalized security event |
| IAM | API snapshot + event export | Control state + security event |
| CSPM | API / JSON export | Cloud finding + control signal |
| Asset inventory | CSV/API | Canonical asset + service |
| Threat intelligence | STIX/TAXII or structured feed | Threat signal |
| Business context | Controlled UI/API entry | Financial parameter + criticality |

### Normalization rules

- Retain source-native identifiers and payload hashes.
- Normalize timestamps to UTC while retaining original timezone metadata.
- Map vendor severity to canonical semantics without discarding the source value.
- Deduplicate by source identity plus deterministic content fingerprint.
- Quarantine malformed or unresolved records; never silently drop data.
- Calculate freshness and coverage metrics that become risk-confidence metadata.
## 7. Cyber Risk Digital Twin

The Digital Twin is the contextual state graph expressed using relational structures in the current product. It connects assets to services/business units, dependencies, vulnerabilities, controls and threat signals, while keeping business-impact parameters explicit.

| Relationship | Purpose | v1.2 requirement |
| --- | --- | --- |
| Asset -> Service / BU | Map technical exposure to business meaning | Explicit service identity where aggregation would otherwise double-count. |
| Asset -> Vulnerability | Represent point-in-time exposure | Observation timestamps and patch state preserved. |
| Asset/Service -> Control | Represent protection state | Coverage and effectiveness normalized separately. |
| Threat -> Asset/Service | Connect external threat activity | Source and confidence preserved. |
| Service -> Dependency | Propagate business impact | Deterministic dependency allocation rule and version. |
| Financial parameter -> Service/BU/Org | Model business consequence | Versioned values with validity windows and provenance. |

### Criticality / dependency propagation

Shared services must not be multiplied into enterprise loss simply because several assets point to the same service. The engine SHALL use an explicit primary-service / dependency-allocation rule and record the rule version with every risk run.

### Control effectiveness

The current implementation averages coverage multiplied by effectiveness across controls. v1.2 retains this as a migration baseline but defines a versioned control-effectiveness function capable of handling control category, applicability, coverage, freshness and observed effectiveness once sufficient data exists.

## 8. Risk Quantification Engine v2

The current service is a useful foundation but is not yet the full mathematical implementation defined by Risk Model v1.0. In particular, the present VaR is a proxy, the optimizer is greedy, and scenario outcomes use fixed EAL multipliers. v1.2 therefore specifies the target Risk Engine v2 while keeping the current service available during migration.

**Figure 3. Target risk-quantification pipeline.**

### 8.1 Likelihood / probability

Primary predictive target: probability of a defined exploitation or incident event within a declared horizon H, conditional on point-in-time vulnerability, exposure, threat, control and asset context. The first implementation SHOULD use an interpretable probabilistic baseline, with a nonlinear challenger evaluated using temporal validation and calibration. The model version and feature schema hash are stored with each production prediction.

### 8.2 Annualized frequency

Where the probability p_H represents at least one event within H years, annualized frequency may be derived as lambda = -ln(1-p_H)/H for a Poisson-style interpretation. Alternative frequency models can be used when event-class data justifies them, but the chosen transformation must be explicit and versioned.

### 8.3 Severity / financial impact

Per-event loss SHALL be modeled as a distribution whenever the evidence supports distributional inference. The implementation combines deterministic business-impact components with empirical or fitted distributions. Candidate components are direct loss, downtime/business interruption, response/recovery, regulatory/legal exposure and other explicitly approved consequence categories.

### 8.4 Aggregate annual loss

For event class i with annual incident count N_i and severities L_i,j, aggregate loss is S = sum_i sum_j L_i,j after dependency/correlation handling. The engine SHALL avoid treating every vulnerability or telemetry event as a separate loss event.

### 8.5 Monte Carlo and VaR

For each simulation m: sample annual counts, sample event severities, apply event-class dependency/correlation rules, and sum losses into S^(m). EAL is the mean of S^(m); VaR_alpha is the empirical alpha-quantile of the annual aggregate loss distribution. Development runs may use fewer samples, but production-quality VaR estimation SHALL use a declared simulation count and uncertainty analysis. The phase-generated model baseline uses 50,000 simulations as a reference production minimum.

### 8.6 Financial Exposure

Financial Exposure is a reporting envelope for the selected scope and period. It is not interchangeable with EAL or VaR. The UI SHALL label the exact metric and horizon so executives can distinguish expected annualized loss from tail loss.

### 8.7 Product Risk Score

Risk Score remains a SentinelStack prioritization index in the range 0-100. It is separate from the existing scan-level finding severity score and must be versioned with a documented mapping from financial/probabilistic risk factors to the product index.

## 9. Risk Drivers and Explainability

The current dashboard calls asset rows “top financial risk drivers.” That is useful for navigation but does not satisfy the deeper attribution contract. v1.2 requires driver records that identify which factor changed the risk and why, tied to evidence and the calculation run.

| Driver family | Example contribution | Evidence linkage |
| --- | --- | --- |
| Exposure | Internet exposure / externally reachable service | Asset state + observed source |
| Likelihood | High EPSS, KEV, exploit availability | Vulnerability/threat records |
| Control gap | Low MFA/EDR/CSPM effectiveness | Control state + evidence |
| Business impact | High downtime cost / critical service dependency | Financial parameter + service relation |
| Threat context | Active threat signal relevant to CVE/sector | Threat intelligence record |
| Model effect | Feature contribution / prediction shift | Model prediction + attribution artifact |

Driver attribution SHALL distinguish causal evidence from model contribution. A model feature contribution explains the model output; it does not by itself prove that a real-world control failure caused an incident.

## 10. AI / ML Design

| Workload | Role in architecture | Current repository status | v1.2 target |
| --- | --- | --- | --- |
| Likelihood estimation | Estimate event probability used by risk engine | Deterministic heuristics currently used | Add calibrated model service + baseline fallback. |
| Severity estimation | Estimate loss distribution parameters where data supports it | Deterministic business-impact fields | Add empirical/statistical layer; ML conditioning optional. |
| Anomaly detection | Detect unusual patterns for analyst review | Existing log-whisperer subsystem exists but is separate | Integrate as an input signal, not as confirmed incident truth. |
| Trend prediction | Forecast directional risk changes | Not yet a governed risk workload | Add later behind explicit evaluation and versioning. |
| Recommendation ranking | Prioritize mitigation candidates | Greedy cost/risk ordering | Move deterministic portfolio selection to optimizer. |
| LLM/NLQ | Explain and query verified outputs | Existing Genkit report/business-language flows | Add read-only risk tools and structured grounding. |

### 10.1 Training data strategy

Public data and synthetic enterprise context remain explicitly separated. Public sources can provide vulnerabilities, exploitation signals, observed incidents and published loss observations; deployment-specific criticality, service dependency, control coverage and business-impact parameters come from the enterprise environment or labeled SIH synthetic data.

### 10.2 Leakage prevention and calibration

- Use point-in-time observations.
- Split train/validation/test by time rather than random only.
- Do not use future KEV status, future incident outcomes or post-event remediation in earlier feature rows.
- Evaluate PR-AUC, Brier/log loss and calibration, not accuracy alone.
- Store model version, feature schema, training dataset snapshot and calibration metadata.
### 10.3 LLM boundary

- LLM receives verified structured metrics and evidence references through approved tools.
- LLM does not calculate EAL, VaR, Risk Score or probability.
- LLM does not invent missing business-impact values.
- LLM answers inherit timestamp, scope and model context from the underlying tool response.
## 11. What-If Scenario Engine

The current scenario implementation uses preset EAL multipliers. That is acceptable as a UI placeholder but is not sufficient as the production analytical contract. v1.2 defines scenario execution as a deterministic state transformation followed by the same Risk Engine pipeline used for the baseline.

| Scenario phase | Required behavior |
| --- | --- |
| Baseline capture | Persist/identify baseline calculation run and input state hash. |
| State mutation | Apply declared changes: e.g., MFA coverage 70% -> 100%, patch critical CVEs, change segmentation state. |
| Recompute | Run likelihood, frequency, severity and loss aggregation with the same model bundle. |
| Compare | Return delta EAL, delta VaR, delta Risk Score, residual exposure and implementation cost. |
| Feasibility | Validate dependencies, applicability and conflicting changes. |
| Persistence | Store scenario input changes and result assessment separately from baseline. |

A scenario may be marked “limited confidence” when its state change affects model features for which the deployed model has insufficient support.

## 12. Investment Optimization Engine

The current optimizer selects recommendations greedily by estimated risk reduction per rupee. v1.2 promotes the optimization step into a governed portfolio problem. The simplest SIH implementation is a 0/1 integer or dynamic-programming model with explicit costs and dependencies; more complex interactions can be added when data supports them.

### Core contract

maximize total modeled risk reduction subject to total cost <= budget, option dependencies, applicability and any mandatory/exclusion constraints. The optimization run records the candidate set, objective, constraints, model bundle and resulting portfolio.

| Output | Definition |
| --- | --- |
| Spend | Sum of selected option costs |
| Risk reduction | Baseline modeled risk minus scenario/portfolio modeled risk, preferably recomputed for interaction effects |
| Residual risk | Baseline risk after selected portfolio |
| ROSI | (Modeled risk reduction - investment cost) / investment cost, with formula/version recorded |
| Cost-effectiveness | Risk reduction per unit cost, plus portfolio-level comparison where interactions exist |
| Investment curve | Repeat optimization across budget points and/or candidate sets to render risk-reduction vs budget |
| Decision | Human approval record referencing optimizer run, timestamp and evidence |

Non-quantifiable recommendations SHALL remain visible for governance but SHALL NOT be silently included in the optimization objective when no defensible monetary/risk-reduction estimate exists.

## 13. API and Integration Design

The v1.2 API strategy is additive. The existing /api/cyber-risk endpoints remain compatible while a versioned risk-intelligence contract is introduced for advanced capabilities.

| Current endpoint | v1.2 treatment | Purpose |
| --- | --- | --- |
| GET /api/cyber-risk/enterprise | KEEP + enrich response | Current enterprise view; add run/model/confidence metadata. |
| POST /api/cyber-risk/snapshots | KEEP | Persist a governed assessment snapshot; eventually delegate to Risk Engine v2. |
| POST /api/cyber-risk/scenarios | ADD or version | Execute isolated scenario mutation and recomputation. |
| GET /api/cyber-risk/trends | ADD | Historical EAL/VaR/score trend. |
| GET /api/cyber-risk/drivers | ADD | Stored risk attribution and evidence. |
| POST /api/cyber-risk/optimize | ADD | Run budget-constrained portfolio optimizer. |
| GET /api/cyber-risk/optimization/{id} | ADD | Retrieve reproducible optimizer result. |
| POST /api/ai/risk-query | ADD or extend existing AI route | Grounded NLQ over verified risk APIs. |
| GET /api/cyber-risk/evidence/{id} | ADD | Trace metric/driver/decision to retained evidence. |

### 13.1 Contract requirements

- Every protected request is scoped to authenticated organization membership.
- Heavy simulation/optimization/report work may return a job resource rather than block the request.
- Responses include calculation timestamp, scope, model bundle version and data-coverage status.
- Breaking contract changes use a new API major version; additive fields are preferred.
## 14. Experience and Dashboard Design

The existing Risk Intelligence page already exposes financial exposure, EAL, a VaR proxy, top asset rows, budget optimization and scenario cards. v1.2 evolves this page rather than replacing the existing visual language.

| View | v1.2 target |
| --- | --- |
| Executive summary | Financial Exposure, EAL, VaR 95/99, product Risk Score, control effectiveness, data confidence, last calculation time. |
| Risk drivers | Evidence-backed factor attribution with drill-down from enterprise -> BU -> service -> asset -> vulnerability/control. |
| Trend | EAL/VaR/score and major driver changes across retained snapshots. |
| Scenario | Editable state changes, recalculated metrics, uncertainty and delta. |
| Investment | Budget slider/input, candidate options, dependencies, optimized portfolio, residual risk and investment curve. |
| Business translation | Natural-language explanation grounded in the same returned metrics and evidence. |
| Governance | Model/version, assumptions, source coverage, evidence and audit details. |

The UI SHALL distinguish observed data, modeled estimates and assumptions visually and semantically. A number generated from an assumption must not look identical to a number backed by observed enterprise financial data.

## 15. Evidence, Auditability and Trust Layer

Trust is split into three different properties: data provenance, model reliability and historical decision integrity. Blockchain can support the third property, but cannot prove that a calculation is mathematically correct.

| Trust property | Mechanism | What it proves |
| --- | --- | --- |
| Data provenance | Source identifier, collection timestamp, payload hash, connector metadata | Where the input came from and whether the retained payload was altered. |
| Model reliability | Versioned artifact, calibration/evaluation metrics, drift monitoring | How the predictive model was evaluated and which version generated a prediction. |
| Decision integrity | Append-only audit + SHA-256 hash chain + optional ledger anchor | Whether historical decision records were changed after publication. |

### 15.1 Blockchain position

For the SIH Blockchain & Cybersecurity theme, v1.2 supports an optional ledger adapter. Only canonical hashes and minimal non-sensitive metadata are anchored. Raw telemetry, vulnerabilities, PII, financial records and ML computation remain off-chain. A ledger anchor is presented as evidence-integrity support, not as a trust shortcut for the risk model itself.

## 16. Security and Privacy Architecture

The current application already uses Express security middleware, Firebase authentication, organization roles, rate limiting, CORS allow-listing, request IDs, health/readiness checks and structured logging. The PS 26105 extension must inherit these controls rather than create a parallel security model.

| Control | v1.2 requirement |
| --- | --- |
| Tenant isolation | Every risk read/write resolves organization scope from authenticated context; admin impersonation is explicit and audited. |
| RBAC | OWNER/ADMIN/MEMBER permissions are applied to risk, snapshot, optimization and approval actions. |
| Input validation | Budget, scenario mutations, scope IDs and connector payloads validated server-side. |
| Secrets | Connector and model-provider secrets remain external to source data records. |
| Sensitive data | Raw telemetry and business financial data are not placed on-chain or exposed to the LLM without an approved tool scope. |
| Audit | Material risk/investment actions create append-oriented audit records. |
| Rate limiting | Heavy risk/AI endpoints use bounded request rates and job-based execution where required. |

## 17. Deployment and Infrastructure

**Figure 4. Reference deployment topology.**

### 17.1 Current-stack deployment rule

The reference implementation continues to use the existing Next.js frontend, Express/TypeScript backend, Prisma/PostgreSQL database and existing deployment environment. A Python service is introduced only for ML workloads that benefit from the Python ecosystem; otherwise the implementation stays inside the current TypeScript runtime.

### 17.2 Lean SIH deployment

| Layer | Baseline |
| --- | --- |
| Frontend | Existing Next.js + React + Tailwind + Recharts |
| API | Existing Express + TypeScript |
| Data | Existing PostgreSQL + Prisma |
| Jobs | Existing database-backed worker pattern; extend for risk runs |
| ML | Python scikit-learn / XGBoost optional service or offline training environment |
| Optimization | Exact DP/ILP implementation using an open-source library or well-tested dynamic programming for MVP |
| Trust | Existing audit logging + SHA-256; optional ledger adapter |
| Cloud | Current deployment retained; scale-out later via independent worker/API processes |

Resource-heavy components such as Kafka, OpenSearch, Neo4j and Kubernetes are not prerequisites for the SIH reference build. Interfaces may remain replaceable to support later enterprise scale.

## 18. Continuous Recalculation and Runtime Flow

The PS 26105 requirement is continuous/near-real-time visibility, not necessarily synchronous recomputation on every raw event. v1.2 uses materiality-based scheduling to prevent recalculation storms.

| Trigger | Action | Priority |
| --- | --- | --- |
| Newly exploited critical vulnerability | Recompute affected asset/service/BU/enterprise as configured | High |
| Material control effectiveness change | Recompute impacted scope | High |
| Relevant threat-intelligence change | Recompute affected scope | High / medium based on materiality |
| Service/dependency/criticality change | Recompute affected scope | High |
| Routine source refresh | Batch recomputation | Routine |
| Manual scenario | Isolated scenario run | On demand |
| Investment portfolio approval | Persist decision; optional post-change verification run | Governed |

### 18.1 Run identity

Each calculation receives a unique run identity with: organization scope, observation timestamp, input-state hash, model bundle version, parameter bundle version, code version, simulation configuration, data-coverage status and result hash. This becomes the primary key for downstream evidence and reproducibility.

## 19. Observability and Operations

| Area | Metrics / alerts |
| --- | --- |
| Ingestion | success/failure, lag, freshness, quarantine count, unresolved entities |
| Risk engine | run latency, failed runs, simulation count, stale assessments, calculation hash |
| ML | calibration error, drift, OOD rate, model-version distribution, prediction coverage |
| Scenario/optimizer | job latency, candidate count, infeasible runs, budget violations (must be zero) |
| API | p50/p95/p99 latency, errors, throughput |
| Data quality | missingness, duplicates, stale entities, lineage coverage |
| Trust | hash verification failures, anchor status, audit append failures |

Operational alerts must distinguish source-data failure from calculation failure. A stale risk assessment caused by a source outage should be visible as a coverage issue, not silently presented as current.

## 20. Failure Modes and No-False-Precision Rules

| Failure | System response |
| --- | --- |
| Source unavailable | Retry, mark stale, reduce coverage, preserve last valid assessment with timestamp. |
| Missing financial input | Use only approved assumption/range or mark metric limited-confidence. |
| ML unavailable | Use approved statistical/deterministic fallback where configured; record fallback. |
| OOD / drifted model state | Flag uncertainty and prevent false-precision outputs when essential. |
| Scenario infeasible | Return validation result; do not fabricate simulated metrics. |
| Optimizer infeasible | Return constraints conflict; do not return a pretend portfolio. |
| Hash mismatch | Create integrity incident and surface audit warning. |
| LLM unavailable | Core dashboard/risk APIs remain operational. |
| Database unavailable | Fail closed for writes; preserve service health semantics. |

No-false-precision rule: when material inputs are absent, stale or outside the supported model domain, SentinelStack must reduce confidence, provide a range where supported, or explicitly say the metric cannot be reliably computed. The dashboard must never populate a precise-looking number solely to avoid an empty state.

## 21. Testing and Verification Strategy

| Test level | Focus | Representative acceptance |
| --- | --- | --- |
| Unit | Pure risk, normalization, cost and dependency functions | Repeated deterministic calculation yields same result for same run inputs. |
| Integration | API + DB + domain services | Tenant-scoped risk run can be created, retrieved and reproduced. |
| Model | Temporal evaluation + calibration | Production candidate passes declared temporal and calibration gates. |
| Scenario | State mutation isolation | Baseline data remains unchanged; scenario result contains explicit delta. |
| Optimization | Budget/dependency/optimality | Selected cost <= budget; dependency rules enforced; deterministic objective evaluation. |
| Security | RBAC, tenant isolation, injection, secrets | Cross-tenant access blocked and material actions audited. |
| Performance | Risk runs and dashboards | Priority recomputation meets declared SLA under controlled test conditions. |
| E2E | Executive workflow | Enterprise risk -> driver -> scenario -> optimizer -> decision evidence. |

### 21.1 Key mathematical tests

- Probability bounds and calibration checks.
- Loss component reconciliation.
- Distribution sampling reproducibility under fixed seed.
- VaR percentile correctness and monotonicity across confidence levels.
- EAL convergence checks as simulation count increases.
- No double-counting under shared service dependencies.
- Scenario delta equals scenario result minus baseline under identical output definitions.
## 22. SRS-to-Design Traceability

| Requirement | v1.2 realization | Implementation status |
| --- | --- | --- |
| FR-01 / FR-02 | Integration adapters + canonical normalization + provenance | Partial foundation; ingestion model expansion required |
| FR-03 | Materiality-triggered risk-run orchestration | Design complete; runtime implementation required |
| FR-04 | Calibrated likelihood provider behind risk engine | Current heuristic baseline; ML implementation required |
| FR-05 | Distributional financial impact + optional ML conditioning | Current deterministic components; distributional layer required |
| FR-06 / FR-06A / FR-06B | Risk run + EAL/VaR + historical snapshots + versioned score | Foundation exists; risk-run versioning and genuine VaR required |
| FR-07 / FR-08 | Digital Twin criticality/dependency + control effectiveness | Foundation exists; formal temporal functions required |
| FR-09 | Normalized driver attribution with evidence | Current top-driver rows; attribution persistence required |
| FR-10 | Likelihood/anomaly/trend workloads | ML and predictive implementation required |
| FR-11 / FR-12 / FR-12A | Grounded recommendations + business translation + NLQ | AI foundation exists; verified-metric tool layer required |
| FR-13 | State mutation + recomputation | Current fixed multipliers; true state-driven recomputation required |
| FR-14 / FR-15 / FR-16 | Budget + candidate catalog + constrained optimizer | Budget UI/foundation exists; persisted candidates and exact optimizer required |
| FR-17 / FR-18 / FR-19 | ROSI + cost-benefit + investment curve | UI foundation exists; governed portfolio math required |
| FR-20 / FR-21 / FR-22 | Executive/technical dashboards + hierarchy drill-down | Partial implementation; v1.2 extends views |
| FR-23 / FR-24 | Framework mapping + evidence-based reporting | Existing compliance/reporting foundation; risk-evidence linkage required |
| NFR-01 / NFR-02 / NFR-06 | TLS, auth, RBAC, tenant isolation, data minimization | Existing security baseline; extend to risk domain |
| NFR-07 | API + adapter contracts | Existing API stack; v1.2 adds expanded contracts |
| NFR-08 | Audit + hash chain + optional ledger anchor | Audit foundation exists; risk evidence/hash implementation required |
| NFR-09 | Cloud-ready modular deployment | Existing cloud deployment retained; worker split remains scalable |
| NFR-10 | Configurable raw telemetry retention + lineage | Data model/design required; policy implementation required |

## 23. Implementation Sequence

| Phase | Work package | Primary repository targets | Exit evidence |
| --- | --- | --- | --- |
| P0 | Baseline + migration guardrails | Branching, migration plan, contract tests | No regression on existing product |
| P1 | Risk-run and lineage foundation | Prisma models + risk façade + hashes | Versioned run can be persisted/replayed |
| P2 | Risk Engine v2 | risk/* services + tests | Distributional EAL/VaR passes math tests |
| P3 | Driver attribution | risk drivers + evidence links | UI drivers trace to stored attribution |
| P4 | Scenario engine | scenario service + API + UI | Scenario is recomputed from explicit state |
| P5 | Investment optimizer | candidate catalog + optimizer + curve | Budget/dependency constraints enforced |
| P6 | ML likelihood baseline | dataset pipeline + model registry + inference | Temporal validation + calibration evidence |
| P7 | Grounded NLQ | AI tool boundary + risk query API | LLM outputs match verified backend values |
| P8 | Governance / trust / compliance | evidence/audit/ledger adapter/reporting | Decision chain is auditable |
| P9 | Hardening | performance, security, drift, operational alerts | Release gates passed |

Implementation rule: do not build downstream UI promises before the underlying risk calculation contract is authoritative. The dashboard may render the current v0.1 outputs during migration, but it must label them as such until Risk Engine v2 is promoted.

## 24. Documentation Change Control

| Document | Next revision | Change intent |
| --- | --- | --- |
| SRS v2.1 | Retain as requirements baseline | No functional scope expansion; only change if a requirement itself is intentionally amended. |
| SDD v1.2 | This document | Repository-aware architecture and implementation boundaries. |
| Data Dictionary v1.1 | Next | Reconcile logical schema with actual Prisma models and new risk-run entities. |
| Risk Model v1.1 | Next | Bind equations and parameter schemas to the actual implementation interfaces. |
| ML Spec v1.1 | Next | Bind training/inference contracts to the selected model-service boundary and current data availability. |
| API Contract v1.1 | Next | Map current Express routes + add missing risk/scenario/optimizer/NLQ endpoints. |
| Implementation Architecture v1.1 | Next | Replace generic repository/monorepo assumptions with actual SentinelStack file/module plan. |
| 26105 Foundation note | Post-implementation update | Record implemented state, not intended state. |

## 25. Design Assumptions and Deferred Decisions

- Enterprise financial-impact parameters will be partially customer-provided and may require explicit assumptions in the SIH demonstration.
- Public data will not be treated as a complete enterprise telemetry dataset; synthetic context remains labeled as synthetic.
- Exact ML algorithm promotion remains evidence-driven; no model is considered production-authoritative merely because it is more complex.
- The optimizer method may begin with an exact dynamic-programming solution for binary options and graduate to ILP when richer constraints require it.
- The current PostgreSQL schema remains the operational source of truth; a graph database is not required for the SIH baseline.
- Blockchain provider/network is deferred; SHA-256 hash anchoring and auditability are the mandatory design properties.
- Accounting-grade financial statements are out of scope; outputs are modeled cyber-risk decision support under explicit assumptions.
## 26. Definition of Done for SDD v1.2

| Check | Definition |
| --- | --- |
| Requirements | Every SRS v2.1 FR/NFR has a mapped design realization and verification path. |
| Repository alignment | Document references actual SentinelStack modules and identifies KEEP/MODIFY/ADD boundaries. |
| Risk authority | Authoritative EAL/VaR/Financial Exposure/Risk Score boundary is explicit. |
| Data lineage | Risk results can be linked to run, inputs, model/parameter versions and evidence. |
| Math | Distributional risk engine, VaR and scenario semantics are defined for implementation. |
| ML | Training/inference responsibilities, calibration and governance boundary are defined. |
| Optimization | Budget, dependencies, risk reduction, ROSI and investment curve contracts are defined. |
| AI | LLM is tool-scoped and cannot invent authoritative metrics. |
| Trust | Audit, hash integrity and optional ledger role are separated from model correctness. |
| Deployment | Reference design remains compatible with the current SentinelStack stack and SIH free-first constraint. |
| Implementation | Next changes are expressible as concrete repository modules/migrations without a greenfield rebuild. |

## Appendix A. Concrete File Change Map

| Priority | File / path | Action | Reason |
| --- | --- | --- | --- |
| P0 | prisma/schema.prisma | MODIFY | Add versioned risk-run, attribution, model, evidence and optimization persistence while preserving existing models. |
| P0 | src/services/cyberRiskQuantification.service.ts | REFACTOR | Compatibility façade over the new risk domain. |
| P0 | src/controllers/cyber-risk.controller.ts | MODIFY | Request validation, run metadata, new endpoints. |
| P0 | src/routes/cyber-risk.routes.ts | MODIFY | Version/extend risk APIs. |
| P0 | src/hooks/use-cyber-risk.ts | MODIFY | Typed v2 response and confidence metadata. |
| P0 | src/app/dashboard/risk-intelligence/page.tsx | MODIFY | Expose new risk/scenario/optimizer workflows incrementally. |
| P0 | src/components/dashboard/ExecutiveRiskOverview.tsx | MODIFY | Distribution-aware metrics and stored driver attribution. |
| P1 | src/services/risk/*.ts | NEW | Separate risk-engine responsibilities for testability and version control. |
| P1 | src/services/model/* or ML adapter | NEW | Model registry/inference boundary. |
| P1 | src/services/provenance/* | NEW | Canonical hashing and evidence linkage. |
| P1 | src/services/optimization/* | NEW | Exact constrained portfolio optimization. |
| P1 | src/services/scenario/* | NEW | State mutation + recomputation semantics. |
| P2 | src/routes/ai.routes.ts / AI risk tool handlers | MODIFY | Grounded financial-risk NLQ. |
| P2 | scripts/seed-cyber-risk-digital-twin.js | MODIFY | Point-in-time, provenance and scenario-aware demo data. |
| P2 | src/tests / test suites | NEW/MODIFY | Math, tenant, scenario, optimizer, grounding and regression coverage. |
| P3 | docs/SENTINELSTACK_26105_FOUNDATION.md | UPDATE | Reflect actual implemented state after migrations land. |

## Appendix B. Current Known Gaps at v1.2 Baseline

| Gap | Why it matters | Planned resolution |
| --- | --- | --- |
| VaR is a proxy in current code | Does not represent a declared loss-distribution percentile. | Implement aggregate loss simulation and empirical quantile. |
| Likelihood uses hand-tuned signals | Probability is not empirically calibrated. | Introduce baseline statistical model + temporal calibration. |
| Optimizer is greedy | Does not guarantee portfolio optimality under constraints. | Implement exact DP/ILP with declared objective/constraints. |
| Scenario uses fixed multipliers | Not a true what-if recomputation. | Mutate model inputs and rerun the engine. |
| Drivers are asset rows | Not stored factor attribution. | Persist risk_driver records + evidence. |
| Risk snapshots lack run/model metadata | Historical results may be hard to reproduce. | Add risk-run identity and model/parameter hashes. |
| AI summary is not risk-metric grounded | Could explain findings without verified financial context. | Add read-only risk tools and structured grounding. |
| Generic integration/provenance tables absent | Full source lineage contract not yet implemented. | Add incremental schema + adapters. |
| Blockchain not yet implemented | Theme-specific trust demonstration is incomplete. | Add optional hash-anchor adapter after core audit chain is stable. |

## Appendix C. Engineering Guardrails

- Never modify main directly for a major risk-engine migration; implement on a feature branch and validate before merge.
- Never replace a deployed API contract merely to fit a new internal module; prefer adapters and additive fields.
- Never let UI code compute authoritative EAL, VaR or optimization values.
- Never train on mixed synthetic/public/private data without provenance labels and dataset versioning.
- Never put raw security telemetry, PII or financial records on a blockchain.
- Never present an assumption as observed business data.
- Never promote a predictive model without temporal validation and probability calibration evidence.
### End of Software Design Document v1.2

This document is the repository-aware design baseline for implementing PS 26105 on the existing SentinelStack product. Subsequent changes should be reflected in the Data Dictionary, Risk Model, ML, API and Implementation documents through controlled versioned revisions.
