# SentinelStack — P6 Predictive ML, Calibration, Drift, Model Registry & Continuous Risk Forecasting Implementation Specification v1.0

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.0  
**Document Status:** P6 Implementation Engineering Baseline  
**Repository:** `github.com/ciphernet01/sentinelstack`  
**Primary Runtime:** Existing Express + TypeScript + Prisma/PostgreSQL  
**ML Runtime:** Python service/process only where ML value justifies separation  
**Primary Dependencies:** P2 Risk Engine v2 + P3 Risk Driver Attribution & Evidence + P4 Scenario Engine + P5 Investment Optimization  
**Date:** 29 September 2026  
**Baselines:** PS 26105 • SRS v2.1 • SDD v1.2 • Data Dictionary v1.1 • Risk Model v1.1 • ML Dataset & Training Specification v1.1 • API Contract v1.1 • Implementation Architecture v1.1 • P0/P1 Runbook v1.0 • P2 Risk Engine v2 Specification v1.0 • P3 Driver Attribution & Evidence Specification v1.0 • P4 Scenario Engine Specification v1.0 • P5 Investment Optimization Specification v1.0

> **Purpose:** Define the production-oriented predictive ML layer that estimates uncertain cyber-risk variables, validates and calibrates those predictions, monitors model drift and data drift, versions model bundles, and feeds governed probabilistic inputs into the deterministic P2 financial-risk engine.

> **Core rule:** ML estimates uncertain inputs; P2 remains authoritative for financial-risk calculation. The ML layer never replaces the mathematical risk engine, never lets an LLM invent probabilities, and never silently substitutes an unvalidated model for a production model.

---

# 1. Objective

P6 implements the predictive intelligence required to make SentinelStack continuous rather than purely snapshot-driven.

The principal predictive question is:

```text
Given the vulnerability, asset, exposure, threat, control and historical context,
what is the probability that the modeled adverse event occurs within a defined
future time horizon?
```

The primary initial use case is:

```text
Probability of exploitation within a defined window
```

with future extensibility to:

```text
incident frequency
control failure
threat escalation
asset compromise
loss severity
risk trend
```

The core pipeline is:

```text
Observed Data
     |
     v
Point-in-Time Dataset
     |
     v
Feature Engineering
     |
     v
Training Dataset
     |
     v
Temporal Split
     |
     v
Baseline Model
     |
     v
Challenger Model
     |
     v
Calibration
     |
     v
Validation
     |
     v
Model Registry
     |
     v
Deployment Policy
     |
     v
Inference
     |
     v
P2 Risk Engine
     |
     v
Financial Risk
```

Monitoring loop:

```text
Production Predictions
        |
        +--> performance
        +--> calibration
        +--> feature drift
        +--> prediction drift
        +--> data quality
        +--> OOD signals
        |
        v
Model Health
        |
        v
Retrain / Review / Rollback
```

---

# 2. Current Repository Gap

The current SentinelStack repository has the architectural foundation for AI integration, but the PS-26105 predictive ML requirement is not yet a production-calibrated model pipeline.

Current state:

```text
AI integration exists
risk engine has hand-tuned likelihood
ML training pipeline is not authoritative
no governed production model registry
no complete calibration pipeline
no full drift-monitoring lifecycle
```

The current hand-tuned likelihood logic in the transitional risk service must not simply be renamed “AI.”

P6 creates a formal contract:

```text
ML prediction
    ->
validated probability
    ->
P2 likelihood/frequency provider
```

---

# 3. P6 Entry Criteria

P6 assumes:

## P2

```text
LikelihoodProvider
FrequencyProvider
RiskInputContext
RiskRun
RiskAssessment
model/parameter metadata
```

## P3

```text
evidence lineage
driver attribution
model signal evidence support
```

## P4

```text
scenario-aware RiskInputContext
```

## P5

```text
investment/scenario consumers of risk metrics
```

## Data Specification

The ML dataset must follow the point-in-time and leakage controls defined in the ML Dataset & Training Specification v1.1.

---

# 4. P6 Exit Criteria

P6 is complete when:

```text
[ ] Dataset generation is point-in-time correct
[ ] Training features are versioned
[ ] Label generation is versioned
[ ] Temporal train/validation/test split exists
[ ] Baseline model exists
[ ] Challenger model exists
[ ] Calibration is evaluated
[ ] Probability quality gates exist
[ ] Model registry exists
[ ] Model promotion workflow exists
[ ] Prediction contract is versioned
[ ] Production inference is integrated with P2
[ ] Prediction metadata is persisted
[ ] Feature drift monitoring exists
[ ] Prediction drift monitoring exists
[ ] Performance monitoring exists when labels arrive
[ ] OOD / low-confidence detection exists
[ ] Model rollback exists
[ ] Model lineage is auditable
[ ] Training/inference data provenance is stored
[ ] Model changes do not silently alter historical risk assessments
[ ] Frontend can disclose model status/confidence where appropriate
```

---

# 5. ML Authority Boundary

P6 must preserve a strict boundary.

```text
ML
    estimates probabilities / uncertain variables

P2
    converts those variables into:
    frequency
    severity
    aggregate loss
    EAL
    VaR
    risk score
```

Example:

```text
ML:
P(exploitation in next 30 days) = 0.18

P2:
lambda = -ln(1 - 0.18) / H

P2:
aggregate loss simulation

P2:
EAL = ₹...

P2:
VaR95 = ₹...
```

The probability is ML-derived.

The financial risk is P2-derived.

---

# 6. What ML Does Not Do

ML must not directly return:

```text
"Enterprise EAL = ₹25M"
"VaR95 = ₹60M"
"Investment = ₹10M"
"Best control = MFA"
```

unless these are outputs of downstream authoritative services.

ML may return:

```text
probability
forecast
anomaly score
class probability
confidence/uncertainty
feature attribution
```

---

# 7. Primary ML Problem

Initial target:

```text
P(exploitation_within_horizon = 1 | X_t)
```

where:

```text
X_t
```

is the point-in-time feature vector for an asset-vulnerability observation at time `t`.

Example horizon:

```text
30 days
```

The actual production horizon is configuration-driven.

---

# 8. Label Definition

Initial proxy label:

```text
CVE becomes KEV within the next H days
```

where the dataset explicitly documents that this is:

```text
a KEV-transition proxy
```

and not a perfect label for:

```text
confirmed exploitation of the organization's asset
```

The production system should eventually learn from enterprise-specific exploitation/incident outcomes where sufficiently reliable labels exist.

---

# 9. Label Integrity

A label for date `t` may only use information available after `t` to establish the future outcome.

Forbidden leakage:

```text
using future KEV status as a feature
```

when the label itself is:

```text
future KEV transition
```

Likewise avoid:

```text
post-incident telemetry
post-remediation state
future patch state
future exploit availability
```

inside the feature vector.

---

# 10. Point-in-Time Dataset

Recommended logical row:

```text
entity_id
vulnerability_id
observation_time
asset_state
vulnerability_state
control_state
threat_state
features
label_window_start
label_window_end
label
```

One row represents:

```text
an observation at a point in time
```

rather than one static CVE.

---

# 11. Feature Groups

Recommended feature domains:

```text
Vulnerability
Asset
Exposure
Threat
Control
Temporal
Business context
Telemetry
Historical behavior
Data quality
```

---

# 12. Vulnerability Features

Examples:

```text
CVSS base score
CVSS severity
EPSS probability
KEV status at observation time
exploit availability
vulnerability age
CWE
attack vector
attack complexity
privileges required
user interaction
remediation status
vendor/product family
```

Only point-in-time-safe values are allowed.

---

# 13. Asset Features

Examples:

```text
asset criticality
asset type
service association
internet exposure
cloud/on-prem
business unit
environment
location type
production status
asset age
```

Sensitive organization identifiers should be encoded or transformed appropriately for model training.

---

# 14. Control Features

Examples:

```text
MFA coverage
EDR coverage
EDR effectiveness
patch coverage
segmentation status
backup coverage
privileged access coverage
logging coverage
control freshness
```

Control features represent observed state at prediction time.

---

# 15. Threat Features

Examples:

```text
active threat indicator
relevant campaign activity
indicator severity
threat-intel freshness
attack-technique relevance
industry-targeting signal
observed exploit activity
```

Observed intelligence and hypothetical scenario signals must remain distinct.

---

# 16. Telemetry Features

Possible:

```text
security alert volume
high-severity event count
authentication anomalies
failed-login rate
endpoint detections
cloud configuration alerts
network anomaly rate
```

Telemetry must be aggregated into feature windows rather than passing unrestricted raw logs into the model.

---

# 17. Temporal Features

Examples:

```text
vulnerability age
days since disclosure
days since exploit publication
days since KEV inclusion
days since last patch attempt
rolling alert count
rolling threat activity
rolling control state
```

Temporal features are useful but high-risk for leakage.

Each feature must document:

```text
observation cutoff
lookback window
aggregation rule
```

---

# 18. Business Context Features

Optional predictive features:

```text
service criticality
asset criticality
business dependency degree
downtime sensitivity
```

The model may use these to estimate likelihood where justified.

P2 remains responsible for converting business context into modeled financial impact.

---

# 19. Data Quality Features

Useful features may include:

```text
telemetry completeness
asset attribution confidence
source freshness
missing feature indicators
```

These may improve prediction or help detect OOD conditions.

They must not be silently converted into artificial loss amounts.

---

# 20. Feature Store Contract

A full external feature-store product is not mandatory for the SIH implementation.

Recommended free-first architecture:

```text
PostgreSQL
+
versioned feature-generation code
+
Parquet/CSV training artifacts
+
model artifacts
```

The system should preserve enough metadata to reproduce feature generation.

---

# 21. Feature Definition Object

```ts
type FeatureDefinition = {
  name: string;
  version: string;

  dataType:
    | "NUMBER"
    | "BOOLEAN"
    | "CATEGORY"
    | "TEXT"
    | "TIMESTAMP";

  sourceType: string;
  sourceField?: string;

  lookbackWindow?: string;
  aggregation?: string;

  pointInTimeSafe: boolean;

  missingValuePolicy: string;
};
```

---

# 22. Feature Registry

Create:

```text
ml/features/
```

with versioned definitions.

Example:

```text
cvss_score@v1
epss_probability@v1
internet_exposure@v1
asset_criticality@v1
mfa_coverage@v1
edr_coverage@v1
threat_activity_7d@v1
```

A training run references the exact feature versions used.

---

# 23. Feature Engineering Pipeline

Recommended:

```text
source data
   |
   v
canonical tables
   |
   v
point-in-time joins
   |
   v
feature transformations
   |
   v
feature validation
   |
   v
training matrix
```

The same feature logic should be reusable for inference.

---

# 24. Training / Serving Skew

One critical production failure mode is:

```text
training feature calculation
!=
production feature calculation
```

Therefore:

```text
shared feature code
+
versioned transformations
+
fixture tests
```

must be used where practical.

---

# 25. Baseline Model

First model:

```text
Logistic Regression
```

Purpose:

```text
strong transparent baseline
probability output
coefficient interpretability
calibration baseline
```

It is not automatically the production winner.

---

# 26. Challenger Model

Primary candidate:

```text
gradient-boosted trees
```

For example:

```text
XGBoost
LightGBM
HistGradientBoosting
```

Choose the library compatible with the free-first deployment environment.

---

# 27. Model Selection

Candidate selection must use:

```text
temporal holdout performance
calibration
stability
latency
interpretability
maintenance cost
```

Do not select a model based solely on:

```text
ROC-AUC
```

because probability calibration is critical.

---

# 28. Training Split

Use chronological splitting:

```text
older period -> train
next period   -> validation
latest period -> test
```

Example:

```text
2024:
train

2025:
validation

2026:
test
```

Exact dates should be determined by available labeled data.

---

# 29. No Random Primary Split

Random splitting can place near-duplicate or temporally adjacent observations into different partitions.

That can inflate measured performance.

Therefore:

```text
temporal split = primary
```

Random split can be used only as a secondary diagnostic.

---

# 30. Group Leakage

Avoid leakage across:

```text
same vulnerability
same asset
same vendor/product
same incident cluster
```

when the grouping would allow future information to enter training indirectly.

Document the grouping strategy.

---

# 31. Class Imbalance

Exploitation labels may be highly imbalanced.

Evaluate:

```text
PR-AUC
precision
recall
F1
calibration
```

Do not rely on:

```text
accuracy
```

as the primary metric.

---

# 32. Model Metrics

Minimum:

```text
ROC-AUC
PR-AUC
Precision
Recall
F1
Brier score
Log loss
Calibration error
```

Also measure:

```text
prediction coverage
latency
missing-feature rate
```

---

# 33. Calibration

Because ML probability feeds:

```text
likelihood
```

calibration is mandatory.

Candidate techniques:

```text
Platt scaling
isotonic regression
calibrated classifier
```

Select based on temporal validation.

---

# 34. Calibration Requirement

A model predicting:

```text
0.20
```

should represent approximately:

```text
20% event frequency
```

over sufficiently large groups of comparable predictions, subject to sampling uncertainty and shift.

This is the key reason calibration matters more than raw classification accuracy for P2 integration.

---

# 35. Reliability Diagram

Generate:

```text
predicted probability bucket
vs
observed event frequency
```

Example buckets:

```text
0.0–0.1
0.1–0.2
...
0.9–1.0
```

Persist validation artifacts.

---

# 36. Calibration Gates

A model should not be promoted solely because it beats the baseline on AUC.

Example promotion requirements:

```text
acceptable PR-AUC
acceptable Brier/log loss
calibration within configured threshold
no severe subgroup degradation
no unacceptable data drift
latency within threshold
```

Exact thresholds must be configured and versioned.

---

# 37. Probability Uncertainty

Where practical, expose uncertainty through:

```text
prediction interval
ensemble variance
bootstrap interval
conformal method
model confidence category
```

Do not invent confidence percentages without a statistical method.

---

# 38. Out-of-Distribution Detection

A production model can encounter observations unlike training data.

P6 should detect:

```text
unusual feature values
novel categories
distribution shift
extreme combinations
```

Possible methods:

```text
Mahalanobis distance
feature quantile monitoring
Isolation Forest
autoencoder/embedding approach
```

Use the simplest method that provides measurable benefit.

---

# 39. OOD Policy

When OOD risk is high:

```text
continue with warning
or
fallback to approved baseline
or
suppress prediction
```

Policy must be explicit.

The model must not silently output normal-looking probabilities for unknown data while hiding that the observation is outside training distribution.

---

# 40. Prediction Contract

Recommended:

```ts
type MLPrediction = {
  predictionId: string;

  modelId: string;
  modelVersion: string;

  featureSetVersion: string;

  target:
    | "EXPLOITATION_WITHIN_HORIZON"
    | string;

  horizonDays: number;

  probability: number;

  confidence:
    | "HIGH"
    | "MEDIUM"
    | "LOW"
    | "OOD";

  oodScore?: number;

  generatedAt: string;
  asOf: string;

  inputHash: string;
};
```

---

# 41. Prediction Probability Rules

Validate:

```text
0 <= probability <= 1
```

Reject:

```text
NaN
Infinity
null probability
```

unless the contract explicitly supports:

```text
prediction unavailable
```

---

# 42. Prediction Freshness

Every prediction requires:

```text
asOf
generatedAt
```

The distinction is important:

```text
asOf = data state represented

generatedAt = time model produced prediction
```

---

# 43. Prediction Persistence

Recommended model:

```text
MLPrediction
```

fields:

```text
id
organizationId
modelVersionId
targetType
targetId
horizonDays
probability
confidence
oodScore
featureSetVersion
inputHash
asOf
generatedAt
createdAt
```

---

# 44. Prediction Lineage

For every prediction:

```text
source records
feature bundle
model version
calibration version
prediction
risk run
```

must be linkable.

Conceptually:

```text
Evidence
  ->
Feature Snapshot
  ->
Model Prediction
  ->
RiskRun
  ->
RiskAssessment
```

---

# 45. P2 Likelihood Integration

P2 should use:

```text
MLPrediction.probability
```

through:

```text
LikelihoodProvider
```

when the model is:

```text
production
enabled
validated
in scope
```

Formula:

```text
lambda = -ln(1 - p_H) / H_y
```

where:

```text
p_H = calibrated probability
H_y = horizon expressed in years
```

---

# 46. Probability-to-Frequency Validation

The conversion assumes:

```text
p_H < 1
```

and uses:

```text
lambda = -ln(1-p_H)/H_y
```

Edge handling must avoid:

```text
log(0)
```

For probabilities extremely close to 1:

```text
apply documented numerical policy
```

rather than arbitrary clipping without metadata.

---

# 47. Model Fallback

Approved fallback sequence:

```text
production calibrated model
        |
        v
approved challenger/baseline
        |
        v
explicit deterministic fallback
```

The fallback used must be persisted in the RiskRun metadata.

---

# 48. No Silent Fallback

A prediction should carry:

```text
predictionSource
```

such as:

```text
ML_PRODUCTION
ML_BASELINE
DETERMINISTIC_FALLBACK
UNAVAILABLE
```

This allows the risk engine and UI to disclose how the likelihood input was obtained.

---

# 49. Historical Immutability

When model version changes:

```text
old RiskAssessment
```

must continue referencing:

```text
old model version
```

A later risk run may use:

```text
new model version
```

Historical results must not be silently rewritten.

---

# 50. Model Registry

Create a model registry domain:

```text
src/services/model/
```

Core records:

```text
Model
ModelVersion
ModelArtifact
ModelMetric
ModelCalibration
ModelDeployment
ModelEvaluation
ModelDriftStatus
```

---

# 51. Model Object

```ts
type Model = {
  id: string;

  name: string;
  purpose: string;
  target: string;

  status:
    | "DEVELOPMENT"
    | "VALIDATION"
    | "PRODUCTION"
    | "RETIRED";

  owner: string;

  createdAt: string;
};
```

---

# 52. Model Version

```ts
type ModelVersion = {
  id: string;

  modelId: string;
  version: string;

  artifactUri: string;
  artifactHash: string;

  featureSetVersion: string;
  labelVersion: string;

  trainingRunId: string;

  calibrationVersion?: string;

  status:
    | "CANDIDATE"
    | "VALIDATED"
    | "STAGED"
    | "PRODUCTION"
    | "RETIRED"
    | "REJECTED";

  createdAt: string;
};
```

---

# 53. Model Artifact Integrity

Every model artifact should store:

```text
artifact hash
```

for example:

```text
SHA-256
```

This helps verify that the loaded model matches the approved artifact.

---

# 54. Artifact Storage

Free-first options:

```text
local object storage
S3-compatible storage
PostgreSQL metadata + file storage in controlled environment
```

Production deployment should use a durable artifact store rather than container-local ephemeral storage.

---

# 55. Training Run

Recommended:

```text
MLTrainingRun
```

fields:

```text
id
datasetVersion
featureSetVersion
labelVersion
trainStart
trainEnd
validationStart
validationEnd
testStart
testEnd
modelType
hyperparameters
seed
codeVersion
dataHash
status
createdAt
```

---

# 56. Training Reproducibility

A training run should capture:

```text
dataset hash
feature version
label version
source snapshot
code commit
dependencies
hyperparameters
random seed
training timestamps
```

This makes the model reproducible.

---

# 57. Model Evaluation

Store:

```text
ModelMetric
```

with:

```text
metricName
value
datasetSplit
evaluationDate
threshold/configuration
```

Example:

```text
PR-AUC = ...
Brier = ...
ECE = ...
```

---

# 58. Subgroup Evaluation

Evaluate important groups where sufficient data exists:

```text
asset criticality
business unit
asset type
cloud/on-prem
industry segment
exposure class
```

The exact grouping must avoid creating privacy or sparsity problems.

The purpose is to identify material degradation, not to manufacture small-sample conclusions.

---

# 59. Subgroup Calibration

A model may be globally calibrated but poorly calibrated for a specific population.

Monitor:

```text
global calibration
+
material operational subgroup calibration
```

Require minimum sample sizes before acting on subgroup metrics.

---

# 60. Model Promotion Workflow

```text
Training
  |
  v
Candidate
  |
  v
Validation
  |
  v
Calibration
  |
  v
Security/lineage checks
  |
  v
Staging
  |
  v
Shadow evaluation
  |
  v
Production
```

---

# 61. Promotion Checklist

Before production:

```text
[ ] dataset version recorded
[ ] temporal test completed
[ ] no known leakage
[ ] metrics recorded
[ ] calibration passed
[ ] artifact hash verified
[ ] feature compatibility verified
[ ] inference test passed
[ ] model explainability available
[ ] OOD policy configured
[ ] rollback target exists
```

---

# 62. Shadow Mode

A challenger model may run alongside production:

```text
production model -> authoritative prediction
challenger -> observation only
```

Compare:

```text
probabilities
calibration
drift sensitivity
latency
coverage
```

The challenger must not affect authoritative risk until promoted.

---

# 63. Champion/Challenger

Registry should maintain:

```text
champion
challenger
```

roles.

A challenger can become champion only after promotion workflow passes.

---

# 64. Rollback

If production model degrades:

```text
production model v3
      |
      v
rollback
      |
      v
production model v2
```

Record:

```text
rollback reason
actor
timestamp
affected predictions/runs
```

New risk runs use the restored model version.

Historical runs remain unchanged.

---

# 65. Drift Types

Track separately:

```text
Data Quality Drift
Feature Drift
Prediction Drift
Concept Drift
Performance Drift
Calibration Drift
```

These are different conditions.

---

# 66. Feature Drift

Monitor distributions such as:

```text
CVSS
EPSS
internet exposure
asset criticality
MFA coverage
EDR coverage
threat activity
```

Possible metrics:

```text
Population Stability Index
Kolmogorov-Smirnov distance
Jensen-Shannon divergence
Wasserstein distance
```

Choose metrics appropriate to feature type.

---

# 67. Prediction Drift

Monitor:

```text
mean probability
probability distribution
high-risk prediction rate
prediction entropy where applicable
```

Prediction drift does not automatically mean model failure.

It indicates:

```text
production prediction behavior changed
```

and requires investigation.

---

# 68. Concept Drift

Concept drift occurs when:

```text
X -> outcome relationship
```

changes.

This is harder to detect because labels arrive later.

Use:

```text
delayed performance evaluation
```

