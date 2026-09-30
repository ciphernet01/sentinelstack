SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

# **SentinelStack** 

## **Risk Quantification & Mathematical Model Specification** 

_From Point-in-Time Evidence to Financial Cyber Risk, Scenario Delta and Investment Value_ 

|**Problem Statement**|26105|
|---|---|
|**Organization**|All India Council for Technical Education(Cyber SecurityCell)|
|**Baseline**|SRS v2.1  |  SDD v1.1  |  Data Dictionary & Database Schema<br>v1.0|
|**Document Version**|1.0|
|**Status**|Mathematical / analytical design baseline|
|**Authority Boundary**|Risk engine owns authoritative EAL / VaR / Risk Score /<br>Financial Exposure|



###### **Engineering status** 

This specification defines the mathematical contracts, assumptions, data lineage rules, model interfaces, scenario semantics, and validation gates required to implement the SRS/SDD risk pipeline. Exact ML algorithm selection remains subject to empirical validation; authoritative financial metrics are never generated directly by the language model. 

### **Contents** 

|1. Purpose, Scope and Authority|12. What-If Scenario Engine<br>i|
|---|---|
|2. Design Principles and Notation|13. Mitigation Recommendation Quantification|
|3. Mathematical Model Overview|14. Investment Optimization and ROSI|
|4. Input Data Contract and Feature Semantics|15. Uncertainty, Confidence and Data Coverage|
|5. Likelihood / Incident Frequency Model|16. Model Governance and Validation|
|6. Financial Impact / Severity Model|17. Failure Modes and No-False-Precision Rules|
|7. Aggregate Loss Distribution|18. Implementation Interfaces and Persistence|
|8. EAL, VaR, Risk Score and Financial Exposure|19. Verification and Acceptance Tests|
|9. Risk Driver Attribution and Explainability<br>f|20. Requirements Traceability|
|10. Control Effectiveness Model|Appendix A. Worked Illustrative Example|
|11. Continuous Recalculation Semantics|Appendix B. Parameter Registry|



SentinelStack SDD-derived engineering artifact  |  Page 1 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

### **1. Purpose, Scope and Authority** 

#### **1.1 Purpose** 

This document defines the mathematical and analytical behavior of SentinelStack required to transform normalized security evidence and business context into probabilistic incident likelihood, financial loss distributions, EAL, VaR, product Risk Score, riskdriver attribution, scenario deltas, mitigation value, and budget-constrained investment portfolios. 

#### **1.2 Source Baseline** 

|**Source artifact**|**Role in this specification**|
|---|---|
|PS 26105|**i**<br>Defines the target capabilities: continuous risk quantification,<br>likelihood and financial impact estimation, EAL/VaR, risk drivers,<br>AI decision support, scenarios, investment optimization, ROSI,<br>dashboards andgovernance.|
|SRS v2.1|Defines testable FR/NFR contracts and authority/retention/latency<br>requirements.|
|SDD v1.1|Defines service boundaries, the Risk Quantification Engine, model<br>governance, scenario isolation, optimizer behavior and audit<br>design.|
|Data Dictionary & DB Schema v1.0|Defines persisted entities for model_versions, model_predictions,<br>risk_assessments, risk_drivers, scenarios, investment_options,<br>recommendations, optimization_runs/results and evidence<br>lineage.|



#### **1.3 Authority Boundary** 

- Authoritative numeric outputs: Risk Quantification Service / risk engine only. 

- Statistical/ML models estimate uncertain variables; their outputs are inputs to the deterministic risk engine. 

- LLM/NLQ layer explains and queries verified backend outputs; it cannot author or overwrite EAL, VaR, Risk Score, financial exposure, probability or optimization results. 

- Scenario engine creates isolated analytical states; it never mutates the production baseline. 

- Optimizer recommends a candidate portfolio; human users remain responsible for consequential investment approvals. 

###### **Core invariant** 

The system may be uncertain, approximate, or unable to calculate a metric, but it shall not turn uncertainty into false precision merely to populate the dashboard. 

### **2. Design Principles and Notation** 

#### **2.1 Principles** 

- Point-in-time correctness: every scored observation uses data that was available at or before the scoring time. 

- Deterministic financial aggregation: EAL/VaR are produced by reproducible mathematical procedures from approved inputs and model outputs. 

- Probabilistic honesty: probability estimates are calibrated, versioned and accompanied by uncertainty/coverage metadata. 

- Business-context first: assets map to services, business units and approved financial-impact parameters. 

- No double counting: correlated events, shared services and overlapping impact components require explicit dependency rules. 

- What-if is recomputation: scenario value is obtained by re-running the same risk pipeline on a mutated state. 

- Optimization is portfolio-level: candidate values are re-evaluated when interactions make independent additive assumptions invalid. 

- Full lineage: source record, model version, assumptions, calculation hash and material outputs remain reconstructable where retention permits. 

SentinelStack SDD-derived engineering artifact  |  Page 2 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

#### **2.2 Notation** 

