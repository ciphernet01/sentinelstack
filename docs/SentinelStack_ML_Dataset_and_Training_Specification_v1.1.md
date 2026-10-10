# SentinelStack — ML Dataset & Training Specification v1.1

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.1  
**Document Status:** Reconciled ML / Data Engineering Baseline  
**Implementation Baseline:** `ciphernet01/sentinelstack`  
**Primary API / Runtime:** Existing Next.js + Express + Prisma/PostgreSQL application  
**Date:** 29 September 2026  
**Baselines:** PS 26105 • SRS v2.1 • SDD v1.2 • Data Dictionary & Database Schema v1.1 • Risk Quantification & Mathematical Model Specification v1.1

> **Engineering rule:** ML models estimate uncertain variables. Authoritative EAL, VaR, Financial Exposure, Product Risk Score, scenario deltas and investment-optimization outputs remain outputs of the governed Risk Quantification Engine. The LLM explains verified results and never replaces the Risk Engine.

---

## Revision Note — v1.0 → v1.1

ML Specification v1.0 defined the intended dataset, training, calibration and governance contract. Version 1.1 keeps the same ML objectives but reconciles the specification with the repository-aware architecture and the revised quantitative model.

| Area | v1.0 baseline | v1.1 reconciliation |
|---|---|---|
| Architecture | Generic model-service concept | Bind ML to the existing SentinelStack Express/TypeScript application through a stable inference contract; introduce Python only for workloads where it provides measurable ML value. |
| Repository status | Training implementation assumed as a future workstream | Repository does not yet prove a promoted production ML model; ML remains Phase P6 after Risk Engine v2, scenario and optimization foundations. |
| Risk handoff | ML feeds risk engine | Explicit handoff: ML outputs probability/severity parameters + uncertainty; the Risk Engine performs annualization, loss aggregation, EAL/VaR and score calculation. |
| Data model | Conceptual ML records | Prediction/model lineage must map to the reconciled v1.1 data model and preserve dataset/model/feature hashes. |
| Current risk service | Independent target | `src/services/cyberRiskQuantification.service.ts` remains a compatibility façade during migration; ML is consumed by the new risk domain rather than hardwired into the legacy calculator. |
| What-if behavior | Reuse model bundle | Scenario calculations must use the same versioned inference bundle against mutated point-in-time state. |
| Evidence | Dataset/model provenance | Add source-to-feature-to-prediction-to-risk-assessment lineage and explicit evidence/coverage status. |
| SIH demonstration | Synthetic context acceptable | Public real cyber evidence + explicitly labelled synthetic enterprise context; synthetic context is for system wiring and demonstration, not evidence of model generalization. |
| Promotion | Validation-focused | Promotion gates now include temporal performance, calibration, OOD/coverage, reproducibility, inference contract tests and downstream Risk Engine compatibility. |

---

## Contents

1. Purpose and Scope
2. Baseline Alignment and Traceability
3. ML Workload Map
4. Data Source Strategy
5. Dataset Construction Architecture
6. Canonical Training Dataset Schema
7. Label Engineering
8. Feature Engineering and Point-in-Time Semantics
9. Dataset Splitting and Leakage Prevention
10. Model Specifications
11. Class Imbalance and Sampling
12. Training Pipeline and Reproducibility
13. Evaluation and Acceptance Criteria
14. Probability Calibration and Uncertainty
15. Model Deployment and Inference Contract
16. Monitoring, Drift and Retraining
17. Governance, Provenance and Model Cards
18. Synthetic Enterprise Context for SIH Demonstration
19. Production Rollout and Promotion Stages
20. Limitations and Non-Claims
21. Verification Checklist
Appendix A. Feature Dictionary
Appendix B. Dataset Lineage
Appendix C. Experiment Registry Minimum
Appendix D. Model Promotion Gate
Appendix E. Implementation Mapping

---

# 1. Purpose and Scope

This specification defines how SentinelStack constructs, validates, trains, calibrates, deploys and governs its machine-learning workloads for PS 26105.

It is subordinate to the SRS and SDD and is the ML/data realization of the mathematical authority boundary defined by the Risk Quantification & Mathematical Model Specification v1.1.

The primary ML objective is to estimate uncertain variables required by the Risk Quantification Engine, especially:

- the probability that a defined cyber event occurs within a declared prediction horizon;
- conditional financial-impact/severity parameters where sufficient empirical evidence exists;
- behavioral anomaly signals used as contextual evidence;
- temporal trends for vulnerabilities, threats, controls and risk states.

ML does **not** directly calculate the authoritative enterprise financial-risk metrics.

## 1.1 Scope Boundary

Public datasets do not provide a complete enterprise view containing all of the following simultaneously:

- enterprise asset inventory;
- service dependencies;
- control coverage/effectiveness;
- organization-specific telemetry;
- business criticality;
- organization-specific financial impact.

SentinelStack therefore uses a layered evidence strategy:

1. public real-world cybersecurity evidence;
2. enterprise data when deployed;
3. synthetic enterprise context for the SIH demonstration where private data is unavailable.

Public, private and synthetic records SHALL remain distinguishable by provenance.

## 1.2 Design Goals

The implementation SHALL provide:

- point-in-time training examples mirroring production inference;
- strict prevention of future-information leakage;
- calibrated probabilities because likelihood feeds annualized risk;
- explicit separation between predictive estimation and authoritative risk quantification;
- reproducible datasets, features, models and calibration artifacts;
- uncertainty, data-coverage and OOD metadata;
- model/version lineage that can be linked to an authoritative risk assessment;
- scenario-safe inference so what-if calculations do not mutate production state;
- promotion gates based on out-of-time evidence rather than accuracy alone.

## 1.3 Non-Goals

This specification does not make the following claims:

- that the ML system predicts all cyber incidents;
- that public EPSS/KEV/VCDB data is equivalent to enterprise telemetry;
- that a model trained on synthetic enterprise context is validated for arbitrary real organizations;
- that an LLM can calculate authoritative risk metrics;
- that a high model score proves an incident has occurred.

---

# 2. Baseline Alignment and Traceability

The ML implementation is derived from the following controlled baselines.

| Baseline | Role | v1.1 relationship |
|---|---|---|
| PS 26105 | Problem definition | Defines continuous risk quantification, financial impact, AI/ML, optimization and executive decision support scope. |
| SRS v2.1 | Master requirements | Defines FR-04, FR-05, FR-10, FR-11, FR-13, FR-16, FR-20 and relevant NFRs. |
| SDD v1.2 | Repository-aware architecture | Defines current SentinelStack topology and Phase P6 ML implementation boundary. |
| Data Dictionary v1.1 | Persistence contract | Defines reconciled existing and target ML/risk lineage entities and schema evolution direction. |
| Risk Model v1.1 | Mathematical authority | Defines probability-to-frequency transformation, severity/loss modeling, Monte Carlo aggregation, EAL/VaR, scenario deltas and authority boundaries. |
| API Contract v1.0 / v1.1 target | Integration contract | Provides the target interface discipline; the production ML adapter must not invent an incompatible response schema. |
| Implementation Gap Analysis v1.0 | Execution gap map | Identifies ML as a later implementation phase after foundational risk-engine work. |

## 2.1 Requirement Traceability

| Source requirement | ML/data realization | Verification evidence |
|---|---|---|
| FR-04 Incident likelihood | Calibrated probabilistic model over point-in-time observations; outputs `p_h`, uncertainty and attribution. | Temporal test, Brier/log-loss, calibration report, reproducibility test. |
| FR-05 Financial impact | Conditional severity model or empirical severity distribution where data supports it. | Backtest, quantile/interval coverage, distribution-fit evidence. |
| FR-10 Predictive analytics | Vulnerability/threat/control trends + anomaly workload. | Temporal backtests and drift monitoring. |
| FR-11 Mitigations | Model-derived risk deltas enter recommendation eligibility only after Risk Engine scenario recomputation. | Recommendation lineage + scenario rerun test. |
| FR-13 What-if | Scenario changes input state and reruns the same versioned predictive bundle. | Baseline invariance + comparable delta tests. |
| FR-16 Optimization | Optimizer consumes quantified option values and costs. ML supplies estimation inputs; optimizer remains deterministic. | Budget/dependency constraint tests + portfolio rerun. |
| FR-20 Risk trends | Time-stamped risk snapshots are analytical outputs and monitoring signals, not silently treated as training truth. | Trend continuity and lineage checks. |
| NFR-05 Explainability | Feature attribution tied to prediction/model version and source evidence. | Attribution reproducibility test. |
| NFR-08 Auditability | Dataset/model/feature/calibration hashes linked to prediction and risk run. | Hash-chain/reproducibility test. |
| NFR-10 Telemetry retention | Source-to-feature lineage and replay metadata retained according to policy. | Retention + replay test. |

---

# 3. ML Workload Map

| Workload | Purpose | Primary output | Authority |
|---|---|---|---|
| ML-01 Likelihood | Estimate probability of a declared event within horizon `H`. | `p_h ∈ [0,1]`, uncertainty, calibration metadata, attribution. | Input to Risk Engine only. |
| ML-02 Severity | Estimate/condition monetary-loss distributions when evidence is sufficient. | Distribution parameters and/or conditional quantiles. | Input to Risk Engine only. |
| ML-03 Behavioral Anomaly | Detect unusual SIEM/IAM/EDR/CSPM behavior. | Anomaly score, context signal, evidence metadata. | Contextual signal only. |
| ML-04 Trend Prediction | Forecast vulnerability, threat, control and risk trajectories. | Forecast + interval / trend indicator. | Decision-support input. |
| LLM-D1 Grounded Language | Translate verified metrics and evidence into business language. | Narrative grounded in structured backend results. | Never authoritative for metrics. |

## 3.1 Implementation Priority

The recommended order is:

1. ML-01 likelihood baseline;
2. ML-04 trend prediction where operational value is demonstrated;
3. ML-03 anomaly detection using available telemetry;
4. ML-02 financial severity after sufficient consistent loss evidence is available.

The order prevents SentinelStack from claiming financial severity intelligence before the underlying data supports it.

---

# 4. Data Source Strategy

SentinelStack uses a layered evidence model rather than forcing unrelated public datasets into one artificial “complete enterprise” dataset.

| Source family | SentinelStack use | Important signals | Limitation |
|---|---|---|---|
| NVD / CVE | Vulnerability state and metadata | CVE, publication dates, CVSS, CPE/CWE where available | Describes vulnerability knowledge, not enterprise exposure. |
| FIRST EPSS | Population-level exploit-likelihood feature and benchmark | Historical EPSS probability/percentile | Not organization-specific; must be combined with local context. |
| CISA KEV | Known-exploitation signal / public-data target proxy | CVE, date added, due date, vendor/product | KEV is not a census of all exploitation. |
| VERIS / VCDB | Real-world incident frequency/severity context | Incident date, action, asset, outcome, actor attributes | Publicly disclosed incidents are incomplete and biased. |
| Security-event research corpora | Anomaly/pipeline experimentation | Event features, labels where supplied, incident leads | Source-specific label quality and collection bias must be preserved. |
| Published cyber-loss research | Severity benchmarking/reference | Event dates, firm factors, loss size, contagion indicators | Research sample is not a universal enterprise loss curve. |
| Enterprise private data | Production context | Assets, services, controls, telemetry, financial parameters | Sensitive and deployment governed. |
| SIH synthetic context | End-to-end demonstration | Assets, dependencies, criticality, controls, impact assumptions | Must be labelled synthetic and cannot alone validate model generalization. |