where sufficient outcome data exists.

---

# 69. Calibration Drift

Compare:

```text
predicted probability
vs
observed event rate
```

on recent labeled windows.

This is especially important because P2 relies on probabilities.

---

# 70. Performance Drift

When labels arrive:

```text
recent PR-AUC
recent Brier
recent log loss
recent recall/precision
```

should be compared with validation and historical production baselines.

---

# 71. Drift Monitoring Frequency

Suggested:

```text
data quality: daily or ingestion-driven
feature drift: daily
prediction drift: daily
performance: weekly/monthly depending on label latency
```

Exact cadence is configurable.

---

# 72. Drift Thresholds

Thresholds must be versioned:

```text
metric
threshold
window
minimum sample size
action
```

Example:

```text
PSI > configured threshold
+
sample size >= N
-->
DRIFT_WARNING
```

Do not hardcode universal threshold meaning across all datasets.

---

# 73. Drift Status

Recommended:

```text
HEALTHY
WARNING
CRITICAL
UNKNOWN
INSUFFICIENT_DATA
```

---

# 74. Drift Action Policy

Example:

```text
WARNING
    monitor

CRITICAL FEATURE DRIFT
    review model

CALIBRATION DRIFT
    investigate recalibration

PERFORMANCE FAILURE
    consider rollback/retraining

DATA QUALITY FAILURE
    block inference where safety policy requires
```

The action must be configurable.

---

# 75. Data Quality Gates

Before inference:

```text
required features present
type validation
range validation
category validation
freshness check
entity resolution
```

If a required input is invalid:

```text
fallback or prediction unavailable
```

according to policy.

---

# 76. Feature Range Validation

Example:

```text
probability:
0..1

coverage:
0..1

CVSS:
0..10
```

The exact ranges must follow the source semantics.

Reject impossible values.

---

# 77. Category Validation

Unknown categories should be handled explicitly:

```text
OTHER
UNKNOWN
OOD
```

or blocked.

Never silently map an unknown category to a common category if that can alter predictions materially.

---

# 78. Missing Data Policy

Each feature defines:

```text
required?
default?
indicator?
drop row?
fallback?
```

Production inference must use the same policy documented during training.

---

# 79. Feature Freshness

For dynamic sources:

```text
max age
```

can be configured.

Example:

```text
threat intelligence <= 24h
EDR telemetry <= 2h
asset inventory <= 7d
```

These are example policies, not universal requirements.

---

# 80. Prediction Availability

If required data is too stale:

```text
prediction status = UNAVAILABLE
```

or use a validated fallback.

The UI must show:

```text
prediction freshness
```

when material.

---

# 81. Inference Service

Recommended:

```text
ml/
   inference/
      predictor.py
      feature_pipeline.py
      validation.py
      model_loader.py
```

Python can expose:

```text
FastAPI
```

only if separate deployment gives practical value.

For the SIH/free-first implementation, a local Python process invoked by the worker is also acceptable if operationally reliable.

---

# 82. API Contract Between Node and ML

Suggested request:

```json
{
  "modelId": "exploit-probability",
  "modelVersion": "v3",
  "featureSetVersion": "features-v2",
  "target": {
    "assetId": "asset-001",
    "vulnerabilityId": "cve-001"
  },
  "asOf": "2026-09-29T00:00:00Z",
  "features": {
    "cvss": 9.8,
    "epss": 0.42,
    "internet_exposure": 1
  }
}
```

Response:

```json
{
  "predictionId": "pred-001",
  "probability": 0.18,
  "confidence": "MEDIUM",
  "oodScore": 0.08,
  "modelVersion": "v3",
  "featureSetVersion": "features-v2"
}
```

Values are illustrative.

---

# 83. Model Service Authentication

If deployed as a separate service:

```text
service-to-service authentication
network restriction
request signing where appropriate
rate limits
```

Do not expose internal model inference publicly without access control.

---

# 84. Model Input Privacy

Training/inference should minimize:

```text
PII
secrets
raw business financial data
```

Use derived features where possible.

Do not train directly on sensitive identifiers merely because they are available.

---

# 85. Data Retention

Retain:

```text
training metadata
model artifacts
evaluation
prediction metadata
feature snapshot references
```

Raw feature payload retention should follow:

```text
NFR-10
organization-configurable source-data retention
```

---

# 86. Prediction Retention

Historical predictions may be retained because they support:

```text
model evaluation
risk-run reproducibility
drift analysis
audit
```

The retention period should be configurable.

---

# 87. Prediction Versioning

Never overwrite:

```text
prediction probability
```

for an existing historical prediction.

Create a new prediction when:

```text
model version changes
feature state changes materially
as-of state changes
```

---

# 88. Model-to-Risk Run Link

A RiskRun should record:

```text
modelBundleId
prediction IDs
fallback policy
ML health state
```

so a risk assessment can answer:

```text
Which model influenced this risk calculation?
```

---

# 89. Model Bundle

P2 should receive a coherent bundle:

```text
Likelihood model
Severity model if ML-based
Calibration artifact
Feature set
Parameter set
```

Store:

```text
modelBundleId
modelBundleHash
```

---

# 90. Model Bundle Compatibility

A model bundle is valid only when:

```text
feature schema matches
prediction contract matches
calibration artifact matches
runtime version compatible
```

---

# 91. Model Bundle Hash

Canonical:

```text
model IDs
versions
artifact hashes
feature version
calibration version
runtime requirements
```

then:

```text
SHA-256
```

Store:

```text
modelBundleHash
```

---

# 92. Risk Engine Integration Rules

When P2 starts a risk run:

```text
resolve approved model bundle
        |
        v
build point-in-time feature context
        |
        v
obtain predictions
        |
        v
validate probability
        |
        v
store prediction metadata
        |
        v
LikelihoodProvider
        |
        v
Risk Engine
```

---

# 93. ML Failure During Risk Run

If the ML service fails:

```text
use approved fallback
```

only if fallback is allowed by policy.

Otherwise:

```text
risk run = degraded/failed
```

and the issue is visible.

Never silently substitute random/default probabilities.

---

# 94. Fallback Transparency

RiskRun metadata:

```text
likelihoodSource:
ML_PRODUCTION
ML_BASELINE
DETERMINISTIC_FALLBACK
```

and:

```text
degraded = true/false
```

---

# 95. ML Contribution to Risk Drivers

P3 may create:

```text
MODEL_SIGNAL
```

drivers where appropriate.

Example:

```text
Elevated modeled exploitation probability
```

with evidence:

```text
prediction ID
model version
feature attribution
```

The driver should explain:

```text
model signal
```

not claim:

```text
confirmed exploitation
```

---

# 96. Explainability

For tree-based models, use:

```text
SHAP
```

or another validated local attribution mechanism.

Store:

```text
feature
contribution
direction
prediction ID
explanation version
```

---

# 97. SHAP Semantics

A feature contribution explains:

```text
why the model prediction moved relative to its model baseline
```

It does not automatically equal:

```text
financial risk contribution
```

P3 remains responsible for financial attribution.

---

# 98. Model Explanation Example

```text
Prediction:
18%

Largest positive model factors:
+ high EPSS
+ internet exposure
+ critical asset
+ exploit availability

Negative factors:
- strong control coverage
```

These are model-explanation features.

They are not automatically rupee contributions.

---

# 99. Explanation Persistence

Recommended:

```text
MLPredictionExplanation
```

fields:

```text
id
predictionId
featureName
featureValue
contribution
direction
explanationVersion
createdAt
```

Top-N can be stored to control size.

---

# 100. Model Card

Every production model should have a model card containing:

```text
purpose
target
population
training data
label definition
feature set
limitations
metrics
calibration
known biases/coverage gaps
OOD policy
deployment scope
owner
version
```

---

# 101. Dataset Card

Every training dataset should document:

```text
sources
date range
population
label
sampling
known biases
missingness
limitations
license/usage terms
```

---

# 102. Public / Private / Synthetic Data

The training pipeline must keep separate:

```text
PUBLIC
PRIVATE
SYNTHETIC
```

and record the source class.

The SIH MVP may use:

```text
public vulnerability/threat/incident data
+
synthetic enterprise context
```

until private enterprise telemetry is available.

---

# 103. Data Licensing

Every external dataset must have:

```text
source URL/reference
license
retrieval date
usage restriction
dataset version
```

Do not silently package data with incompatible redistribution terms.

---

# 104. Training Dataset Assembly

Example:

```text
NVD / vulnerability data
+
EPSS
+
CISA KEV
+
asset synthetic context
+
controls synthetic context
+
threat activity
```

joined point-in-time.

The exact source mix should match the final dataset implementation and documented availability.

---

# 105. Incident Outcome Expansion

Future enterprise model can incorporate:

```text
confirmed exploitation
security incidents
EDR detections
SIEM incident labels
vulnerability remediation outcomes
```

when the organization has sufficient reliable labels.

This can replace the KEV proxy with a deployment-specific outcome.

---

# 106. Model Retraining Trigger

Retraining may be triggered by:

```text
scheduled cadence
critical drift
calibration degradation
performance degradation
new high-value labels
major feature schema change
```

Retraining does not imply automatic promotion.

---

# 107. Retraining Frequency

Recommended initial policy:

```text
periodic retraining
+
event-driven review
```

Exact cadence depends on:

```text
label arrival rate
threat dynamics
data volume
drift
```

---

# 108. Retraining Pipeline

```text
trigger
  |
  v
snapshot data
  |
  v
build point-in-time dataset
  |
  v
validate data
  |
  v
train baseline/challenger
  |
  v
evaluate
  |
  v
calibrate
  |
  v
model card
  |
  v
registry candidate
```

---

# 109. Continuous Training Guardrail

Do not implement:

```text
automatic model promotion after training
```

in the initial production system.

Use:

```text
candidate -> validated -> staged -> approved -> production
```

---

# 110. Drift Dashboard

Recommended model-health dashboard:

```text
Model:
Exploit Probability v3

Status:
Production

Calibration:
Healthy

Feature Drift:
Warning

Prediction Drift:
Healthy

Performance:
Pending / Healthy / Warning

OOD:
2.1%

Last Validation:
...

Training Window:
...

Current Feature Version:
...
```

---

# 111. Executive Model Disclosure

Executives generally should not need raw ML diagnostics.

Expose:

```text
model confidence
data freshness
major limitations
```

and provide drill-down for technical users.

---

# 112. Technical ML Dashboard

Show:

```text
AUC
PR-AUC
Brier
Calibration error
feature drift
prediction drift
model latency
missing features
OOD rate
fallback rate
```

---

# 113. Fallback Rate

Track:

```text
ML_PRODUCTION predictions
vs
fallback predictions
```

A rising fallback rate can signal:

```text
data quality
service reliability
feature incompatibility
```

---

# 114. Latency Metrics

Track:

```text
feature generation latency
model inference latency
P95/P99 latency
model load time
```

---

# 115. Inference Capacity

Use:

```text
batch inference
```

where appropriate for:

```text
large asset/vulnerability populations
```

and:

```text
online inference
```

for:

```text
interactive scenario
```

where feasible.

---

# 116. Batch Prediction Architecture

```text
RiskRun
   |
   v
candidate records
   |
   v
feature batch
   |
   v
ML inference
   |
   v
prediction records
   |
   v
P2
```