|**Symbol**|**Meaning**|**Unit / domain**|
|---|---|---|
|H|Likelihood evaluation horizon|years; reference may use 30 days = 30/365<br>years|
|p_h|Probability of at least one target event<br>within H|[0,1]|
|lambda|Annualized event frequency / rate|events/year|
|N|Annual incident count|non-negative integer|
|L|Loss severity for one event|organization currency|
|S|Aggregate annual loss|organization currency/year|
|EAL|Expected Annual Loss = E[S]|organization currency/year|
|VaR_alpha|alpha-quantile of annual loss distribution|organization currency|
|CE|Normalized control effectiveness|[0,1]|
|C|Criticality / business criticality score|0-100|
|D|Dependency strength|0-100 or normalized [0,1]|
|DeltaEAL|Baseline EAL minus scenario/portfolio EAL|organization currency/year|
|Cost|Investment cost normalized to evaluation<br>horizon|organization currency|



### **3. Mathematical Model Overview** 

The reference model separates four responsibilities: uncertain likelihood estimation, uncertain financial-impact estimation, aggregate-loss simulation, and deterministic decision metrics. This separation allows the ML layer to evolve without changing the financial metric contract. 



_Figure 1. End-to-end risk quantification and decision loop_ 

#### **3.1 Canonical Calculation Contract** 

- Inputs(t) -> canonical state X_t -> likelihood model -> p_h, confidence, bounds -> annualization / frequency model -> lambda 

- -> impact model -> severity distribution L 

- -> frequency + severity aggregation -> loss distribution S 

- -> deterministic metrics -> EAL, VaR, Financial Exposure 

- -> product risk-score mapping -> Risk Score 0..100 

- -> attribution -> Top Risk Drivers 

- -> scenario mutation -> recompute -> Delta metrics 

- -> optimizer -> budget-feasible portfolio + residual risk + value 

### **4. Input Data Contract and Feature Semantics** 

**4.1 Required Input Classes** 

|**Class**<br>|**Examples**<br>|**Primary use**<br>|
|---|---|---|
|Vulnerability<br>|CVE, CVSS, EPSS, KEV, exploit availability,<br>age, patch state<br>|Likelihood, exposure, risk drivers<br>|
|Security telemetry<br>|SIEM / EDR / IAM / CSPM events, anomaly<br>counts, authentication signals<br>|Threat activity, control signals, behavioral<br>likelihood<br>|
|Asset inventory<br>|Asset type, external exposure, owner,<br>|Population, exposure, scope<br>|



SentinelStack SDD-derived engineering artifact  |  Page 3 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

|**Class**|**Examples**|**Primary use**|
|---|---|---|
||location, service link||
|Business context|Service criticality, business-unit criticality,<br>service dependencies|Impact and aggregation|
|Control context|Coverage, configuration strength, incident<br>history, compliance state|Control effectiveness / likelihood<br>attenuation|
|Threat intelligence|Signal type, confidence, target scope,<br>timestamps|Threat activity, trend prediction|
|Historical incidents|Incident class, time, severity/loss<br>estimates, scope|Frequency/severity calibration|
|Financial parameters|Downtime cost/hour, breach cost/record,<br>response cost bands,<br>regulatory/reputation assumptions|Financial impact model|



#### **4.2 Entity Alignment with Data Dictionary** 

|**Analytical function**|**Primary persisted entities**|
|---|---|
|Business context|organizations, business_units, services, assets,<br>asset_service_links, service_dependencies, financial_parameters|
|Vulnerability state|vulnerabilities, asset_vulnerabilities|
|Telemetry / threats|security_events, threat_signals, incidents|
|Controls|control_definitions, control_states, framework_controls,<br>control_framework_mappings|
|Model governance|model_versions, model_predictions|
|Authoritative risk|risk_assessments, risk_assessment_inputs, risk_drivers|
|Scenarios / investment|scenarios, scenario_changes, investment_options,<br>recommendations, optimization_runs, optimization_results,<br>investment_decisions|
|Provenance|integration_sources, ingestion_runs, source_records, evidence,<br>evidence_links, audit_events|



#### **4.3 Point-in-Time Feature Rule** 

- At scoring time t, a feature is eligible only if its observation timestamp/effective window does not leak future information into the score. 

- Training examples are built from point-in-time observations; future outcomes are labels, not features. 

- Every production prediction stores model version, feature-schema version, scoring timestamp, data coverage, confidence and relevant source lineage. 

### **5. Likelihood / Incident Frequency Model** 

The likelihood layer estimates an event probability for a defined event class and horizon. The reference implementation is designed for a calibrated probabilistic model; a validated logistic model is the baseline and a nonlinear tabular model may be promoted if temporal validation demonstrates superior calibration and discrimination. 

#### **5.1 Target Definition** 

Target example: y_i,t,H = 1  if exploitation / incident of class i occurs for asset a within H 0  otherwise Reference horizon: H = 30 days (configurable per workload) 

#### **5.2 Feature Families** 

- Vulnerability state: CVSS, EPSS, KEV flag, exploit availability, vulnerability age, patch status. 

