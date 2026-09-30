SentinelStack | SDD v1.1 | PS 26105 

# **SentinelStack** 

## **Software Design Document** 

AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform 

|**Field**|**Value**|
|---|---|
|Problem Statement|26105|
|Organization|All India Council for Technical Education (Cyber Security<br>Cell)|
|Document Version|1.1 - Final Gap-Checked Design Baseline|
|Document Status|Final Design Baseline - PS 26105 / SRS v2.1 Aligned|
|Based On|SentinelStack SRS v2.1 — Final Gap-Closed Baseline|
|Design Scope|Reference implementation for SIH 2026 / enterprise-ready<br>architecture|



**Design intent:** This document translates the approved SRS into an implementable architecture, data model, analytical pipeline, API boundary, security model, deployment model, and test strategy. Specific technologies are selected as reference implementation choices and can be replaced without changing the functional contract. 

Software Design Document - Final Design Baseline | Page 1 

SentinelStack | SDD v1.1 | PS 26105 

### **Contents** 

1. Design Objectives and Principles 

2. System Context and Actors 

3. Architecture Overview 

4. Component Design 

5. Data Architecture 

6. Ingestion and Normalization Design 

7. Cyber Risk Digital Twin 

8. Risk Quantification Engine 

9. AI/ML Design 

10. AI Decision Support and LLM Boundary 

#### **10.5 Recommendation Prioritization** 

11. What-If Scenario Engine 

12. Investment Optimization Engine 

13. Dashboards, Reporting and Compliance 

#### **13.6 Executive and Board Decision Pack** 

14. Evidence, Auditability and Trust Layer 

15. API and Integration Design 

16. Security and Privacy Architecture 

17. Deployment and Infrastructure 

#### **17.4 Reference Cloud Target** 

18. Scalability, Performance and Resilience 

19. Observability and Operations 

20. Data Quality, Model Governance and Validation 

21. Failure Modes and Recovery 

22. Testing and Verification Strategy 

23. SRS-to-Design Traceability 

24. Technology Selection and Trade-offs 

25. Implementation Sequence 

26. Design Assumptions and Deferred Decisions 

27. Definition of Done for Design Baseline 

Software Design Document - Final Design Baseline | Page 2 

SentinelStack | SDD v1.1 | PS 26105 

### **1. Design Objectives and Principles** 

The design SHALL implement the full SentinelStack SRS v2.1 final baseline and preserve clear boundaries between deterministic risk calculation, statistical/ML estimation, language-model explanation, and optimization. The design is intentionally traceable to PS 26105 rather than being a generic cybersecurity platform. 

#### **1.1 Primary Design Objectives** 

- Continuously transform heterogeneous security evidence into current risk estimates. 

- Connect technical findings to business assets, services, controls, and financial impact. 

- Produce model-derived EAL, VaR, Financial Exposure and Risk Score outputs with assumptions and evidence. 

- Provide scenario simulation that changes modeled state and recomputes risk rather than inventing an answer. 

- Optimize remediation/control investment under explicit budget constraints. 

- Provide grounded AI interaction without allowing the LLM to author authoritative risk numbers. 

- Preserve traceability from source evidence to risk assessment, recommendation and investment decision. 

- Be cloud-ready and support SaaS, private or hybrid deployment patterns. 

#### **1.2 Design Principles** 

- Single source of truth for calculations: the risk engine owns authoritative risk metrics. 

- Bring computation to sensitive data when required; minimize movement of raw telemetry. 

- Explainability by construction: every material result has drivers, assumptions and source lineage. 

- Point-in-time correctness: training and scoring pipelines avoid temporal leakage. 

- Fail closed on missing critical data: uncertainty and coverage are surfaced instead of false precision. 

- Composable integrations: SentinelStack complements existing SIEM/EDR/VMS/IAM/CSPM products. 

- API-first and tenant-aware design: all core capabilities are accessible through controlled service boundaries. 

### **2. System Context and Actors** 

#### **2.1 Actors** 

|**Actor**|**Primary interactions**|**Authorization scope**|
|---|---|---|
|CISO / Security Leadership|Risk, trends, risk drivers, scenarios,<br>investment options|Enterprise / assigned tenants|
|Risk Officer|Risk analysis, scenarios, governance<br>evidence|Enterprise / business units|
|Security / IT Team|Assets, vulnerabilities, controls,<br>remediation|Assigned technical scope|
|Executive / Board Stakeholder|Financial exposure, budget, ROSI, decision<br>summaries|Executive views / approvals|
|Compliance / Governance|Framework mapping,evidence,reporting|Governance scope<br>i|
|Connector / Collector|Ingest telemetryand context|Machine identity,source-specific|
|ML / Risk Service|Feature computation and risk calculation|Service-to-service only|
|LLM Service|Grounded explanation and NL query<br>handling|Tool-scoped, read-only by default|



#### **2.2 System Boundary** 

SentinelStack begins at the point where external enterprise data becomes available through connectors, imports or collectors. It ends at risk, decision, reporting, compliance and audit outputs, including 

Software Design Document - Final Design Baseline | Page 3 

SentinelStack | SDD v1.1 | PS 26105 

executive/technical views and regulatory evidence packages where applicable. It does not replace the source security controls or act as the organization's ERP/accounting system. 

#### **2.3 Reference Operating Context** 

```
Enterprise telemetry/context -> SentinelStack ingestion -> canonical evidence store ->
digital twin -> risk/ML engine -> decision/optimizer -> dashboards/reports
```

```
|
```

```
audit/evidence
```

Software Design Document - Final Design Baseline | Page 4 

SentinelStack | SDD v1.1 | PS 26105 

### **3. Architecture Overview** 

The logical architecture separates collection, contextualization, analytics, decision support, presentation and trust functions. The design permits a lean MVP deployment while retaining cloud portability and service boundaries for later scale. 



<!-- Start of picture text -->
SentinelStack Logical Architecture<br>A clean layered view from enterprise evidence to risk, decisions, investment, and governance<br>Soe Sources Ingestion + Normalization |Cyber Risk Digital Twin) Risk Quantification<br>vis = Stet a eben cSP veivettonke telenagene facets sactto Uikenood = impact scontels<br>Risk Drivers Al Decision Support What-If Scenarios Investment Optimization<br>Assumptions » Confidence ENEedciveligemates ee Recaiculate Baseline delta Budget‘ion« DependenciesCas aecveness« Risk<br>EXPERIENCE + GOVERNANCE<br>Executive + Tachnical UI TEeGyII Audit<br>Risk»i EAL»diem VaR“vents«Tends+ DFRatan «Frameworkelena mappingBee« assumptonshanes “tamperndent+, Trust caper<br>Cross-cutting: security + privacy * RBAC + tenant isolation + observabilty + model governance « retention + cloud portability<br>Authority: Risk Engine publishes EAL/VaRIRisk Score: Al explains/proposes: Optimizer selects under declared constraints<br><!-- End of picture text -->

#### **3.1 Logical Layers** 

|**Layer**|**Responsibility**|**Key interfaces**|
|---|---|---|
|Integration|Connectors, webhook/API intake,<br>scheduled imports,agents|REST, webhooks, CSV/JSON, STIX/TAXII|
|Data & Context|Canonical schema, entity resolution,<br>qualityrules,digital twin state<br>f|PostgreSQL/SQL APIs, event contracts|
|Risk Analytics|Likelihood, impact, control effectiveness,<br>loss distribution,EAL/VaR/score|Internal service APIs, batch scoring|
|AI Decision|Prediction, recommendations, grounded<br>NLQ,scenario orchestration|Risk APIs + tool calls|
|Optimization|Candidate modeling, constrained<br>optimization,ROSI|Optimization API|
|Experience|Executive/technical dashboards,reports|HTTPS REST/JSON|
|Governance & Trust|Audit trail, evidence package, framework<br>mappings,hash anchoring|Append-only audit API; optional ledger<br>adapter|