## 4.1 Public-Data Rule

EPSS SHALL NOT be used as the target of the likelihood model merely because it is already a probability.

For a public-data experiment, the target must be a separately defined future outcome. One defensible proxy is a future transition such as “CVE enters KEV within the next 30 days,” provided the target is described exactly as that proxy.

The experiment registry SHALL state:

- target definition;
- prediction horizon;
- target-source version;
- censoring policy;
- population represented;
- known limitations.

---

# 5. Dataset Construction Architecture

The canonical pipeline is:

```text
Public / Enterprise Sources
        |
        v
Raw Immutable Landing
        |
        v
Parsing + Canonicalization
        |
        v
Entity Resolution
        |
        v
Point-in-Time State Assembly
        |
        +--> Label Construction
        |
        +--> Feature Construction
        |
        v
Quality + Leakage Gates
        |
        v
Temporal Split Manifest
        |
        v
Training Dataset Snapshot
        |
        v
Model Training
        |
        v
Calibration + Validation
        |
        v
Model Registry
        |
        v
Versioned Inference Bundle
        |
        v
Risk Engine Input Contract
        |
        v
EAL / VaR / Financial Exposure / Risk Score
```

## 5.1 Pipeline Rules

Each stage SHALL record:

- source identifier;
- acquisition timestamp;
- source version/date where available;
- transformation version;
- entity-resolution version;
- dataset snapshot identifier;
- feature-set version;
- label-policy version;
- row counts and quality statistics.

The pipeline SHALL:

- never overwrite raw source records;
- separate observation time from collection time;
- preserve stable identifiers;
- fail closed on impossible timestamps;
- fail closed on schema violations;
- fail closed when canonical IDs are duplicated unexpectedly;
- reject feature values occurring after the prediction observation time.

## 5.2 Repository-Aware Placement

Per SDD v1.2, ML is introduced into the existing SentinelStack architecture rather than through a greenfield platform rewrite.

Recommended boundary:

```text
Existing Express API
    |
    +--> Risk compatibility façade
            |
            +--> Risk Engine v2
                    |
                    +--> ML inference adapter
                            |
                            +--> Model bundle
                            |
                            +--> Optional Python model service
```

The primary Express/TypeScript application remains responsible for:

- tenant/authentication context;
- request validation;
- risk-run orchestration;
- persistence;
- evidence lineage;
- Risk Engine authority;
- API responses.

A separate Python process/service is justified only when a workload or library requirement makes it materially useful. It is not mandatory for the first ML implementation.

## 5.3 Offline Training vs Production Inference

Training may initially run offline in Python because reproducible tabular ML tooling is readily available.

Production inference SHALL expose a stable schema regardless of implementation language.

This prevents model-language choices from changing the authoritative risk contract.

---

# 6. Canonical Training Dataset Schema

The primary likelihood row is an **asset-vulnerability observation at time `t`**.

For public-data experiments, enterprise fields may be synthetic or absent. Missingness SHALL be represented explicitly and must not be silently interpreted as “safe.”

| Column | Type | Meaning | Source | Leakage rule |
|---|---|---|---|---|
| `observation_id` | UUID | Unique point-in-time row | Generated | Immutable |
| `observation_time` | TIMESTAMP | Time for which the feature state is valid | Source/derived | Predictors ≤ `t` |
| `asset_id` | STRING | Enterprise/synthetic asset ID | Asset inventory | Stable mapping |
| `service_id` | STRING | Service context | Service map | State known by `t` |
| `cve_id` | STRING | Vulnerability identifier | NVD/scanner | Stable identifier |
| `cvss_base` | FLOAT | CVSS base score | NVD/scanner | Versioned historical source |
| `epss_score` | FLOAT | EPSS score as of `t` | FIRST EPSS | Historical lookup only |
| `kev_flag` | BOOLEAN | Whether CVE was in KEV by `t` | CISA KEV | Point-in-time lookup |
| `vuln_age_days` | INTEGER | Days since vulnerability publication | NVD + `t` | Past dates only |
| `exploit_available` | BOOLEAN | Exploit/tooling signal available by `t` | Threat intel | No future publication |
| `internet_exposed` | BOOLEAN | External reachability at `t` | Asset/CSPM | Point-in-time |
| `asset_criticality` | FLOAT | Business importance at `t` | Enterprise/synthetic | Provenance required |
| `dependency_weight` | FLOAT | Dependency strength | Service map | Valid relationship at `t` |
| `mfa_coverage` | FLOAT | MFA coverage at `t` | IAM | Point-in-time |
| `edr_coverage` | FLOAT | EDR coverage at `t` | EDR | Point-in-time |
| `control_effectiveness` | FLOAT | Coverage-aware effectiveness | Control model | Versioned calculation |
| `threat_activity` | FLOAT | Recent threat/activity signal | Threat intel/telemetry | Window ends ≤ `t` |
| `behavior_anomaly` | FLOAT | Recent anomaly signal | SIEM/EDR/IAM | Bounded lookback |
| `patch_status` | CATEGORICAL | Remediation state | VMS/asset data | As-of `t` |
| `service_criticality` | FLOAT | Affected-service criticality | Enterprise/service map | As-of `t` |
| `exposure_score` | FLOAT | Composite exposure feature | Derived | Versioned transform |
| `label_horizon_days` | INTEGER | Declared prediction horizon | Experiment config | Fixed by run |
| `target_event` | BOOLEAN | Event occurs in `(t, t+H]` | Label builder | Future-only for label |
| `target_source` | STRING | Target provenance/policy | Label builder | Versioned |
| `synthetic_context_flag` | BOOLEAN | Synthetic contextual fields present | Pipeline | Must be true when applicable |
| `dataset_snapshot_id` | STRING | Immutable dataset version | Pipeline | Required |
| `feature_set_version` | STRING | Feature semantics version | Pipeline | Required |
| `label_policy_version` | STRING | Label semantics version | Pipeline | Required |