- Exposure: internet-facing state, reachable service, external attack surface indicators. 

- Threat activity: recent targeted signals, threat confidence, technique prevalence, time-varying threat activity. 

SentinelStack SDD-derived engineering artifact  |  Page 4 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

- 

- 

- 

- Asset/service context: asset criticality, service criticality, dependency strength. 

- Control posture: MFA coverage, EDR coverage, configuration strength, recent control failures, incident history. 

- Behavioral telemetry: normalized event rates and anomaly indicators from SIEM/EDR/IAM/CSPM. 

#### **5.3 Probability Contract** 

##### 0 <= p_h(a,i,t) <= 1 

_p_h is the modeled probability that event class i occurs for asset/service context a during horizon H._ 

#### **5.4 Annualization** 

When the likelihood model outputs the probability of at least one event in horizon H, the system converts it to an annualized rate under a constant-hazard approximation. This avoids the common but biased practice of directly multiplying a short-horizon probability by 365/H. 

##### lambda = -ln(1 - p_h) / H_years 

**Note:** For very small p_h, lambda is approximately p_h / H_years. For large p_h, the logarithmic transformation preserves the relationship implied by a Poisson hazard model. 

#### **5.5 Control Attenuation and Threat Modifiers** 

Controls and threat/activity features are incorporated through the approved likelihood model. For deterministic post-processing, the reference design uses a monotonic attenuation function in log-rate space: 

##### lambda_adj = lambda_raw * exp( - sum_k beta_k * CE_k ) 

- beta_k >= 0 is the calibrated effect strength for control family k. 

- CE_k is the normalized, coverage-aware effectiveness value defined in Section 10. 

- The coefficient set is versioned and may be learned from historical outcomes or initialized from approved expert priors when empirical data is insufficient. 

- Threat and exposure features should ordinarily enter the statistical model rather than being multiplied blindly after prediction; post-process modifiers are allowed only when separately validated. 

#### **5.6 Frequency Model** 

- Reference count model: Negative Binomial when incident counts exhibit overdispersion; Poisson as the simpler fallback when dispersion is consistent with Poisson assumptions. 

##### N_i ~ NegBin(mu_i, k_i)   or   N_i ~ Poisson(lambda_i) 

- mu_i is the annual expected frequency for event class i; k_i controls overdispersion when the Negative Binomial model is used. 

### **6. Financial Impact / Severity Model** 

Financial impact is modeled as a distribution rather than a single deterministic amount. This reflects uncertainty in downtime, records affected, response duration, regulatory outcomes and business consequences. 

#### **6.1 Loss Components** 

##### L = L_downtime + L_breach + L_response + L_regulatory + L_reputation + L_other 

|**Component**|**Reference construction**|**Required inputs**|
|---|---|---|
|Downtime|D_hours * cost_per_hour; D_hours may be<br>probabilistic|Service downtime impact, recovery<br>duration|
|Breach / disclosure|R_records * cost_per_record + fixed<br>handlingcosts|Estimated affected records/data units,<br>cost assumptions|
|Response / recovery|Response duration * rate + fixed<br>IR/recovery costs|Incident response cost bands,<br>staffing/vendor costs|
|Regulatory|Scenario/range distribution reflecting<br>applicable exposure|Jurisdictional/business assumptions; not<br>an accountingfact|



SentinelStack SDD-derived engineering artifact  |  Page 5 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

|**Component**|**Reference construction**|**Required inputs**|
|---|---|---|
|Reputation|Modeled business consequence scenario|Approved business assumptions;<br>i  l|
||or approved revenue-impact proxy|confidence explicitly flagged|
|Other|Business-specific modeled consequences|Approved parameter registry|



#### **6.2 Severity Distribution** 

Each loss component may use a parametric distribution, empirical bootstrap distribution, or scenario mixture. The distribution choice is recorded in model_versions and the parameter set is linked to the financial_parameters registry. 

- Lognormal / Gamma may be used for positive heavy-tailed cost components when empirical fit supports them. 

- Empirical bootstrap should be preferred when the organization has sufficient historical observations and stable definitions. 

- Scenario mixtures are permitted when several plausible consequence regimes exist (for example, short vs. prolonged outage). 

#### **6.3 Business Criticality and Service Dependency** 

Business criticality is not treated as an arbitrary “severity multiplier.” Instead, it determines which services, impact parameters and dependency paths are activated by an incident. Dependency strength controls propagation into upstream/downstream services. The implementation must apply an explicit allocation rule so a shared service is not counted twice. 

- Primary service association: use asset_service_links.is_primary where designated. 

- Secondary services: include only where the relationship type and dependency rules indicate business impact. 

- Propagation: multiply eligible impact by normalized dependency strength and apply the configured anti-double-counting allocation rule. 

- All criticality/dependency transformations are versioned because changing the propagation rule changes authoritative risk outputs. 

### **7. Aggregate Loss Distribution** 

#### **7.1 Event-Class Aggregation** 