---

# 117. Scenario Inference

For P4:

```text
scenario state
```

may require new predictions.

Example:

```text
MFA coverage changes
```

If the model uses MFA coverage as a feature:

```text
scenario feature state
    ->
new ML prediction
```

Then:

```text
P2 recalculates risk
```

This is important.

P4 must not reuse baseline probability when a scenario changes a material ML feature.

---

# 118. Model Inference Cache

Cache only when:

```text
feature vector hash
+
model bundle
+
asOf policy
```

match.

Scenario state changes should produce a new feature/input hash when relevant features change.

---

# 119. Prediction Cache Safety

A cache key should include:

```text
organization
target
featureSetVersion
featureHash
modelBundle
asOf
horizon
```

---

# 120. Feature Hash

Canonical feature values:

```text
sorted feature keys
normalized values
feature version
```

then:

```text
SHA-256
```

Store:

```text
inputHash
```

This can support reproducibility.

---

# 121. ML Data Lineage

For each model:

```text
DataSource
  |
  v
DatasetVersion
  |
  v
FeatureSetVersion
  |
  v
TrainingRun
  |
  v
ModelVersion
  |
  v
CalibrationVersion
  |
  v
Prediction
  |
  v
RiskRun
```

This lineage should be queryable.

---

# 122. Registry State Machine

```text
DEVELOPMENT
   |
   v
CANDIDATE
   |
   v
VALIDATED
   |
   v
STAGED
   |
   v
PRODUCTION
   |
   v
RETIRED
```

Invalid transitions should be rejected.

---

# 123. Registry Governance

Only authorized users/services may:

```text
promote
rollback
retire
```

Training jobs may create:

```text
CANDIDATE
```

but should not automatically promote to production.

---

# 124. Model Retirement

When a model is retired:

```text
new runs cannot use it
```

but:

```text
historical predictions remain linked
```

---

# 125. Compatibility Test

Before promotion:

```text
production feature payload
```

must pass:

```text
candidate model schema
```

tests.

---

# 126. Inference Contract Test

For known fixture:

```text
features
```

should produce:

```text
probability within expected tolerance
```

for the same model artifact.

---

# 127. Model Artifact Smoke Test

On deployment:

```text
load artifact
run fixture
validate output
```

before accepting traffic.

---

# 128. Security of Model Artifacts

Verify:

```text
artifact hash
trusted storage
access permissions
```

Do not load arbitrary model files from untrusted paths.

---

# 129. Dependency Security

Pin or lock:

```text
Python dependencies
Node dependencies
system libraries
```

Model runtime must be scanned as part of CI/CD.

---

# 130. ML Supply Chain

Track:

```text
package versions
model artifact hash
training code commit
data version
```

This supports reproducibility and investigation.

---

# 131. Model Serialization

Choose a format with controlled loading semantics.

Avoid untrusted deserialization where possible.

Artifact loading must assume:

```text
model file is security-sensitive executable-like content
```

and only load trusted artifacts.

---

# 132. Secrets

Do not include:

```text
API keys
database credentials
tokens
passwords
```

in:

```text
training dataset
model artifact
feature cache
experiment logs
```

---

# 133. PII

Minimize or remove:

```text
email
username
full IP address where unnecessary
employee identifiers
customer identifiers
```

from model features.

Prefer:

```text
derived behavioral features
```

where practical.

---

# 134. Training Environment Isolation

The training pipeline should be separable from production runtime.

Recommended:

```text
development/training environment
        |
        v
approved model artifact
        |
        v
production inference
```

Do not mount arbitrary training directories into production inference.

---

# 135. Experiment Tracking

Free-first options:

```text
MLflow
filesystem/JSON metadata
PostgreSQL metadata
```

A full external SaaS experiment platform is not required.

At minimum persist:

```text
run ID
hyperparameters
metrics
dataset version
artifact hash
```

---

# 136. MLflow Consideration

MLflow can be used later for:

```text
experiments
model registry
artifact metadata
```

but should not be mandatory if deployment complexity outweighs benefit.

The internal registry contract should remain stable regardless of implementation.

---

# 137. Training Code Layout

Recommended:

```text
ml/
  datasets/
    build_dataset.py
    labels.py
    validation.py

  features/
    definitions.py
    transforms.py
    point_in_time.py

  training/
    train_baseline.py
    train_challenger.py
    evaluate.py
    calibrate.py

  inference/
    predictor.py
    validation.py

  monitoring/
    drift.py
    calibration.py
    performance.py

  registry/
    metadata.py
    promotion.py
```

---

# 138. Node Integration Layout

Recommended:

```text
src/services/model/
    modelRegistry.service.ts
    modelBundle.service.ts
    prediction.service.ts
    modelHealth.service.ts
    modelPromotion.service.ts

src/services/risk/
    likelihood.service.ts
    ...
```

---

# 139. Model Registry Database

Recommended entities:

```text
MLModel
MLModelVersion
MLTrainingRun
MLDatasetVersion
MLFeatureSetVersion
MLCalibrationVersion
MLPrediction
MLPredictionExplanation
MLModelDeployment
MLModelDrift
MLModelEvaluation
```

---

# 140. MLDatasetVersion

Fields:

```text
id
name
version
sourceHash
dateRangeStart
dateRangeEnd
rowCount
labelVersion
schemaVersion
licenseMetadata
createdAt
```

---

# 141. MLFeatureSetVersion

Fields:

```text
id
name
version
featureDefinitionHash
createdAt
```

---

# 142. MLCalibrationVersion

Fields:

```text
id
modelVersionId
method
artifactHash
validationMetrics
createdAt
```

---

# 143. MLModelEvaluation

Fields:

```text
id
modelVersionId
datasetSplit
metricName
metricValue
sampleCount
evaluationConfig
createdAt
```

---

# 144. MLModelDeployment

Fields:

```text
id
modelVersionId
environment
status
deployedAt
deployedBy
rollbackTargetId
```

---

# 145. MLModelDrift

Fields:

```text
id
modelVersionId
windowStart
windowEnd
featureName
metric
value
threshold
status
sampleCount
createdAt
```

---

# 146. Model Health Summary

Aggregate:

```text
overallStatus
featureDriftStatus
predictionDriftStatus
calibrationStatus
performanceStatus
oodStatus
fallbackRate
```

---

# 147. API Design

## 147.1 Model Registry

### `GET /api/v1/models`

List authorized models.

### `GET /api/v1/models/{id}`

Return:

```text
model
versions
production version
health
```

---

# 148. Model Version

### `GET /api/v1/models/{id}/versions/{version}`

Return:

```text
artifact metadata
training run
dataset
features
calibration
metrics
deployment
```

---

# 149. Prediction

Internal service endpoint:

```text
POST /internal/v1/models/{modelId}/predict
```

External clients should not directly control model version unless explicitly authorized.

---

# 150. Model Health

### `GET /api/v1/models/{id}/health`

Return:

```text
drift
calibration
performance
OOD
fallback
last evaluation
```

---

# 151. Training Runs

### `GET /api/v1/models/{id}/training-runs`

Return:

```text
dataset
features
metrics
status
```

---

# 152. Model Promotion

### `POST /api/v1/models/{id}/versions/{version}/promote`

Requires privileged role.

Request:

```json
{
  "target": "STAGED",
  "rationale": "Validation gates passed"
}
```

Production promotion can require approval based on governance policy.

---

# 153. Model Rollback

### `POST /api/v1/models/{id}/rollback`

Request:

```json
{
  "targetVersion": "v2",
  "reason": "Calibration degradation"
}
```

Creates audit event.

---

# 154. Drift Endpoint

### `GET /api/v1/models/{id}/drift`

Filters:

```text
window
feature
status
```

---

# 155. Model Metrics Endpoint

### `GET /api/v1/models/{id}/metrics`

Return:

```text
performance
calibration
sample size
evaluation period
dataset version
```

---

# 156. Prediction Lineage

### `GET /api/v1/models/predictions/{predictionId}`

Return:

```text
prediction
model
feature set
as-of
evidence references
explanation
risk-run linkage
```

Sensitive feature payloads require elevated access.

---

# 157. Risk API Model Disclosure

Risk API response can include:

```json
{
  "modelContext": {
    "modelBundleId": "bundle-v3",
    "likelihoodSource": "ML_PRODUCTION",
    "predictionCoverage": 0.96,
    "fallbackRate": 0.01,
    "warnings": []
  }
}
```

Exact exposure should be governed by role and UX.

---

# 158. Risk Run Metadata

Persist:

```text
model bundle
prediction IDs
ML health status
fallback status
```

This is essential for auditability.

---

# 159. Continuous Risk Forecasting

P6 enables:

```text
current risk
```

plus:

```text
forecast risk trajectory
```

where data/model support it.

Possible outputs:

```text
7-day expected likelihood
30-day likelihood
90-day trend
```

---

# 160. Forecast Definition

A forecast must declare:

```text
horizon
population
target
data cutoff
model version
uncertainty
```

Example:

```text
Probability of exploitation within next 30 days
as of 29 Sep 2026
```

---

# 161. Risk Trend Forecast

P2 remains responsible for financial risk.

A future forecast can create:

```text
forecast probability
forecast frequency
forecast EAL range
```

by feeding predicted likelihood into P2 under a forecast scenario.

The output should be clearly labeled:

```text
forecast
```

not:

```text
current observed state
```

---

# 162. Forecast Scenario

Recommended architecture:

```text
Current state
+
predicted threat/likelihood
    ->
P2 forecast run
    ->
future risk distribution
```

This prevents the ML layer from directly generating financial exposure.

---

# 163. Forecast Uncertainty

Forecast results should preserve:

```text
prediction uncertainty
risk simulation uncertainty
data uncertainty
```

Do not collapse them into one unexplained “confidence score.”

---

# 164. Risk Forecast API

### `GET /api/v1/risk/forecast`

Parameters:

```text
horizon
scope
baselineAssessmentId
modelBundleId optional
```

Response:

```text
forecast metadata
probability
risk metrics
uncertainty
assumptions
model context
```

---

# 165. Forecast Horizon

Supported initial:

```text
7
30
90
```

days if data supports them.

Longer horizons require model validation.

Do not extrapolate a 30-day model into 1-year risk without an explicit validated methodology.

---

# 166. Forecast Confidence

A forecast confidence category can incorporate:

```text
model calibration
OOD status
data freshness
sample support
uncertainty
```

It should not pretend to be a single statistically exact probability of correctness.

---

# 167. Continuous Recalculation Trigger

Risk runs may be triggered by:

```text
new vulnerability
new KEV signal
major threat-intel change
control state change
asset exposure change
material telemetry anomaly
model deployment
scheduled cadence
```

---

# 168. Materiality Filter

Do not recalculate the full enterprise model for every low-value event.

Use:

```text
event materiality
scope
dependency impact
risk threshold
```

to decide whether a new full risk run is required.

---

# 169. Incremental Prediction

For high-volume data:

```text
predict affected asset-vulnerability records
```

rather than all records.

Then:

```text
materiality policy
```

decides whether to launch:

```text
partial assessment
full enterprise assessment
```

---

# 170. Risk Run Queue

Recommended job types:

```text
ML_BATCH_INFERENCE
MODEL_HEALTH_CHECK
RISK_RECALCULATION
FORECAST_RUN
MODEL_EVALUATION
DRIFT_ANALYSIS
```

These integrate with the existing worker/queue architecture.

---

# 171. Risk Event Pipeline

```text
Source Event
   |
   v
Normalize
   |
   v
Materiality
   |
   +--> no material change -> record only
   |
   v
Feature refresh
   |
   v
ML prediction
   |
   v
RiskRun
   |
   v
P2
   |
   v
P3
```

---

# 172. Model Deployment and Risk Recalculation

When a new model becomes production:

```text
do not automatically rewrite historical risk
```

Optionally trigger:

```text
new current risk run
```

and show:

```text
model-change effect
```

separately from:

```text
environment-change effect
```

---

# 173. Model Change Impact Analysis

Before promoting a new model, optionally run:

```text
same current input
+
old model
+
candidate model
```

Compare:

```text
probabilities
calibration
resulting P2 EAL
VaR
Risk Score
```

This can identify material model-induced risk changes.

---

# 174. Model Change Governance

If candidate model materially changes risk:

```text
flag for review
```

Do not hide the fact that:

```text
risk changed because model changed
```

---

# 175. Backtesting

A model should be evaluated against historical periods that were not used for training.

Backtesting should report:

```text
prediction
observed event
calibration
metrics
drift
```

---

# 176. Walk-Forward Evaluation

Preferred for changing environments:

```text
train on past
predict next period
advance window
repeat
```

This can measure:

```text
stability over time
```

better than one static holdout.

---

# 177. Production Backtest

Where labels eventually become available:

```text
predicted exploitation
vs
observed exploitation
```

This feeds:

```text
real-world calibration assessment
```

and future retraining.

---

# 178. Label Delay

Security outcomes may arrive late.

The system should store:

```text
label_available_at
```

separately from:

```text
event_time
```

---

# 179. Delayed Evaluation

Predictions remain:

```text
PENDING_LABEL
```

until the label window closes.

Then:

```text
EVALUATED
```

or:

```text
UNRESOLVED
```

---

# 180. Prediction Outcome Table

Recommended:

```text
MLPredictionOutcome
```

fields:

```text
predictionId
outcome
outcomeObservedAt
labelWindowClosedAt
labelSource
createdAt
```

This supports delayed calibration/performance measurement.

---

# 181. Outcome Types

Example:

```text
EVENT
NO_EVENT
UNKNOWN
CONFLICTING
```

Do not treat:

```text
UNKNOWN
```

as:

```text
NO_EVENT
```

for performance calculations.

---

# 182. Monitoring Sample Size

Every metric should store:

```text
sample count
```

because:

```text
small samples
```

can create unstable drift/performance conclusions.

---

# 183. Statistical Significance

Where appropriate, monitoring can include:

```text
confidence interval
statistical test
effect size
```

Do not rely only on:

```text
one threshold
```

without sample-size context.

---

# 184. Drift Dashboard Wording

Use:

```text
Feature distribution changed
```

rather than:

```text
Model is broken
```

unless performance evidence supports the stronger statement.

---

# 185. OOD Dashboard Wording

Use:

```text
Predictions include elevated out-of-distribution observations
```

instead of:

```text
AI cannot handle this
```

---

# 186. Model Risk Warning

Executive UI should surface:

```text
Model status
Data freshness
Material limitations
```

when they affect decision interpretation.

---

# 187. No-False-Precision Rules

Avoid showing:

```text
Probability = 18.3749281%
```

when the model's calibration uncertainty does not justify that precision.

Prefer:

```text
18%
```

or:

```text
~18%
```

with uncertainty context.

---

# 188. Probability Rounding

Store full numerical precision internally.

Display according to:

```text
UI precision policy
```

that avoids misleading precision.

---

# 189. Financial Precision Boundary

Even if probability is shown rounded:

```text
P2
```

uses the underlying validated probability.

The display layer does not alter calculations.

---

# 190. Model Explainability and P3

When a prediction materially influences a risk driver:

```text
RiskDriver
  ->
MODEL_SIGNAL
  ->
MLPrediction
  ->
MLPredictionExplanation
```

This makes AI decisions inspectable.

---

# 191. AI / LLM Boundary

The existing LLM may explain:

```text
model signal
risk driver
scenario
investment
```

but cannot:

```text
change model probability
override calibration
declare model healthy
```

---

# 192. LLM Grounding Example

User:

```text
Why did the risk of this service increase?
```

Backend retrieves:

```text
RiskAssessment delta
+
RiskDriver
+
ML prediction delta
+
feature explanation
+
evidence
```

LLM summarizes verified records.

---

# 193. Model-Driven Recommendation

P6 may identify:

```text
rising exploitation probability
```

which can become a P3 driver.

P3/P4/P5 then determine:

```text
treatment
scenario
investment
```

The ML model does not select the final investment.

---

# 194. Model Drift to Investment Workflow

Example:

```text
Model calibration degraded
    |
    v
risk confidence warning
    |
    v
governance review
    |
    v
recalibration
    |
    v
new model version
    |
    v
new risk run
```

Do not automatically increase investment recommendations simply because a model metric changed.

---

# 195. Data Drift to Risk Workflow

Example:

```text
Threat feature distribution changed
    |
    v
model health warning
    |
    v
risk run metadata
    |
    v
risk interpretation warning
```

Whether to force recalculation depends on the materiality policy.

---

# 196. Model Version in Scenario Runs

P4 scenario runs must record the model bundle used.

If a scenario changes a feature that the model consumes:

```text
new prediction
```

must be calculated under the scenario.

---

# 197. Investment Optimization Impact

P5 optimization consumes scenario results.

Therefore if model version changes:

```text
existing optimization portfolios may become stale
```

and must be revalidated according to P5 staleness policy.

---

# 198. Model Change Cascade

```text
Model version changes
       |
       +--> current risk run
       +--> scenario validity
       +--> optimization validity
       +--> executive metrics
       +--> reports
```

Each layer should preserve historical versions rather than silently rewriting prior outputs.

---

# 199. Model Registry + Blockchain

Optional hash anchoring may include:

```text
model artifact hash
model bundle hash
evaluation package hash
production promotion event hash
```

Do not put proprietary model artifacts on-chain.

---

# 200. Audit Events

Recommended:

```text
MODEL_CREATED
MODEL_VERSION_CREATED
MODEL_EVALUATED
MODEL_CALIBRATED
MODEL_STAGED
MODEL_PROMOTED
MODEL_ROLLED_BACK
MODEL_RETIRED
DRIFT_DETECTED
CALIBRATION_ALERT
PERFORMANCE_ALERT
PREDICTION_FALLBACK
MODEL_EXPLANATION_CREATED
```

---

# 201. Model Promotion Audit

Store:

```text
candidate version
previous production version
metrics
calibration
reviewer
rationale
timestamp
```

---

# 202. Model Rollback Audit

Store:

```text
failed version
rollback target
reason
affected environment
actor
timestamp
```

---

# 203. Access Control

Model operations should use privileged authorization:

```text
VIEW_MODEL
VIEW_MODEL_METRICS
CREATE_MODEL
PROMOTE_MODEL
ROLLBACK_MODEL
RETIRE_MODEL
```

Exact roles should align with existing RBAC.

---

# 204. Training Access

Training jobs may access:

```text
approved datasets
```

but should not automatically access:

```text
production secrets
```

or unrestricted production data.

---

# 205. Production Data Export

If production data is used for training:

```text
approved extraction
privacy filtering
dataset snapshot
access audit
```

is required.

---

# 206. Reproducibility Package

For a production model version, retain:

```text
model artifact
model hash
training run
dataset version
feature set
label definition
calibration artifact
metrics
model card
code version
environment metadata
```

---

# 207. Environment Metadata

Capture:

```text
Python version
ML library versions
OS/container image
CPU/GPU class if relevant
```

---

# 208. Dependency Locking

Recommended:

```text
requirements.txt / lock file
```

and container image digest where possible.

---

# 209. CPU-First Deployment

For SIH and free-first deployment:

```text
CPU inference
```

is preferred unless profiling demonstrates GPU necessity.

This reduces:

```text
cost
deployment complexity
availability constraints
```

---

# 210. Training Compute

Training can be performed:

```text
locally
free notebook environment where permitted
free/academic compute
```

with final artifact exported into the registry.

The production runtime should not depend on a personal notebook.

---

# 211. Dataset Size and Batch Processing

Use:

```text
Parquet
chunked reads
batch inference
```

when datasets become large.

Do not load unrestricted enterprise telemetry into memory.

---

# 212. Feature Precomputation

Frequently reused features can be precomputed:

```text
daily
hourly
event-driven
```

depending on freshness requirements.

---

# 213. Incremental Feature Updates

For:

```text
rolling telemetry features
```

consider incremental aggregation.

Avoid rebuilding all historical features for every new event unless necessary.

---

# 214. Feature Store Scope

A separate feature store is optional.

The core requirement is:

```text
point-in-time correctness
versioning
reproducibility
serving consistency
```

---

# 215. Training Data Validation

Before training:

```text
schema validation
duplicate check
label integrity
date ordering
missingness
range checks
leakage heuristics
class distribution
```

---

# 216. Leakage Tests

Automated checks should flag features whose timestamp is:

```text
after label observation cutoff
```

or whose source semantics indicate future knowledge.

---

# 217. Duplicate Observation Test

Detect duplicate:

```text
entity
vulnerability
observation_time
```

rows.

Duplicate rows can distort model metrics.

---

# 218. Label Balance Test

Report:

```text
positive rate
negative rate
unknown rate
```

per split.

Unexpected shifts should trigger review.

---

# 219. Train/Validation/Test Integrity

Store:

```text
row counts
time ranges
label prevalence
```

for each split.

---

# 220. Test Set Protection

The final temporal test set should not be used repeatedly for model tuning.

If it is repeatedly inspected:

```text
it ceases to be an unbiased final evaluation
```

Create a new holdout or rolling evaluation policy as needed.

---

# 221. Model Tuning

Hyperparameter tuning should use:

```text
training + validation
```

while keeping:

```text
final test
```

untouched until model selection is complete.

---

# 222. Calibration Tuning

Calibration parameters must be learned only on:

```text
training/validation data
```

according to the chosen calibration strategy.

Do not calibrate using the final test set and then report that test as independent.

---

# 223. Calibration Monitoring

Store:

```text
ECE/Brier
calibration curve
sample count
evaluation window
```

for production windows where labels are available.

---

# 224. Probability Bucketing

Production monitoring can group:

```text
0–5%
5–10%
...
95–100%
```

and compute observed outcome rates.

---

# 225. Reliability Example

If a bucket predicts:

```text
~20%
```

for many observations and observed outcomes are consistently:

```text
~20%
```

calibration is behaving as expected for that bucket.

This is descriptive validation, not a guarantee for future data.

---

# 226. Model Evaluation Report

Every candidate evaluation should generate:

```text
Dataset
Metrics
Calibration
Temporal test
Subgroups
OOD
Latency
Feature drift baseline
Limitations
Recommendation status
```

---

# 227. Promotion Policy

Candidate can reach:

```text
VALIDATED
```

only when required gates pass.

Then:

```text
STAGED
```

