SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

# **SENTINELSTACK** 

## **ML Dataset & Training Specification** 

AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform 

|**Problem Statement**|26105|
|---|---|
|**Organization**|All India Council for Technical Education (Cyber Security<br>Cell)|
|**Document Version**|1.0|
|**Document Status**|Engineering Baseline|
|**Source Baselines**|PS 26105 • SRS v2.1 • SDD v1.1 • Data Dictionary v1.0 •<br>Risk Model Spec v1.0|
|**Date**|23 September 2026|
|**Primary Purpose**|Define reproducible ML data construction, training,<br>validation, calibration, governance, and deployment<br>contracts|



##### **Engineering rule** 

ML models estimate uncertain variables; authoritative EAL, VaR, Financial Exposure and Product Risk Score remain outputs of the governed Risk Quantification Engine. The LLM does not calculate or override those metrics. 

AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

### **Contents** 

- 1. Purpose and Scope 

- 2. Baseline Alignment and Traceability 

- 3. ML Workload Map 

- 4. Data Source Strategy 

- 5. Dataset Construction Architecture 

- 6. Canonical Training Dataset Schema 

- 7. Label Engineering 

- 8. Feature Engineering and Point-in-Time Semantics 

- 9. Dataset Splitting and Leakage Prevention 

- 10. Model Specifications 

- 11. Class Imbalance and Sampling 

- 12. Training Pipeline and Reproducibility 

- 13. Evaluation and Acceptance Criteria 

- 14. Probability Calibration and Uncertainty 

- 15. Model Deployment and Inference Contract 

- 16. Monitoring, Drift and Retraining 

- 17. Governance, Provenance and Model Cards 

- 18. Synthetic Enterprise Context for SIH Demonstration 

- 19. Limitations and Non-Claims 

- 20. Verification Checklist 

- Appendix A. Feature Dictionary 

- Appendix B. Dataset Lineage 

- Appendix C. References 

AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

### **1. Purpose and Scope** 

This specification defines how SentinelStack constructs, validates, trains, calibrates, deploys and governs its machine-learning workloads. It is subordinate to the SRS and SDD and turns their ML-related requirements into executable data and model contracts. 

The primary ML objective is to estimate uncertain variables used by the Risk Quantification Engine, especially the probability that a defined cyber event occurs within a specified horizon and, where evidence permits, the financial severity of an incident. Additional ML workloads support anomaly detection and trend prediction required by the AI Decision Support Layer. 

##### **Scope boundary** 

This document does not claim that public datasets contain a complete enterprise view. Public data supplies observed incidents, vulnerabilities, exploit signals and selected security telemetry; deployment-specific asset criticality, service dependencies, control coverage and business-impact parameters come from the enterprise environment. Public and synthetic records SHALL remain distinguishable in provenance. 

#### **1.1 Design Goals** 

- Point-in-time training examples that mirror the way inference will operate in production. 

- No use of future information when constructing a feature row. 

- Calibrated probabilities because probability feeds annualized risk and financial loss calculations. 

- Separation of predictive estimation from deterministic risk quantification. 

- Reproducible data/model artifacts with immutable version identifiers and provenance. 

- Explicit uncertainty, data coverage and out-of-distribution (OOD) handling. 

### **2. Baseline Alignment and Traceability** 

The SRS requires continuous AI/ML predictive analytics, incident likelihood estimation, statistical/ML financial-impact estimation, quantified mitigation recommendations, and grounded decision support. The Risk Model Specification defines the probability contract, annualization, severity distributions, Monte Carlo aggregation, risk scoring, scenario deltas and modelgovernance rules. The SDD defines the component boundaries and persistence contracts that this ML specification implements. 

|**Source requirement**|**ML/data realization**|**Verification**|
|---|---|---|
|FR-04 Incident likelihood|Calibrated probabilistic model over point-in-<br>time observations; outputs p_h and<br>uncertainty metadata.|Temporal holdout + calibration +<br>reproducibility tests.|
|FR-05 Financial impact|Conditional severity model/empirical<br>distribution for business impact components;<br>deterministic impact composition remains<br>governed by Risk Engine.|Backtesting of severity/quantiles +<br>distribution fit checks.|
|FR-10 Predictive analytics|Vulnerability/threat/control trends plus<br>anomaly workload.|Temporal forecasting/backtest + drift<br>monitoring.|
|FR-11 Mitigations|Model-derived ΔEAL/ΔVaR enters<br>recommendation eligibility; ranking uses<br>model value and governance constraints.|Recommendation lineage and scenario re-<br>run tests.|
|FR-13 What-if|Scenario engine changes feature/state<br>inputs, then reruns the same versioned<br>predictive bundle.|Baseline unchanged + comparable metric<br>deltas.|
|FR-16 Optimization|Optimizer consumes quantified option values<br>and costs; portfolio is re-evaluated as a<br>scenario.|Budget/dependency constraint tests.|
|FR-20 Risk trends|Time-stamped risk snapshots remain<br>separate from training data but provide<br>prediction targets and monitoring signals.|Trend continuity + snapshot retention<br>checks.|
|NFR-05 Explainability|Feature attribution and evidence references<br>are stored with predictions.|Attribution consistency tests.|



AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

|**Source requirement**|**ML/data realization**|**Verification**|
|---|---|---|
|NFR-08 Auditability|Dataset/model versions, hashes, feature<br>windows and decision lineage are persisted.|Hash reproducibility + audit-chain checks.|
|NFR-10 Telemetry retention|Retention policy preserves source-to-feature<br>lineage and permits replay under policy.|Retention/replay test.|



### **3. ML Workload Map** 

|**Workload**|**Purpose**|**Primary output**|**Feeds authoritative risk?**|
|---|---|---|---|
|ML-01 Likelihood|Estimate probability of defined<br>cyber event within horizon H.|p_h  [0,1], calibration metadata,<br>∈<br>attribution.|Yes — as an input to annualized<br>frequency; Risk Engine remains<br>authoritative.|
|ML-02 Severity|Estimate/condition the<br>distribution of financial incident<br>impact.|Severity parameters or quantiles;<br>component uncertainty.|Yes — as an input to loss<br>distribution; Risk Engine<br>composes losses.|
|ML-03 Behavioral anomaly|Detect unusual<br>SIEM/IAM/EDR/CSPM behavior.|Anomaly score / alert signal.|Indirectly — becomes a<br>contextual risk feature.|
|ML-04 Trend prediction|Predict vulnerability, threat and<br>control-performance trajectories.|Forecast / trend indicator with<br>interval.|Indirectly — decision-support<br>and scenario inputs.|
|LLM-D1 Grounded language|Explain verified metrics and<br>answer natural-language<br>queries.|Narrative grounded on structured<br>backend results.|No — never authoritative for risk<br>numbers.|



### **4. Data Source Strategy** 

SentinelStack uses a layered data strategy so the training program is evidence-based without pretending that a single public dataset contains enterprise telemetry, business context and financial impact together. 

|**Source family**|**Use in SentinelStack**|**Key fields / signals**|**Important caveat**|
|---|---|---|---|
|NVD / CVE vulnerability data|Vulnerability state and metadata.|CVE, publication dates, CVSS,<br>affected products/CPE/CWE where<br>available.|Describes vulnerability knowledge,<br>not enterprise exposure.|
|FIRST EPSS|Population-level exploitation<br>likelihood feature and benchmark.|CVE, daily EPSS, percentile,<br>historical date.|EPSS is population-level, not<br>organization-specific; layer local<br>context. [1]|
|CISA KEV|Observed known-exploited signal<br>and future label proxy.|CVE, date added, due date,<br>vendor/product, required action.|KEV indicates known exploitation;<br>not all exploitation becomes KEV.<br>[2]|
|VERIS / VCDB|Real-world incident<br>frequency/severity context.|Incident date/type, actors, actions,<br>assets, outcomes and other coded<br>attributes.|Publicly disclosed incidents are<br>incomplete and biased; not a<br>comprehensive enterprise<br>telemetry corpus. [3]|
|WitFoo Precinct6 v2.0.0|Real enterprise security-event<br>corpus for anomaly/detection<br>research and pipeline stress<br>testing.|114,421,340 labelled events +<br>incident leads/provenance.|Labels are machine-derived, one<br>contributor supplied 87% of live<br>rows, 33-day capture; not analyst-<br>adjudicated ground truth. [4]|
|Published cyber-loss research|Financial severity<br>reference/benchmark.|Event dates, industry, firm factors,<br>loss size, contagion indicators.|Research sample, not a universal<br>organization-specific loss curve. [5]|
|Enterprise private data|Production context and<br>organization-specific prediction.|Assets, services, criticality,<br>exposure, controls, telemetry,<br>business impact.|Sensitive; access, retention and<br>residency are deployment<br>governed.|
|SIH synthetic context|Demonstration/integration only.|Assets, services, dependencies,<br>control coverage, business impact<br>parameters.|Must be labelled SYNTHETIC and<br>not used alone to claim model<br>validity.|



AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

##### **Public-data rule** 

Do not use EPSS as the target for the likelihood model. EPSS may be a feature or external benchmark, while the target should come from a separately defined future outcome such as future KEV membership or observed incident occurrence. FIRST explicitly notes that EPSS is a calibrated population-level probability and should be layered with local context. [1] 

### **5. Dataset Construction Architecture** 



<!-- Start of picture text -->
(Pubic rea: werd)<br>—Enterpriseontodata / SIH——"s"Yana‘oserstonpatieble “leakageLabel ulder contas Trantestyalte me Modeleawrason ang | —*{ odeeeteard rey J—* wisence"onceeae )__("—| —P{ ikerane (eat var se)>)<br><!-- End of picture text -->

**Figure 1. Reproducible ML training pipeline from public/enterprise evidence to the governed Risk Engine inference contract.** 

Dataset construction is performed in versioned stages: acquisition → raw landing → parsing → canonicalization → entity resolution → point-in-time feature assembly → label construction → quality checks → split generation → training dataset snapshot. Every stage records source version, acquisition timestamp, transformation version and lineage references. 

- Never overwrite raw source records; create immutable ingestion snapshots. 

- Keep observation time and collection time separately when available. 

- Use stable entity identifiers for CVEs, assets, services and controls. 

- Persist dataset snapshot ID, feature-set version and label-policy version with every training run. 

- Fail closed on schema violations, impossible timestamps, duplicated canonical IDs or feature timestamps after the label cutoff. 

### **6. Canonical Training Dataset Schema** 

The primary likelihood training row is an asset-vulnerability observation at time t. For public-data experiments, asset/context columns may be synthetic or absent; absence SHALL be represented explicitly, never as an assumed “safe” value. 

|**Column**|**Type**|**Meaning**|**Source**|**Leakage rule**|
|---|---|---|---|---|
|observation_id|UUID|Unique point-in-time row ID.|Generated|Immutable.|
|observation_time|TIMESTAMP|Time at which the feature<br>state is valid.|Source/derived|All predictors ≤ this time.|
|asset_id|STRING|Enterprise asset or synthetic<br>asset identifier.|Asset inventory|Stable mapping only.|
|service_id|STRING|Primary service context.|CMDB/service map|Only state known by t.|
|cve_id|STRING|Vulnerability identifier.|NVD/enterprise scanner|Stable identifier.|
|cvss_base|FLOAT|CVSS base score.|NVD/scanner|Versioned source snapshot.|
|epss_score|FLOAT|EPSS score for CVE as-of t.|FIRST EPSS|Historical date query; never<br>use future score.|
|kev_flag|BOOLEAN|Whether CVE was in KEV by<br>t.|CISA KEV|Point-in-time lookup.|
|vuln_age_days|INTEGER|Days since vulnerability<br>publication at t.|NVD + t|Derived from past dates only.|
|exploit_available|BOOLEAN|Observed exploit/tooling<br>signal available by t.|Threat intel/enterprise|No future publication dates.|
|internet_exposed|BOOLEAN|Asset externally reachable at<br>t.|Asset/CSPM|Point-in-time inventory.|
|asset_criticality|FLOAT|Business criticality score/tier<br>at t.|Enterprise context|Private or synthetic;<br>provenance flag mandatory.|
|dependency_weight|FLOAT|Business-service|Service map|No future topology.|



AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

|**Column**<br>|**Type**<br>|**Meaning**|**Source**|**Leakage rule**|
|---|---|---|---|---|
|~~a~~<br>|~~a~~<br>|dependency strength at t.|||
|mfa_coverage<br>~~aaa~~<br>|FLOAT<br>~~a~~|Control coverage at t.|IAM / enterprise|Point-in-time snapshot.|
|edr_coverage<br> <br>~~aa~~|FLOAT<br>|EDR control coverage at t.|EDR|Point-in-time snapshot.|
|control_effectiveness<br><br>|FLOAT|Normalized, coverage-aware<br>effectiveness.|Control model|Versioned calculation.|
|threat_activity<br>~~aa~~<br>|FLOAT|Recent threat/activity signal.|Threat intel / telemetry|Window must end ≤ t.|
|behavior_anomaly<br><br>~~a~~<br>|FLOAT<br>|Recent anomaly indicator.<br>|SIEM/EDR/IAM<br>|Window must end ≤ t.<br>|
|label_horizon_days<br>~~a~~|INTEGER<br>~~a ~~|Prediction horizon H.<br> ~~e~~|Experiment config<br>|Fixed per experiment.<br>~~e~~|
|target_event|BOOLEAN|Whether defined event<br>occurs in (t, t+H].|Future observations|Created after feature freeze;<br>never a feature.|
|target_source|STRING|Label provenance/policy.|Label builder|Must reference<br>source/version.|
|synthetic_context_flag<br>|BOOLEAN|Whether any contextual fields<br>are synthetic.|Pipeline|Cannot be false when<br>synthetic data used.|
|dataset_snapshot_id<br>~~a~~|STRING|Immutable dataset version.|Pipeline|Required for reproducibility.|



### **7. Label Engineering** 

#### **7.1 Likelihood Target** 

Primary target: Y = 1 when the defined event class occurs within the prediction horizon H after observation time t; otherwise Y = 0. The event definition must be fixed before dataset construction. Example experiment: “CVE becomes known exploited (KEV) within the next 30 days,” using the future KEV state only for labeling. 

##### **Important label distinction** 

“Exploited within 30 days” and “added to KEV within 30 days” are not the same target. The latter is a defensible public-data proxy when first-exploitation timestamps are unavailable. The experiment registry must name the target exactly; results must not be described as a stronger claim than the label supports. 

#### **7.2 Severity Target** 

For financial-impact modeling, the target is one or more observed loss components or an aggregate loss amount under a stable event definition. Heavy-tailed positive losses may be modelled with parametric distributions or quantile regression when supported by empirical fit; empirical bootstrap is preferred when the enterprise has enough consistent history. 

#### **7.3 Negative / Unknown Cases** 

- A missing future record is not automatically a confirmed negative if the observation window is censored or telemetry coverage is insufficient. 

- Rows with incomplete observation windows SHALL be marked censored/unknown and excluded from ordinary binary-loss evaluation unless a survival/censoring method is explicitly implemented. 

- Target-source provenance must distinguish observed, proxy-derived and synthetic labels. 

### **8. Feature Engineering and Point-in-Time Semantics** 



AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

**Figure 2. Feature families entering a point-in-time model vector.** 

|**Feature family**|**Examples**|**Allowed time window**|**Transformation notes**|
|---|---|---|---|
|Vulnerability|CVSS, EPSS, KEV, exploit<br>availability, age, patch state|≤ t|Normalize, preserve source<br>version.|
|Exposure|Internet-facing, reachable service,<br>external attack-surface signals|≤ t|Encode topology state as-of t.|
|Threat|Recent targeting signals,<br>confidence, technique prevalence|≤ t|Windowed aggregates; no future<br>event counts.|
|Asset/service|Criticality, service criticality,<br>dependency|≤ t|Use active relationship valid at t.|
|Controls|MFA, EDR, configuration,<br>incidents, compliance|≤ t|Coverage-aware normalization.|
|Behavior|Event rates, anomaly indicators|Window ending at or before t|Use bounded lookback window;<br>record window length.|
|Historical trend|Counts, rates, slope, EWMA-like<br>features|≤ t|Do not compute from future risk<br>snapshots.|



Feature transforms SHALL be versioned. For every derived feature, the lineage record should identify the source fields, transformation code/version, lookback interval and missing-value policy. 

### **9. Dataset Splitting and Leakage Prevention** 

Predictive workloads use time-ordered splits because the intended production task is forward-looking. A random split can place future vulnerability or threat signals in the training set while the same underlying event appears in validation/test. 

|**Stage**|**Time semantics**|**Purpose**|
|---|---|---|
|Train|Earliest contiguous period|Fit model parameters.|
|Validation|Later contiguous period|Select hyperparameters, feature set and<br>calibration strategy.|
|Test|Latest untouched period|Final estimate of generalization.|
|Rolling backtest|Multiple forward windows|Measure stability across time and threat-<br>regime changes.|



#### **9.1 Leakage Checklist** 

- No feature timestamp > observation_time. 

- No future KEV status, future EPSS score, future patch status, future control state or post-incident telemetry. 

- No dataset-wide target encoding that crosses time boundaries. 

- Entity-level deduplication performed before splitting when duplicated incidents/records could cross partitions. 

- Scalers/encoders fit on training period only and then applied forward. 

- Hyperparameter tuning never touches the final test period. 

- For severity data, post-loss financial information must not be used as a predictor unless it was genuinely known before the modeled event outcome. 

### **10. Model Specifications** 

#### **10.1 ML-01 Likelihood Model** 

Baseline: logistic regression for transparent calibration benchmark. Candidate: gradient-boosted decision trees for nonlinear tabular relationships. Promotion is allowed only when the candidate improves out-of-time performance and calibration versus the baseline and passes governance checks. 

AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

||**Item**|**Specification**|
|---|---|---|
|Input||Canonical point-in-time feature vector.|
|Target||Y  {0,1} for a defined event class/horizon.<br>∈|
|Output||p_h = P(Y=1 | X_t), plus calibration metadata and attribution.|
|Primary metrics||PR-AUC, ROC-AUC, Brier score, log loss, recall/precision at<br>operational thresholds.|
|Calibration||Platt scaling, isotonic regression or another validated method fit on<br>validation data only.|
|Explainability||SHAP/feature contributions or model-specific equivalent; stored with<br>prediction.|
|Promotion||Must pass temporal test, calibration and stability gates.|



#### **10.2 ML-02 Financial Severity Model** 

Severity is modeled as a distribution, not a single point value. Candidate methods include lognormal/Gamma regression, quantile regression, or empirical/bootstrapped severity depending data volume and fit. The output can provide conditional quantiles or distribution parameters to the Risk Engine, which composes loss components and performs aggregate-loss simulation. 

|**Output**|**Meaning**|**Use**|
|---|---|---|
|q10 / q50 / q90|Conditional loss quantiles|Uncertainty and scenario display.|
|Distribution parameters|Parameters for approved severity family|Monte Carlo sampling.|
|Component losses|Downtime, breach, response, regulatory,<br>reputational, other|Compose aggregate loss with governed anti-<br>double-counting rules.|



#### **10.3 ML-03 Behavioral Anomaly** 

Initial workload: unsupervised/semi-supervised anomaly detection such as Isolation Forest or robust statistical baselines. An anomaly score is a risk signal, not a confirmed incident. When labels exist, evaluate detection utility against labelled outcomes while preserving the label limitations of the source dataset. 

#### **10.4 ML-04 Trend Prediction** 

Trend models operate on time-series aggregates such as vulnerability counts, threat-signal rates, control-performance measures and risk-metric snapshots. Initial baselines should be simple, interpretable time-series or feature-based models; more complex methods are promoted only when temporal backtesting demonstrates value. 

### **11. Class Imbalance and Sampling** 

Rare-event cyber prediction creates severe class imbalance. Accuracy SHALL NOT be the primary likelihood metric. The model evaluation should emphasize PR-AUC, recall/precision at operating thresholds, Brier score/log loss and calibration. The zeroevent baseline must be reported because it exposes the danger of inflated accuracy under rarity. 

- Use class weights or focal/weighted objectives before naive oversampling when appropriate. 

- Any oversampling is performed inside training folds only. Never oversample validation/test periods. 

- Undersampling must preserve temporal and industry/asset structure. 

- Report prevalence in each split. 

- Threshold selection must be based on operational capacity or explicitly declared decision cost, not tuned on the test set. 

### **12. Training Pipeline and Reproducibility** 

Every training run produces a reproducibility bundle containing dataset snapshot ID, source versions, transformation version, feature-set version, label policy, code commit, environment lockfile/container digest, random seeds, hyperparameters, calibration method, metric report and model hash. 

AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

|**Artifact**|**Required metadata**|
|---|---|
|Dataset snapshot|Snapshot ID, source versions, acquisition time, row counts, schema hash.|
|Feature set|Feature IDs, transformations, windows, imputation policy, feature schema<br>hash.|
|Label policy|Target definition, horizon, censoring policy, source mapping and version.|
|Training run|Code commit, environment digest, seed, hyperparameters, training<br>duration.|
|Model artifact|Model version, serialized artifact hash, input schema, output schema.|
|Calibration artifact|Calibration method, fit-period ID, calibration metrics.|
|Model card|Purpose, population, metrics, limitations, intended use, non-use claims.|



##### **Reproducibility test** 

Given the same dataset snapshot, feature version, code/environment and seed, the training pipeline must reproduce model metadata and prediction outputs within a defined numerical tolerance. Any non-deterministic component must be documented. 

### **13. Evaluation and Acceptance Criteria** 

|**Area**|**Acceptance condition**|
|---|---|
|Data quality|Schema, type, timestamp, identifier, duplicate and lineage checks pass<br>configured quality gates.|
|Likelihood discrimination|PR-AUC/ROC-AUC reported on untouched temporal test; candidate<br>compared with transparent baseline.|
|Likelihood calibration|Brier/log-loss and calibration curve reported; calibration fitted without test<br>leakage.|
|Stability|Rolling temporal backtests reported; major degradation explained or<br>model rejected for promotion.|
|Severity|Point and quantile metrics reported; tail behaviour and interval coverage<br>evaluated.|
|Anomaly|Detection utility evaluated against known labels/signals with source-label<br>limitations disclosed.|
|Trend|Forecast error and interval coverage reported on later periods.|
|Explainability|Stored attribution reproduces the contribution summary displayed by the<br>UI for the same prediction version.|
|OOD / uncertainty|Out-of-distribution and low-coverage states generate explicit uncertainty<br>metadata and can suppress authoritative downstream outputs when<br>essential inputs are missing.|
|Integration|Inference schema, model version and prediction lineage are accepted by<br>Risk Engine contract tests.|



#### **13.1 Calibration Metrics** 

- Brier score and log loss for probabilistic correctness. 

- Reliability/calibration plots by risk band. 

- Expected calibration error (ECE) or another declared binning metric. 

- Calibration drift between validation and production windows. 

AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

### **14. Probability Calibration and Uncertainty** 

Probability quality matters more than raw classification accuracy because the likelihood output is transformed into an annual event rate and then into financial loss calculations. A model that ranks cases correctly but is systematically overconfident can materially distort EAL/VaR. 

|**Uncertainty type**|**Example**|**System response**|
|---|---|---|
|Aleatoric|Different legitimate outcomes for similar feature<br>vectors.|Probability/distribution width or quantiles.|
|Epistemic|Limited training evidence for a new<br>sector/technology.|Wider confidence/uncertainty or low-confidence<br>flag.|
|Data coverage|Missing SIEM/EDR/IAM/asset context.|Coverage indicator; withhold/limit metrics when<br>essential inputs are absent.|
|OOD / drift|Current feature pattern far from validated<br>training population.|OOD/stress flag; avoid false precision; require<br>review/retraining as appropriate.|



##### **No-false-precision rule** 

Missing telemetry does not mean “zero incidents” and weak evidence does not justify a precise number. The system shall surface data coverage, confidence, assumptions and OOD status alongside predictions and financial risk. 

### **15. Model Deployment and Inference Contract** 



<!-- Start of picture text -->
P(exploitation / incident<br>within horizon)<br>Annual event rate \ Financial severity distribution<br>from calibrated probability conditioned on context<br>Monte Carlo annual<br>aggregate loss S<br>EAL | VaR| Financial Exposure<br>Risk Score | Drivers<br><!-- End of picture text -->

**Figure 3. Predictive model outputs feed the governed Risk Engine rather than replacing it.** 

|**Field**|**Type**|**Requirement**|
|---|---|---|
|model_version|STRING|Immutable version ID; required.|
|prediction_id|UUID|Unique prediction record.|
|entity_scope|STRING|Asset/service/BU/enterprise scope.|
|observation_time|TIMESTAMP|Feature-state timestamp.|



AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

|**Field**|**Type**|**Requirement**|
|---|---|---|
|p_h|FLOAT|Calibrated probability for declared horizon, 0–1.|
|horizon_days|INTEGER|Declared horizon used for p_h.|
|calibration_version|STRING|Calibration artifact version.|
|confidence_level|STRING|Declared confidence/coverage state.|
|data_coverage|OBJECT/JSON|Required source classes present/fresh.|
|ood_flag|BOOLEAN|Out-of-distribution indicator.|
|feature_attribution|OBJECT/JSON|Top contributors and signs/magnitudes.|
|input_bundle_hash|STRING|Canonical hash for reproducibility.|
|model_artifact_hash|STRING|Immutable artifact hash.|



The Risk Engine then annualizes the horizon probability according to the governed risk model, combines severity distributions and runs aggregate-loss simulation to calculate EAL, VaR and other authoritative metrics. Predictions without sufficient confidence/coverage may remain visible as advisory signals but must not silently generate authoritative financial outputs. 

### **16. Monitoring, Drift and Retraining** 

|**Monitor**|**Signal**|**Action**|
|---|---|---|
|Data drift|Feature distributions, missingness, category<br>shifts|Alert; assess impact before retraining.|
|Concept drift|Observed future outcomes vs predicted<br>probabilities|Rolling calibration/discrimination review.|
|Calibration drift|Brier/log-loss/ECE movement|Recalibrate or retrain after governance review.|
|Coverage drift|Drop in source freshness/completeness|Lower confidence / withhold outputs when<br>material.|
|OOD rate|Fraction of production rows flagged OOD|Investigate new population or feature failure.|
|Prediction drift|Shift in score/probability distribution|Compare against expected change in<br>environment.|
|Business utility|ΔEAL/decision outcomes after deployed<br>controls|Validate whether decisions remain directionally<br>useful.|



Retraining SHALL be triggered by evidence, not by an arbitrary calendar alone. A scheduled review cadence may still be used, but promotion requires a new validation package and model card version. 

### **17. Governance, Provenance and Model Cards** 

Model governance must answer three different trust questions: “Where did the data come from?”, “Is the model statistically reliable for this use?”, and “Can we reproduce what the system calculated at the time?” 

|**Trust question**|**Required evidence**|
|---|---|
|Data authenticity / provenance|Source identifier, acquisition time, source version, ingestion run,<br>record hash and transformation lineage.|
|Statistical reliability|Temporal test metrics, calibration report, backtests, uncertainty/OOD<br>evaluation.|
|Decision reproducibility|Input bundle hash, model version, parameter version, simulation<br>configuration and authoritative output hash.|



AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

#### **17.1 Model Card Minimum** 

- Intended use and decision context. 

- Population and data sources. 

- Target definition and horizon. 

- Features and point-in-time rules. 

- Training/validation/test periods. 

- Metrics and calibration. 

- Known biases/coverage limitations. 

- Out-of-distribution limitations. 

- Human oversight requirements. 

- Prohibited or unsupported interpretations. 

### **18. Synthetic Enterprise Context for SIH Demonstration** 

Because private enterprise fields are unavailable for a public submission prototype, the SIH demonstration SHALL generate a labeled synthetic context layer around real public cybersecurity evidence. Examples include assets, business services, criticality, service dependencies, control coverage and business-impact parameters. 

|**Synthetic field**|**Example generation rule**|**Use**|**Restriction**|
|---|---|---|---|
|asset_criticality|Sample from declared tier<br>probabilities|Risk contextualization|Not evidence of a real organization.|
|service_dependency|Generate directed dependencies<br>with bounded strength|Impact propagation|Must retain generation<br>seed/version.|
|mfa_coverage|Scenario-controlled percentage|Control effectiveness / what-if|Must be marked synthetic.|
|downtime_cost_hour|Scenario/business-profile<br>parameter|Financial impact|Use as an assumption with<br>sensitivity analysis.|
|EDR/MFA/control state|Scenario-controlled posture|Likelihood attenuation|Must be versioned and<br>provenance-tagged.|



##### **Validation boundary** 

Synthetic context is suitable for demonstrating system wiring, what-if behaviour, optimization constraints and end-to-end integration. It SHALL NOT be presented as proof that the ML model generalizes to real enterprises. 

### **19. Limitations and Non-Claims** 

- No public dataset currently provides the full combination of enterprise telemetry, business criticality, controls, dependencies and complete financial loss for arbitrary companies. 

- EPSS is not an organization-specific exploitation forecast; it must be combined with local context. [1] 

- VCDB/VERIS is valuable real-world incident evidence, but it is not a complete unrestricted enterprise incident census and has sector/reporting biases. [3] 

- The WitFoo Precinct6 corpus is suitable for security-event/anomaly experimentation, but its labels are machine-derived and its contribution distribution is highly skewed. [4] 

- Financial-loss research datasets support severity modelling and benchmarking, but they do not establish a universal enterprise loss curve. [5] 

- Model outputs are estimates with assumptions and uncertainty; EAL/VaR are not guarantees of future loss. 

- Black-swan geopolitical events are not predicted by the ML system; stress scenarios may represent out-of-distribution analysis. 

### **20. Verification Checklist** 

|**Check**|**Pass condition**|**Owner / evidence**|
|---|---|---|
|PS/SRS alignment|All ML-related FR/NFR entries map to a<br>workload, dataset contract or governance rule.|Requirements traceability report.|



AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

|**Check**|**Pass condition**|**Owner / evidence**|
|---|---|---|
|Point-in-time integrity|No future-dated feature values appear in a<br>training row.|Leakage scanner report.|
|Label correctness|Target policy reproduced exactly from frozen<br>source snapshots.|Label audit sample + code hash.|
|Temporal split|Final test period is later than train/validation and<br>untouched.|Dataset split manifest.|
|Calibration|Calibration artifact is versioned and evaluated<br>on later data.|Calibration report.|
|Reproducibility|Same inputs/settings reproduce outputs within<br>tolerance.|Re-run report.|
|Inference contract|Prediction schema accepted by Risk Engine<br>integration tests.|Contract test report.|
|Uncertainty|Missing/OOD conditions surface<br>confidence/coverage state.|Failure-mode test suite.|
|Governance|Model card and lineage complete before<br>promotion.|Model registry record.|



### **Appendix A. Feature Dictionary** 

|**Feature ID**|**Feature**|**Definition**|**Window**|**Type**|
|---|---|---|---|---|
|F01|cvss_base|CVSS base severity.|As-of t|numeric|
|F02|epss_score|Historical EPSS probability.|As-of t|numeric|
|F03|kev_flag|CVE known exploited by t.|As-of t|boolean|
|F04|vuln_age_days|Days since publication.|Derived|numeric|
|F05|internet_exposed|External exposure state.|As-of t|boolean|
|F06|asset_criticality|Business importance.|As-of t|numeric/ordinal|
|F07|dependency_weight|Service dependency<br>strength.|As-of t|numeric|
|F08|mfa_coverage|MFA deployment coverage.|As-of t|numeric|
|F09|edr_coverage|EDR deployment coverage.|As-of t|numeric|
|F10|control_effectiveness|Normalized effectiveness.|As-of t|numeric|
|F11|threat_activity|Recent threat activity.|≤ t lookback|numeric|
|F12|behavior_anomaly|Recent anomaly score.|≤ t lookback|numeric|
|F13|patch_status|Patch/remediation state.|As-of t|categorical|
|F14|service_criticality|Criticality of affected<br>service.|As-of t|numeric/ordinal|
|F15|exposure_score|Composite exposure<br>indicator.|As-of t|numeric|



AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

SentinelStack  |  ML Dataset & Training Specification  |  PS 26105 

### **Appendix B. Dataset Lineage** 



<!-- Start of picture text -->
Pubic reabword<br>—_—‘ta ‘Canonical poncin-time Label builder “rain vate Model raining Model registry Inference reaure Rsk Engine<br>Enterprise/ SIM ‘servation able + leakage contoss test by time “Feairaton “model ead ‘convact (EALIVaR/ score)<br><!-- End of picture text -->

**Figure 4. Lineage view: sources → canonical data → labels/features → model artifacts → risk outputs.** 

Minimum lineage chain per authoritative prediction: source record IDs → feature snapshot → model version → prediction → risk assessment input bundle → risk assessment output → downstream scenario/decision record. 

### **Appendix C. References** 

**[1] FIRST, Exploit Prediction Scoring System (EPSS): public API and methodology. https://api.first.org/epss/ and https://www.first.org/epss/how-it-works** Current official EPSS documentation; accessed 23 Sep 2026. 

**[2] CISA, Known Exploited Vulnerabilities Catalog. https://www.cisa.gov/known-exploited-vulnerabilities-catalog** Official KEV source; accessed 23 Sep 2026. 

**[3] VERIS / VCDB, VERIS Community Database. https://verisframework.org/vcdb.html** Official project/data description; accessed 23 Sep 2026. 

**[4] WitFoo, Open cybersecurity research datasets. https://www.witfoo.com/research/** Precinct6 v2.0.0 dataset description and limitations; accessed 23 Sep 2026. 

**[5] H. Eling / Risk Management study, “Heterogeneity in cyber loss severity and its impact on cyber risk measurement.” https://link.springer.com/article/10.1057/s41283-022-00095-w** Published research dataset description; accessed 23 Sep 2026. 

**[6] SentinelStack SRS v2.1, internal engineering baseline.** Requirements source. 

**[7] SentinelStack SDD v1.1, internal engineering baseline.** Architecture/design source. 

**[8] SentinelStack Risk Quantification and Mathematical Model Specification v1.0, internal engineering baseline.** Mathematical/risk model source. 

**[9] SentinelStack Data Dictionary and Database Schema v1.0, internal engineering baseline.** Persistence/data source. 

##### **Baseline status** 

This document is the ML/data engineering baseline. Algorithm-specific implementation may be refined after dataset profiling and empirical validation, but any change to target definitions, feature semantics, split policy, calibration policy or model authority boundary requires a versioned change and regression against the SRS/SDD/risk-model contracts. 

AICTE Cyber Security Cell • Problem Statement 26105 • Internal Engineering Baseline 