## 6.1 Missingness Semantics

Missing values SHALL be distinguishable from zero.

Examples:

- missing EDR telemetry ≠ EDR coverage of 0%;
- missing incident evidence ≠ no incident;
- missing financial loss ≠ zero monetary loss;
- unavailable asset criticality ≠ low criticality.

The inference contract must carry coverage metadata so downstream calculations can decide whether an authoritative risk result is allowed.

---

# 7. Label Engineering

## 7.1 Likelihood Target

The canonical binary target is:

```text
Y = 1
when the declared event occurs during (t, t + H]
Y = 0
when the observation window is complete and the event does not occur
```

The event definition must be frozen before dataset construction.

Example public-data experiment:

```text
Target:
"CVE becomes listed in CISA KEV within the next 30 days"

Observation:
state of the CVE and contextual features at time t

Label:
future KEV transition in (t, t + 30 days]
```

This is a **KEV-transition prediction**, not a claim of directly observing every exploitation event.

## 7.2 Probability Handoff to the Risk Engine

The ML model returns:

```text
p_h = P(Y = 1 | X_t)
```

The Risk Engine converts the declared horizon probability to an annualized event rate according to the governed Risk Model.

With `H_y` expressed in years:

```text
lambda = -ln(1 - p_h) / H_y
```

This conversion is performed by the Risk Engine, not by the ML service.

## 7.3 Severity Target

Financial severity may be modeled as:

- aggregate loss;
- one or more loss components;
- conditional quantiles;
- approved parametric distribution parameters;
- empirical/bootstrap distribution when enterprise history is sufficient.

Possible components include:

- business interruption;
- incident response/recovery;
- direct loss;
- legal/regulatory exposure;
- other governed business-impact categories.

The Risk Engine remains responsible for composing the loss model and preventing double counting.

## 7.4 Negative and Unknown Cases

A missing future record must not automatically become a negative.

Rows with:

- incomplete observation windows;
- insufficient telemetry coverage;
- unresolved entity state;
- ambiguous target provenance;

SHALL be marked censored/unknown and excluded from ordinary binary-loss evaluation unless an explicit survival/censoring methodology is implemented.

---

# 8. Feature Engineering and Point-in-Time Semantics

Every feature is defined relative to `observation_time = t`.

## 8.1 Feature Families

| Family | Examples | Allowed window |
|---|---|---|
| Vulnerability | CVSS, EPSS, KEV, age, exploit availability, patch state | As-of `t` |
| Exposure | Internet-facing state, external attack surface, reachability | As-of `t` |
| Threat | Targeting signals, technique prevalence, confidence | ≤ `t` |
| Asset/service | Asset criticality, service criticality, dependency | Active at `t` |
| Controls | MFA, EDR, posture, control effectiveness | As-of `t` |
| Behavior | Event rates, anomaly signals | Bounded lookback ending ≤ `t` |
| Historical trend | Counts, rates, slope, EWMA-like aggregates | ≤ `t` |

## 8.2 Feature-Lineage Requirements

For every derived feature, lineage SHOULD identify:

- source field(s);
- source record ID(s);
- transformation name;
- transformation version/code commit;
- lookback interval;
- missing-value policy;
- normalization policy;
- source acquisition version.

Feature transformations SHALL be versioned.

## 8.3 Derived-Feature Rule

Composite features such as `exposure_score` and `control_effectiveness` must not silently embed future information or undocumented hand-tuned weights.

Where a composite is required:

1. define the formula;
2. version it;
3. persist the version with the dataset;
4. test it independently;
5. keep its semantics stable across a training run.

---

# 9. Dataset Splitting and Leakage Prevention

Predictive workloads SHALL use time-ordered data splits because the production task is forward-looking.

| Split | Time semantics | Purpose |
|---|---|---|
| Train | Earliest contiguous period | Fit model parameters |
| Validation | Later contiguous period | Hyperparameters, feature selection, calibration |
| Test | Latest untouched period | Final generalization estimate |
| Rolling backtest | Multiple forward windows | Stability across time/threat regimes |

## 9.1 Leakage Checklist

The training pipeline SHALL verify:

- no feature timestamp > observation time;
- no future KEV state;
- no future EPSS value;
- no future patch status;
- no future control state;
- no post-outcome telemetry;
- no target encoding that crosses time boundaries;
- no duplicated incident/entity records crossing evaluation partitions;
- scalers/encoders fitted on training data only;
- hyperparameter tuning cannot access final test data;
- severity predictors do not use information that became available only after the modeled loss.

## 9.2 Entity and Source Leakage

When multiple rows describe the same underlying incident, CVE transition, or other entity, splitting must prevent near-duplicate leakage where appropriate.

The dataset manifest SHALL document the deduplication/entity-grouping policy.

---

# 10. Model Specifications

## 10.1 ML-01 Likelihood Model

### Baseline

Logistic regression is the required transparent baseline.

### Challenger

A gradient-boosted tree model is the primary nonlinear challenger for tabular relationships.

Promotion is allowed only when the challenger demonstrates a meaningful out-of-time improvement while preserving or improving calibration and governance properties.

### Contract

