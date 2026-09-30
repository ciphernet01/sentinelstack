# SENTINELSTACK

# PS 26105 Implementation Gap Analysis

**Existing Codebase → Target Engineering Baseline**

SENTINELSTACK

PS 26105 Implementation Gap Analysis

Existing Codebase → Target Engineering Baseline

| Document Attribute | Value |
| --- | --- |
| Problem Statement | 26105 — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform |
| Document Version | 1.0 |
| Document Status | Engineering Gap Analysis Baseline |
| Audit Basis | Existing SentinelStack repository, default branch, current implementation state |
| Repository | github.com/ciphernet01/sentinelstack |
| Primary Runtime Baseline | Next.js + React frontend; Node.js + Express + TypeScript backend; Prisma + PostgreSQL |
| Purpose | Identify exact implementation deltas before revising the phased engineering documents or changing production code |

Prepared for implementation planning of SentinelStack as the PS 26105 solution.

## 1. Executive Summary

Finding: SentinelStack is not a greenfield implementation. The repository already contains a substantial PS 26105 foundation: business units, cyber assets, asset dependencies, security controls, telemetry, vulnerabilities, threat intelligence, risk snapshots, scenario persistence, a financial-risk service, a dedicated Risk Intelligence page, and an enterprise cyber-risk API.

| Critical reconciliation point<br>The existing financial-risk implementation is a useful foundation but is not yet equivalent to the approved mathematical/model baseline. The next engineering phase must harden the risk calculation rather than replace the platform. |
| --- |

Primary gaps are concentrated in five areas: true loss-distribution VaR/EAL modeling; calibrated ML estimation; evidence-level risk-driver attribution; state-based what-if/optimization; and provenance/governance persistence. Secondary gaps exist in source ingestion/normalization, continuous recalculation, enterprise risk scoring, regulatory evidence packaging, and API/UI coverage.

- Preserve existing scanner, assessment, auth, tenancy, reporting, compliance and dashboard capabilities.

- Keep the existing cyber-risk API/service as a compatibility surface, but refactor it behind a versioned financial-risk domain.

- Treat the current Prisma risk models as an implementation foundation, not as the final data contract; reconcile them with the phase-1 logical schema.

- Do not claim that ML, Monte Carlo VaR, true constrained optimization, or blockchain-backed tamper evidence are already implemented; they are target-state capabilities.

- Revise the phased documents only after this gap analysis establishes the mapping from current code to target state.

## 2. Audit Scope and Source Baselines

This gap analysis reconciles the approved planning artifacts against the repository implementation that was actually inspected. The purpose is implementation planning, not a redesign of the requirements.

| Artifact | Current role | Gap-analysis treatment |
| --- | --- | --- |
| SRS v2.1 | Master functional/non-functional requirement baseline | Remain authoritative; no broad scope rewrite |
| SDD v1.1 | Target architecture/design baseline | Revise to reflect actual repository boundaries and implementation maturity |
| Data Dictionary & DB Schema v1.0 | Logical persistence contract | Reconcile with actual Prisma models and migrations |
| Risk Quantification & Mathematical Model v1.0 | Analytical target state | Major implementation gap exists versus current risk service |
| ML Dataset & Training Spec v1.0 | ML/data governance baseline | Mostly retain; add implementation status and actual integration path |
| API & Integration Contract v1.0 | Logical/external service contract | Map against current Express routes; add missing routes incrementally |
| Implementation & Repository Architecture v1.0 | Planned implementation structure | Revise to explicitly extend existing SentinelStack repository |

| Source-of-truth rule<br>Requirements documents describe what SentinelStack must do. The repository audit describes what it does today. Where the two differ, this document records the delta rather than silently changing the requirement. |
| --- |

## 3. Current Repository Reality

The inspected repository is a production-oriented web application rather than a new monorepo scaffold. The root package contains backend/frontend build and start scripts, Prisma migrations, security checks, reporting, authentication, payment integrations, and an existing cyber-risk implementation.