#### **3.2 Reference Deployment Topology** 

For the SIH reference implementation, the system can be deployed as a small number of containerized services rather than a distributed microservice fleet. The logical service boundaries remain independent even when multiple modules run in the same container. 



<!-- Start of picture text -->
Browser<br>  | HTTPS<br>  v<br>Web / API Gateway<br>  |-------------------|--------------------|<br>  v                   v                    v<br>Core API        Risk/ML Worker       Ingestion Worker<br>  |                   |                    |<br><!-- End of picture text -->

Software Design Document - Final Design Baseline | Page 5 

SentinelStack | SDD v1.1 | PS 26105 

```
  +-------------------+--------------------+
```

```
                      v
              PostgreSQL + Object Storage
```

```
                      |
               Audit / Evidence Store
                      |
             Optional Ledger Adapter
```

### **4. Component Design** 

|**ID**|**Component**|**Responsibility**|
|---|---|---|
|C1|API Gateway / Application API|Authentication, authorization, tenant routing,<br>request validation,orchestration.|
|C2|Connector Manager|Maintains source connectors, credentials,<br>schedules,schemas and ingestion status.|
|C3|Normalization Service|Transforms source data into canonical<br>entities;resolves identifiers and timestamps.|
|C4|Context / Digital Twin Service|Maintains asset, service, dependency,<br>control and business-contextgraph/state.|
|C5|Risk Quantification Service|Runs likelihood, impact, loss simulation,<br>EAL/VaR and risk-score computations.|
|C6|Risk Driver / Attribution Service|Ranks contributing features/factors using<br>model attribution and deterministic<br>contribution analysis.|
|C7|ML Platform|Training, validation, calibration, model<br>registry,scoringand drift monitoring.|
|C8|AI Decision Service|Prediction narratives, mitigation<br>recommendation orchestration, grounded<br>NLQ.|
|C9|Scenario Engine|Creates isolated scenario states, applies<br>control changes and triggers recomputation.|
|C10|Investment Optimizer|Solves budget-constrained portfolio problem<br>and computes ROSI/cost-benefit.|
|C11|Compliance / Reporting Service|Framework mappings, evidence packaging,<br>PDF reportgeneration.|
|C12|Audit / Trust Service|Immutable event trail, hash chain, evidence<br>package hashes and optional blockchain<br>anchor.|
|C13|Web Experience|Executive, technical, risk, governance and<br>scenario/optimizer interfaces.|



#### **4.1 Component Interaction Rules** 

- Only Risk Quantification Service may publish authoritative EAL/VaR/Risk Score values. 

- AI Decision Service can read computed outputs and propose explanations/recommendations, but cannot directly write authoritative financial-risk metrics. 

- Scenario Engine writes scenario state, never overwrites the production baseline. 

- Investment Optimizer consumes model-derived costs and risk reductions and returns a candidate portfolio; human approval remains a business workflow. 

- Audit/Trust Service receives canonical event metadata and evidence hashes, not raw high-volume telemetry by default. 

Software Design Document - Final Design Baseline | Page 6 

SentinelStack | SDD v1.1 | PS 26105 

### **5. Data Architecture** 

#### **5.1 Core Entity Model** 

|**Entity**|**Purpose**|**Key attributes**|
|---|---|---|
|Organization|Top-level tenant/business owner|org_id,name,currency,timezone|
|BusinessUnit|Organizationalgrouping|bu_id,org_id,criticality|
|Service|Business/technical service|service_id, bu_id, owner,<br>downtime_cost_per_hour,dependencies|
|Asset|Host, application, cloud resource or identity<br>set|asset_id, type, owner, criticality, exposure,<br>service_id|
|Vulnerability|Vulnerability state attached to assets|cve_id, asset_id, cvss, epss, kev, age,<br>patch_state<br>i|
|ThreatSignal|Observed or external threat intelligence|type,source,timestamp,confidence,scope|
|SecurityEvent|Normalized telemetry event|event_id, type, timestamp, source, entity_ref,<br>severity|
|Control|Security control<br>i|control_id, framework_refs, status, coverage,<br>effectiveness<br>f|
|Incident|Confirmed securityincident|incident_id,date,type,affected_service,loss|
|FinancialParameter|Business impact input|parameter, value, currency, validity_window,<br>source|
|RiskAssessment|Computed risk snapshot|assessment_id, timestamp, scope, EAL, VaR,<br>score,model_version|
|Scenario|Non-production state mutation|scenario_id, baseline_id, changes,<br>created_by|
|InvestmentOption|Control/remediation candidate|option_id, cost, coverage,<br>dependencies, applicability,<br>risk_reduction,risk_condition_refs|
|Recommendation|AI/analytic action proposal|recommendation_id, action,<br>affected_scope, cost,<br>expected_financial_change,<br>risk_reduction, dependencies,<br>confidence, priority_rank,<br>evidence_refs,risk_condition_refs|
|Evidence|Source/provenance record|evidence_id, source, collected_at,<br>content_hash,lineage|
|AuditEvent|Traceability event|event_id, actor, action, timestamp,<br>payload_hash|
|FrameworkControl|Control mapping record|framework, control_id, mapping_type,<br>evidence_refs|



#### **5.2 Key Relationships** 

```
Organization 1---N BusinessUnit 1---N Service 1---N Asset
Asset 1---N Vulnerability
Asset/Service N---N Control
ThreatSignal N---N Asset/Service
RiskAssessment -> snapshot of Organization / BU / Service / Asset state
Scenario -> RiskAssessment baseline + state mutations
InvestmentOption -> affected assets/services + candidate controls
Recommendation -> evidence + model outputs + optional InvestmentOption
```

#### **5.3 Risk Snapshot Retention** 

RiskAssessment snapshots are persisted at least daily and on material recalculation, with a 36-month minimum retention window, matching FR-06A. Raw/normalized telemetry retention is configurable by deployment and source policy; the design requires the lineage pointer needed to reconstruct how a computed assessment was produced even when high-volume telemetry ages out. 

Software Design Document - Final Design Baseline | Page 7 

SentinelStack | SDD v1.1 | PS 26105 

### **6. Ingestion and Normalization Design** 

#### **6.1 Integration Patterns** 

|**Source class**|**Preferred mechanism**|**Fallback**|
|---|---|---|
|Vulnerabilitymanagement|REST API / scheduled sync|CSV/JSON import|
|SIEM|Webhook/API,incrementalquery|Batch export|
|IAM|REST/API snapshot + event feed|CSV/JSON|
|EDR|API/event stream|Scheduled export|
|CSPM|REST/API|JSON/CSV|
|Asset inventory|REST/API / CMDB sync|CSV/JSON|
|Threat intelligence|STIX/TAXII|Structured feed/file|
|Business context|Secure API / admin import|CSV/JSON;manual controlled entry|



#### **6.2 Canonical Event Contract** 

```
{
  "event_id": "source-specific-id",
  "source": "edr|siem|vms|iam|cspm|asset|threat|business",
  "observed_at": "ISO-8601 UTC",
  "entity_type": "asset|service|identity|finding|control",
  "entity_ref": "canonical-id",
  "event_type": "normalized-event-name",
  "severity": 0..10,
  "attributes": {"key": "value"},
  "source_confidence": 0..1,
  "ingestion_batch": "batch-id"
}
```

#### **6.3 Normalization and Entity Resolution** 