| Item | Specification |
|---|---|
| Input | Canonical point-in-time feature vector |
| Target | Declared binary event/horizon |
| Output | `p_h` + uncertainty/coverage + attribution |
| Core metrics | PR-AUC, ROC-AUC, Brier, log loss |
| Operational metrics | Precision/recall at declared thresholds |
| Calibration | Platt, isotonic, or another validated approach |
| Attribution | SHAP/model-specific feature contribution |
| Promotion | Temporal performance + calibration + stability + OOD/coverage gates |

## 10.2 ML-02 Financial Severity Model

Severity is distributional rather than a single point estimate.

Candidate families include:

- lognormal;
- Gamma;
- quantile regression;
- empirical/bootstrap distributions;
- other distribution families only after fit/backtest evidence.

Potential outputs:

| Output | Meaning |
|---|---|
| `q10` | Lower conditional loss quantile |
| `q50` | Median conditional loss |
| `q90` | Upper conditional loss quantile |
| Distribution parameters | Parameters for approved family |
| Component parameters | Downtime, response, recovery, regulatory and other modeled components |

The Risk Engine consumes these outputs and performs annual aggregate-loss simulation.

## 10.3 ML-03 Behavioral Anomaly

Initial implementation may use:

- Isolation Forest;
- robust statistical baselines;
- semi-supervised methods when labels are available.

An anomaly score is **not** a confirmed attack.

The model response SHALL include:

- score;
- threshold/config version;
- observation window;
- evidence-source classes;
- coverage metadata.

## 10.4 ML-04 Trend Prediction

Trend models may operate on:

- vulnerability counts;
- threat-signal rates;
- control-performance measurements;
- risk snapshots;
- remediation backlog;
- aggregate anomaly rates.

Baseline methods should remain simple and interpretable until temporal backtesting justifies added complexity.

---

# 11. Class Imbalance and Sampling

Rare cyber events create severe imbalance.

Accuracy SHALL NOT be the primary likelihood metric.

The evaluation must report:

- prevalence;
- PR-AUC;
- ROC-AUC;
- precision/recall at declared thresholds;
- Brier score;
- log loss;
- calibration.

## 11.1 Sampling Rules

- Prefer class weighting or weighted objectives before naive oversampling where appropriate.
- Perform oversampling inside training folds only.
- Never oversample validation/test periods.
- Preserve temporal structure when undersampling.
- Report class prevalence independently for every split.
- Select operational thresholds using documented decision-cost or operational-capacity criteria, not the final test set.

---

# 12. Training Pipeline and Reproducibility

Every training run SHALL generate a reproducibility bundle.

## 12.1 Required Artifacts

| Artifact | Required metadata |
|---|---|
| Dataset snapshot | Snapshot ID, source versions, acquisition times, row count, schema hash |
| Feature set | Feature IDs, transformations, windows, imputation policy, feature-schema hash |
| Label policy | Target definition, horizon, censoring, source mapping, version |
| Training run | Commit, environment digest, seed, hyperparameters, duration |
| Model artifact | Model version, artifact hash, input/output schema |
| Calibration artifact | Method, fit-period ID, calibration metrics |
| Model card | Purpose, population, metrics, limitations, intended/non-use claims |
| Evaluation report | Temporal metrics, calibration, stability, uncertainty/OOD evidence |
| Inference bundle | Model + preprocessing + calibration + schema + versions |

## 12.2 Reproducibility Test

Given the same:

- dataset snapshot;
- feature-set version;
- label policy;
- code/environment;
- random seed;

the pipeline SHALL reproduce:

- model metadata;
- preprocessing metadata;
- calibration metadata;
- prediction outputs;

within a defined numerical tolerance.

Any non-deterministic component must be documented.

---

# 13. Evaluation and Acceptance Criteria

| Area | Acceptance condition |
|---|---|
| Data quality | Schema, type, timestamp, identifier, duplicate and lineage gates pass. |
| Likelihood discrimination | PR-AUC/ROC-AUC reported on untouched temporal test. |
| Likelihood calibration | Brier/log-loss + reliability curve reported; calibration not fit on test. |
| Stability | Rolling backtests performed; material degradation explained or promotion rejected. |
| Severity | Quantile/point metrics + tail behavior + interval coverage reported. |
| Anomaly | Utility evaluated against available labels/signals with source limitations disclosed. |
| Trend | Forecast error and interval coverage reported on later periods. |
| Explainability | Stored attribution matches the model/version shown in the UI. |
| OOD / uncertainty | Low-coverage/OOD states are explicit and can suppress authoritative downstream outputs when essential inputs are unavailable. |
| Integration | Prediction schema accepted by Risk Engine contract tests. |
| Reproducibility | Same inputs and configuration reproduce outputs within tolerance. |
| Governance | Model card, lineage and promotion evidence complete. |

## 13.1 Calibration Metrics

At minimum, report:

- Brier score;
- log loss;
- reliability/calibration plot;
- Expected Calibration Error (ECE) or another declared calibration metric.

Calibration SHALL be evaluated on later data than the fitting period.

## 13.2 No Single-Metric Promotion

A model SHALL NOT be promoted solely because it has a higher:

- accuracy;
- ROC-AUC;
- F1;
- raw discrimination score.

Probability quality, temporal stability, coverage and downstream numerical safety are mandatory parts of promotion.

---

# 14. Probability Calibration and Uncertainty

Probability quality matters because the output may influence annualized frequency and financial loss calculations.

A model that ranks cases correctly but is overconfident can materially distort financial risk.

## 14.1 Uncertainty Classes

| Uncertainty | Example | System response |
|---|---|---|
| Aleatoric | Similar cases have different legitimate outcomes | Probability/distribution width or quantiles |
| Epistemic | Limited evidence for new technology/sector | Lower confidence, wider uncertainty or abstention |
| Data coverage | Missing SIEM/EDR/IAM/asset context | Coverage indicator; limit/withhold outputs if material |
| OOD / drift | Production population differs from validation population | OOD flag + review/retraining decision |