| Area | Observed implementation | Assessment |
| --- | --- | --- |
| Application shell | Next.js/React frontend + Node/Express/TypeScript backend in one repository | Keep |
| Authentication / tenancy | Firebase auth, organization membership, organization-scoped routes | Keep and extend |
| Assessment/scanner platform | Assessment, Finding, Report, ScanJob, ScheduledScan and webhook models/routes | Keep |
| PS 26105 digital twin | BusinessUnit, CyberAsset, AssetDependency, SecurityControl, AssetControl, CyberVulnerability | Foundation present |
| Telemetry / threat data | SecurityTelemetry and ThreatIntelIndicator models; demo seeding exists | Foundation present; ingestion framework missing |
| Financial risk service | cyberRiskQuantification.service.ts calculates impact, likelihood, EAL, VaR proxy, scenarios and recommendations | Major refactor required |
| Risk persistence | RiskSnapshot and RiskScenario models | Foundation present; lineage/versioning insufficient |
| Risk API | GET /api/cyber-risk/enterprise and POST /api/cyber-risk/snapshots | Extend significantly |
| Risk UI | /dashboard/risk-intelligence plus ExecutiveRiskOverview and command-center integration | Keep visual layer; replace data contract progressively |
| AI layer | AI report summary / translation flows + AI chat route | Ground against verified risk outputs |
| Audit / tamper evidence | Existing generic AuditLog; no demonstrated hash-chain/blockchain implementation in PS risk path | Major gap |

## 4. Requirement-to-Code Gap Matrix

Status values: Implemented = materially covered in the inspected code; Partial = usable foundation but missing required semantics; Gap = target behavior not implemented; Foundation = supporting structure exists but the requirement is not operationally complete.

| Req | Requirement | Status | Current evidence | Target delta |
| --- | --- | --- | --- | --- |
| FR-01 | Multi-source security data ingestion | Partial | Telemetry/vulnerability/threat models exist, but no generic integration source/run/record layer was found. | Add connector registry, ingestion runs, canonical source records, quality gates. |
| FR-02 | Normalization / canonicalization | Gap | Inputs are written directly into PS risk-specific Prisma models; no canonical source-record pipeline was found. | Build source adapter → normalized evidence pipeline with source IDs and hashes. |
| FR-03 | Continuous / near-real-time risk visibility | Partial | Risk is recomputed on GET; telemetry window is runtime-filtered to 30 days. No event-triggered recalculation path was found. | Introduce material-change triggers/queue and calculation runs. |
| FR-04 | Incident likelihood estimation | Partial | Likelihood is computed from hand-tuned CVSS/EPSS/exploit/telemetry/control heuristics. | Add versioned calibrated probabilistic model with validation metadata. |
| FR-05 | Financial/business impact estimation using statistical/AI/ML | Partial | Deterministic asset cost fields exist; no statistical/ML severity model is implemented. | Add loss-severity model contract and optional ML estimator. |
| FR-06 | EAL / VaR / financial exposure | Partial | EAL is impact × annual likelihood; financial exposure sums asset impact; VaR is a proxy multiplier, not a loss-distribution quantile. | Implement event-frequency/severity distributions + Monte Carlo + true percentile VaR. |
| FR-06A | Historical trend visibility | Partial | RiskSnapshot stores snapshots and is indexed by time; no dedicated trend endpoint/UI contract was found in current cyber-risk routes. | Add trends API, aggregation and charts. |
| FR-06B | Continuous enterprise/BU/asset Risk Score | Gap | Existing Assessment riskScore is a finding-severity score; PS risk service returns no enterprise Risk Score. | Create separate versioned product Risk Score domain. |
| FR-07 | Asset criticality / service dependency | Partial | CyberAsset and AssetDependency models exist, but current risk calculation does not traverse dependency relationships. | Implement dependency propagation and anti-double-counting allocation. |
| FR-08 | Control effectiveness | Partial | Coverage × effectiveness is calculated and used to adjust likelihood. | Version the control model and connect controls to scenario state changes. |
| FR-09 | Risk drivers | Partial | Top drivers are asset-level rows sorted by EAL; stored contribution attribution/evidence is absent. | Persist driver attribution at feature/evidence level. |
| FR-10 | Predictive AI/ML analytics | Gap | No trained production risk prediction model was found in the audited risk path. | Implement dataset pipeline, baseline model, calibration, model registry, inference contract. |
| FR-11 | AI mitigation recommendations | Partial | Hardcoded rules produce patching/MFA/segmentation recommendations and fixed cost/reduction percentages. | Generate recommendations from modeled control state and quantified delta. |
| FR-12 | Natural-language interface | Partial | AI routes/flows exist, but the PS risk path is not yet demonstrably grounded in typed risk results. | Add risk query planner/tool contract with metric IDs and evidence refs. |
| FR-12A | Technical-to-business bridge | Partial | Existing AI report/translation flows explain technical findings. | Ground explanations in financial-risk outputs, drivers and business context. |
| FR-13 | What-if scenario analysis | Partial | Scenario presets exist, but they apply fixed EAL multipliers rather than rerunning a mutated model state. | Implement isolated scenario state + full recalculation + delta. |
| FR-14 | Budget definition | Implemented | Budget is accepted by current enterprise-risk API/UI. | Retain; version in optimization run. |
| FR-15 | Candidate investments / dependencies | Partial | Recommendations are generated in memory; no persisted investment catalog or dependency model is used by the optimizer. | Persist option definitions, dependencies and eligibility. |
| FR-16 | Budget-constrained optimization | Partial | Greedy ratio-based selector respects budget but does not solve dependency/interactions exactly. | Replace with exact constrained portfolio optimizer where required. |
| FR-17 | ROSI | Partial | ROSI is calculated for current recommendation portfolio and scenarios. | Base it on authoritative scenario delta, cost model and run metadata. |
| FR-18 | Strategic / board investment review | Partial | Risk Intelligence dashboard surfaces financial metrics; board-pack workflow/evidence bundle not present. | Add strategic comparison views and exportable decision pack. |
| FR-19 | Investment-vs-risk-reduction curve | Gap | No current curve/efficient-frontier implementation found in risk UI/service. | Add budget sweep or Pareto frontier service and chart. |
| FR-20 | Executive dashboard | Partial | ExecutiveRiskOverview/command-center presents financial exposure, EAL, VaR proxy, drivers and optimization. | Replace proxy metrics with governed contract; add uncertainty/provenance. |
| FR-21 | Technical dashboard | Partial | General SentinelStack dashboards exist; PS risk technical drill-down is limited. | Add technical risk evidence and control-state views. |
| FR-22 | Drill-down | Partial | Risk driver cards expose asset/vulnerability counts but not complete evidence lineage. | Add driver → evidence → source record → calculation chain. |
| FR-23 | Framework mapping | Partial | SecurityControl includes ISO/NIST/CIS/RBI/SEBI fields and existing compliance modules exist. | Integrate mapping/evidence with financial-risk decisions. |
| FR-24 | Evidence-based reporting / regulatory filings | Partial | Report/PDF capabilities exist, but PS-specific evidence package and filing support are not demonstrated. | Create risk decision report package with evidence refs and framework status. |