For each event class i, the annual number of incidents N_i and severities L_i define an annual aggregate loss S_i. Enterprise annual loss is the sum across event classes after correlation/dependency handling. 

##### S = sum_i ( sum_{j=1..N_i} L_{i,j} ) 

#### **7.2 Monte Carlo Procedure** 

1. Sample annual incident counts N_i from the approved frequency model. 

2. For every sampled incident, sample a severity L_{i,j} from the approved severity distribution or empirical distribution. 

3. Apply dependency/correlation rules across event classes and shared services. 

4. Sum all event losses to obtain one annual aggregate loss S^(m). 

5. Repeat for M simulations (reference minimum 50,000 for production-grade VaR estimation; lower counts may be used for development and marked accordingly). 

6. Use the empirical simulated distribution to compute EAL, VaR and uncertainty bounds. 

#### **7.3 Correlation and Double Counting** 

###### **Required control** 

The aggregation layer shall not treat every source finding as an independent loss event. Multiple vulnerabilities, alerts or control failures on the same asset may contribute to one incident. The model therefore aggregates by incident scenario/event class and uses dependency/correlation rules before calculating annual loss. 

SentinelStack SDD-derived engineering artifact  |  Page 6 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

### **8. EAL, VaR, Risk Score and Financial Exposure** 

#### **8.1 Expected Annual Loss** 

##### EAL = E[S] 

EAL is the mean of the modeled annual aggregate loss distribution. In simulation form: 

##### EAL_hat = (1/M) * sum_m S^(m) 

#### **8.2 Value at Risk** 

##### VaR_alpha = Quantile_alpha(S) 

- Reference dashboard confidence levels: 95% and 99% are configurable. 

- VaR is a percentile threshold, not the maximum possible loss and not a guarantee that loss will remain below the value. 

#### **8.3 Financial Exposure** 

Financial Exposure is the reporting envelope of modeled monetary risk for the selected scope and time. The authoritative record stores the metric alongside the exact calculation bundle and confidence metadata. For a single-period decision view, the system may expose EAL and VaR separately so that “average annual loss” and “tail exposure” are not conflated. 

#### **8.4 Product Risk Score (0-100)** 

Risk Score is a SentinelStack product index for prioritization; it is not a regulatory score. It is versioned, configurable and decomposable so stakeholders can understand how financial exposure, annual incident probability and control gaps combine. 

##### S_E = 100 * clamp(EAL / EAL_appetite, 0, 1) 

##### S_L = 100 * P_annual(event or loss class) 

##### S_C = 100 * (1 - CE_enterprise) 

##### RiskScore = w_E*S_E + w_L*S_L + w_C*S_C,  where w_E + w_L + w_C = 1 

- EAL_appetite is an approved organizational risk-appetite threshold stored in configuration/financial parameters. 

- P_annual may be derived from aggregate event frequency as 1 - exp(-lambda_total) for a Poisson hazard approximation, or from the calibrated count model. 

- Weights are configuration, not arbitrary per-view changes; each score record stores the score-version and weights used. 

**Note:** If an appetite threshold is unavailable, the platform shall not fabricate a normalized financial Risk Score. It may show the raw EAL/VaR metrics and a “score unavailable / limited confidence” state instead. 

### **9. Risk Driver Attribution and Explainability** 

#### **9.1 Driver Types** 

|**Driver type**|**Method**|**Example**<br>l|
|---|---|---|
|Model driver|SHAP / feature contribution from the<br>approved ML model|KEV flag increased predicted exploitation<br>likelihood|
|Risk-engine driver|Counterfactual or deterministic<br>contribution to EAL / VaR|Downtime cost assumption drives tail<br>exposure|
|Asset/service driver|Scope decomposition|Internet-facing critical service contributes<br>large EAL share|
|Control driver|Delta from control effectiveness state|Low MFA coverage increases modeled<br>likelihood|



SentinelStack SDD-derived engineering artifact  |  Page 7 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

#### **9.2 Contribution Contract** 

A driver shown in the UI must be reproducible from stored attribution data. LLM prose may translate the driver into business language but does not create the underlying driver. 

##### Contribution_x ~= Metric(current) - Metric(counterfactual without x) 

**Note:** Counterfactual recomputation may be used for top-k expensive drivers. For the remaining drivers, normalized model attribution and deterministic decomposition may be used. The attribution method is persisted with the risk assessment. 

### **10. Control Effectiveness Model** 

#### **10.1 Evidence Components** 

|**Factor**|**Range**|**Interpretation**|
|---|---|---|
|Coverage|0..1|Fraction of relevant population protected<br>by the control|
|Configuration strength<br>f|0..1|Observed posture/strength against the<br>control definition|
|Incident effectiveness|0..1|Observed outcome/incident evidence<br>where available|
|Compliance state|0..1|Assessment/evidence state, not an<br>automatic proof of effectiveness|
|Freshness|0..1|Recency of supportingevidence|
|Source confidence|0..1|Reliability of the underlyingsource signal|



#### **10.2 Normalized Effectiveness** 