- Generate a canonical ID for every tracked entity and retain source IDs for traceability. 

- Normalize timestamps to UTC while retaining original timezone metadata. 

- Map source-specific severity into a normalized scale without discarding the original value. 

- Deduplicate repeated events using source ID, timestamp and content fingerprints. 

- Route malformed or low-confidence data to a quarantine queue instead of silently dropping it. 

- Calculate data coverage metrics that later feed risk-confidence reporting. 

#### **6.4 Data Quality Gates** 

|**Gate**|**Example rule**<br>i|**Action on failure**|
|---|---|---|
|Schema|Required fieldspresent|Reject/quarantine|
|Identity|Asset reference resolvable|Hold for entityresolution|
|Freshness|Timestampinside source SLA|Mark stale|
|Range|Probability0..1;CVSS 0..10|Reject/quarantine<br>i|
|Provenance|Source and collection time known|Degrade confidence / review|
|Duplication|Fingerprint not already processed|Ignore duplicate|



Software Design Document - Final Design Baseline | Page 8 

SentinelStack | SDD v1.1 | PS 26105 

### **7. Cyber Risk Digital Twin** 

The Digital Twin is the contextual state layer that connects technical evidence to business meaning. It is implemented as relational tables with explicit relationships in the reference MVP; a graph database is not required for the baseline. 

#### **7.1 State Model** 

```
Asset -> hosted_by / depends_on -> Service -> owned_by -> Business Unit
Asset -> affected_by -> Vulnerability
Asset/Service -> protected_by -> Control
Threat Signal -> targets / relates_to -> Asset or Service
Financial Parameter -> applies_to -> Service / Business Unit / Organization
```

#### **7.2 Criticality and Dependency Propagation** 

Each service has business criticality attributes and dependencies. Asset-level risk is weighted by service criticality and dependency centrality; the same context is preserved when aggregating risk to business-unit and enterprise scopes. The propagation function SHALL be deterministic and versioned so that changes to dependency logic are auditable. 

#### **7.3 Control State** 

Control state is represented independently from control definition. The state includes implementation status, coverage, configuration strength, observed incidents and evidence freshness. The Risk Engine converts these attributes into a normalized effectiveness factor using a versioned control-effectiveness model. 

#### **7.4 Data Coverage and Confidence** 

Every twin snapshot carries source coverage indicators. Missing SIEM/EDR/IAM or business-impact inputs do not silently become “zero risk”; instead the pipeline either applies an approved prior/assumption with an uncertainty adjustment or marks the metric as limited-confidence. 

Software Design Document - Final Design Baseline | Page 9 

SentinelStack | SDD v1.1 | PS 26105 

### **8. Risk Quantification Engine** 



<!-- Start of picture text -->
Risk Quantification Pipeline<br>Security, business, and control evidence converge before the loss distribution is computed.<br>Security Evidence Business Context Controt Context<br>Feature / Context Assembly<br>Every assessment carries model version, assumptions, data coverage, uncertainty, and source lineage.<br><!-- End of picture text -->

#### **8.1 Authority Boundary** 

**Authoritative metric rule:** EAL, VaR, Financial Exposure and Risk Score are generated by the deterministic/statistical risk engine. ML models estimate uncertain inputs such as exploitation likelihood or severity parameters; an LLM may explain the result but SHALL NOT invent, recalculate or override authoritative values. 

#### **8.2 Likelihood Model** 

The reference likelihood model estimates the probability of an incident/exploitation event over a defined horizon using point-in-time observations. The reference likelihood design uses a calibrated probabilistic baseline (logistic/GLM family) and permits a nonlinear tabular challenger (e.g., gradient-boosted trees). Promotion of a nonlinear model requires temporal validation, calibration, attribution stability and operational monitoring; the selected production model remains versioned. 

```
Example scoring target:
```

```
P(exploitation within T days | vulnerability, exposure, threat, controls, asset context)
= p
```

```
Features may include:
```

```
CVSS, EPSS, KEV status, exploit availability, internet exposure, vulnerability age,
threat activity,
```

```
asset criticality, patch state, EDR coverage, MFA coverage, control effectiveness, recent
telemetry.
```

#### **8.3 Financial Impact Model** 

Impact is modeled as a distribution rather than a single point whenever data supports it. The reference design combines statistically fitted severity distributions with deterministic business-impact components; an ML/regression conditioning layer may refine severity parameters using service, asset and incident context. Components may include direct loss, business interruption, response/recovery cost, regulatory/legal exposure and other business consequences. Inputs can be service-specific downtime cost, data sensitivity, recovery time, affected population and historical loss observations. 

##### `Illustrative decomposition:` 

```
Loss = Direct + Downtime + Response/Recovery + Regulatory/Legal + Other modeled impact
```

```
Frequency and severity are modeled separately where data supports it; Monte Carlo
simulation produces the aggregate annual loss distribution.
```

Software Design Document - Final Design Baseline | Page 10 

SentinelStack | SDD v1.1 | PS 26105 

#### **8.4 Expected Annual Loss** 

For a simplified case, EAL can be represented as annual incident frequency multiplied by expected loss per incident. The reference design models frequency and severity separately where data supports it, then aggregates them to preserve uncertainty and tail behavior. Multiple plausible incident outcomes contribute to the expected value. 

```
Simplified: EAL = lambda_annual * E[Loss]
```

```
Distributional implementation: simulate annual event counts + event severities ->
aggregate loss distribution -> EAL
```

#### **8.5 Value at Risk** 

VaR is the selected percentile of the modeled annual loss distribution. It represents a loss threshold that is not expected to be exceeded with the chosen confidence level under the model assumptions; it is not a maximumloss guarantee. 

```
VaR_alpha = quantile(AnnualLossDistribution, alpha)
```

#### **8.6 Risk Score** 

A normalized enterprise/business-unit/service/asset Risk Score is generated from the risk engine using versioned weighting and/or calibrated probabilistic outputs. The mapping from monetary risk to score is configurable and documented; score changes must always remain traceable to underlying factors. 

#### **8.7 Material Recalculation** 

- Critical/newly exploited vulnerability affecting a critical asset -> priority recalculation. 

- Control disablement or material coverage change -> priority recalculation. 

- Material threat-intelligence change -> priority recalculation where relevant. 

   - Service added/retired or material dependency/criticality change -> affected-scope recalculation. 

- Routine updates -> batch/full recalculation cycle. 

- Historical snapshots are preserved to support risk trend analysis. 

Software Design Document - Final Design Baseline | Page 11 

SentinelStack | SDD v1.1 | PS 26105 

### **9. AI / ML Design** 

#### **9.7 Reference Predictive Design** 

The MVP trains point-in-time likelihood and impact models separately. Likelihood uses a calibrated probabilistic model; impact uses fitted frequency/severity distributions with optional supervised conditioning. Anomaly and trend workloads use independent signals rather than forcing all predictive tasks into one model. 

#### **9.1 ML Workloads** 

|**Workload**|**Objective**|**Output**|**Primary validation**|
|---|---|---|---|
|Likelihood estimation|Estimate exploitation/incident<br>probability|Calibrated probability|PR-AUC, ROC-AUC, recall,<br>calibration|
|Anomaly detection|Detect unusual security<br>behavior|Anomaly score / signal|Detection review, precision@k,<br>drift|
|Trend prediction|Estimate evolving risk/threat<br>trends<br>i|Forecast / directional estimate|Temporal backtest<br>i|
|Impact estimation|Estimate financial loss<br>parameters|Severity/frequency parameters|MAE/RMSE or distribution fit +<br>backtest|
|Risk attribution|Explain model contribution|Feature contribution / driver<br>rank|Stability + domain review|
|Recommendation<br>prioritization|Rank mitigation actions<br>by modeled risk<br>reduction, urgency, cost,<br>scope, dependencies<br>and confidence|Priority rank|Consistency + domain<br>review|