| Req | Requirement | Status | Current evidence | Target delta |
| --- | --- | --- | --- | --- |
| NFR-01 | Security / access control | Partial | Firebase auth, RBAC and org roles exist. | Extend to new APIs/data domains; validate tenant boundaries. |
| NFR-02 | Privacy / data protection | Partial | Tenant scoping and security middleware exist; raw telemetry lifecycle is not implemented. | Define data classes, minimization and sensitive-field handling. |
| NFR-03A | Continuous risk latency | Gap | Current GET computes synchronously; no governed freshness/SLA pipeline. | Add incremental recalculation + queue + freshness metadata. |
| NFR-04 | Performance / scalability | Partial | Existing backend/DB architecture is suitable for incremental extension. | Benchmark Monte Carlo and large-tenant aggregation; cache/version results. |
| NFR-05 | Explainability | Partial | AI summaries and top driver display exist. | Persist model/feature attribution and calculation explanation. |
| NFR-06 | Tenant isolation / governance | Partial | Organization-scoped models/routes are present. | Add explicit org_id enforcement to every new persistence/API path. |
| NFR-07 | Interoperability | Partial | Public API/webhook infrastructure exists. | Add canonical connectors and documented ingestion contracts. |
| NFR-08 | Auditability / tamper evidence | Gap | Generic AuditLog exists; no PS risk hash chain / blockchain anchor path found. | Add append-only risk decision ledger, content hashes and optional blockchain anchor. |
| NFR-09 | Cloud readiness | Partial | Render-compatible Node/Next/Postgres application and Docker tooling exist. | Keep provider-neutral; isolate optional Python ML service. |
| NFR-10 | Raw telemetry retention + lineage | Gap | No source-record retention class/lineage store in actual Prisma risk schema. | Implement retention metadata, raw payload storage policy and source hash lineage. |