##### CE_k = WeightedMean(coverage, strength, incident, compliance) * freshness * source_confidence 

- All coefficients are versioned and constrained so 0 <= CE_k <= 1. 

- Freshness and source confidence reduce certainty/effective strength; they do not silently convert missing data to “control absent.” 

- Where control-outcome data is insufficient, approved priors may be used with an uncertainty penalty. 

### **11. Continuous Recalculation Semantics** 

#### **11.1 Trigger Classes** 

|**Trigger**|**Examples**|**Action**|
|---|---|---|
|Critical material|Known exploited vulnerability on critical<br>asset; control disablement|Priority recomputation; target within 15 min<br>of ingestion|
|Structural material|Service added/retired; dependency or<br>criticality changed|Recompute affected subtree and impacted<br>rollups|
|Routine|Low-severity vulnerability, normal control<br>telemetry refresh|Batch within 24 h full cycle|
|Model update|Approved model version or parameter<br>bundle changes|Recompute according to model-<br>governance rollout plan|
|Scenario only|User-created hypothetical state|Isolated scenario calculation; baseline<br>immutable|



#### **11.2 Recalculation Scope** 

Risk recalculation should be proportional to impact: first recompute the affected asset/service/event class, then propagate to business unit and enterprise aggregates. Materiality routing prevents recalculation storms when many correlated source records arrive in a short interval. 

SentinelStack SDD-derived engineering artifact  |  Page 8 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

### **12. What-If Scenario Engine** 

A scenario is a copy-on-write mutation over a baseline RiskAssessment. The engine applies approved mutations deterministically, reruns the same risk pipeline, and returns a comparable result without modifying baseline operational state. 