#### **9.2 Training Dataset Design** 

The training dataset uses point-in-time observations, not a single static row per vulnerability. Public real-world incident and vulnerability data can provide observed events and external features; enterprise-private asset criticality, control coverage and business-impact parameters are supplied by the deployment environment. Synthetic contextual fields used for the SIH demonstration SHALL be explicitly labeled as synthetic. 

#### **9.3 Temporal Leakage Prevention** 

- Train/validation/test partitions are split by time, not purely at random. 

- Only information available at or before the observation timestamp is allowed as a feature. 

- Future KEV or future incident labels must not leak into earlier observations. 

- Model versions and feature schema versions are stored with every risk assessment. 

#### **9.4 Probability Calibration** 

Because predicted probabilities are propagated into monetary risk, calibration is a first-class acceptance criterion. Reliability curves, calibration error and threshold behavior SHALL be reviewed before a model is promoted. 

#### **9.5 Model Lifecycle** 

```
Data validation -> training -> temporal validation -> calibration -> model registration
-> approval -> deployment ->
```

```
shadow scoring -> monitoring -> drift detection -> retraining/revalidation -> versioned
promotion/rollback
```

#### **9.6 Uncertainty Handling** 

The system SHALL surface model confidence/coverage and uncertainty ranges where available. Out-ofdistribution or materially drifted conditions are flagged. The system does not claim to predict black-swan 

Software Design Document - Final Design Baseline | Page 12 

SentinelStack | SDD v1.1 | PS 26105 

geopolitical events; it can instead support stress-test scenarios and show increased model uncertainty when conditions fall outside learned patterns. 

### **10. AI Decision Support and LLM Boundary** 

#### **10.1 Grounded Natural-Language Query Architecture** 

```
User query
```

- `-> intent extraction / policy check` 

- `-> approved tool calls` 

- `-> risk metrics API` 

- `-> risk drivers API` 

- `-> trend API` 

- `-> scenario API` 

- `-> verified structured result` 

- `-> LLM explanation` 

- `-> answer with source/time/model context` 

#### **10.2 LLM Responsibilities** 

- Explain risk results in business language. 

- Summarize top contributors and changes between two assessment snapshots. 

- Generate natural-language descriptions of approved mitigation recommendations. 

- Translate executive questions into safe read-only analytical queries. 

- Explain framework mappings and evidence already returned by backend services. 

#### **10.3 LLM Prohibitions** 

- Cannot directly author EAL, VaR, Risk Score or probability values. 

- Cannot alter risk-engine results. 

- Cannot access arbitrary raw databases outside approved tools. 

- Cannot claim evidence that is not present in the returned structured context. 

- Cannot silently fill missing business-impact assumptions; it must surface the limitation. 

#### **10.4 Recommendation Pipeline** 

#### **10.5 Recommendation Prioritization** 

Recommendations are ranked using model-derived risk reduction, urgency/materiality, affected business scope, implementation cost, dependencies, feasibility and uncertainty. Only recommendations with defensible quantified risk reduction enter the optimization candidate set; non-quantifiable recommendations remain visible but are not assigned invented values. 

```
Risk driver(s) -> candidate action mapping -> scenario simulation -> quantified Δrisk ->
cost/coverage/dependency check ->
```

```
priority ranking -> recommendation record -> explanation -> optional optimizer candidate
```

Software Design Document - Final Design Baseline | Page 13 

SentinelStack | SDD v1.1 | PS 26105 

### **11. What-If Scenario Engine** 



<!-- Start of picture text -->
Scenario-to-Investment Decision Loop<br>Recommendations and what-if scenarios both produce model-derived candidates for budget-constrained optimization<br>Current Risk Baseline AI Risk Review What-if scenario | || Quantified Delta<br>Candidate Investment Set Budget Optimizer Decision Portfolio.<br><!-- End of picture text -->

#### **11.1 Scenario State** 

A scenario is an immutable set of changes applied to a baseline snapshot. Examples include “MFA coverage 60% -> 100%” or “delay selected remediation by 30 days.” Scenario state lives outside production configuration and can be compared repeatedly. 

#### **11.2 Scenario Execution** 

1. Load the selected baseline RiskAssessment and associated Digital Twin state. 

2. Validate requested mutations against the scenario policy and available data. 

3. Create a temporary scenario state without modifying the baseline. 

4. Recalculate affected likelihood, impact, control-effectiveness and aggregate loss metrics. 

5. Return baseline vs scenario EAL, VaR, Risk Score and modeled risk reduction with model version and assumptions. 

#### **11.3 Scenario Types** 

|**Scenario type**|**Example**|**Expected output**|
|---|---|---|
|Control coverage|MFA 60% -> 100%|ΔEAL,ΔVaR,cost,ROSI|
|Remediation timing|Delaycriticalpatch 30 days|Incremental exposure|
|Asset change|Internet-facing-> internal|Changed likelihood/risk|
|Service continuity|Recoverytime objective reduced|Changed business impact|
|Threat stress|Threat activitymultiplier|Stress-test distribution / uncertainty|



Software Design Document - Final Design Baseline | Page 14 

SentinelStack | SDD v1.1 | PS 26105 

### **12. Investment Optimization Engine** 

#### **12.1 Optimization Problem** 

```
Decision variable: x_i in {0,1} for each candidate control/remediation option i
Objective: maximize modeled risk reduction
Constraint: sum(Cost_i * x_i) <= Budget
```

```
Additional constraints: dependencies, mutually exclusive options, applicability,
implementation capacity
```

#### **12.2 Candidate Option Record** 

|**Field**|**Meaning**|
|---|---|
|option_id|Stable identifier|
|action|Human-readable remediation/control|
|cost<br>f|Estimated investment cost|
|affected scope|Assets/services/business units|
|risk_reduction|Scenario-derived modeled reduction<br>l|
|dependency_ids|Prerequisites/conflicts|
|implementation_time|Expected time-to-value|
|confidence|Confidence in estimate|
|evidence_refs|Supportingmodel/data references<br>i|
|risk_condition_refs|Underlying risk conditions / findings that the option is<br>intended to mitigate|
|priority_rank|Model-derived recommendation priority after<br>urgency, risk reduction, cost, scope, dependencies<br>and confidence|
|applicability|Assets/services/conditions for which the control or<br>remediation is valid|
|residual_financial_exposure|Modeled exposure after the candidate action is<br>applied,where scenario data supports it|



#### **12.3 Cost-Effectiveness** 

The optimizer SHALL expose risk reduction, cost, residual risk, risk reduction per unit spend and ROSI where supported. It shall preserve the originating risk condition and evidence references for each candidate. Costeffectiveness is a decision aid, not a free-form “best control” label. The chosen portfolio is the mathematical result under the specified objective and constraints, followed by human approval. 

The optimization result also records selected investments, total cost, modeled risk reduction, residual EAL/VaR/financial exposure where supported, constraints, assumptions, and source/model evidence. 

#### **12.4 ROSI** 

```
ROSI = (Modeled Risk Reduction - Investment Cost) / Investment Cost
```

The exact accounting convention is configurable and must be stated in each report. Risk reduction used in ROSI must be produced by the risk/scenario engine, not authored by the LLM. 

#### **12.5 Investment Curve** 

The Investment-vs-Risk-Reduction curve is generated by evaluating budget points or ordered candidate portfolios and plotting cumulative investment against modeled residual risk/reduction. The curve is descriptive and supports identification of diminishing returns. 