## 5. Target Integration Architecture

The implementation should extend the existing application with a modular financial-risk domain. A second application stack is not required at this stage.

| Layer | Existing SentinelStack | Target PS 26105 extension |
| --- | --- | --- |
| Source adapters | Scanners, public API, webhooks and existing telemetry models | Integration registry + connector adapters for VMS/SIEM/IAM/EDR/CSPM/asset/TI/business data |
| Evidence / normalization | Risk-specific Prisma rows and seeded demo data | Canonical source records, ingestion runs, normalized observations, quality gates, provenance hashes |
| Digital twin | BusinessUnit, CyberAsset, AssetDependency, SecurityControl, AssetControl | Add service-level abstractions where needed; use dependency graph in risk propagation |
| Likelihood | Hand-tuned heuristic | Versioned probabilistic model + calibration + uncertainty |
| Impact / severity | Deterministic asset cost components | Severity distributions / empirical loss models + business parameter registry |
| Risk engine | EAL + VaR proxy + financial exposure | Aggregate loss distribution + Monte Carlo + EAL/VaR/score + uncertainty |
| Drivers | Asset-level EAL sorting | Feature/evidence attribution with stored contribution records |
| Scenarios | Fixed multipliers | Scenario state mutations → full pipeline rerun → delta |
| Optimization | Greedy ratio selection | Exact budget/dependency optimizer + portfolio interactions |
| AI | Genkit report translation/chat | Grounded risk tool layer; LLM explanation only |
| Governance | AuditLog | Risk calculation versioning + decision ledger + hashes + evidence bundle |
| Blockchain theme | Not present in risk path | Optional permissioned/testnet anchor of hashes; database remains operational truth |

## 6. File-by-File Modification Plan