## 14.2 No-False-Precision Rule

Missing telemetry does not mean zero incidents.

Weak evidence does not justify a precise number.

Where material inputs are absent, SentinelStack SHALL expose:

- data coverage;
- confidence status;
- assumptions;
- OOD state;
- model version;
- evidence provenance.

## 14.3 Downstream Authority

An ML prediction can remain visible as an advisory signal when confidence is low, but it must not silently produce an authoritative EAL/VaR result when required inputs are missing.

---

# 15. Model Deployment and Inference Contract

The inference contract is the stable bridge between the ML implementation and the Risk Engine.

## 15.1 Required Prediction Contract

```json
{
  "model_version": "string",
  "prediction_id": "uuid",
  "entity_scope": "asset|service|business_unit|enterprise",
  "observation_time": "timestamp",
  "p_h": 0.0,
  "horizon_days": 30,
  "calibration_version": "string",
  "confidence_level": "high|medium|low|insufficient",
  "data_coverage": {},
  "ood_flag": false,
  "feature_attribution": {},
  "input_bundle_hash": "sha256:...",
  "model_artifact_hash": "sha256:..."
}
```

For severity:

```json
{
  "model_version": "string",
  "prediction_id": "uuid",
  "entity_scope": "asset|service|business_unit|enterprise",
  "observation_time": "timestamp",
  "distribution_family": "string",
  "parameters": {},
  "quantiles": {
    "q10": 0,
    "q50": 0,
    "q90": 0
  },
  "confidence_level": "high|medium|low|insufficient",
  "data_coverage": {},
  "ood_flag": false,
  "input_bundle_hash": "sha256:...",
  "model_artifact_hash": "sha256:..."
}
```

## 15.2 Inference Rules

Every prediction SHALL identify:

- model version;
- feature-set version;
- calibration version;
- observation timestamp;
- entity scope;
- data coverage;
- OOD state;
- provenance/hash references.

The Risk Engine then:

1. validates the prediction contract;
2. annualizes probability where applicable;
3. obtains/conditions severity distributions;
4. performs aggregate-loss simulation;
5. calculates EAL, VaR and related authoritative metrics;
6. records the model lineage used by that risk run.

## 15.3 Scenario Inference

A what-if scenario must not overwrite the baseline prediction.

Instead:

```text
Baseline State
    |
    +--> Baseline Feature Bundle --> Model --> Baseline Prediction
    |
Scenario State Copy
    |
    +--> Scenario Feature Bundle --> Same Versioned Model --> Scenario Prediction
```

The Risk Engine compares the resulting authoritative risk outputs.

---

# 16. Monitoring, Drift and Retraining

ML production monitoring is evidence-driven.

| Signal | Example | Action |
|---|---|---|
| Data drift | Feature distribution / missingness / category shifts | Investigate and assess risk impact |
| Concept drift | Future outcomes vs predicted probabilities | Revalidate |
| Calibration drift | Brier/log-loss/ECE deterioration | Recalibrate or retrain |
| Coverage drift | Lower source freshness/completeness | Lower confidence or withhold output |
| OOD rate | Increased fraction of OOD rows | Investigate new population/feature failure |
| Prediction drift | Change in probability/score distribution | Compare against actual environment change |
| Business utility | Observed effect after controls | Validate decision usefulness |

## 16.1 Retraining Policy

Retraining SHALL be triggered by evidence rather than by an arbitrary calendar alone.

A scheduled review cadence may exist, but promotion of a new model requires:

- a new dataset snapshot;
- a new evaluation package;
- calibration evidence;
- drift analysis;
- updated model card;
- regression against the inference contract;
- Risk Engine compatibility tests.

---

# 17. Governance, Provenance and Model Cards

Model governance answers three separate trust questions.

| Trust question | Required evidence |
|---|---|
| Where did the data come from? | Source identifier, acquisition time, source version, ingestion run, record hash, transformation lineage |
| Is the model statistically reliable for this use? | Temporal metrics, calibration, backtests, uncertainty/OOD evaluation |
| Can the result be reproduced? | Input bundle hash, model version, parameter version, simulation configuration and authoritative-output lineage |

## 17.1 Minimum Model Card

Every promoted model SHALL document:

- intended use;
- decision context;
- population;
- data sources;
- target definition;
- prediction horizon;
- features;
- point-in-time policy;
- train/validation/test periods;
- evaluation metrics;
- calibration method;
- known biases;
- coverage limitations;
- OOD limitations;
- human oversight requirements;
- prohibited interpretations;
- model version;
- code and artifact hashes.

## 17.2 Separation of Trust Claims

SentinelStack SHALL distinguish:

```text
Data authenticity
    !=
Model statistical reliability
    !=
Historical decision reproducibility
```

A blockchain/hash anchor, where implemented, can strengthen historical integrity/provenance. It does not prove that a model is statistically correct.

---

# 18. Synthetic Enterprise Context for SIH Demonstration

Because private enterprise data is unavailable for the public SIH demonstration, SentinelStack may create a synthetic enterprise context around real public cyber evidence.

Synthetic fields may include:

- assets;
- business services;
- service dependencies;
- asset/service criticality;
- control coverage;
- MFA/EDR posture;
- downtime-cost assumptions;
- financial-impact parameters.

## 18.1 Synthetic Data Rules

Every synthetic record SHALL contain provenance indicating:

```text
provenance_type = SYNTHETIC
generation_seed = <declared seed>
generation_version = <scenario/data version>
```

## 18.2 Example Synthetic Fields