Software Design Document - Final Design Baseline | Page 15 

SentinelStack | SDD v1.1 | PS 26105 

### **13. Dashboards, Reporting and Compliance** 

#### **13.1 Executive Dashboard** 

|**Panel**|**Required data**|**Interaction**<br>i|
|---|---|---|
|Enterprise Risk|Risk Score,EAL,VaR,Financial Exposure|Time filter,scope|
|Risk Trend|Historical snapshots|Period comparison,hover detail|
|TopContributors|Drivers,assets,services,vulnerabilities|Drill-down|
|Risk Reduction Opportunities|Candidate mitigations and modeled<br>reduction|Scenario / optimizer|
|Investment View|Budget,cost,risk reduction,ROSI<br>i|Portfolio comparison|
|Board / Investment Review|Financial exposure, cost-benefit,<br>modeled risk reduction, residual<br>risk, ROSI, assumptions,<br>limitations|Approval-ready summary; export<br>to report pack|



#### **13.2 Technical Dashboard** 

- Asset and service hierarchy with risk metrics 

- Vulnerability/control findings with business context 

- Remediation backlog and aging 

- Control effectiveness evidence 

- Framework mappings and evidence availability 

- Source freshness and data-coverage indicators 

#### **13.3 Natural Language Layer** 

The NLQ panel is backed by the same APIs as dashboards. This prevents the conversational interface from becoming an independent, potentially inconsistent source of truth. 

#### **13.4 Compliance Mapping** 

Framework mappings are stored as versioned relationships between internal controls/evidence and framework references. The first baseline supports ISO/IEC 27001, NIST CSF, CIS Controls, RBI Cyber Security Framework and SEBI Cybersecurity and Cyber Resilience Framework, as required by the SRS. Mapping records are versioned so a report can identify the framework/version used. 

#### **13.5 Reporting** 

#### **13.6 Executive and Board Decision Pack** 

The reporting layer shall provide an approval-ready summary containing current financial exposure, EAL/VaR, top drivers, candidate investments, cost-benefit comparison, modeled risk reduction, residual exposure, ROSI/value metrics, assumptions and limitations. 

Reports contain assessment timestamp, scope, model versions, top drivers, financial metrics, evidence references, assumptions, data coverage, scenario results, investment analysis, business-impact interpretation and applicable framework mappings. Executive/board review packs shall expose strategic trade-offs, cost, modeled risk reduction, residual exposure and limitations. PDF export is required by FR-24. 

Software Design Document - Final Design Baseline | Page 16 

SentinelStack | SDD v1.1 | PS 26105 

### **14. Evidence, Auditability and Trust Layer** 

#### **14.1 Audit Event Model** 

```
event_id | timestamp | actor/service | action | object_type | object_id | source_refs |
model_version | payload_hash | prev_hash
```

Audit records are append-only and cryptographically chained. A material event can therefore be checked for sequence integrity even if the primary database is later accessed by an administrator. 

#### **14.2 Evidence Package** 

For every material risk assessment or decision, the platform creates an evidence package reference containing canonical inputs/metadata, calculation model version, relevant source references, assumptions and output hashes. Raw telemetry is not copied into the trust layer by default. 

#### **14.3 Optional Blockchain Anchor** 

A blockchain adapter MAY periodically anchor a hash of selected evidence/audit records to a permissioned or appropriately controlled ledger. The ledger proves that a canonical record hash existed at the anchor time; it does not prove that the underlying model or source data was correct. 

#### **14.4 Integrity Verification** 

`1. Canonicalize record` 

`2. SHA-256(record)` 

`3. Compare with stored chained/anchored hash` 

`4. Match => integrity of recorded artifact preserved` 

`5. Mismatch => integrity incident / investigation` 

Software Design Document - Final Design Baseline | Page 17 

SentinelStack | SDD v1.1 | PS 26105 

### **15. API and Integration Design** 

#### **15.1 External API Groups** 

|**APIgroup**|**Representative endpoints**|**Purpose**|
|---|---|---|
|Authentication|POST /auth/login;POST /auth/refresh|Session / token management|
|Assets|GET /assets;GET /assets/{id}|Inventory+ context|
|Ingestion|POST /ingest/{source}; POST<br>/webhooks/{source}|Source data intake|
|Risk|GET /risk/summary;GET /risk/{scope}|EAL/VaR/score/exposure|
|Drivers|GET /risk/{scope}/drivers|Attribution / contributors|
|Trends|GET /risk/{scope}/trend|Historical time-series|
|Scenarios|POST /scenarios;POST /scenarios/{id}/run|What-if simulation|
|Recommendations|GET /recommendations; POST<br>/recommendations/{id}/simulate|Mitigation actions|
|Optimization|POST /optimization/run|Budget-constrainedportfolio|
|Compliance|GET /frameworks; GET /mappings; POST<br>/reports/compliance|Framework mapping/evidence|
|Reports|POST /reports/risk;GET /reports/{id}|PDF/reportgeneration|
|Audit|GET /audit/events;POST /audit/anchor|Traceability/ trust|



#### **15.2 Internal Service Contracts** 

Internal APIs use versioned JSON schemas. Risk computations are idempotent by assessment input hash + model version. Long-running ingestion, ML scoring and optimization tasks are asynchronous and return job IDs for polling. 

#### **15.3 API Controls** 

- JWT/OAuth-compatible authentication for user sessions 

- RBAC enforcement at route and object level 

- Rate limiting and request-size limits 

- Idempotency keys for ingestion and optimization jobs 

- Audit logging for material state changes 

- Schema validation before persistence 

Software Design Document - Final Design Baseline | Page 18 

SentinelStack | SDD v1.1 | PS 26105 

### **16. Security and Privacy Architecture** 

#### **16.1 Trust Boundaries** 



<!-- Start of picture text -->
Data, Privacy and Trust Boundaries<br>=<br><!-- End of picture text -->

#### **16.2 Security Controls** 

|**Control**|**Design**|
|---|---|
|Transport encryption|TLS 1.2+ for external/internal service communication where<br>supported|
|Data at rest|AES-256 orplatform-equivalent encryption|
|RBAC|Least-privilege role and object-scope enforcement|
|Tenant isolation|org_id/tenant boundaryenforced server-side and inquery policies|
|Secrets|Secret manager/environment injection; never committed to<br>source|
|Connector security|Per-source credentials,scopedpermissions,rotation metadata<br>i|
|Inputprotection|Schema validation, payload limits,malware-safe file handling|
|LLM isolation|Tool-scoped access;no unrestricted SQL/DB access|
|Audit|Tamper-evident event trail for material actions|
|Backup|Encrypted backups with recoverytesting|



#### **16.3 Sensitive Data Minimization** 

For highly sensitive deployments, local collectors can transform raw telemetry into aggregate or derived features before export. Examples include failed-login rate, MFA coverage, privileged-account count, EDR anomaly counts and coverage percentages. The platform can therefore reduce exposure of raw event streams while retaining risk-relevant information. 

#### **16.4 Data Residency** 

Storage location is deployment-configurable. Private/on-premises or hybrid deployments are supported by keeping raw telemetry and sensitive business parameters inside the organizational boundary and exporting only approved feature sets or computed results. 

Software Design Document - Final Design Baseline | Page 19 

SentinelStack | SDD v1.1 | PS 26105 

### **17. Deployment and Infrastructure** 

#### **17.1 Reference Technology Stack** 