| Path | Action | Exact change | Timing |
| --- | --- | --- | --- |
| prisma/schema.prisma | MODIFY | Preserve existing models; add run/version/provenance, calculation inputs, drivers, investment options, optimization runs/results, evidence/decision ledger, retention metadata. | Phase 1 data foundation |
| prisma/migrations/* | NEW | Create additive migrations only; never edit applied migrations. | Phase 1 |
| src/services/cyberRiskQuantification.service.ts | REFACTOR | Turn current service into compatibility façade over new risk domain. Remove fixed VaR proxy, hardcoded multipliers and greedy-only optimizer from authoritative path. | Phase 2 risk engine |
| src/services/risk/* | NEW | Financial risk domain: evidence adapter, likelihood, frequency, severity, Monte Carlo, score, attribution, scenario, optimizer, governance. | Phase 2-4 |
| src/controllers/cyber-risk.controller.ts | MODIFY | Add calculation-run metadata, freshness, model bundle, scenario/optimization endpoints and validation. | Phase 2-4 |
| src/routes/cyber-risk.routes.ts | MODIFY | Extend beyond enterprise/snapshots to trends, scenarios, recommendations, optimization, evidence and governance. | Phase 2-5 |
| src/routes/index.ts | KEEP | Current /cyber-risk mounting is correct. | No major change |
| src/hooks/use-cyber-risk.ts | MODIFY | Version new response types; add query hooks for trends, scenarios, optimization and evidence. | Phase 2-5 |
| src/app/dashboard/risk-intelligence/page.tsx | MODIFY | Use governed risk API, show freshness/model/version/uncertainty; add scenario + optimizer workflows. | Phase 2-5 |
| src/components/dashboard/ExecutiveRiskOverview.tsx | MODIFY | Replace VaR proxy language, add proper risk score, distributions, driver attribution, investment curve and board-ready outputs. | Phase 2-5 |
| src/services/aiReport.service.ts | MODIFY | Use verified risk context rather than raw findings alone for PS 26105 decision support. | Phase 5 |
| src/ai/flows/translate-technical-risk-to-business-language.ts | MODIFY | Ground explanations in structured risk results and evidence refs. | Phase 5 |
| src/services/riskScoring.service.ts | KEEP / CLARIFY | Retain legacy assessment severity score; do not reuse as enterprise financial Risk Score. | Documentation + type naming |
| scripts/seed-cyber-risk-digital-twin.js | MODIFY | Generate seed data for distributions, model assumptions, investments, scenario state and evidence provenance. | Phase 1-4 |
| docs/SENTINELSTACK_26105_FOUNDATION.md | UPDATE | Mark current foundation as superseded/absorbed into the full PS implementation plan. | Documentation |

## 7. Risk Engine: Current vs Required Mathematical Behavior

| Dimension | Current implementation | Required implementation |
| --- | --- | --- |
| Likelihood | Heuristic sum of CVSS/EPSS/exploit/age + telemetry, multiplied by exposure/criticality and control effectiveness. | Calibrated probability model with point-in-time features, declared horizon, annualization rule, uncertainty/OOD metadata. |
| Frequency | Implicit annual likelihood only. | Explicit event frequency/rate model feeding annual incident counts. |
| Severity | Single modeled impact number from asset cost fields. | Severity distribution or empirical loss model by incident/event class. |
| Aggregation | Sum asset-level expected losses. | Aggregate incidents by event class and dependency rules; prevent correlated-source double counting. |
| EAL | Impact × annual likelihood. | Mean of simulated annual aggregate loss distribution. |
| VaR | Impact × clamp(likelihood × 2.2). | Declared percentile of annual loss distribution (for example 95%/99%). |
| Risk Score | No PS enterprise score in risk response. | Versioned 0–100 product index decomposable into declared components. |
| Drivers | Top assets by EAL. | Feature/evidence attribution that explains change in risk and links to evidence. |
| Scenario | Fixed multiplier on baseline EAL. | Mutate control/asset state and rerun same model pipeline. |
| Optimization | Greedy risk-reduction/cost ratio. | Portfolio optimization with budget, dependencies, eligibility and interactions. |

| No-false-precision gate<br>A calculation may be returned with uncertainty, low coverage or unavailable metrics. The UI must not fabricate a precise EAL/VaR value merely to fill a card. |
| --- |

## 8. ML / AI Integration Gap

| Workload | Current state | Implementation step |
| --- | --- | --- |
| Likelihood prediction | No production trained model in the audited risk path. | Build point-in-time dataset, transparent baseline, tree model candidate, calibration and temporal evaluation. |
| Severity estimation | No statistical/ML severity model in code. | Start with empirical distribution / robust parametric baseline; add ML only when validated. |
| Anomaly detection | Existing log-whisperer subsystem has anomaly functionality, but it is not integrated into PS 26105 risk scoring. | Add adapter that treats anomaly as evidence/signal, not confirmed incident. |
| Trend prediction | No PS risk forecast path demonstrated. | Add time-series feature generation and holdout evaluation after historical snapshots exist. |
| LLM / NLQ | Genkit flows exist; current report summary uses raw findings. | Introduce tool-grounded NLQ: retrieve typed backend metrics first, then generate explanation. |
| Model governance | Documented in ML spec; runtime registry not present in audited risk service. | Persist model versions, metrics, schema hash, calibration artifact and promotion state. |

## 9. Database Reconciliation Plan

The phase-1 logical schema is more mature than the current Prisma risk schema in provenance/governance detail. The current schema should be extended additively so existing live functionality remains intact.

| Logical domain from v1.0 data contract | Observed current Prisma support | Reconciliation |
| --- | --- | --- |
| Integration sources / ingestion runs / source records | Not found in audited Prisma risk models. | NEW domain. |
| Canonical vulnerabilities / asset findings | CyberVulnerability combines catalog + asset-level observation. | Split catalog vs asset finding semantics where needed; preserve current model during migration. |
| Risk assessments / calculation runs | RiskSnapshot stores a result snapshot. | Add calculation-run identity/version and richer assessment metadata. |
| Risk drivers / attribution | topDrivers JSON on RiskSnapshot. | Add normalized risk-driver rows with evidence links. |
| Model versions / predictions | Not present in audited Prisma schema. | NEW domain. |
| Scenarios / scenario changes | RiskScenario exists with modeledChanges JSON. | Add explicit scenario state/change rows and baseline linkage. |
| Investment options / optimization runs/results | Current recommendations are in-memory only. | NEW persisted domains. |
| Evidence / evidence links | Generic report/assessment evidence exists, but no PS-specific evidence model in audited risk schema. | NEW/reconcile with existing reporting evidence. |
| Audit events / hash chain | Generic AuditLog exists. | Add PS risk decision ledger and hash chain; avoid breaking auth audit. |
| Retention / source lineage | Not present in audited risk schema. | Add retention class, source hash, payload reference and lifecycle fields. |

## 10. API Gap

The current PS risk route surface is intentionally small. That is acceptable as a foundation, but it does not yet implement the full API contract generated during the document phase.

| API capability | Current route evidence | Gap / next route family |
| --- | --- | --- |
| Enterprise current risk | GET /api/cyber-risk/enterprise | Keep, change response contract to governed calculation result. |
| Persist snapshot | POST /api/cyber-risk/snapshots | Keep, link to calculation run and model bundle. |
| Scenario simulation | Service method exists; route not found in current cyber-risk route file. | Add POST scenario simulation + optional persistence. |
| Risk trends | RiskSnapshot persisted, but no cyber-risk trend route in current route file. | Add GET trends. |
| Recommendations | Currently embedded in enterprise response. | Add typed recommendation endpoint when UI workflows need independent refresh. |
| Optimization | Currently embedded in enterprise response. | Add POST optimization run and GET result. |
| Evidence / governance | No PS-specific route found. | Add calculation/evidence/audit decision endpoints. |
| NLQ | Generic /api/ai/chat exists. | Add risk-grounded tool contract rather than a free-form risk answer path. |

## 11. Frontend Gap

| Current UI component | What it already does | Required evolution |
| --- | --- | --- |
| /dashboard/risk-intelligence | Budget, refresh, save snapshot, executive risk overview. | Add risk score, proper VaR, freshness, confidence, calculation version, scenario editor and optimizer run. |
| ExecutiveRiskOverview | Exposure, EAL, VaR proxy, controls, asset drivers, optimization, scenario cards. | Replace asset-as-driver shorthand with actual driver attribution; add loss distribution and budget curve. |
| DashboardCommandCenter | Integrates financial-risk presentation into command-center design. | Keep presentation layer; bind to governed response and uncertainty/provenance fields. |
| use-cyber-risk hook | Typed response for current service. | Version response and split hooks by capability. |

## 12. Governance, Provenance and Blockchain Position

- Database remains the operational source of truth for risk calculations, model inputs and decisions.

- Every authoritative calculation should have a calculation_run_id, model_bundle_version, parameter/assumption version, input evidence references, timestamp and calculation hash.

- Risk-driver records should reference both the calculation result and the evidence supporting the driver.

- Decision records should capture the selected investment portfolio, budget, optimizer run, approver, timestamp and evidence.

- A permissioned blockchain or testnet can anchor hashes of canonical risk decisions for tamper evidence. Raw telemetry, PII, financial payloads and model computation should remain off-chain.

- Blockchain anchoring proves historical record integrity/provenance; it does not prove that the risk model itself is statistically correct.

## 13. Implementation Priority Order

| Phase | Workstream | Outcome | Exit condition |
| --- | --- | --- | --- |
| P0 | Baseline lock | Create feature branch; preserve production behavior; freeze current response contract for compatibility. | Current production routes still pass smoke tests. |
| P1 | Data reconciliation | Add calculation runs, model/parameter versioning, provenance/evidence foundations and investment/scenario persistence. | Schema migration + seed + tenant tests pass. |
| P2 | Risk math | Implement frequency/severity distributions, Monte Carlo, EAL, genuine VaR and enterprise Risk Score. | Numerical tests + reproducibility + validation fixtures pass. |
| P3 | ML | Train baseline likelihood model, calibrate, register model and wire inference into risk engine. | Temporal test + calibration acceptance criteria pass. |
| P4 | Scenarios + optimizer | Replace fixed multipliers and greedy selection with state mutation + constrained optimization. | Budget/dependency/scenario delta tests pass. |
| P5 | AI + governance | Ground NLQ, business translation, risk decision ledger, hashes and optional blockchain anchor. | All numeric AI responses trace to backend metrics/evidence. |
| P6 | Dashboards + reporting | Executive/technical/board views, trend/curve views, compliance evidence package. | E2E acceptance against SRS use cases. |

## 14. Documentation Revision Impact

| Document | Revision | Reason | Specific sections to change |
| --- | --- | --- | --- |
| SRS | v2.1 retained initially | Requirements are still the master scope. | Add implementation status appendix only if useful; do not loosen FRs. |
| SDD | v1.2 | Align architecture to actual Node/Express/Next/Prisma repository and modular extension strategy. | Architecture overview; component boundaries; deployment; implementation sequence; current-vs-target state. |
| Data Dictionary / DB | v1.1 | Reconcile logical 37-table contract with actual Prisma models/migrations. | Entity mapping; migration strategy; exact current vs target tables. |
| Risk Model | v1.1 | Turn analytical baseline into code-level implementation contract and testable parameter definitions. | Implementation interfaces; persistence mapping; numerical acceptance tests. |
| ML Spec | v1.1 | Add runtime integration path and current maturity status. | Deployment/inference; model registry mapping; current baseline. |
| API Contract | v1.1 | Map logical contract to real Express route surface and compatibility strategy. | Surface map; current endpoint mapping; versioning. |
| Implementation Architecture | v1.1 | Correct greenfield/monorepo assumptions; define extension of existing SentinelStack. | Repository structure; module boundaries; development sequence. |

## 15. Definition of Done for the Gap-Closure Program

- No existing SentinelStack authentication, assessment, scanner, report, compliance or billing flows are broken by the PS 26105 work.

- Every authoritative EAL/VaR/Risk Score output is reproducible from an explicit calculation run and versioned inputs.

- VaR is computed from an annual loss distribution rather than a fixed multiplier proxy.

- Risk scenarios execute as isolated state mutations and return comparable deltas without modifying the baseline.

- Optimization respects budget and modeled dependencies; selected portfolios are persisted and reproducible.

- ML likelihood outputs are calibrated, temporally evaluated and versioned; unsupported/OOD states are visible.

- Risk drivers have stored contribution evidence rather than merely being a list of high-EAL assets.

- AI/NLQ responses reference verified backend metrics; the LLM does not author authoritative risk numbers.

- Risk decision history is auditable and tamper-evident, with hash anchoring available for the Blockchain & Cybersecurity theme.

- Raw telemetry can be aged out while lineage and hashes remain sufficient to explain retained risk decisions.

## Appendix A. Audit Evidence and Source References

| Source | Path / Reference | Use |
| --- | --- | --- |
| Repository | https://github.com/ciphernet01/sentinelstack | Inspected current SentinelStack codebase. |
| PS 26105 foundation | docs/SENTINELSTACK_26105_FOUNDATION.md | Existing cyber-risk foundation, seed and route intent. |
| Current risk engine | src/services/cyberRiskQuantification.service.ts | Current heuristic likelihood, EAL/VaR proxy, fixed scenarios and greedy optimization. |
| Current Prisma schema | prisma/schema.prisma | Current digital-twin, risk snapshot and scenario models. |
| Current risk routes | src/routes/cyber-risk.routes.ts | Current enterprise and snapshot route surface. |
| Current risk controller | src/controllers/cyber-risk.controller.ts | Current budget parsing and response behavior. |
| Current risk hook | src/hooks/use-cyber-risk.ts | Current frontend contract. |
| Current risk page | src/app/dashboard/risk-intelligence/page.tsx | Current UI workflow. |
| Current executive view | src/components/dashboard/ExecutiveRiskOverview.tsx | Current risk visualization and wording. |
| Requirements baseline | SentinelStack_SRS_v2.1_FINAL | FR/NFR target requirements. |
| Design baseline | SentinelStack_SDD_v1.1_FINAL | Target architecture/design baseline. |
| Data contract | SentinelStack_Data_Dictionary_and_Database_Schema_v1.0_FINAL | Logical data contract and traceability. |
| Math baseline | SentinelStack_Risk_Quantification_and_Mathematical_Model_Specification_v1.0_FINAL | Loss distribution, EAL, VaR, scenario and optimization semantics. |
| ML baseline | SentinelStack_ML_Dataset_and_Training_Specification_v1.0_FINAL | Dataset, leakage, calibration and governance semantics. |
| API baseline | SentinelStack_API_and_Integration_Contract_Specification_v1.0_FINAL | Logical endpoint contract. |
| Implementation baseline | SentinelStack_Implementation_and_Repository_Architecture_Specification_v1.0_FINAL | Free-first implementation plan that now requires reconciliation with actual repo. |

## Appendix B. Change-Control Rule

This gap analysis should be treated as the checkpoint between the documentation phase and implementation. The next revisions of SDD, data dictionary, mathematical model, ML specification, API contract and implementation architecture should reference this document, record only evidence-backed changes, and preserve the SRS as the master requirements baseline.