| Field | Example use | Rule |
|---|---|---|
| `asset_criticality` | Risk contextualization | Generated according to declared profile |
| `service_dependency` | Impact propagation | Directed graph with bounded strengths |
| `mfa_coverage` | Control effectiveness / what-if | Scenario-controlled |
| `edr_coverage` | Control effectiveness | Scenario-controlled |
| `downtime_cost_hour` | Financial-impact assumption | Sensitivity-tested and labelled assumption |
| `business_impact_profile` | Severity context | Versioned and declared |
| `control_state` | Scenario modeling | Must not modify baseline production state |

## 18.3 Validation Boundary

Synthetic context is valid for demonstrating:

- data wiring;
- risk recomputation;
- what-if behavior;
- dependency propagation;
- investment optimization constraints;
- end-to-end lineage;
- dashboard behavior.

It SHALL NOT be presented as proof that the ML model generalizes to real enterprises.

---

# 19. Production Rollout and Promotion Stages

The SDD v1.2 implementation sequence places ML in Phase P6.

## 19.1 P6 Entry Criteria

Before promoting ML-01, the implementation should already have:

- Risk Engine v2 authority boundary;
- versioned risk runs;
- reproducible feature/input bundle handling;
- scenario-safe state representation;
- model/prediction persistence contract;
- integration test harness.

## 19.2 P6 Work Package

```text
Dataset ingestion
    ->
Point-in-time feature builder
    ->
Label builder
    ->
Leakage scanner
    ->
Temporal split manifest
    ->
Baseline model
    ->
Calibration
    ->
Temporal evaluation
    ->
Model registry
    ->
Inference adapter
    ->
Risk Engine integration
```

## 19.3 Promotion Levels

| Level | Meaning | Allowed use |
|---|---|---|
| Experimental | Training/research only | No authoritative production risk |
| Shadow | Inference runs beside current logic | Compare outputs; no authority |
| Advisory | Visible to authorized users | May inform analysis; still not authoritative |
| Promoted | Passed all gates | Can feed governed Risk Engine calculations |
| Retired | Removed from active inference | Historical lineage remains immutable |

---

# 20. Limitations and Non-Claims

The following limitations are explicit engineering constraints:

1. No public dataset provides the full combination of enterprise telemetry, asset criticality, controls, dependencies and complete financial losses for arbitrary companies.
2. EPSS is population-level and is not an organization-specific exploitation forecast.
3. KEV is evidence of known exploitation and is not a complete census of exploitation.
4. VERIS/VCDB provides valuable real-world incident evidence but has reporting and coverage limitations.
5. Security-event research corpora may contain source-specific or machine-derived labels; label quality must be disclosed.
6. Published cyber-loss research datasets support severity benchmarking but do not establish a universal enterprise loss curve.
7. ML predictions are estimates with assumptions and uncertainty.
8. EAL/VaR are modeled risk metrics, not guarantees of future loss.
9. Anomaly scores are not equivalent to confirmed incidents.
10. Black-swan geopolitical events are not claimed to be predicted by the ML system.
11. Stress scenarios may intentionally represent out-of-distribution states.
12. Synthetic enterprise context cannot validate model generalization by itself.

---

# 21. Verification Checklist

| Check | Pass condition | Evidence |
|---|---|---|
| Baseline alignment | ML requirements map to workload/data/governance contracts | Traceability report |
| Point-in-time integrity | No future feature values in training rows | Leakage scanner |
| Label correctness | Frozen target policy reproduces exactly | Label audit + source hash |
| Temporal split | Test period is later and untouched | Split manifest |
| Calibration | Calibration artifact is versioned and evaluated on later data | Calibration report |
| Reproducibility | Same inputs/settings reproduce outputs within tolerance | Re-run report |
| Inference contract | Prediction schema accepted by Risk Engine | Contract tests |
| Uncertainty | Missing/OOD states surface explicit metadata | Failure-mode tests |
| Attribution | Prediction attribution matches stored model version | Explainability test |
| Dataset provenance | Public/private/synthetic provenance is distinguishable | Dataset audit |
| Model governance | Model card + evaluation + lineage complete | Registry record |
| Scenario safety | Scenario inference does not mutate baseline state | Scenario isolation test |
| Risk authority | ML cannot directly write authoritative EAL/VaR | Service authorization test |
| Downstream linkage | Prediction can be traced to a risk assessment | Lineage test |

---

# Appendix A — Feature Dictionary

| ID | Feature | Definition | Window |
|---|---|---|---|
| F01 | `cvss_base` | CVSS base severity | As-of `t` |
| F02 | `epss_score` | Historical EPSS probability | As-of `t` |
| F03 | `kev_flag` | Whether CVE was in KEV | As-of `t` |
| F04 | `vuln_age_days` | Days since vulnerability publication | Derived at `t` |
| F05 | `internet_exposed` | External exposure state | As-of `t` |
| F06 | `asset_criticality` | Business importance | As-of `t` |
| F07 | `dependency_weight` | Service dependency strength | As-of `t` |
| F08 | `mfa_coverage` | MFA coverage | As-of `t` |
| F09 | `edr_coverage` | EDR deployment coverage | As-of `t` |
| F10 | `control_effectiveness` | Coverage-aware control effectiveness | As-of `t` |
| F11 | `threat_activity` | Recent threat activity signal | ≤ `t` lookback |
| F12 | `behavior_anomaly` | Recent anomaly score | ≤ `t` lookback |
| F13 | `patch_status` | Remediation state | As-of `t` |
| F14 | `service_criticality` | Criticality of affected service | As-of `t` |
| F15 | `exposure_score` | Composite exposure indicator | Versioned transform |

Additional enterprise-specific features may be introduced only through versioned feature-set changes and leakage review.

---

# Appendix B — Dataset Lineage

The minimum authoritative lineage chain is:

```text
Source Record IDs
      |
      v
Raw Ingestion Snapshot
      |
      v
Canonical Record
      |
      v
Point-in-Time Feature Snapshot
      |
      v
Training Dataset Snapshot
      |
      v
Model Version
      |
      v
Prediction Record
      |
      v
Risk Assessment Input Bundle
      |
      v
Risk Assessment Output
      |
      v
Scenario / Recommendation / Investment Decision
```

## B.1 Minimum Hash Chain

Where canonical hashing is implemented:

```text
source_record_hash
    ->
feature_bundle_hash
    ->
model_artifact_hash
    ->
prediction_input_hash
    ->
prediction_record
    ->
risk_input_bundle_hash
    ->
risk_output_hash
```

Hashes support reproducibility and integrity verification.

They do not establish statistical validity on their own.

---

# Appendix C — Experiment Registry Minimum

Every experiment SHALL record:

```yaml
experiment_id:
dataset_snapshot_id:
feature_set_version:
label_policy_version:
observation_window:
prediction_horizon_days:
target_definition:
population_scope:
synthetic_context_used:
synthetic_generation_version:
train_period:
validation_period:
test_period:
model_family:
hyperparameters:
random_seed:
calibration_method:
class_imbalance_strategy:
threshold_policy:
metrics:
uncertainty_method:
ood_method:
code_commit:
environment_digest:
model_artifact_hash:
status:
```

The registry is the authoritative index for model-development lineage.

---

# Appendix D — Model Promotion Gate

A model can advance to **Promoted** only when all required gates pass.

## D.1 Data Gate

- schema valid;
- point-in-time rules pass;
- label policy frozen;
- no unresolved critical lineage issues;
- source provenance complete.

## D.2 Statistical Gate

- temporal test results available;
- baseline comparison complete;
- calibration evaluated;
- uncertainty/OOD evaluated;
- stability assessed across rolling windows.

## D.3 Engineering Gate

- deterministic/reproducible artifact generated;
- inference schema validated;
- artifact hash recorded;
- preprocessing and calibration packaged;
- backward/forward schema compatibility checked.

## D.4 Risk-Engine Gate

- Risk Engine accepts prediction output;
- annualization semantics are correct;
- missing/low-confidence conditions are handled;
- scenario reruns use the same model bundle;
- model cannot directly write authoritative risk values.

## D.5 Governance Gate

- model card complete;
- evidence references complete;
- human oversight defined;
- limitations and unsupported interpretations documented;
- promotion decision recorded in audit history.

---

# Appendix E — Implementation Mapping

This appendix binds the ML specification to the repository-aware SDD v1.2 implementation plan.

| Repository area | ML role | Treatment |
|---|---|---|
| `src/server.ts` | Runtime/health/security boundary | Keep existing middleware/security behavior. |
| `src/routes/index.ts` | Route registration | Extend only after inference/risk contracts are defined. |
| `src/routes/cyber-risk.routes.ts` | Risk API | Risk-facing inference metadata and risk-run contracts. |
| `src/controllers/cyber-risk.controller.ts` | Request orchestration | Validate scope/version/coverage and return run metadata. |
| `src/services/cyberRiskQuantification.service.ts` | Current risk compatibility layer | Keep as façade during migration; delegate to the new risk domain. |
| `src/services/risk/*` | Risk domain | Consume governed ML outputs; remain authoritative for financial metrics. |
| `prisma/schema.prisma` | Persistence | Add/strengthen model, prediction, lineage and evidence records incrementally. |
| `scripts/seed-cyber-risk-digital-twin.js` | SIH context | Extend seed data with explicit synthetic provenance and point-in-time semantics. |
| `src/hooks/use-cyber-risk.ts` | Frontend contract | Add model version, confidence, provenance and risk-run metadata. |
| `src/app/dashboard/risk-intelligence/page.tsx` | UX | Show ML confidence/provenance alongside authoritative risk outputs. |
| `src/components/dashboard/ExecutiveRiskOverview.tsx` | Executive UI | Never imply that an ML prediction itself is the financial-risk result. |
| AI/Genkit flows | Grounded explanation | Feed only verified structured backend results. |
| Optional Python service | ML inference/training | Add only if measurable benefit justifies a separate runtime. |

## E.1 Implementation Rule

Do not build dashboard claims before the underlying risk and ML contracts are authoritative.

During migration, the UI may display transitional risk outputs, but those outputs must be labelled according to their implementation status until Risk Engine v2 and the relevant ML model are promoted.

---

# Appendix F — Reference Data/Model Examples

## F.1 Likelihood Example

Illustrative only:

```json
{
  "event_definition": "KEV transition",
  "horizon_days": 30,
  "p_h": 0.18,
  "model_version": "likelihood-v1-experimental",
  "calibration_version": "cal-v1",
  "confidence_level": "medium",
  "ood_flag": false
}
```

This example is not a claim about any real vulnerability or organization.

## F.2 Risk-Engine Consumption

```text
ML p_h
   |
   v
annualized frequency
   |
   +--> severity distribution
   |
   v
aggregate-loss simulation
   |
   +--> EAL
   +--> VaR
   +--> Financial Exposure
   +--> Product Risk Score
```

The arrows are one-way in terms of authority: ML estimates inputs; the Risk Engine computes authoritative metrics.

---

# Baseline Status

This document is the **ML/data engineering baseline v1.1**.

Algorithm-specific implementation may be refined after empirical dataset profiling, but changes to any of the following require a versioned specification change and regression against the SRS, SDD and Risk Model contracts:

- target definition;
- feature semantics;
- point-in-time rules;
- split policy;
- calibration policy;
- uncertainty/OOD policy;
- model authority boundary;
- inference schema;
- dataset provenance semantics.

**Next documentation baseline in the agreed sequence:** API & Integration Contract v1.1, followed by Implementation & Repository Architecture Specification v1.1.