|**Layer**|**Reference choice**|**Reason**|
|---|---|---|
|Web|Next.js + TypeScript + Tailwind + Recharts|Fast dashboard iteration, typed frontend,<br>strongecosystem|
|API|FastAPI + Python|Direct access to ML/risk libraries and async<br>API support|
|Data|PostgreSQL|Relational integrity, JSON support, mature<br>managed/free-tier options|
|ML|Python + scikit-learn / XGBoost candidate|Tabular modeling, explainability and<br>calibration ecosystem|
|Optimization|OR-Tools or scipy.optimize candidate|Constrained optimization support|
|Backgroundjobs|Python worker / taskqueue abstraction|Decouple ingestion,scoring,reporting|
|Storage|Object storage abstraction|Reports,evidencepackages,model artifacts|
|Auth|Supabase Auth or OAuth/OIDC-compatible<br>provider|Fast implementation and standard identity<br>model|
|LLM|Provider-agnostic tool-callingadapter|Grounded AI without couplingto one vendor|
|Trust|SHA-256 hash chain + optional ledger<br>adapter|Tamper-evidence without placing raw data<br>on-chain|
|Deployment|Docker +public-cloud compatible containers|Cloud-ready, portable reference deployment|



#### **17.2 MVP / Free-Tier Deployment** 

The SIH reference deployment can consolidate services into a small number of containers and use managed PostgreSQL/auth/storage where available. Kafka, OpenSearch, Neo4j, Kubernetes and other scale-out components are not required for the first working system; adapters/interfaces can be retained for future enterprise deployments. In either form, ingestion and computation workers SHALL be independently scalable from the presentation/API layer to satisfy the cloud-readiness design target. 

#### **17.3 Deployment Modes** 

#### **17.4 Reference Cloud Target** 

The reference deployment targets one major public-cloud environment first (AWS as the initial reference), while keeping containerized services and externalized configuration portable to Azure/GCP. Ingestion and analytical workers are independently scalable from the presentation layer. 

|**Mode**|**Data location**|**Typical use**|
|---|---|---|
|SaaS|Cloud|Lower-sensitivity/ smaller tenant|
|Private|Customer-controlled environment|High-sensitivityenterprise|
|Hybrid|Raw data local, derived features/results<br>centralized|Preferred path for sensitive analytics|



Software Design Document - Final Design Baseline | Page 20 

SentinelStack | SDD v1.1 | PS 26105 

### **18. Scalability, Performance and Resilience** 

#### **18.1 SRS Alignment Targets** 

|**Metric**|**Design target**|**Mechanism**|
|---|---|---|
|Tracked assets|100,000 per deployment (draft target)|Indexed asset tables, pagination, scoped<br>queries|
|Open findings|1,000,000 (draft target)|Partitioning/indices, asynchronous<br>processing|
|Concurrent users|500(draft target)|Stateless API instances,connectionpooling|
|High-severityrecalculation|<=15 minutes from ingestion|Priority job lane|
|Routine recalculation|<=24 hours|Scheduled full recomputation|
|Monthlyuptime|>=99.5% draft target|Managed services,health checks,retries|



#### **18.2 Resilience Patterns** 

- Idempotent ingestion and scoring jobs 

- Retry with exponential backoff for transient connector failures 

- Dead-letter/quarantine handling for malformed records 

- Checkpointed long-running analytics jobs 

- Database backups and point-in-time recovery where the platform supports it 

- Circuit breakers around unreliable external connectors 

- Graceful degradation when non-critical sources are unavailable 

#### **18.3 Recalculation Prioritization** 

Risk recomputation is prioritized by materiality: critical asset + active exploitation or control disablement gets a priority job; lower-severity routine changes are batched. A scheduler prevents repeated recalculation storms when many related events arrive in a short interval. 

Software Design Document - Final Design Baseline | Page 21 

SentinelStack | SDD v1.1 | PS 26105 

### **19. Observability and Operations** 

#### **19.1 Operational Metrics** 

|**Area**|**Metrics**|
|---|---|
|Ingestion|events/sec,lag,success rate,source freshness, quarantine count|
|Risk engine|assessment latency, queue depth, failed runs, model-version<br>distribution|
|ML|drift indicators, calibration error, score distribution shift, OOD<br>rate|
|Scenario/optimizer|job latency,failure rate,candidate count,infeasible cases|
|API|latency p50/p95/p99,error rate,throughput|
|Dataquality|missingness,duplicate rate,stale entities,lineage coverage|
|Security|auth failures, privilege changes,suspicious API activity|
|Audit|append failure,hash mismatch,anchor status|



#### **19.2 Alerting** 

- High-priority source outage affecting risk coverage 

- Material data-quality degradation 

- Risk engine failure or stale assessment beyond SLA 

- Model drift or severe calibration degradation 

- Audit hash verification failure 

- Repeated authorization anomalies 

Software Design Document - Final Design Baseline | Page 22 

SentinelStack | SDD v1.1 | PS 26105 

### **20. Data Quality, Model Governance and Validation** 

#### **20.1 Risk Output Validation** 

- Check that probability values stay within [0,1]. 

- Check financial units/currency and aggregation consistency. 

- Reconcile asset/BU/enterprise aggregations within defined tolerances. 

- Confirm scenario outputs differ only because of approved state changes. 

- Persist model/data versions with every material assessment. 

- Compare repeated runs for deterministic components to ensure reproducibility. 

#### **20.2 Model Governance Record** 

|**Record**|**Required contents**|
|---|---|
|Model card|Purpose,trainingdata,features,limitations,intended use|
|Evaluation report|Temporal split,metrics,calibration,error analysis|
|Version record|Artifact ID,code version,feature schema,approval|
|Deployment record|Release date,servingconfig,rollback target|
|Monitoringrecord|Drift,calibration, performance,incidents|
|Retirement record|Reason,successor model,historical compatibility|



#### **20.3 Human Validation** 

High-impact investment and risk-acceptance decisions remain subject to human approval. The platform provides quantified evidence and candidate actions; it does not autonomously execute security changes or approve budgets. 

Software Design Document - Final Design Baseline | Page 23 

SentinelStack | SDD v1.1 | PS 26105 

### **21. Failure Modes and Recovery** 

|**Failure mode**|**System response**|**User-visible state**|
|---|---|---|
|Source unavailable|Retry+ mark stale + update coverage|Source freshness warning|
|Malformed input|Quarantine|Rejected/quarantined record count|
|Unknown asset|Hold for resolution|Unmapped entitywarning|
|Missing financial parameter|Use approved assumption/range or mark<br>limited|Confidence/assumption notice|
|ML model unavailable|Use approved fallback/statistical baseline<br>where configured|Model fallback indicator|
|Scenario infeasible|Do not return fabricated result<br>l|Validation error|
|Optimizer infeasible|Return reason / constraints conflict|Noportfolio recommendation|
|Hash mismatch|Raise integrityincident|Audit integritywarning|
|LLM unavailable|Dashboard/API remain functional|NLQunavailable|



#### **21.1 No-False-Precision Rule** 

When critical inputs are absent or out-of-distribution, the platform SHALL reduce confidence, provide ranges where supported, or explicitly state that a financial metric cannot be reliably computed. It shall not silently substitute a precise-looking number merely to keep the dashboard populated. 

Software Design Document - Final Design Baseline | Page 24 

SentinelStack | SDD v1.1 | PS 26105 

### **22. Testing and Verification Strategy** 

#### **22.1 Test Levels** 

|**Level**|**Coverage**|**Examples**|
|---|---|---|
|Unit|Pure functions/models|Normalization, risk formulas, cost<br>calculations|
|Integration|Service contracts|Ingestion -> normalization -> risk|
|Model|Statistical correctness|Temporal validation,calibration,drift|
|Scenario|State mutation correctness|MFA 60->100,delay30 days|
|Optimization|Constraint correctness|Budget,dependencies,infeasible cases|
|Security|Auth/privacy/audit|RBAC,tenant isolation,injection tests|
|Performance|SRS targets|15-min recalculation,dashboard latency|
|E2E|User workflows|Executive risk -> scenario -> optimizer -><br>report|