<!-- Start of picture text -->
(~=Baseline state)Recommended“approvedchange /tuture state portfolio<br>(TL ( _copy-omentespyormts, (sanasea™ )<br>(ovcaeantaiesSBR)—o SRI | —o{( yQuaaa Rec a kulaa a tesatecee affected))| ______( Grt=){Corcompaniesbaseline vs scenario (acS‘Optimization candidate)a)<br><!-- End of picture text -->

_Figure 2. Scenario-to-optimization flow_ 

#### **12.1 Scenario Delta** 

##### DeltaEAL = EAL_baseline - EAL_scenario 

##### DeltaVaR = VaR_baseline - VaR_scenario 

##### DeltaExposure = Exposure_baseline - Exposure_scenario 

- Positive delta means modeled risk decreases under the scenario. 

- All scenario outputs reference the same metric definition and comparable simulation settings as the baseline unless explicitly configured. 

#### **12.2 Standard Scenario Types** 

- Control coverage change (e.g., MFA 60% -> 100%). 

- Remediation delay (e.g., critical vulnerability patch delayed by 30 days). 

- Patch/mitigation implementation on selected assets. 

- Threat-stress scenario (e.g., threat activity factor increased 3x) with explicit “stress scenario” labeling. 

- Financial-parameter sensitivity (e.g., downtime cost/hour increased by 25%). 

**Note:** Scenarios are analytical assumptions, not predictions. Stress tests are explicitly labeled because they may move the system outside the historical training distribution. 

### **13. Mitigation Recommendation Quantification** 

A recommendation becomes optimization-eligible only when the system can establish a model-derived risk reduction and a valid cost/coverage/dependency record. 

#### **13.1 Recommendation Pipeline** 

Risk driver(s) 

- -> candidate action mapping 

- -> scenario simulation 

- -> DeltaEAL / DeltaVaR 

- -> cost / applicability / dependency validation 

- -> priority ranking 

- -> recommendation record 

- -> grounded explanation 

- -> optional optimizer candidate 

#### **13.2 Priority Ranking** 

Priority is computed from model-derived value and decision constraints. A reference composite score is: 

##### PriorityScore = a*NormalizedDeltaEAL + b*RiskUrgency + c*CoverageGain + d*EvidenceConfidence - e*NormalizedCost 

SentinelStack SDD-derived engineering artifact  |  Page 9 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

- Weights are configurable and versioned. 

- Hard constraints (mandatory control, applicability, dependency conflict) are evaluated before ranking. 

- The LLM may explain why an action is high priority; it does not determine DeltaEAL or Cost. 

### **14. Investment Optimization and ROSI** 

#### **14.1 Decision Variables** 

##### x_i in {0,1}   for binary investment options 

- Continuous or fractional variables are allowed only when the option semantics justify partial deployment (e.g., coverage rollout). 

#### **14.2 Primary Optimization Objective** 

##### maximize  DeltaEAL_portfolio 

#### **14.3 Constraints** 

##### sum_i Cost_i*x_i <= Budget 

- Dependency constraints: prerequisite controls must be selected before dependent options. 

- Conflict constraints: mutually exclusive options cannot be selected together. 

- Applicability constraints: option must apply to at least one in-scope asset/service. 

- Mandatory constraints: required remediation/control actions may be fixed to selected when policy demands. 

#### **14.4 Interaction-Aware Evaluation** 

Individual option risk reduction is used for screening. Because security controls interact, the final selected portfolio must be evaluated as a portfolio scenario through the scenario engine whenever feasible. This prevents additive double counting. 

#### **14.5 Cost-Effectiveness** 

##### ValueDensity_i = DeltaEAL_i / Cost_i 

- ValueDensity is a ranking aid, not a replacement for portfolio optimization. 

- Among near-optimal portfolios, lower cost or higher value density may be used as a secondary preference, subject to governance policy. 

#### **14.6 ROSI** 

##### ROSI = (DeltaEAL - InvestmentCost) / InvestmentCost 

- InvestmentCost must be normalized to the same evaluation period used for DeltaEAL. 

- ROSI is a modeled economic metric, not a guarantee of realized savings. 

#### **14.7 Investment-vs-Risk-Reduction Curve** 

The platform evaluates budgets across a configurable range, solves the optimization for each budget point, and plots the efficient frontier: total investment on the x-axis and modeled risk reduction on the y-axis. Diminishing returns are identified from the slope change of the frontier. 

### **15. Uncertainty, Confidence and Data Coverage** 

#### **15.1 Three Distinct Uncertainty Types** 

|**Type**|**Meaning**|**Representation**|
|---|---|---|
|Model uncertainty|Uncertainty in learned parameters /|Prediction intervals, calibration metrics,|
||predictions|ensemble/spread where applicable|
|Input uncertainty|Uncertain business or security parameters|Ranges/distributions in|



SentinelStack SDD-derived engineering artifact  |  Page 10 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

|**Type**|**Meaning**|**Representation**<br>i|
|---|---|---|
|||financial_parameters|
|Data coverage uncertainty|Important sources or populations|Coverage %, freshness, missing-source<br>l|
||missing/stale|flags|



#### **15.2 Reported Outputs** 

- Point estimate plus P10/P50/P90 or equivalent interval for financial metrics when supported by simulation. 

- Likelihood confidence / calibration metadata for predictive outputs. 

- Data coverage indicator showing which required source classes were present and fresh. 

- Assumption register references for estimated financial parameters. 

#### **15.3 No-False-Precision Gate** 

- If an essential input is missing, the system reduces confidence, widens uncertainty, or withholds the metric. 

- If the scoring point is out-of-distribution relative to validated model data, the UI must surface an OOD/stress flag. 

- A missing SIEM/EDR/IAM feed does not mean “zero incidents” or “fully effective controls.” 

### **16. Model Governance and Validation** 

#### **16.1 Lifecycle** 

Data validation -> training -> temporal validation -> calibration -> model registry 

-> approval -> deployment -> shadow scoring -> monitoring 

-> drift detection -> retraining/revalidation -> versioned promotion / rollback 

#### **16.2 Required Validation Metrics** 

|**Workload**<br>i|**Minimum evaluation set**|
|---|---|
|Likelihood classifier|PR-AUC, ROC-AUC, Precision, Recall, F1, Brier score, calibration<br>curve / ECE, temporal backtest|
|Frequency model|Calibration of mean/dispersion, count residual diagnostics,<br>temporal stability|
|Severity model|Distribution fit diagnostics, tail stability, bootstrap/holdout error<br>where labeled loss data exists|
|Risk engine|Reproducibility, aggregation reconciliation, unit/currency<br>consistency, scenario invariance outside changed state|
|Optimizer|Budget feasibility, dependency feasibility, portfolio value,<br>deterministic repeatability|



#### **16.3 Temporal Leakage Prevention** 

- Use time-ordered train/validation/test splits for predictive security workloads. 

- Do not use future labels, future remediation status, future threat signals or post-event telemetry in a point-in-time feature row. 

- Data lineage stores observation time and collection time separately where possible. 

#### **16.4 Model Promotion Gate** 

###### **Promotion gate** 

Production promotion requires temporal validation, calibration adequacy, data-quality checks, a stability/drift plan, explainability review, documented limitations, and approval of the model version. 

SentinelStack SDD-derived engineering artifact  |  Page 11 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

### **17. Failure Modes and No-False-Precision Rules** 

|**Failure / edge case**<br>i|**Required system behavior**|
|---|---|
|Missing business financial parameters|Show EAL/VaR as limited/unavailable or use explicitly approved<br>assumptions with wider uncertainty; never invent values.|
|New vulnerability outside model distribution|Ingest and score with OOD flag; prefer conservative<br>uncertainty/stress treatment; do not claim exact prediction.|
|Geopolitical / black-swan event|Do not predict the event. Support stress testing and<br>recomputation when new threat/business evidence arrives.<br>f|
|Source outage|Mark affected source stale; preserve last-known timestamp; lower<br>coverage/confidence; trigger operational alert.|
|Conflicting source records|Use source precedence/data-quality rules; quarantine unresolved<br>conflicts; preserve both lineage records.|
|Duplicate incident telemetry|Deduplicate based on source identifiers/content fingerprints and<br>event correlation rules.|
|Scenario invalid|Reject mutation if schema/type/range/authorization constraints<br>fail.|
|Optimizer infeasible|Return infeasibility reason and closest policy-compliant<br>alternatives; never return a budget-violating portfolio.|
|Audit hash mismatch|Raise integrity alert; block “verified” label for affected record until<br>investigation.|



### **18. Implementation Interfaces and Persistence** 

#### **18.1 Service Inputs / Outputs** 

|**Interface**|**Input**|**Output**|
|---|---|---|
|Risk assessment API|scope, timestamp, model bundle, state<br>snapshot|risk_assessment_id, EAL, VaR, Risk Score,<br>Exposure, confidence, drivers, calculation<br>hash|
|Prediction API|feature vector + model version|prediction_value, bounds, confidence,<br>model metadata|
|Scenario API|baseline assessment + mutations|scenario_id, scenario metrics, deltas,<br>affected entities|
|Recommendation API|drivers + candidate actions|recommendations with cost, DeltaEAL,<br>confidence, evidence refs|
|Optimizer API|budget + eligible options + constraints|portfolio, cost, DeltaEAL, residual<br>EAL/VaR, ROSI, feasibility status|
|NLQ API|user question + authorization scope|grounded response using backend metrics;<br>no direct metric writes|



#### **18.2 Persistence Contracts** 

|**Entity**|**Key requirement**|
|---|---|
|model_predictions|Store prediction type/value/bounds/explanation plus model<br>version and scoringcontext.|
|risk_assessments|Authoritative EAL/VaR/RiskScore/Exposure plus calculation hash,<br>confidence and timestamp.|
|risk_assessment_inputs|Link assessment to source records and prediction inputs.|
|risk_drivers|Store rank/contribution/entity/evidence references independently<br>from narrative text.|
|scenarios / scenario_changes|Persist baseline id and each mutation; never overwrite baseline.|
|optimization_runs / results|Persist budget, constraints, optimizer version, selections, residual<br>risk and value.|
|evidence / audit_events|Persist source linkage, hashes, actor/time and tamper-evident<br>metadata.|



SentinelStack SDD-derived engineering artifact  |  Page 12 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

#### **18.3 Canonical Calculation Hash** 

A material risk assessment shall generate a calculation hash over a canonical representation containing the assessment scope, approved input identifiers/versions, model bundle version, parameter versions, simulation configuration, assumptions and authoritative outputs. The hash is used for reproducibility/integrity checks, not as evidence that the model is statistically correct. 

### **19. Verification and Acceptance Tests** 

|**Test ID**|**Verification**|
|---|---|
|RQ-01|**i**<br>For every production assessment, all authoritative metrics are<br>reproducible from stored inputs, parameter versions and model<br>bundle.|
|RQ-02|Likelihood probability remains within [0,1] and passes calibration<br>acceptance criteria before promotion.|
|RQ-03|30-day probability annualization produces the expected rate under<br>the constant-hazard transformation.|
|RQ-04|EAL equals the mean of the simulated annual loss distribution<br>within numerical tolerance.|
|RQ-05|VaR matches the configured empirical percentile within<br>simulation error tolerance.|
|RQ-06|Changing only MFA coverage in a scenario changes scenario<br>outputs while baseline assessment remains unchanged.|
|RQ-07|Top risk drivers returned by the UI match persisted attribution<br>records.|
|RQ-08|An optimization result never exceeds budget or violates<br>dependency/conflict constraints.|
|RQ-09|Portfolio DeltaEAL is re-evaluated for interaction effects when<br>required; additive estimates are not treated as authoritative where<br>interactions are material.|
|RQ-10|ROSI uses the same evaluation horizon/currency basis for risk<br>reduction and cost.|
|RQ-11|Missing financial parameters trigger<br>limited-confidence/unavailable state rather than fabricated<br>precision.|
|RQ-12|High-severity material changes trigger affected-risk recalculation<br>within the SRS freshness target under controlled test conditions.|
|RQ-13|Every material assessment links to model version, source lineage<br>and calculation hash.|
|RQ-14|LLM/NLQ output exactly reflects backend metric values and<br>cannot mutate authoritative risk records.|
|RQ-15|Audit tamper-evidence verification detects modified<br>payload/hash-chain records.|



### **20. Requirements Traceability** 

|**SRS requirement**|**Mathematical/design realization**|
|---|---|
|FR-04|Section 5: calibrated probabilistic likelihood model and<br>annualization contract|
|FR-05|Section 6: statistical/ML-supported severity and business-impact<br>distribution|
|FR-06 / FR-06A / FR-06B|Sections 7-8: aggregate loss, EAL, VaR, Financial Exposure, Risk<br>Score, historical snapshots|
|FR-07|Section 6.3: business service mapping, criticality and<br>dependency-aware impact|
|FR-08|Section 10: normalized control effectiveness|
|FR-09|Section 9: reproducible driver attribution|
|FR-10|Section 16: predictive workload lifecycle and trend-related inputs|
|FR-11|Section 13: quantified mitigation recommendation pipeline|
|FR-12 / FR-12A|Sections 1 and 18:grounded NLQ and technical-to-business|



SentinelStack SDD-derived engineering artifact  |  Page 13 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

|**SRS requirement**|**Mathematical/design realization**|
|---|---|
||translation boundary|
|FR-13|Section 12: isolated what-if recomputation and delta metrics|
|FR-14 / FR-15 / FR-16|Section 14: budgets, candidate attributes, constrained portfolio<br>optimization|
|FR-17 / FR-18 / FR-19|Section 14: ROSI, cost-effectiveness and investment frontier|
|FR-20 / FR-21 / FR-22|Sections 8-9 + data persistence: executive/technical outputs and<br>drill-down lineage<br>i|
|FR-23 / FR-24|Sections 18-19: evidence linkage, reportinginputs and verification|
|NFR-03A|Section 11: trigger classes and 15-minute / 24-hour recalculation<br>semantics|
|NFR-05|Sections 9, 15, 16: explainability, uncertainty and model<br>governance|
|NFR-08|Section 18.3 + governance lineage: calculation hashes and<br>tamper-evident audit|
|NFR-10|Section 4 + persistence: source-record lineage and configurable<br>telemetry retention|



#### **20.1 Alignment to PS 26105** 

###### **Coverage statement** 

This mathematical specification operationalizes the PS 26105 core loop: multi-source evidence -> continuous cyber risk quantification -> likelihood and financial impact -> EAL/VaR/risk scores -> risk drivers -> AI decision support -> what-if scenarios -> budget-constrained investment optimization -> ROSI/cost-benefit -> executive/technical/governance outputs. 

SentinelStack SDD-derived engineering artifact  |  Page 14 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

### **Appendix A. Worked Illustrative Example** 

The following values are illustrative only and do not represent any real organization. They demonstrate the mechanics of the specification. 

#### **A.1 Likelihood** 

Suppose a calibrated model estimates a 30-day probability p_h = 0.08 for a defined incident class on a critical service. 

##### H_years = 30/365 = 0.08219 

##### lambda = -ln(1 - 0.08) / 0.08219 ~= 1.015 events/year 

#### **A.2 Impact** 

Suppose a severity simulation samples uncertainty in outage duration, response cost and data-impact consequences. Assume the resulting annual aggregate loss simulation across all event classes has mean E[S] = Rs 7.8 crore and the 95th percentile is Rs 22.4 crore. 





#### **A.3 Scenario** 

A scenario changes privileged-account MFA coverage from 60% to 100%. The same pipeline is rerun without mutating the baseline. 

EAL_baseline = Rs 7.8 crore 

EAL_scenario = Rs 5.9 crore DeltaEAL = Rs 1.9 crore/year 

#### **A.4 Investment Value** 

Suppose the normalized implementation cost for the evaluation period is Rs 42 lakh. 

##### ROSI = (1.9 crore - 0.42 crore) / 0.42 crore ~= 3.52x 

**Note:** The numerical example is intentionally illustrative. Production values must be derived from approved organizational data, validated models, and versioned assumptions. 

### **Appendix B. Parameter Registry** 

|**Parametergroup**|**Examples**|**Governance**|
|---|---|---|
|Likelihood|Horizon, model threshold, calibration<br>acceptance, annualization convention|Model version + approval|
|Frequency|Poisson/NB family, dispersion, event-class<br>segmentation|Statistical model version|
|Impact|Downtime rate, breach cost, response<br>cost, regulatory scenario bands|Financial parameter version + owner|
|Criticality / dependency|Criticality thresholds, dependency<br>propagation rules|Risk-method version|
|Controls|Effectiveness weights, beta coefficients,<br>freshness thresholds|Control-model version|
|Risk Score|EAL appetite, weights w_E/w_L/w_C|Risk-score version|
|Simulation|M, random-seed policy, confidence levels|Calculation bundle version|
|Optimization|Objective weights, near-optimal tolerance,<br>constraints|Optimizer version / policy|



SentinelStack SDD-derived engineering artifact  |  Page 15 

SentinelStack  |  Risk Quantification & Mathematical Model Specification  |  PS 26105 

### **Appendix C. Mathematical Implementation Checklist** 

- Implement likelihood output as a calibrated probability with timestamp and model version. 

- Convert horizon probability to annualized frequency using the approved hazard transformation. 

- Build severity distributions from approved financial parameters and empirical loss evidence where available. 

- Aggregate event counts and severities into annual loss simulations with explicit dependency rules. 

- Persist EAL, VaR, Financial Exposure and Risk Score as authoritative risk_assessment outputs. 

- Persist risk drivers independently of LLM narrative. 

- Implement scenario copy-on-write and exact delta computation. 

- Feed only quantified, eligible recommendation options into optimization. 

- Use portfolio-level scenario evaluation for material interaction effects. 

- Persist model/parameter/simulation versions and calculation hashes for every material assessment. 

- Validate calibration, temporal leakage, reproducibility, uncertainty and budget feasibility before release. 

SentinelStack SDD-derived engineering artifact  |  Page 16 