with shadow/controlled evaluation.

Then:

```text
PRODUCTION
```

after authorization.

---

# 228. Canary Deployment

Optional:

```text
small traffic slice
```

for candidate model.

For cyber-risk platform, canary mode can mean:

```text
candidate predicts
production remains authoritative
```

and candidate outputs are compared before promotion.

---

# 229. Production Monitoring Windows

Monitor:

```text
24h
7d
30d
```

where sufficient data exists.

Use longer windows for:

```text
delayed labels
```

---

# 230. Model Health Threshold Registry

Thresholds should be persisted in:

```text
ModelMonitoringPolicy
```

Example fields:

```text
metric
warningThreshold
criticalThreshold
minimumSampleSize
window
action
version
```

---

# 231. Monitoring Policy Example

```json
{
  "metric": "prediction_drift",
  "method": "PSI",
  "warningThreshold": 0.2,
  "criticalThreshold": 0.3,
  "minimumSampleSize": 1000,
  "windowDays": 7,
  "action": "REVIEW"
}
```

Values are example configuration, not universal defaults.

---

# 232. Model Health State Machine

```text
HEALTHY
   |
   v
WARNING
   |
   v
CRITICAL
   |
   +--> REVIEW
   |
   +--> ROLLBACK
   |
   +--> RETRAIN
```

A critical state does not automatically imply rollback unless policy says so.

---

# 233. Drift Attribution

When drift is detected, identify:

```text
which features changed
```

and:

```text
which population changed
```

This helps root-cause investigation.

---

# 234. Model Change vs Environment Change

Always distinguish:

```text
Risk changed because environment changed
```

from:

```text
Risk changed because model changed
```

This is essential for executive trust.

---

# 235. Risk Comparison Across Model Versions

Optional analysis:

```text
same input
old model
new model
```

then:

```text
prediction delta
risk delta
```

Store as:

```text
ModelImpactAnalysis
```

if implemented.

---

# 236. Model Impact Analysis

Recommended fields:

```text
baselineModelVersion
candidateModelVersion
inputSnapshotHash
predictionDelta
riskMetricDelta
createdAt
```

This supports governance review.

---

# 237. Forecast Model Scope

Do not conflate:

```text
exploitation probability model
```

with:

```text
financial severity model
```

They may be separate model components in the future.

---

# 238. Severity ML Extension

Future financial impact ML can estimate:

```text
severity distribution parameters
```

but must ultimately feed:

```text
P2 severity/loss distribution
```

and remain calibrated and validated.

---

# 239. Financial Impact ML Guardrail

A model may estimate:

```text
distribution parameters
```

but should not directly replace:

```text
aggregate loss simulation
```

---

# 240. Loss Model Integration

Future:

```text
frequency model
+
severity model
```

can provide inputs to:

```text
P2 aggregate loss simulation
```

with:

```text
model versions
calibration
uncertainty
```

stored.

---

# 241. Threat Forecast Extension

Future model:

```text
threat intensity forecast
```

may feed:

```text
likelihood/frequency
```

through a governed interface.

Do not directly turn threat forecast into:

```text
₹ loss
```

outside P2.

---

# 242. Continuous Learning

The full loop eventually becomes:

```text
predict
  ->
risk
  ->
decide
  ->
implement
  ->
observe
  ->
label
  ->
evaluate
  ->
retrain
```

This creates a feedback system rather than a one-time AI demo.

---

# 243. Feedback Data

Potential feedback:

```text
actual patch completion
actual control coverage
actual incident
actual exploitation
actual downtime
actual financial impact
```

with appropriate data governance.

---

# 244. Realized-vs-Modeled Evaluation

Future platform metric:

```text
predicted risk
vs
observed risk outcome
```

This should support:

```text
model validation
```

rather than automatically changing model parameters without governance.

---

# 245. ML Governance Package

For each production model:

```text
Model Card
Dataset Card
Training Run
Evaluation
Calibration
Artifact
Promotion
Monitoring
Rollback
```

This package should be auditable.

---

# 246. Reporting

Model governance report should include:

```text
current model
training period
data source classes
validation metrics
calibration
drift
production health
fallback rate
limitations
```

---

# 247. Executive Risk Report

Do not overwhelm the executive report with:

```text
ROC-AUC
feature SHAP charts
```

unless requested.

Instead show:

```text
risk result
model status
major confidence/coverage warning
```

with technical drill-down.

---

# 248. Technical Report

The technical report can include:

```text
feature contributions
model version
calibration curve
drift
prediction coverage
fallback rate
```

---

# 249. AI Explanation

The LLM can answer:

```text
What model generated this likelihood?
Why did the probability rise?
Is the model currently healthy?
```

only from verified registry and prediction metadata.

---

# 250. Grounded AI Response Data

Backend should return:

```text
model version
prediction
confidence
top features
model health
evidence
```

The LLM should summarize them.

---

# 251. Model Security Boundary

The LLM must never receive:

```text
arbitrary model execution privileges
```

or:

```text
filesystem access to model artifacts
```

---

# 252. Prompt Injection from Security Data

Security telemetry and threat-intel text may contain attacker-controlled strings.

Therefore:

```text
treat source text as untrusted data
```

when passed to AI explanation.

Separate:

```text
instructions
```

from:

```text
retrieved evidence
```

---

# 253. Feature Text Inputs

If text features are added later:

```text
sanitize
length limit
source provenance
prompt-injection isolation
```

Text should not be passed to the LLM as executable instructions.

---

# 254. ML API Rate Limits

Internal model service should enforce:

```text
request limits
batch size
timeout
payload size
```

---

# 255. Prediction Cost Controls

For enterprise scale:

```text
batch predictions
incremental inference
cache
event-driven recalculation
```

should control compute.

---

# 256. Model Worker Failure

If worker fails:

```text
retry
```

then:

```text
fallback / unavailable
```

according to policy.

Every failed prediction must be observable.

---

# 257. Retry Safety

Prediction jobs should use:

```text
idempotency key
inputHash
modelBundleId
```

to prevent duplicate logical predictions.

---

# 258. Data Source Failure

If EPSS/KEV or another source is unavailable:

```text
record source outage
feature freshness status
```

Do not silently substitute stale data without marking it.

---

# 259. Source Freshness and ML

A model prediction can be numerically valid but operationally stale.

Therefore:

```text
prediction freshness
+
source freshness
```

must be visible to the risk run.

---

# 260. Model Health in RiskRun

Store:

```text
modelHealth = HEALTHY/WARNING/CRITICAL
```

at run time.

This allows later analysis:

```text
Was risk calculation performed while model health was degraded?
```

---

# 261. Risk Assessment Confidence

A risk assessment can carry:

```text
overall confidence
```

computed from:

```text
ML health
data completeness
evidence quality
model OOD
input freshness
```

The exact combination must be defined in the risk model.

Do not multiply arbitrary confidence percentages.

---

# 262. Confidence Composition

Prefer categorical/structured components:

```text
ML confidence: Medium
Data completeness: High
Evidence quality: High
OOD: Low
```

rather than:

```text
0.73 × 0.91 × 0.84
```

without a validated probabilistic interpretation.

---

# 263. Model Status in Executive UI

Example:

```text
Risk Model Status
Healthy
Data freshness: 96%
Fallback use: 1%
```

All values illustrative.

---

# 264. What-if ML

P4 scenario:

```text
MFA 62% -> 95%
```

If MFA is a model feature:

```text
baseline prediction
vs
scenario prediction
```

must be calculated.

Then:

```text
P2 scenario risk
```

uses the scenario probability.

This makes AI materially connected to the what-if engine.

---

# 265. Optimization ML

P5 receives:

```text
scenario benefit
```

not:

```text
raw ML prediction
```

Therefore investment optimization remains downstream of P2/P4.

---

# 266. Driver Attribution ML

P3 may combine:

```text
ML feature explanation
+
counterfactual risk impact
```

to distinguish:

```text
model-level explanation
```

from:

```text
financial risk contribution
```

---

# 267. Data Quality as a Driver

A data-quality issue can be surfaced as:

```text
confidence limitation
```

rather than a monetary driver.

Example:

```text
EDR coverage missing on 12% of critical assets
```

This may reduce confidence in the estimated risk.

---

# 268. ML Data Quality Metrics

Track:

```text
missing required feature %
invalid feature %
stale feature %
unknown category %
OOD %
```

---

# 269. Feature Drift Metrics

Store:

```text
feature
window
reference window
method
value
sample count
threshold
status
```

---

# 270. Prediction Drift Metrics

Store:

```text
mean probability
distribution metric
high-risk proportion
sample count
window
status
```

---

# 271. Performance Metrics

When labels available:

```text
PR-AUC
ROC-AUC
Brier
Log loss
precision
recall
F1
calibration error
```

---

# 272. Model Evaluation Window

Each metric must identify:

```text
population
window start
window end
label status
sample size
```

---

# 273. Model Registry API Security

Model registry access must enforce:

```text
organization
role
model scope
```

Some global model metadata can be platform-level if intentionally shared.

Tenant-specific models must remain tenant-isolated.

---

# 274. Shared Foundation Model

If SentinelStack uses a global public-data model:

```text
shared model
```

tenant-specific calibration or fine-tuning may create:

```text
tenant model version
```

The lineage must distinguish:

```text
base model
+
tenant adaptation
```

---

# 275. Tenant Adaptation

Future:

```text
global model
+
organization-specific calibration
```

can improve enterprise relevance.

However:

```text
tenant private data
```

must not leak into another tenant's model.

---

# 276. Cross-Tenant Learning

Any aggregate learning across tenants must require:

```text
explicit privacy/governance policy
```

and must not expose one tenant's raw data.

This is a future capability.

---

# 277. Data Anonymization

If shared training uses enterprise-derived data:

```text
remove direct identifiers
aggregate where possible
```

and document the process.

---

# 278. Model Bias / Coverage

Model evaluation must document known limitations such as:

```text
public dataset bias
industry skew
region skew
vendor/product skew
label proxy limitations
```

These are limitations, not reasons to invent correction factors without evidence.

---

# 279. Model Drift vs Threat Evolution

Threat landscapes can change faster than labels.

P6 should therefore monitor:

```text
threat features
prediction distribution
```

even before final performance labels arrive.

But threat-feature drift alone should be treated as:

```text
early warning
```

rather than direct proof of model failure.

---

# 280. Retraining Trigger Governance

Example policy:

```text
critical calibration drift
OR
repeated performance degradation
OR
major feature schema change
```

creates:

```text
RETRAIN_REQUIRED
```

---

# 281. Model Review Board

A lightweight governance role can review:

```text
model promotion
rollback
critical drift
label changes
feature changes
```

This can be implemented as an application permission rather than a separate organizational system.

---

# 282. Model Version Change Impact on Compliance

When model version changes:

```text
risk evidence
```

should retain the model metadata so an auditor can distinguish:

```text
risk due to environment
vs
risk due to model methodology
```

---

# 283. Model Methodology Disclosure

Reports should include:

```text
model version
target definition
calibration status
```

without exposing proprietary weights if not appropriate.

---

# 284. Model Confidence and Risk Appetite

Risk appetite comparisons should use:

```text
authoritative risk metric
```

even if:

```text
ML confidence = low
```

but the UI should visibly disclose the limitation.