#### **22.2 Acceptance Examples** 

- FR-03/NFR-03A: a critical source event triggers affected-risk recomputation within the target window in controlled test conditions. 

- FR-06: EAL/VaR/Financial Exposure are available at enterprise, BU and asset scopes where data exists. 

- FR-09: top drivers returned by the UI match the underlying attribution/contribution record. 

- FR-12: identical backend values are returned through dashboard and NLQ pathways. 

- FR-13: MFA scenario changes model state without changing baseline data and returns a comparable EAL/VaR delta. 

- FR-16: optimizer never returns a portfolio whose total cost exceeds the budget or violates declared dependencies. 

- FR-23/24: generated compliance report contains framework references, evidence links and assessment timestamp. 

- NFR-08: any material audit record modification results in detectable hash-chain inconsistency. 

#### **22.3 Model Acceptance Gate** 

A predictive model is not production-eligible solely because its accuracy metric is high. Promotion requires temporal validation, calibration adequacy, data-quality checks, interpretability review, stability monitoring plan and documented limitations. 

Software Design Document - Final Design Baseline | Page 25 

SentinelStack | SDD v1.1 | PS 26105 

### **23. SRS-to-Design Traceability** 

|**SRS Requirement**|**Design realization**|**Verification**|
|---|---|---|
|FR-01 Data Source Integration|C2 Connector Manager + C1 APIs<br>+ C3 normalization;<br>REST/webhook, batch/file, agent<br>patterns|**i**<br>Connector and ingestion<br>integration tests|
|FR-02 Data Normalization|C3 canonical schema, entity<br>resolution, timestamp/severity<br>normalization, quarantine|Schema/entity-resolution/data-<br>quality tests|
|FR-03 Continuous Risk Updating|C5 risk engine + priority scheduler<br>+ materiality triggers including<br>service/dependencychanges|Recalculation trigger and latency<br>tests|
|FR-04 Incident Likelihood|C7 calibrated likelihood model +<br>C5 scoring|Temporal validation, calibration<br>and reproducibilitytests<br>i|
|FR-05 Financial Impact|C5 impact model with statistical<br>distributions + deterministic<br>business components + optional<br>ML conditioning|Distribution fit/backtest +<br>component reconciliation tests|
|FR-06 EAL / VaR / Financial<br>Exposure|C5 loss-distribution engine at<br>enterprise/BU/asset scopes|Statistical, aggregation and scope<br>tests|
|FR-06A Historical risk retention|RiskAssessment time-series store<br>+ trend service;>=36 months|Retention, snapshot and trend<br>tests|
|FR-06B Continuous Risk Score|C5 score computation with<br>versioned mapping and driver<br>lineage|Score update, reproducibility and<br>traceability tests|
|FR-07 Asset criticality|C4 Digital Twin<br>dependency/criticality model;<br>deterministicpropagation|Dependency and criticality<br>propagation tests|
|FR-08 Control effectiveness|C4 control state + C5 versioned<br>effectiveness model|Control-effectiveness calculation<br>tests|
|FR-09 Risk drivers|C6 attribution/contribution service<br>tied to model/data|Attribution consistency and<br>source-lineage tests|
|FR-10 Predictive analytics|C7 separate likelihood, anomaly<br>and trend workloads|Temporal backtests, drift and<br>stabilitytests<br>i|
|FR-11 AI mitigation<br>recommendations|C8 recommendation orchestration<br>+ C9 scenario simulation + C10<br>optimizer candidategate|Priority, quantification and non-<br>quantifiable exclusion tests|
|FR-12 Natural-language interface|C8 grounded tool-calling layer<br>over read-onlyanalytical APIs<br>i|Grounding, authorization and<br>unsupported-claim tests|
|FR-12A Business-risk translation|C8 translates verified metrics into<br>service/business/financial<br>consequence|Answer consistency and<br>unsupported-figure tests|
|FR-13 What-if scenarios<br>i|C9 immutable scenario state + C5<br>recomputation|Baseline-isolation and delta-<br>comparison tests|
|FR-14 Budget definition|C10 budget schema and validation|Input/limit validation tests|
|i<br>FR-15 Candidate investments|C10 candidate catalog with cost,<br>scope, dependencies,<br>applicability and<br>risk_condition_refs|Candidate completeness/lineage<br>tests|
|FR-16 Budget-constrained<br>optimization|C10 constrained optimizer for risk<br>reduction, budget, dependencies<br>and value metrics|Constraint, infeasibility and<br>optimality tests|



Software Design Document - Final Design Baseline | Page 26 

|||SentinelStack | SDD v1.1 | PS 26105<br>**i**|
|---|---|---|
|**SRS Requirement**|**Design realization**|**Verification**|
|FR-17 ROSI + strategic review|C10 ROSI + C11 executive/board<br>reviewpack|**i**<br>Formula, assumptions and board-<br>pack tests|
|FR-18 Cost-benefit|C10 comparison view with cost,<br>risk reduction, residual risk and<br>business consequence|Comparison consistency tests|
|FR-19 Investment-risk curve|C10 evaluation across<br>budget/candidate points +<br>visualization|Curve/data consistency tests|
|FR-20 Executive dashboard|C13 executive dashboard with<br>required metrics and business<br>interpretation|E2E dashboard tests|
|FR-21 Technical dashboard|C13 technical views for assets,<br>controls, remediation, findings<br>and mappings|Drill-down and filtering tests|
|FR-22 Drill-down|C4 hierarchy + C13 navigation<br>Enterprise -> BU -> Service -><br>Asset -> Vuln/Control|Hierarchy/navigation tests|
|FR-23 Framework mapping|C11 versioned mappings for ISO<br>27001, NIST CSF, CIS, RBI CSF,<br>SEBI CSRF|Mapping integrity tests|
|FR-24 Evidence reporting / filings|C11 PDF reports + evidence<br>traceability for audits, governance<br>and regulatoryuse|Report/evidence/filing package<br>tests|
|NFR-01 Security|TLS 1.2+; encryption at rest;<br>secure service boundaries|Security configuration and<br>transport tests|
|NFR-02 Access Control|C1 RBAC + least privilege + object-<br>scope enforcement|RBAC/authorization tests|
|NFR-03 Scalability|Indexed/partitionable storage +<br>stateless API + independent<br>workers;sizingtargets in Table 17|Load and scale tests against draft<br>targets|
|NFR-03A Recalculation latency|Priority job lane + scheduler for<br><=15 min high-severity and <=24 h<br>routine updates|Controlled latency tests|
|NFR-04 Availability|Health checks, retries, graceful<br>degradation and managed-service<br>resilience|Uptime/chaos/failure-injection<br>tests|
|NFR-05 Explainability|C6 drivers + evidence +<br>assumptions + model versions<br>exposed to UI/report/LLM|Explainability completeness tests|
|NFR-06 Data Privacy|Data minimization, configurable<br>residency, private/hybrid<br>deployment options|Privacy/data-residency tests|
|NFR-07 Interoperability|REST/JSON + STIX/TAXII contracts;<br>connector adapter model|Contract and connector<br>compatibilitytests|
|NFR-08 Auditability / tamper<br>evidence|C12 append-only hash chain +<br>evidence package + optional<br>ledger anchor|Hash-chain tamper tests and<br>evidence reconstruction|
|NFR-09 Cloud deployability|Dockerized services, externalized<br>config, cloud target and<br>independent scaling|Cloud deployment and scaling<br>test|



Software Design Document - Final Design Baseline | Page 27 

|||SentinelStack | SDD v1.1 | PS 26105<br>**i**|
|---|---|---|
|**SRS Requirement**|**Design realization**<br>i|**Verification**|
|NFR-10 Source telemetry<br>retention|Configurable raw/normalized<br>retention + >=36-month retained<br>record/reference for material<br>support wherepermitted|Retention-policy and evidence-<br>linkage tests|



Software Design Document - Final Design Baseline | Page 28 

SentinelStack | SDD v1.1 | PS 26105 

Design closure check: every SRS v2.1 functional requirement (FR-01 through FR-24) and every non-functional requirement (NFR-01 through NFR-10) has a documented design realization and verification path in this SDD, including prioritized recommendation outputs, candidate applicability/lineage, residual financial exposure, scalability/availability, explainability, interoperability, auditability, cloud deployment and source-telemetry retention. The SRS v2.1 traceability baseline therefore carries forward all PS 26105 capability areas into system design. 

**24. Technology Selection and Trade-offs** 

|**Decision**|**Selected reference**|**Alternative**|**Reason / trade-of**|
|---|---|---|---|
|Web|Next.js + TypeScript|React-only SPA|Integrated routing, server<br>capabilities,typed frontend|
|API|FastAPI|Node/Express|Python reduces ML boundary<br>overhead|
|Database|PostgreSQL|Neo4j as primary|Relational integrity and lower<br>operational complexityfor MVP|
|ML|scikit-learn + candidate XGBoost|Deep learning|Tabular risk data; lower<br>data/compute demand|
|Optimizer|OR-Tools/scipy candidate|Custom heuristic|Explicit constraints and testable<br>solutions|
|LLM|Provider-agnostic|Hard vendor lock-in|Grounded tool-callingboundary|
|Trust|Hash chain + optional ledger|Full on-chain data|Avoids putting sensitive telemetry<br>on-chain|
|Deployment|Docker containers|Kubernetes|Lower MVP complexity; cloud-<br>portable later|



#### **24.1 Important Trade-off: Lean MVP vs Enterprise Scale** 

The reference design intentionally starts with a small operational footprint. The component boundaries allow later insertion of Kafka, OpenSearch, a graph database, distributed workers, or Kubernetes without changing the SRS-level contracts. This avoids spending scarce SIH development time on infrastructure that does not directly demonstrate PS 26105 outcomes. 

#### **24.2 Important Trade-off: Public vs Private Data** 

Public data is suitable for proving model mechanics and validating against known incidents/vulnerabilities, while organization-specific business context remains deployment-provided. Private enterprise context is required for real asset criticality, control coverage and organization-specific financial parameters. The design therefore treats data provenance and synthetic-vs-observed labels as first-class metadata. 

Software Design Document - Final Design Baseline | Page 29 

SentinelStack | SDD v1.1 | PS 26105 

### **25. Implementation Sequence** 

|**Phase**|**Deliverables**|**Exit criteria**|
|---|---|---|
|P0 Foundations|Repo, auth, tenant model, CI/CD, base<br>schema|Users can authenticate; tenant boundaries<br>tested|
|P1 Data Layer|Connectors, canonical schema,<br>asset/context model|Real/public + synthetic sources ingest<br>successfully|
|P2 Risk Engine|Likelihood baseline, impact model, loss<br>simulation,EAL/VaR/score|Reproducible risk calculations with tests|
|P3 AI/ML|Training pipeline, calibration, anomaly/trend<br>models|Validated models with versioning|
|P4 Decision|Risk drivers, grounded NLQ,<br>recommendations|Answers tie to verified metrics|
|P5 What-if|Scenario state engine|Baseline isolation and delta calculations<br>work|
|P6 Optimization|Candidate catalog, budget optimizer, ROSI,<br>curve|Budget constraints and dependencies<br>enforced|
|P7 Governance|Compliance mappings,evidence,audit/trust|Evidence-linked reports + tamper checks<br>l|
|P8 Experience|Executive/technical dashboards,PDF reports|End-to-end workflows meet SRS acceptance|
|P9 Hardening|Performance, security, resilience,<br>deployment|Draft NFR targets exercised and documented|



#### **25.1 Critical Path** 

```
Data model -> ingestion/normalization -> Digital Twin -> Risk Engine -> Scenario Engine
-> Optimizer
```

```
                                         |                  |
```

```
                                         +-> AI Decision ---+-> Dashboards / Reports /
```

```
Compliance
```

Software Design Document - Final Design Baseline | Page 30 

SentinelStack | SDD v1.1 | PS 26105 

### **26. Design Assumptions and Deferred Decisions** 

#### **26.1 Assumptions** 

- Enterprise source systems can expose at least one supported integration mechanism or export format. 

- Business owners can provide asset/service criticality and minimum financial-impact parameters for production use; where unavailable, the system marks estimates as limited-confidence or uses approved assumptions with explicit disclosure. 

- SIH demonstration data will label synthetic enterprise context separately from observed public data. 

- Financial figures are estimates under explicit assumptions and are not treated as accounting statements. 

- Human reviewers remain responsible for material risk acceptance and investment approvals. 

#### **26.2 Deferred / Configurable Decisions** 

- Exact likelihood/impact model algorithm and hyperparameters. 

- Final managed cloud service/vendor selection. 

- Whether a graph database is needed at scale. 

- Blockchain network/provider and anchoring cadence. 

- Final raw-telemetry retention policy per data source and customer regulation; the SDD requires configurable policy enforcement plus 36-month retention/linkage for material supporting records where permitted by NFR-10. 

- Exact calibration threshold and model promotion criteria after empirical testing. 

#### **26.3 Design Constraints** 

The system must not present unsupported precision, must preserve source and model provenance, must respect tenant/data boundaries, and must keep AI explanations grounded in backend results. These constraints are cross-cutting and apply to every implementation choice. 

Software Design Document - Final Design Baseline | Page 31 

SentinelStack | SDD v1.1 | PS 26105 

### **27. Definition of Done for Design Baseline** 

|**Check**|**Definition**|
|---|---|
|Requirements|EverySRS FR/NFR has a design realization and verificationpath.<br>l|
|Architecture|Component boundaries, data flows and deployment model are<br>documented.|
|Data|Core entities, lineage, normalization and retention strategy are<br>specified.|
|Risk math|Likelihood, impact, loss distribution, EAL, VaR and score<br>boundaries are specified.|
|AI|ML responsibilities, calibration, lifecycle and LLM boundary are<br>specified.|
|Optimization|Budget, dependencies, risk reduction, ROSI and curve outputs are<br>defined.|
|Security|i<br>Trust boundaries, RBAC, encryption, tenant isolation and audit<br>design are defined.|
|Operations|Performance targets, observability, failure modes and recovery<br>are defined.|
|Testing|i<br>Unit through E2E/model/securityacceptancepaths are defined.|
|Implementation|Phased build sequence and criticalpath are approved.|



**Design baseline statement:** SDD v1.0 converts the approved SRS into an implementable reference architecture. The next engineering artifacts should be (1) detailed database/data dictionary, (2) risk-model specification with equations and parameter schemas, <u>(3) ML dataset and training specification, and (4) API contract/OpenAPI definition.</u> 

### **Appendix A Source Baseline** 

Primary source: SentinelStack Software Requirements Specification v2.1, prepared against Smart India Hackathon 2026 Problem Statement 26105, “AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform.” 

No external technical standard is treated as a normative design dependency in this SDD; standards/framework mappings remain functional requirements captured in the SRS and shall be elaborated with versioned mapping data during implementation. 

Software Design Document - Final Design Baseline | Page 32 