The decision maker can then interpret the result accordingly.

---

# 285. Uncertainty-Aware Forecast

Future extension:

```text
Monte Carlo over ML probability uncertainty
```

could generate:

```text
risk distribution under prediction uncertainty
```

This should be added to P2 only through a documented mathematical extension.

---

# 286. Current P6 Scope

P6 v1 should focus on:

```text
exploit probability
calibration
drift
registry
inference
P2 integration
continuous prediction
```

Avoid overbuilding:

```text
deep-learning foundation model
large language model training
autonomous agent
```

unless justified by data and measurable performance.

---

# 287. Why Gradient Boosting Is Enough Initially

The first predictive target is:

```text
tabular
point-in-time
binary/probabilistic
```

This is well suited to:

```text
logistic regression
gradient-boosted trees
```

and permits:

```text
explainability
calibration
CPU inference
```

without requiring a large deep-learning stack.

---

# 288. Model Serving Choice

Recommended sequence:

```text
Python training
+
Python inference artifact
+
Node orchestration
```

Then decide whether to expose:

```text
FastAPI
```

or invoke the model worker directly.

The architecture should not add a microservice solely for aesthetics.

---

# 289. Repository Integration

Recommended files:

```text
ml/
src/services/model/
src/services/risk/likelihood.service.ts
src/services/risk/riskRun.service.ts
prisma/schema.prisma
```

---

# 290. P6 New Files

```text
ml/datasets/build_dataset.py
ml/datasets/labels.py
ml/datasets/validate.py

ml/features/definitions.py
ml/features/transforms.py
ml/features/point_in_time.py

ml/training/train_baseline.py
ml/training/train_challenger.py
ml/training/evaluate.py
ml/training/calibrate.py

ml/inference/predictor.py
ml/inference/model_loader.py
ml/inference/validation.py

ml/monitoring/drift.py
ml/monitoring/calibration.py
ml/monitoring/performance.py

ml/registry/artifacts.py

src/services/model/modelRegistry.service.ts
src/services/model/modelBundle.service.ts
src/services/model/prediction.service.ts
src/services/model/modelHealth.service.ts
src/services/model/modelPromotion.service.ts
src/services/model/modelImpact.service.ts
```

---

# 291. P6 Modified Files

Likely:

```text
prisma/schema.prisma
src/services/risk/likelihood.service.ts
src/services/risk/riskRun.service.ts
src/services/risk/riskAssessment.service.ts
src/services/scenario/scenarioStateResolver.service.ts
src/services/scenario/scenarioRun.service.ts
src/routes/index.ts
```

API routes may include:

```text
src/routes/model.routes.ts
src/routes/risk-forecast.routes.ts
```

where repository structure permits.

---

# 292. P6 Database Migration

Add target entities incrementally:

```text
MLModel
MLModelVersion
MLTrainingRun
MLDatasetVersion
MLFeatureSetVersion
MLCalibrationVersion
MLModelEvaluation
MLModelDeployment
MLModelDrift
MLPrediction
MLPredictionExplanation
MLPredictionOutcome
```

Add foreign keys into:

```text
RiskRun
RiskAssessment
```

through bundle IDs rather than hard-coded model columns wherever practical.

---

# 293. Compatibility Migration

Current risk service:

```text
calculateLikelihood()
```

becomes façade:

```text
LikelihoodProvider
```

with implementation options:

```text
MLProductionLikelihoodProvider
MLBaselineLikelihoodProvider
DeterministicFallbackLikelihoodProvider
```

---

# 294. Likelihood Provider Selection

Selection policy:

```text
approved model available?
    |
   yes -> use ML production
    |
   no
    |
    v
approved fallback
```

Selection reason persisted.

---

# 295. Model Bundle Resolver

Create:

```text
modelBundle.service.ts
```

Responsibilities:

```text
resolve production bundle
verify artifact hashes
check compatibility
return versioned bundle
```

---

# 296. Prediction Service

Create:

```text
prediction.service.ts
```

Responsibilities:

```text
build feature request
call model runtime
validate response
persist prediction
link evidence
return prediction
```

---

# 297. Model Health Service

Responsibilities:

```text
read drift state
read performance state
read calibration state
read fallback rate
return health summary
```

---

# 298. Model Promotion Service

Responsibilities:

```text
validate promotion
record approval
change deployment status
create audit event
trigger optional risk re-evaluation
```

---

# 299. Model Impact Service

Responsibilities:

```text
compare old/new model predictions
compare downstream risk metrics
persist change analysis
```

This should be optional but is strongly useful for governance.

---

# 300. Training Dataset Versioning

Every training run references:

```text
dataset_version
feature_set_version
label_version
```

No “latest” implicit dependency.

---

# 301. Dataset Hash

Canonical dataset manifest:

```text
source versions
date ranges
row count
schema
feature version
label version
```

then:

```text
SHA-256
```

Store:

```text
sourceHash
```

---

# 302. Code Version

Training run stores:

```text
git commit SHA
```

or equivalent source version.

---

# 303. Dependency Environment

Training run stores:

```text
environment lock hash
```

or:

```text
container digest
```

where practical.

---

# 304. Hyperparameter Registry

Store:

```text
model type
learning rate
depth
number of estimators
regularization
class weights
random seed
```

for reproducibility.

---

# 305. Hyperparameter Tuning

Use:

```text
validation period
```

and store:

```text
search space
selection metric
best parameters
```

Do not repeatedly tune against the final test set.

---

# 306. Calibration Selection

Evaluate:

```text
raw probability
Platt
isotonic
```

on validation.

Choose the calibration strategy based on:

```text
calibration quality
stability
sample size
```

---

# 307. Probability Thresholds

The P2 likelihood integration uses:

```text
probability
```

directly.

Do not threshold:

```text
probability > 0.5
```

to create a binary prediction for financial-risk calculation.

The continuous probability is more useful.

---

# 308. Classification Threshold

A binary classification threshold can still be used for:

```text
precision/recall
```

but it is not authoritative for:

```text
P2 likelihood
```

---

# 309. Model Output Distribution

Monitor:

```text
mean
median
p95
high-risk tail
```

of predicted probabilities.

Large changes may indicate:

```text
population shift
```

or:

```text
feature changes
```

---

# 310. Feature Importance Stability

Monitor whether:

```text
top model drivers
```

change materially across retraining.

This can identify:

```text
feature instability
```

but should not be used alone to reject a model.

---

# 311. Explainability Stability

For a fixed validation set:

```text
top feature contributions
```

can be compared across model versions.

Significant changes should be documented.

---

# 312. Model Interpretability Record

Store:

```text
explanationVersion
method
topN
baseline
```

---

# 313. Feature Attribution vs Risk Attribution

Important distinction:

```text
SHAP contribution
=
model probability explanation
```

while:

```text
P3 driver contribution
=
risk metric explanation
```

These must remain separate.

---

# 314. Model Health Impact on Risk

Risk API can include:

```text
model warning
```

without modifying EAL.

Example:

```text
EAL = ₹12M
Model health = WARNING
Reason = feature drift above warning threshold
```

This is more transparent than silently discounting the risk number.

---

# 315. Risk Result Confidence

A higher-level risk assessment confidence may summarize:

```text
input quality
ML status
scenario completeness
evidence coverage
```

but exact aggregation must be defined separately from the ML model.

---

# 316. Drift Event Storage

Every critical drift event should persist:

```text
metric
value
threshold
window
sample count
status
action
```

---

# 317. Notification Integration

Future alerts:

```text
Model critical drift detected
Model rollback executed
Fallback rate elevated
```

should integrate with the existing notification/notification-like architecture.

---

# 318. Audit + Hash

Model registry state can use:

```text
version hash
artifact hash
promotion event hash
```

for integrity.

---

# 319. Blockchain Adapter

Optional:

```text
model promotion hash
model bundle hash
risk run hash
```

can be anchored to the ledger.

The blockchain remains:

```text
integrity/provenance layer
```

not:

```text
ML execution layer
```

---

# 320. Security Testing

Minimum:

```text
artifact tampering
cross-tenant model access
prediction endpoint auth
model promotion auth
rollback auth
input validation
malicious feature values
unsafe model loading
```

---

# 321. Model Artifact Tampering Test

Modify model file.

Expected:

```text
artifact hash mismatch
load blocked
```

---

# 322. Cross-Tenant Model Test

Tenant A model:

```text
not visible or loadable by Tenant B
```

unless the model is explicitly shared/global.

---

# 323. Unauthorized Promotion Test

Viewer/analyst:

```text
cannot promote production model
```

according to configured RBAC.

---

# 324. Unauthorized Rollback Test

Only authorized role:

```text
rollback
```

---

# 325. Malicious Feature Input Test

Inject:

```text
invalid numeric
extreme value
unknown category
oversized payload
```

Expected:

```text
validation failure / controlled fallback
```

---

# 326. Model Runtime Timeout

If ML inference exceeds:

```text
timeout
```

then:

```text
retry according to policy
fallback or unavailable
```

Do not block the entire risk pipeline indefinitely.

---

# 327. Partial Inference

For batch prediction:

```text
successful records
failed records
```

must be separately reported.

P2 should not silently treat missing predictions as:

```text
zero probability
```

---

# 328. Batch Retry

Use:

```text
input hash
```

to retry only failed records.

---

# 329. Model Availability

Production should expose:

```text
model loaded
artifact verified
health status
```

via internal readiness checks.

---

# 330. Server Readiness

Existing:

```text
/health/ready
```

can include a model health sub-check for environments where ML is mandatory.

If ML is optional:

```text
report degraded status
```

instead of failing all application readiness.

---

# 331. Graceful Degradation

If model service unavailable:

```text
risk engine may use approved fallback
```

subject to policy.

UI shows:

```text
Risk calculated with fallback likelihood source
```

when material.

---

# 332. Model Warm-Up

On deployment:

```text
load model
verify hash
run fixture
warm prediction path
```

before serving production inference.

---

# 333. Cold Start

Avoid storing model only in ephemeral lazy-load state if cold-start latency harms risk jobs.

Use controlled caching.

---

# 334. Batch Model Loading

A single worker can load:

```text
one active model bundle
```

and process many records.

This reduces repeated model loading.

---

# 335. Memory Controls

For large models/data:

```text
batch size
streaming input
resource limits
```

must be configured.

---

# 336. Model Runtime Resource Monitoring

Track:

```text
CPU
memory
latency
error rate
queue depth
```

---

# 337. ML Job Priority

Suggested:

```text
interactive scenario prediction
>
current risk recalculation
>
scheduled batch
>
offline analysis
```

Exact priority policy is configurable.

---

# 338. Continuous Risk Refresh Architecture

```text
Event Ingestion
      |
      v
Normalize
      |
      v
Feature Update
      |
      v
Prediction
      |
      v
Materiality
      |
      +--> No material change
      |
      v
RiskRun
      |
      v
P2
      |
      v
P3
      |
      v
Dashboard
```

---

# 339. Event Materiality Examples

Potential material events:

```text
critical CVE becomes KEV
internet exposure enabled
MFA coverage falls materially
new high-confidence threat campaign
critical service dependency changes
```

These trigger policy evaluation.

---

# 340. Continuous vs Scheduled

Support both:

```text
event-driven
```

and:

```text
scheduled
```

recalculation.

---

# 341. Recalculation Frequency

The highest practical frequency depends on:

```text
data source cadence
compute
organization scale
risk materiality
```

Do not promise per-second enterprise risk unless the deployed system supports it.

---

# 342. Continuous Risk Snapshot

A current risk assessment can be:

```text
LATEST_VALID
```

and linked to:

```text
latest authoritative RiskRun
```

---

# 343. Prediction Freshness in Dashboard

Example:

```text
Likelihood model data as of:
09:45 UTC

Risk run:
09:47 UTC
```

This helps users understand recency.

---

# 344. Forecasting UX

Possible:

```text
Current Risk
7-day projected
30-day projected
```

with clearly separated:

```text
observed
forecast
```

---

# 345. Forecast Scenario Label

Use:

```text
Modeled forecast
```

rather than:

```text
Predicted exact loss
```

---

# 346. Model Drift UX

Technical:

```text
Feature drift:
Warning

Prediction drift:
Normal

Calibration:
Healthy
```

Executive:

```text
Risk model monitoring:
Attention required
```

with drill-down.

---

# 347. Model Registry UI

Recommended:

```text
Models

Exploit Probability
    Production: v3
    Challenger: v4
    Health: Warning

Versions
    v4 Candidate
    v3 Production
    v2 Retired
```

---

# 348. Model Version Detail UI

Show:

```text
Purpose
Target
Training period
Data version
Feature version
Metrics
Calibration
Drift
Deployment
Artifact hash
Limitations
```

---

# 349. Model Promotion UI

Require:

```text
review
rationale
confirmation
```

before privileged promotion.

---

# 350. Model Rollback UI

Require:

```text
target version
reason
confirmation
```

---

# 351. Model Impact UI

Compare:

```text
v3
vs
v4
```

on:

```text
predictions
calibration
risk metrics
```

---

# 352. Executive Transparency

A risk dashboard can show:

```text
Calculation method:
Quantitative risk engine

Likelihood source:
Calibrated predictive model

Model status:
Healthy / Warning

Data freshness:
...
```

This builds trust without pretending that ML is infallible.

---

# 353. Trust Model

Trust is separated into:

```text
Data provenance
Model reliability
Calculation integrity
Decision governance
```

P6 primarily strengthens:

```text
Model reliability
```

and contributes to:

```text
calculation provenance
```

---

# 354. Model Reliability Components

Model reliability evidence:

```text
temporal validation
calibration
production monitoring
drift detection
artifact integrity
versioning
rollback
```

---

# 355. Prediction Evidence

A prediction can have:

```text
feature snapshot reference
model version
calibration version
evidence references
```

This lets a reviewer inspect:

```text
why the model produced the signal
```

---

# 356. Evidence Hash

Feature snapshot or prediction package can use:

```text
SHA-256
```

for integrity.

---

# 357. Model Registry + Audit

Historical production state:

```text
Sep 20:
v2

Sep 25:
v3 promoted

Sep 28:
v3 rollback to v2
```

must be queryable.

---

# 358. Model Rollback and Current Risk

After rollback:

```text
new RiskRun
```

may be triggered.

Do not rewrite:

```text
RiskRun created under v3
```

---

# 359. Historical Report Reproducibility

A historical report must continue to reference:

```text
model version
feature version
risk run
```

used at the time.

---

# 360. Model Lifecycle Retention

Retain retired model metadata long enough to support:

```text
historical risk reconstruction
audit
model-performance analysis
```

subject to policy.

---

# 361. P6 Acceptance Matrix

| Area | Acceptance |
|---|---|
| Dataset | Point-in-time correct |
| Labels | Versioned and leakage-tested |
| Features | Versioned |
| Training | Temporal split |
| Models | Baseline + challenger |
| Calibration | Measured and versioned |
| Metrics | PR-AUC/Brier/log loss/etc. |
| Registry | Model lifecycle implemented |
| Artifact integrity | Hash verified |
| Inference | Versioned contract |
| P2 integration | LikelihoodProvider uses approved probability |
| Fallback | Explicit and auditable |
| Prediction lineage | Prediction -> model -> features -> RiskRun |
| Explainability | Model-level feature attribution |
| Drift | Feature + prediction + performance |
| OOD | Detection + policy |
| Monitoring | Health states |
| Promotion | Governed |
| Rollback | Supported |
| Scenario | Material feature changes recalculate ML prediction |
| Forecasting | Explicit horizon and uncertainty |
| Security | Auth/RBAC/artifact controls |
| Historical integrity | Old runs unchanged |
| AI | LLM only explains verified outputs |

---

# 362. P6 Definition of Done

P6 is accepted only when:

```text
1. A point-in-time predictive dataset can be generated reproducibly.
2. Training uses temporal validation and leakage checks.
3. A calibrated predictive model produces probability outputs.
4. Model and calibration artifacts are versioned.
5. A governed registry controls candidate/staged/production models.
6. P2 consumes validated probabilities through a formal provider interface.
7. Historical risk assessments preserve the model bundle used.
8. P4 scenarios recalculate predictions when material features change.
9. Production inference failures use an explicit approved fallback or fail visibly.
10. Feature, prediction and delayed performance drift are monitored.
11. OOD conditions are detected and surfaced.
12. Model promotion and rollback are audited.
13. Model explanations remain distinct from financial risk attribution.
14. Continuous/event-driven prediction can feed material risk recalculation.
15. Forecast outputs identify horizon, model, data cutoff and uncertainty.
16. Free-first deployment remains practical.
17. Tenant isolation and artifact integrity controls pass.
18. Model status is visible enough for risk interpretation.
```

---

# Appendix A — Example Prediction

Illustrative:

```json
{
  "predictionId": "pred-001",
  "modelId": "exploit-probability",
  "modelVersion": "v3",
  "featureSetVersion": "features-v2",
  "target": "EXPLOITATION_WITHIN_HORIZON",
  "horizonDays": 30,
  "probability": 0.18,
  "confidence": "MEDIUM",
  "oodScore": 0.08,
  "asOf": "2026-09-29T00:00:00Z",
  "generatedAt": "2026-09-29T00:05:00Z",
  "inputHash": "sha256:..."
}
```

Values are illustrative.

---

# Appendix B — Example P2 Integration

```text
ML prediction:
p_30d = 0.18

H_y = 30 / 365

lambda =
-ln(1 - 0.18) / H_y

P2:
frequency provider
    |
    v
loss distribution
    |
    v
50,000+ simulations
    |
    +--> EAL
    +--> VaR95
    +--> VaR99
```

The ML model does not calculate the final financial result.

---

# Appendix C — Example Model Registry

```text
Exploit Probability

v2
Status: RETIRED
Calibration: isotonic
Training: 2024-2025

v3
Status: PRODUCTION
Calibration: isotonic
Training: 2024-2026
Health: WARNING

v4
Status: CANDIDATE
Calibration: Platt
Training: 2025-2026
Validation: PASSED
```

Illustrative only.

---

# Appendix D — Example Calibration Table

```text
Predicted bucket    Observed rate

0–10%               ~8%
10–20%              ~17%
20–30%              ~24%
30–40%              ~36%
...
```

The exact values come from validation data.

---

# Appendix E — Example Drift Event

```text
Model:
Exploit Probability v3

Window:
29 Sep 2026

Feature:
EPSS

Drift:
WARNING

Reason:
production distribution differs materially from reference window

Sample:
14,200

Action:
REVIEW
```

Illustrative only.

---

# Appendix F — Example Scenario + ML

Baseline:

```text
MFA coverage = 62%
ML exploitation probability = 0.18
```

Scenario:

```text
MFA coverage = 95%
```

P4:

```text
scenario feature vector
    |
    v
ML
    |
    v
scenario probability = 0.12
    |
    v
P2
    |
    v
scenario EAL / VaR
```

All values illustrative.

---

# Appendix G — Example Model Change Impact

```text
Current model v3:
probability = 0.18

Candidate v4:
probability = 0.14

Downstream P2:
EAL_v3 = ₹12.4M
EAL_v4 = ₹10.9M

Interpretation:
part of the apparent risk change is methodology/model change,
not an environmental state change.
```

Illustrative only.

---

# Appendix H — Example Fallback

```text
Production ML:
unavailable

Approved fallback:
deterministic likelihood provider v2

RiskRun:
likelihoodSource = DETERMINISTIC_FALLBACK
degraded = true

Dashboard:
"Risk calculated using approved fallback likelihood source."
```

This is transparent degradation.

---

# Appendix I — Example End-to-End Continuous Loop

```text
09:00
KEV feed updated

09:02
feature state refreshed

09:03
ML predicts affected vulnerabilities

09:04
materiality policy detects enterprise impact

09:05
RiskRun created

09:06
P2 calculates loss distribution

09:07
P3 recalculates financial drivers

09:08
dashboard updates

09:10
P5 optimization marked stale if model/input changes materially
```

The exact cadence depends on infrastructure and configured policy.

---

# Appendix J — Recommended Implementation Sequence

```text
P6.1
ML database/registry foundation
        |
        v
P6.2
Point-in-time dataset builder
        |
        v
P6.3
Feature registry
        |
        v
P6.4
Training pipeline
        |
        v
P6.5
Baseline + challenger
        |
        v
P6.6
Calibration
        |
        v
P6.7
Model registry
        |
        v
P6.8
Inference service
        |
        v
P6.9
P2 likelihood integration
        |
        v
P6.10
Prediction lineage
        |
        v
P6.11
Drift/OOD monitoring
        |
        v
P6.12
Promotion/rollback
        |
        v
P6.13
Continuous forecasting
        |
        v
P6.14
P4/P5 integration validation
        |
        v
P6.15
UI + AI grounding
```

---

# Appendix K — Engineering Guardrails

```text
DO:
- use point-in-time datasets
- use temporal validation
- calibrate probabilities
- version features/labels/models
- store artifact hashes
- preserve prediction lineage
- monitor drift and performance
- make fallback explicit
- keep model explanation separate from financial attribution
- recalculate scenario predictions when material features change
- preserve historical model versions
- validate model changes before promotion

DO NOT:
- call hand-tuned heuristics "AI"
- use future information in training features
- optimize on test-set performance
- feed uncalibrated probability into financial-risk calculations
- let the LLM invent probabilities
- silently fallback to zero/default probability
- overwrite historical predictions
- silently promote a newly trained model
- treat feature drift as proof of model failure
- treat OOD data as normal without disclosure
- put proprietary model artifacts on blockchain
- make the model itself the financial-risk authority
```

---

# Status

**P6 Predictive ML, Calibration, Drift, Model Registry & Continuous Risk Forecasting Implementation Specification:** READY

P6 completes the predictive layer:

```text
Observed Security State
      ->
Predictive Probability
      ->
Calibrated Likelihood
      ->
P2 Quantitative Risk
      ->
P3 Attribution
      ->
P4 Scenarios
      ->
P5 Investment Optimization
```

The next dependent implementation phase is:

```text
P7 — Grounded Natural-Language Decision Support, Business Translation & Executive/Technical AI Copilot
```

P7 will sit above the verified P2–P6 services and will provide natural-language explanation, controlled what-if/optimization queries, business-language translation, and executive/technical decision support without becoming an authoritative calculation engine.
