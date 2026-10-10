# SentinelStack — P8 Governance, Evidence Integrity, Blockchain Anchoring, Compliance Evidence & Regulatory Reporting Implementation Specification v1.0

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.0  
**Document Status:** P8 Implementation Engineering Baseline  
**Repository:** `github.com/ciphernet01/sentinelstack`  
**Primary Runtime:** Existing Express + TypeScript + Prisma/PostgreSQL  
**Primary Dependencies:** P1 lineage/audit foundation + P2 Risk Engine v2 + P3 Risk Driver Attribution & Evidence + P4 Scenario Engine + P5 Investment Optimization + P6 Predictive ML + P7 Grounded AI Copilot  
**Date:** 29 September 2026  
**Baselines:** PS 26105 • SRS v2.1 • SDD v1.2 • Data Dictionary v1.1 • Risk Model v1.1 • ML Dataset & Training Specification v1.1 • API Contract v1.1 • Implementation Architecture v1.1 • P0/P1 Runbook v1.0 • P2 Risk Engine v2 Specification v1.0 • P3 Risk Driver Attribution & Evidence Specification v1.0 • P4 Scenario Engine Specification v1.0 • P5 Investment Optimization Specification v1.0 • P6 Predictive ML Specification v1.0 • P7 Grounded NLQ/AI Copilot Specification v1.0

> **Purpose:** Consolidate the governance, evidence lineage, tamper-evident integrity, audit, optional blockchain anchoring, control-framework mapping, regulatory evidence packages and decision-governance layer around the authoritative outputs produced by P2–P7.

> **Core rule:** Governance records prove what was observed, calculated, changed, reviewed and recorded. Hashes and blockchain anchors prove integrity of selected records after anchoring. They do not prove that a model, risk estimate, recommendation or compliance interpretation is mathematically or legally correct.

---

# 1. Objective

P8 provides the governance layer required to make SentinelStack suitable for:

```text
enterprise risk governance
auditability
evidence management
control accountability
regulatory reporting
management review
investment decision traceability
model governance
historical reconstruction
tamper-evident integrity
```

The P8 control flow is:

```text
Operational Evidence
        |
        v
Canonical Evidence
        |
        v
Risk / Scenario / Investment / AI Outputs
        |
        v
Governance Event
        |
        +--> actor
        +--> timestamp
        +--> resource
        +--> rationale
        +--> version
        |
        v
Canonicalization
        |
        v
SHA-256 Hash
        |
        +--> internal integrity store
        |
        +--> optional blockchain anchor
        |
        v
Audit / Governance Package
        |
        +--> framework mapping
        +--> evidence package
        +--> report
        +--> regulatory workflow
        |
        v
Reviewer / Auditor / Executive
```

---

# 2. Governance Scope

P8 covers:

```text
A. analytical audit trail
B. evidence integrity
C. provenance
D. risk assessment governance
E. scenario governance
F. investment decision governance
G. model governance integration
H. AI action governance
I. compliance mappings
J. regulatory evidence packages
K. reporting
L. optional blockchain anchoring
M. historical reconstruction
```

P8 does not replace:

```text
P2 risk calculation
P3 attribution
P4 scenario engine
P5 optimization
P6 ML
P7 AI orchestration
```

It governs their outputs and history.

---

# 3. Governance Principles

## 3.1 Provenance

Every material analytical output must answer:

```text
Where did this data come from?
When was it observed?
Which transformation was applied?
Which calculation used it?
Which version produced the result?
```

## 3.2 Immutability

Historical governance records should be:

```text
append-only
or
versioned
```

rather than overwritten.

## 3.3 Separation of Facts and Interpretation

The platform should distinguish:

```text
observed evidence
modeled result
forecast
hypothesis/scenario
human judgment
regulatory interpretation
```

## 3.4 Human Accountability

The platform can support:

```text
review
approval
acceptance
rejection
exception
```

but must retain the responsible actor and rationale.

---

# 4. Current Repository Gap

The existing repository already has:

```text
AuditLog
AuditLog-related application events
RiskSnapshot
Report
ComplianceBadge
security controls
```

The PS-26105 target requires a broader analytical governance model covering:

```text
RiskRun
RiskAssessment
RiskDriver
EvidenceRecord
ScenarioRun
ScenarioAssessment
OptimizationRun
Portfolio
MLPrediction
ModelDeployment
AI Tool Invocation
Compliance Evidence
Investment Decision
```

The existing product/account activity audit trail should remain useful.

P8 adds the analytical/governance layer rather than replacing ordinary application logs.

---

# 5. P8 Exit Criteria

P8 is complete when:

```text
[ ] Material analytical events are persisted
[ ] Evidence lineage is queryable
[ ] Historical records are append-oriented
[ ] Canonical hashes are generated for governed packages
[ ] Integrity verification exists
[ ] Optional blockchain anchor adapter exists
[ ] Blockchain is not used as the source of operational truth
[ ] Risk assessments have governance state
[ ] Scenario decisions are auditable
[ ] Investment decisions are auditable
[ ] AI-triggered material actions are auditable
[ ] ML model governance references are available
[ ] Compliance controls are mapped to evidence
[ ] Evidence packages can be generated
[ ] Regulatory report templates are versioned
[ ] Report generation is reproducible
[ ] Review workflows exist
[ ] Exceptions are tracked
[ ] Risk acceptances are tracked
[ ] Governance sign-offs are tracked
[ ] Tenant isolation is enforced
[ ] Sensitive data remains off-chain
[ ] Integrity verification can detect tampering
[ ] Historical records can be reconstructed
```

---

# 6. Governance Architecture

```text
                 ┌────────────────────────┐
                 │ Operational Data       │
                 │ VMS / SIEM / IAM / EDR │
                 └───────────┬────────────┘
                             |
                             v
                 ┌────────────────────────┐
                 │ Canonical Evidence     │
                 └───────────┬────────────┘
                             |
              ┌──────────────┼──────────────┐
              v              v              v
            P2 Risk        P3 Drivers      P6 ML
              |              |              |
              └──────────────┼──────────────┘
                             v
                    P4/P5/P7 Outputs
                             |
                             v
                    ┌─────────────────┐
                    │ Governance      │
                    │ Event + Package │
                    └────────┬────────┘
                             |
                    ┌────────┴────────┐
                    v                 v
             Internal Hash       Optional Ledger
                    |                 |
                    └────────┬────────┘
                             v
                   Audit / Compliance /
                   Regulatory Reporting
```

---

# 7. Authority Model

Governance does not calculate risk.

The authoritative hierarchy remains:

```text
P2 -> financial risk
P3 -> driver attribution
P4 -> scenario state/results
P5 -> optimization result
P6 -> ML/model health
P7 -> grounded explanation
P8 -> governance/provenance/integrity
```

---

# 8. Governance Object Types

Canonical governed resources:

```text
RISK_ASSESSMENT
RISK_RUN
RISK_DRIVER
EVIDENCE_RECORD
SCENARIO
SCENARIO_RUN
SCENARIO_ASSESSMENT
INVESTMENT_OPTION
OPTIMIZATION_RUN
PORTFOLIO
INVESTMENT_DECISION
MODEL_VERSION
MODEL_DEPLOYMENT
ML_PREDICTION
AI_OPERATION
COMPLIANCE_ASSESSMENT
COMPLIANCE_EVIDENCE
REPORT
```

---

# 9. Governance Event

Recommended:

```ts
type GovernanceEvent = {
  id: string;

  organizationId: string;

  eventType: GovernanceEventType;

  actorType:
    | "USER"
    | "SERVICE"
    | "SYSTEM"
    | "MODEL"
    | "AI";

  actorId?: string;

  resourceType: string;
  resourceId: string;

  riskRunId?: string;

  timestamp: string;

  beforeHash?: string;
  afterHash?: string;

  rationale?: string;

  metadata?: Record<string, unknown>;

  eventHash: string;
};
```

---

# 10. Governance Event Types

Recommended:

```text
EVIDENCE_INGESTED
EVIDENCE_VERSIONED
EVIDENCE_CORRECTED
EVIDENCE_RETIRED

RISK_RUN_CREATED
RISK_ASSESSMENT_CREATED
RISK_ASSESSMENT_REVIEWED
RISK_ASSESSMENT_ACCEPTED
RISK_ASSESSMENT_REJECTED
RISK_ASSESSMENT_SUPERSEDED

DRIVER_CREATED
DRIVER_REVIEWED
DRIVER_DISPUTED
DRIVER_ACCEPTED
DRIVER_REJECTED

SCENARIO_CREATED
SCENARIO_VALIDATED
SCENARIO_RUN
SCENARIO_REVIEWED
SCENARIO_APPROVED
SCENARIO_REJECTED

OPTIMIZATION_RUN
PORTFOLIO_VALIDATED
PORTFOLIO_REVIEWED

INVESTMENT_DECISION_CREATED
INVESTMENT_DECISION_APPROVED
INVESTMENT_DECISION_REJECTED
RISK_ACCEPTANCE_CREATED

MODEL_PROMOTED
MODEL_ROLLED_BACK
MODEL_RETIRED

AI_OPERATION
AI_ACTION_CONFIRMED
AI_ACTION_REJECTED

COMPLIANCE_ASSESSMENT_CREATED
COMPLIANCE_EVIDENCE_LINKED

REPORT_GENERATED
REPORT_APPROVED
REPORT_SUBMITTED

HASH_CREATED
LEDGER_ANCHORED
INTEGRITY_VERIFIED
INTEGRITY_FAILURE
```

---

# 11. Event Semantics

An event records:

```text
something happened
```

It is not itself proof that the underlying business interpretation was correct.

Example:

```text
RISK_ASSESSMENT_ACCEPTED
```

proves:

```text
an authorized actor recorded acceptance
```

It does not independently prove:

```text
the risk number is accurate
```

---

# 12. Application Audit vs Analytical Audit

Existing:

```text
AuditLog
```

continues to support:

```text
login
account changes
organization management
application actions
```

New analytical governance events support:

```text
risk
model
scenario
investment
evidence
compliance
AI
```

The two may be correlated through:

```text
requestId
actorId
organizationId
timestamp
```

---

# 13. Audit Correlation

Every material operation should carry:

```text
requestId
traceId
organizationId
actorId
resourceId
```

where applicable.

This lets investigators reconstruct:

```text
who
did what
to which object
when
through which operation
```

---

# 14. Evidence Governance

P3 defines evidence relationships.

P8 extends governance around:

```text
version
integrity
custody
retention
review
status
```

Recommended logical fields:

```text
id
organizationId
sourceType
sourceRecordId
observedAt
collectedAt
ingestedAt
evidenceVersion
contentHash
status
retentionClass
createdAt
```

---

# 15. Evidence Versioning

If evidence changes:

```text
create new version
```

rather than overwriting the old version used by a historical calculation.

Example:

```text
EDR Evidence v1
   |
   v
EDR Evidence v2
```

Historical RiskRun remains linked to v1.

---

# 16. Evidence Chain of Custody

For important evidence:

```text
source
 ->
collection
 ->
ingestion
 ->
normalization
 ->
storage
 ->
calculation
```

retain timestamps and hashes.

---

# 17. Source Provenance

Each source should identify:

```text
source system
connector
source version
retrieval timestamp
source record identifier
```

---

# 18. Evidence Reliability

P8 can persist:

```text
source reliability
```

but should distinguish:

```text
source reliability
```

from:

```text
financial model contribution
```

---

# 19. Evidence Status

Recommended:

```text
ACTIVE
SUPERSEDED
RETIRED
DISPUTED
UNAVAILABLE
```

---

# 20. Evidence Correction

If an analyst discovers bad evidence:

```text
do not mutate history
```

Create:

```text
correction event
+
new evidence version
```

Then, where necessary:

```text
new risk run
```

may be generated.

---

# 21. Evidence Dispute

Human review may mark:

```text
DISPUTED
```

with:

```text
actor
rationale
time
```

Original evidence remains.

---

# 22. Evidence Retention

Retention policy should be configurable by:

```text
organization
evidence class
regulatory requirement
source type
```

---

# 23. Retention Classes

Example:

```text
STANDARD
SECURITY_TELEMETRY
RISK_CALCULATION
REGULATORY
INVESTMENT_DECISION
MODEL_GOVERNANCE
LEGAL_HOLD
```

Exact retention periods are organization/policy specific.

---

# 24. Legal Hold

Where required:

```text
LEGAL_HOLD
```

prevents normal automated deletion until released by authorized governance.

---

# 25. Evidence Deletion

Deletion should distinguish:

```text
operational data deletion
```

from:

```text
historical evidence required for governed calculations
```

If historical evidence is deleted under policy:

```text
replace raw data with tombstone/reference metadata
```

where appropriate, so the audit record remains explainable.

---

# 26. Hashing Architecture

Recommended:

```text
canonical record
      |
      v
canonical serialization
      |
      v
SHA-256
      |
      +--> contentHash
      +--> eventHash
      +--> packageHash
```

---

# 27. Canonicalization

Canonical serialization must define:

```text
field ordering
null handling
date/time format
number representation
string encoding
array ordering
```

The same logical record must produce:

```text
same canonical bytes
```

and therefore:

```text
same hash
```

---

# 28. Hash Algorithm

Primary:

```text
SHA-256
```

This is intended for:

```text
tamper detection
integrity verification
package identity
```

not:

```text
encryption
```

---

# 29. Hash Versioning

Store:

```text
hashAlgorithm
canonicalizationVersion
```

so future algorithm changes do not make historical hashes ambiguous.

---

# 30. Record Hash

For evidence:

```text
contentHash
```

For governance event:

```text
eventHash
```

For report/evidence package:

```text
packageHash
```

---

# 31. Hash Chain

Optional internal chain:

```text
Event 1
   |
hash_1
   |
Event 2 + hash_1
   |
hash_2
   |
Event 3 + hash_2
```

This makes deletion/reordering easier to detect.

---

# 32. Hash Chain Scope

A hash chain should be scoped by:

```text
organization
event stream
```

or another explicit domain.

Do not create a single global chain that becomes a performance bottleneck.

---

# 33. Hash Chain Record

Store:

```text
previousEventHash
eventHash
sequenceNumber
```

---

# 34. Event Sequence

Use a monotonic logical sequence within the defined stream.

Do not assume database auto-increment across distributed workers is sufficient for a global causal ordering.

---

# 35. Clock Semantics

Events store:

```text
server-generated timestamp
```

Optionally also:

```text
source timestamp
```

These are distinct.

---

# 36. Integrity Verification

Recommended service:

```text
src/services/provenance/integrityVerification.service.ts
```

It checks:

```text
record hash
hash chain
package hash
ledger anchor
```

---

# 37. Verification Result

```ts
type IntegrityVerificationResult = {
  status:
    | "VERIFIED"
    | "FAILED"
    | "NOT_ANCHORED"
    | "INSUFFICIENT_DATA";

  resourceId: string;

  expectedHash?: string;
  observedHash?: string;

  ledgerStatus?: string;

  warnings: string[];
};
```

---

# 38. Integrity Failure

If mismatch occurs:

```text
INTEGRITY_FAILURE
```

event is generated.

The system should not silently “repair” the hash.

---

# 39. Integrity Failure Response

Display:

```text
The stored record does not match its recorded integrity hash.
Historical interpretation requires investigation.
```

The exact action should follow governance policy.

---

# 40. Blockchain Role

Blockchain is an optional:

```text
external integrity anchor
```

for selected governance packages.

The operational source of truth remains:

```text
PostgreSQL / governed application data
```

---

# 41. What Goes On-Chain

Preferred:

```text
package hash
resource ID
anchor timestamp
ledger transaction ID
minimal metadata
```

---

# 42. What Must Stay Off-Chain

Do not put:

```text
PII
credentials
tokens
raw telemetry
raw SIEM logs
full vulnerability payloads
detailed financial data
proprietary model artifacts
AI conversation text
private business assumptions
```

on a public blockchain.

---

# 43. Permissioned vs Public Ledger

The adapter should support:

```text
permissioned blockchain
public testnet
local/private ledger
```

depending on deployment and governance.

The application should not hard-code one chain.

---

# 44. Ledger Adapter

Create:

```text
src/services/provenance/ledger/
```

with:

```text
ledger.interface.ts
localLedger.adapter.ts
evmLedger.adapter.ts
permissionedLedger.adapter.ts
```

where actual implementations are introduced.

---

# 45. Ledger Interface

```ts
interface IntegrityLedger {
  anchor(
    packageHash: string,
    metadata?: Record<string, string>
  ): Promise<LedgerAnchor>;

  verify(
    anchor: LedgerAnchor
  ): Promise<LedgerVerificationResult>;
}
```

---

# 46. Ledger Anchor

```ts
type LedgerAnchor = {
  id: string;

  ledgerType: string;
  network: string;

  transactionId?: string;

  packageHash: string;

  anchoredAt: string;

  status:
    | "PENDING"
    | "CONFIRMED"
    | "FAILED";
};
```

---

# 47. Blockchain Failure

If anchoring fails:

```text
governance package remains valid internally
```

but:

```text
ledger status = FAILED
```

unless the governance policy requires blockchain anchoring for a specific package.

Do not mark:

```text
anchored
```

before confirmation.

---

# 48. Blockchain Confirmation

For public/permissioned networks, store:

```text
transaction ID
block height where applicable
confirmation state
network
```

---

# 49. Ledger Retry

Anchoring should be asynchronous.

Use:

```text
idempotency key
packageHash
```

to prevent duplicate anchor requests.

---

# 50. Ledger Security

Private keys must remain:

```text
server-side
secret-managed
```

and not be available to:

```text
frontend
LLM
ordinary users
```

---

# 51. Ledger Key Rotation

Where applicable:

```text
record key/address version
rotation event
```

---

# 52. Ledger Data Minimization

On-chain payload should contain only:

```text
minimum metadata
```

required to verify integrity.

---

# 53. Governance Package

A governance package is a stable bundle of references and hashes.

Example:

```text
RiskAssessment
RiskRun
Drivers
Evidence references
Scenario
Optimization
Decision
Report
```

---

# 54. Package Object

```ts
type GovernancePackage = {
  id: string;

  organizationId: string;

  packageType:
    | "RISK_ASSESSMENT"
    | "SCENARIO"
    | "INVESTMENT_DECISION"
    | "COMPLIANCE"
    | "MODEL_GOVERNANCE"
    | "REGULATORY_REPORT";

  resourceIds: string[];

  packageVersion: string;

  canonicalHash: string;

  createdAt: string;
};
```

---

# 55. Package Manifest

Each package should contain:

```text
resource type
resource ID
version
hash
timestamp
relationship
```

---

# 56. Package Hash

Compute:

```text
SHA-256(canonical manifest)
```

Store:

```text
packageHash
```

---

# 57. Package Versioning

Change package version when:

```text
schema changes
hashing/canonicalization changes
material package contents change
```

---

# 58. Risk Assessment Governance

Risk Assessment status:

```text
DRAFT
CALCULATED
REVIEW_REQUIRED
REVIEWED
ACCEPTED
REJECTED
SUPERSEDED
ARCHIVED
```

---

# 59. Status Semantics

```text
CALCULATED
```

means calculation completed.

```text
REVIEWED
```

means an authorized reviewer inspected it.

```text
ACCEPTED
```

means an authorized actor accepted the result for the defined governance purpose.

These are different states.

---

# 60. Risk Acceptance

Organizations may explicitly accept residual risk.

Create:

```text
RiskAcceptance
```

with:

```text
riskAssessmentId
riskScope
acceptedMetric
threshold
expiration
reason
acceptedBy
approvedAt
reviewDate
conditions
```

---

# 61. Risk Acceptance Example

```text
Residual EAL:
₹8.2M

Accepted by:
authorized risk officer

Reason:
business transformation project
temporary exposure

Expiration:
31 Dec 2026
```

Illustrative.

---

# 62. Risk Acceptance Does Not Change Risk

Risk acceptance modifies:

```text
governance status
```

not:

```text
EAL
VaR
Risk Score
```

---

# 63. Risk Acceptance Expiration

When:

```text
expiration <= current date
```

status becomes:

```text
EXPIRED
```

and review is required according to policy.

---

# 64. Risk Exception

An exception may document:

```text
control not implemented
reason
temporary waiver
compensating controls
expiry
owner
```

It is separate from:

```text
risk acceptance
```

---

# 65. Compensating Control

Record:

```text
exception
    |
    +--> compensating control
```

and link to:

```text
SecurityControl
```

---

# 66. Governance Review

A review object can contain:

```text
reviewer
review date
scope
result
comments
follow-up
```

---

# 67. Review Outcomes

```text
ACCEPT
REJECT
REQUEST_CHANGES
DEFER
```

---

# 68. Review Independence

For high-impact decisions, governance policy may require:

```text
reviewer != creator
```

This should be configurable.

---

# 69. Segregation of Duties

Potential roles:

```text
ANALYST
RISK_MANAGER
CISO
AUDITOR
COMPLIANCE_OFFICER
ADMIN
```

P8 can require different permissions for:

```text
calculate
review
accept
approve
export
submit
```

---

# 70. Investment Decision Governance

P5 produces:

```text
OptimizationPortfolio
```

P8 creates:

```text
InvestmentDecision
```

with:

```text
portfolioId
requestedBudget
decision
decisionMaker
rationale
approvalDate
```

---

# 71. Investment Decision States

```text
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
REJECTED
DEFERRED
CANCELLED
```

---

# 72. Decision vs Portfolio

A portfolio is:

```text
analytical result
```

An investment decision is:

```text
governance action around that result
```

---

# 73. Decision Does Not Rewrite Optimization

If portfolio was optimized under:

```text
objective A
```

and a user rejects it:

```text
optimization result remains unchanged
```

A new optimization can be run with different constraints.

---

# 74. Decision Rationale

Required for material decisions:

```text
business rationale
risk rationale
budget rationale
conditions
```

The rationale is human governance data.

---

# 75. AI Decision Support

P7-generated narrative can be attached to an investment decision package as:

```text
supporting context
```

not as:

```text
decision authority
```

---

# 76. AI Action Audit

If P7 created:

```text
Scenario
OptimizationRun
DecisionCandidate
```

the governance record should identify:

```text
initiatedBy = AI
userId
confirmation
request hash
```

---

# 77. Model Governance

P6 model metadata becomes governed under P8.

Governed records:

```text
dataset version
feature version
training run
model version
calibration
evaluation
promotion
rollback
retirement
```

---

# 78. Model Approval

Production model deployment may require:

```text
review
approval
rationale
```

according to organization policy.

---

# 79. Model Approval Package

Include:

```text
model card
dataset card
metrics
calibration
limitations
artifact hash
promotion event
```

---

# 80. Model Change Governance

A model update can produce:

```text
new risk result
```

P8 must preserve:

```text
old model
new model
model impact analysis
risk-run linkage
```

---

# 81. Model Rollback Governance

Rollback event:

```text
old production
new production
rollback target
reason
actor
timestamp
```

---

# 82. ML Model Risk Acceptance

Where model limitations are known:

```text
model exception
```

may be recorded.

Example:

```text
KEV-transition proxy used until enterprise exploitation labels are available.
```

---

# 83. Model Limitation Record

Fields:

```text
modelVersion
limitation
impact
mitigation
owner
reviewDate
status
```

---

# 84. Compliance Domain

P8 provides a framework mapping and evidence management layer.

Supported baseline mappings:

```text
ISO/IEC 27001
NIST CSF
CIS Controls
RBI Cyber Security Framework
SEBI Cybersecurity and Cyber Resilience Framework
```

The exact framework/control catalogue must be versioned.

---

# 85. Framework Catalogue

Recommended:

```text
Framework
FrameworkVersion
Control
ControlMapping
EvidenceRequirement
```

---

# 86. Framework Object

```ts
type Framework = {
  id: string;
  name: string;
  version: string;
  jurisdiction?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
};
```

---

# 87. Control Mapping

```ts
type ControlMapping = {
  frameworkVersionId: string;

  frameworkControlId: string;

  sentinelControlId?: string;

  mappingType:
    | "DIRECT"
    | "PARTIAL"
    | "SUPPORTING"
    | "NOT_MAPPED";

  rationale: string;

  reviewedAt?: string;
};
```

---

# 88. Mapping Semantics

A mapping means:

```text
SentinelStack control/evidence is associated with a framework control.
```

It does not automatically mean:

```text
organization is compliant.
```

---

# 89. Compliance Assessment

Recommended:

```ts
type ComplianceAssessment = {
  id: string;

  organizationId: string;
  frameworkVersionId: string;

  scopeType: string;
  scopeId?: string;

  status:
    | "DRAFT"
    | "ASSESSMENT"
    | "REVIEW"
    | "FINAL";

  assessedAt: string;
  assessorId: string;
};
```

---

# 90. Compliance Evidence

Each framework control can link to:

```text
policy
configuration
risk assessment
control state
audit event
test result
evidence record
report
```

---

# 91. Evidence Sufficiency

A framework requirement may require multiple evidence items.

The system should support:

```text
evidence coverage
```

without creating unsupported legal conclusions.

---

# 92. Compliance Gap

A gap can be:

```text
CONTROL_MISSING
CONTROL_PARTIAL
EVIDENCE_MISSING
EVIDENCE_STALE
REVIEW_REQUIRED
```

---

# 93. Gap Object

```ts
type ComplianceGap = {
  frameworkControlId: string;

  gapType: string;

  severity?: string;

  evidenceRefs: string[];

  ownerId?: string;

  remediationOptionIds: string[];

  status:
    | "OPEN"
    | "IN_PROGRESS"
    | "MITIGATED"
    | "ACCEPTED"
    | "CLOSED";
};
```

---

# 94. Compliance Remediation

A compliance gap can link to:

```text
RiskDriver
InvestmentOption
Scenario
```

creating:

```text
compliance
  ->
risk
  ->
treatment
  ->
investment
```

traceability.

---

# 95. Framework Versioning

A framework update creates:

```text
new FrameworkVersion
```

Historical assessments remain linked to the version used.

---

# 96. Regulatory Reporting

P8 should support versioned report definitions.

Possible report classes:

```text
RISK_ASSESSMENT
BOARD_RISK_REPORT
COMPLIANCE_REPORT
REGULATORY_EVIDENCE_PACKAGE
MODEL_GOVERNANCE_REPORT
INVESTMENT_DECISION_PACKAGE
AUDIT_PACKAGE
```

---

# 97. Reporting Architecture

```text
Structured Governance Data
       |
       v
Report Definition
       |
       v
Report Query
       |
       v
Evidence / Metric Snapshot
       |
       v
Template
       |
       v
Rendered Report
       |
       v
Approval
       |
       v
Optional Submission
```

---

# 98. Report Definition

```ts
type ReportDefinition = {
  id: string;

  name: string;
  version: string;

  reportType: string;

  requiredSections: string[];

  dataSources: string[];

  status:
    | "DRAFT"
    | "ACTIVE"
    | "RETIRED";
};
```

---

# 99. Report Snapshot

A report should use a snapshot of:

```text
risk
evidence
compliance
model
investment
```

at a declared:

```text
asOf
```

time.

---

# 100. Report Reproducibility

Store:

```text
reportDefinitionVersion
dataSnapshotHash
templateVersion
packageHash
```

---

# 101. Report Approval

States:

```text
DRAFT
GENERATED
REVIEW_REQUIRED
APPROVED
SUBMITTED
SUPERSEDED
```

---

# 102. Regulatory Submission

Where a future connector exists:

```text
submission package
 ->
authorized submission connector
```

Submission status:

```text
PREPARED
SUBMITTED
ACKNOWLEDGED
REJECTED
```

Do not mark a report as submitted without actual submission evidence.

---

# 103. Submission Evidence

Store:

```text
submission ID
destination
timestamp
response
hash/package
actor/service
```

---

# 104. Governance Package Assembly

Create:

```text
src/services/governance/governancePackage.service.ts
```

Responsibilities:

```text
resolve resources
validate scope
construct manifest
calculate package hash
persist package
optional ledger anchor
```

---

# 105. Integrity Service

Create:

```text
src/services/provenance/integrityHash.service.ts
src/services/provenance/integrityVerification.service.ts
```

---

# 106. Governance Event Service

Create:

```text
src/services/governance/governanceEvent.service.ts
```

---

# 107. Evidence Governance Service

Create:

```text
src/services/governance/evidenceGovernance.service.ts
```

---

# 108. Risk Acceptance Service

Create:

```text
src/services/governance/riskAcceptance.service.ts
```

---

# 109. Exception Service

Create:

```text
src/services/governance/exception.service.ts
```

---

# 110. Compliance Service

Existing compliance routes remain.

Extend with:

```text
framework versioning
control mappings
evidence linkage
assessment workflow
report package
```

---

# 111. Reporting Service

Create/extend:

```text
src/services/reporting/regulatoryReport.service.ts
src/services/reporting/reportGovernance.service.ts
```

---

# 112. Ledger Service

Create:

```text
src/services/provenance/ledger/ledger.service.ts
```

---

# 113. Governance Worker

Background jobs:

```text
package_generation
integrity_verification
ledger_anchor
report_generation
review_reminders
expiry_checks
```

---

# 114. Database Target

Recommended new entities:

```text
GovernanceEvent
EvidenceVersion
EvidenceReview
EvidenceRetentionPolicy
GovernancePackage
GovernancePackageResource
LedgerAnchor
RiskAcceptance
RiskException
GovernanceReview
Framework
FrameworkVersion
FrameworkControl
ControlMapping
ComplianceAssessment
ComplianceEvidence
ComplianceGap
ReportDefinition
ReportDefinitionVersion
ReportInstance
ReportApproval
ReportSubmission
InvestmentDecision
InvestmentDecisionReview
```

---

# 115. GovernanceEvent Schema

```text
id
organizationId
eventType
actorType
actorId
resourceType
resourceId
requestId
traceId
riskRunId
timestamp
previousEventHash
beforeHash
afterHash
rationale
metadata
eventHash
```

---

# 116. GovernancePackage Schema

```text
id
organizationId
packageType
packageVersion
canonicalHash
createdBy
createdAt
status
```

---

# 117. Package Resource Schema

```text
id
packageId
resourceType
resourceId
resourceVersion
resourceHash
relationship
```

---

# 118. LedgerAnchor Schema

```text
id
organizationId
packageId
ledgerType
network
transactionId
packageHash
status
submittedAt
confirmedAt
metadata
```

---

# 119. RiskAcceptance Schema

```text
id
organizationId
riskAssessmentId
scopeType
scopeId
metric
acceptedValue
reason
conditions
acceptedBy
approvedBy
status
expiresAt
reviewDate
createdAt
```

---

# 120. RiskException Schema

```text
id
organizationId
controlId
resourceType
resourceId
reason
compensatingControlId
ownerId
approvedBy
status
expiresAt
createdAt
```

---

# 121. GovernanceReview Schema

```text
id
organizationId
resourceType
resourceId
reviewType
reviewerId
status
comments
reviewedAt
```

---

# 122. Framework Schema

```text
id
name
publisher
jurisdiction
createdAt
```

---

# 123. FrameworkVersion Schema

```text
id
frameworkId
version
effectiveFrom
effectiveTo
status
sourceReference
```

---

# 124. FrameworkControl Schema

```text
id
frameworkVersionId
controlIdentifier
title
description
parentControlId
```

---

# 125. ControlMapping Schema

```text
id
frameworkControlId
sentinelControlId
mappingType
rationale
reviewStatus
reviewerId
reviewedAt
```

---

# 126. ComplianceAssessment Schema

```text
id
organizationId
frameworkVersionId
scopeType
scopeId
status
assessorId
assessedAt
reviewedAt
finalizedAt
```

---

# 127. ComplianceEvidence Schema

```text
id
assessmentId
frameworkControlId
evidenceRecordId
relationship
status
reviewedBy
reviewedAt
```

---

# 128. ComplianceGap Schema

```text
id
assessmentId
frameworkControlId
gapType
description
ownerId
status
createdAt
closedAt
```

---

# 129. ReportDefinitionVersion Schema

```text
id
definitionId
version
effectiveFrom
effectiveTo
templateHash
schemaHash
status
```

---

# 130. ReportInstance Schema

```text
id
organizationId
definitionVersionId
scopeType
scopeId
dataSnapshotHash
artifactHash
status
generatedAt
```

---

# 131. ReportApproval Schema

```text
id
reportId
reviewerId
status
rationale
timestamp
approvedHash
```

---

# 132. ReportSubmission Schema

```text
id
reportId
destination
submissionId
status
submittedAt
acknowledgedAt
responseMetadata
```

---

# 133. InvestmentDecision Schema

```text
id
organizationId
portfolioId
decision
requestedBudget
approvedBudget
decisionMakerId
rationale
conditions
status
createdAt
approvedAt
```

---

# 134. Decision Review Schema

```text
id
investmentDecisionId
reviewerId
status
comments
reviewedAt
```

---

# 135. Database Indexes

Recommended:

```text
GovernanceEvent:
organizationId + timestamp
organizationId + resourceType + resourceId
organizationId + eventType

GovernancePackage:
organizationId + packageType
canonicalHash

Evidence:
organizationId + sourceType
organizationId + status
contentHash

LedgerAnchor:
organizationId + status
packageId

RiskAcceptance:
organizationId + status
expiresAt

Compliance:
organizationId + frameworkVersionId
assessmentId + frameworkControlId

Reports:
organizationId + status
definitionVersionId

InvestmentDecision:
organizationId + status
portfolioId
```

---

# 136. Governance API

Recommended:

```text
GET  /api/v1/governance/events
GET  /api/v1/governance/packages/{id}
POST /api/v1/governance/packages
POST /api/v1/governance/packages/{id}/verify

GET  /api/v1/evidence
GET  /api/v1/evidence/{id}
GET  /api/v1/evidence/{id}/history

GET  /api/v1/risk/acceptances
POST /api/v1/risk/acceptances

GET  /api/v1/exceptions
POST /api/v1/exceptions

GET  /api/v1/compliance/frameworks
GET  /api/v1/compliance/assessments
POST /api/v1/compliance/assessments

GET  /api/v1/reports/definitions
POST /api/v1/reports/generate
GET  /api/v1/reports/{id}
POST /api/v1/reports/{id}/approve

POST /api/v1/ledger/anchors
GET  /api/v1/ledger/anchors/{id}
POST /api/v1/ledger/anchors/{id}/verify
```

---

# 137. Governance API Security

Every governance endpoint must enforce:

```text
authentication
organization isolation
role/permission
resource ownership
input validation
rate limits
audit
```

---

# 138. Governance Package API

### `POST /api/v1/governance/packages`

Request:

```json
{
  "packageType": "RISK_ASSESSMENT",
  "resourceIds": [
    "risk-001",
    "run-001"
  ]
}
```

Backend resolves all authorized resources and constructs the manifest.

---

# 139. Package Verification API

### `POST /api/v1/governance/packages/{id}/verify`

Returns:

```text
package status
hash verification
resource verification
ledger status
warnings
```

---

# 140. Risk Acceptance API

### `POST /api/v1/risk/acceptances`

Requires:

```text
authorized role
resource
reason
expiration
```

---

# 141. Compliance Evidence API

### `POST /api/v1/compliance/assessments/{id}/evidence`

Links:

```text
EvidenceRecord
```

to:

```text
framework control
```

---

# 142. Report Generation API

### `POST /api/v1/reports/generate`

Request:

```json
{
  "definitionId": "reg-report-v1",
  "scope": "enterprise",
  "riskAssessmentId": "risk-001"
}
```

---

# 143. Report Approval API

### `POST /api/v1/reports/{id}/approve`

Requires:

```text
review/approval permission
```

and stores:

```text
approved version/hash
```

---

# 144. Ledger API

### `POST /api/v1/ledger/anchors`

Creates an asynchronous anchor job.

---

# 145. Ledger Verification API

### `POST /api/v1/ledger/anchors/{id}/verify`

Returns:

```text
local hash
ledger hash
status
```

---

# 146. Authorization Matrix

| Action | Analyst | Risk Manager | Compliance | Auditor | Admin |
|---|---:|---:|---:|---:|---:|
| View governance events | Yes | Yes | Yes | Yes | Yes |
| Create package | Yes | Yes | Yes | Optional | Yes |
| Verify integrity | Yes | Yes | Yes | Yes | Yes |
| Create risk acceptance | No | Yes | No | No | Yes |
| Approve risk acceptance | No | Yes | No | No | Yes |
| Create compliance assessment | Optional | Optional | Yes | No | Yes |
| Approve regulatory report | No | Optional | Yes | No | Yes |
| Anchor ledger | Optional | Yes | Yes | No | Yes |
| Verify ledger | Yes | Yes | Yes | Yes | Yes |
| Approve investment decision | No | Yes | No | No | Yes |

Exact roles follow the existing RBAC model.

---

# 147. Tenant Isolation

All governance records require:

```text
organizationId
```

and authorization.

A user must not infer another tenant's:

```text
resource existence
hash
report
compliance state
investment decision
```

from APIs or errors.

---

# 148. Sensitive Evidence Access

Raw evidence may have stricter authorization than:

```text
evidence metadata
```

Use:

```text
field-level authorization
```

where necessary.

---

# 149. Financial Governance Access

Detailed:

```text
loss decomposition
cost assumptions
investment decisions
```

may require:

```text
risk/finance role
```

depending on policy.

---

# 150. Audit Log Immutability

Do not allow ordinary update/delete operations on:

```text
GovernanceEvent
```

Instead:

```text
correction event
```

should be appended.

---

# 151. Governance Package Sealing

A package becomes:

```text
SEALED
```

when its:

```text
manifest
hash
resource versions
```

are fixed.

---

# 152. Package Mutation

If a sealed package needs correction:

```text
create new package
```

rather than editing the old package.

---

# 153. Package Supersession

New package may link:

```text
supersedesPackageId
```

---

# 154. Governance State Separation

Use distinct dimensions such as:

```text
calculationStatus
reviewStatus
governanceStatus
```

Do not collapse:

```text
CALCULATED
REVIEWED
APPROVED
```

into one status.

---

# 155. Scenario Governance State

Separate:

```text
scenario calculation
scenario review
scenario approval
```

---

# 156. Portfolio Governance State

Separate:

```text
optimizer status
validation status
review status
decision status
```

---

# 157. Model Governance State

Separate:

```text
artifact status
evaluation status
deployment status
approval status
```

---

# 158. Compliance State

Separate:

```text
assessment status
evidence status
gap status
approval/finalization
```

---

# 159. Approval Version Binding

An approval applies to:

```text
specific resource version/hash
```

If the resource materially changes:

```text
prior approval does not automatically transfer
```

---

# 160. Optimistic Locking

Governed objects should use:

```text
version number
updatedAt
```

and where necessary:

```text
expectedVersion
```

on approval/update APIs.

---

# 161. Risk Acceptance Invariant

Risk acceptance does not reduce:

```text
computed risk.
```

It changes governance interpretation of residual exposure.

---

# 162. Exception Invariant

An exception does not automatically reduce:

```text
risk metrics.
```

If the operational state changes, a new P2 risk run determines any new risk value.

---

# 163. Compliance Invariant

Framework mapping does not automatically equal:

```text
compliance.
```

---

# 164. Report Snapshot Invariant

A report references:

```text
declared assessment/evidence/model snapshots
```

rather than silently querying “latest” data during rendering.

---

# 165. Ledger Invariant

Ledger status:

```text
CONFIRMED
```

only when the anchor is actually confirmed.

---

# 166. Governance Dashboard

Suggested widgets:

```text
Open Risk Reviews
Risk Acceptances Expiring
Open Exceptions
Stale Evidence
Model Reviews Due
Compliance Gaps
Reports Pending Approval
Integrity Alerts
Ledger Anchors
Investment Decisions
```

---

# 167. Governance Timeline

Display:

```text
event
actor
resource
timestamp
rationale
status
```

Every item links to the governed resource.

---

# 168. Governance Center Navigation

Recommended:

```text
Governance
├── Risk Reviews
├── Risk Acceptance
├── Exceptions
├── Evidence
├── Compliance
├── Model Governance
├── Investment Decisions
├── Reports
├── Integrity
└── Audit Timeline
```

---

# 169. Governance Search

Search by:

```text
resource
actor
event
date
framework
risk run
package
hash
```

---

# 170. Evidence Explorer

Filters:

```text
source
date
resource
status
quality
framework
hash
```

---

# 171. Integrity Detail View

For a package:

```text
Package Hash
Canonicalization Version
Hash Algorithm
Resources
Internal Verification
Ledger Status
Transaction
Last Verification
```

---

# 172. Risk Review Detail

Show:

```text
assessment
drivers
evidence
model
assumptions
risk appetite
exceptions
reviewers
acceptance
```

---

# 173. Compliance Assessment Detail

Show:

```text
framework
control
mapping
evidence
gap
review
```

---

# 174. Investment Decision Detail

Show:

```text
Portfolio
Optimization objective
Budget
Validated scenario
Risk outcome
Cost
Approval
Decision
Rationale
```

---

# 175. Report Detail

Show:

```text
definition
version
data-as-of
validation
approval
submission
integrity
```

---

# 176. Governance AI Integration

P7 can query:

```text
governance events
risk acceptance
exceptions
compliance
reports
integrity
investment decisions
model governance
```

but all results come from P8 governance services.

---

# 177. Governance AI Questions

Examples:

```text
Who approved this risk acceptance?

When does this exception expire?

Which evidence supports this compliance mapping?

Was this report approved?

Has this risk package been integrity-verified?

Which model version was approved?

Who approved this portfolio?

Was this action initiated by AI?
```

---

# 178. Governance AI Guardrails

The Copilot must not:

```text
invent approval
invent evidence
change compliance status
approve risk acceptance
promote model
submit report
approve investment
```

without the governed backend workflow.

---

# 179. AI Governance Mutation

AI may prepare:

```text
draft
```

but final governance mutations require:

```text
authorization
```

and, where configured:

```text
human confirmation
```

---

# 180. Governance Package AI Traceability

If AI produces a material narrative:

```text
user question
tool calls
source package
AI response
review
```

can be stored as a derived governance artifact.

---

# 181. Governance Metrics

Track:

```text
evidence_coverage
stale_evidence_count
integrity_failure_count
open_risk_acceptances
expiring_acceptances
open_exceptions
expired_exceptions
pending_reviews
pending_regulatory_reports
model_approval_count
ledger_anchor_success_rate
```

---

# 182. Integrity Reconciliation

Periodic job:

```text
sample/full governed records
   |
   v
recompute hash
   |
   v
compare stored hash
   |
   v
compare ledger anchor
```

---

# 183. Ledger Reconciliation

For every anchored package:

```text
local packageHash
vs
on-chain anchored hash
```

must match.

---

# 184. Evidence Lifecycle

```text
ACTIVE
 ->
SUPERSEDED
 ->
RETIRED
```

or:

```text
ACTIVE
 ->
DISPUTED
 ->
REVIEWED
```

with governance events.

---

# 185. Governance Workflow Engine

A full BPM/workflow product is not mandatory for P8 v1.

Use:

```text
state machines
```

and:

```text
role-based transitions
```

first.

---

# 186. State Transition Validation

Every governed resource should have:

```text
current status
allowed next states
actor permission
required fields
```

---

# 187. Workflow Example

Risk Assessment:

```text
CALCULATED
   ->
REVIEW_REQUIRED
   ->
REVIEWED
   ->
ACCEPTED
```

---

# 188. Invalid Transition

Example:

```text
DRAFT
 -> APPROVED
```

should fail if:

```text
review
```

is required.

---

# 189. Workflow Audit

Every transition creates:

```text
GovernanceEvent
```

---

# 190. Approval Conditions

Approval may include:

```text
conditions
expiry
scope
```

---

# 191. Conditional Approval

Example:

```text
Approved subject to:
MFA remediation by date X.
```

The condition should be persisted and trackable.

---

# 192. Approval Follow-Up

Create:

```text
GovernanceActionItem
```

for unresolved:

```text
condition
exception
review
evidence gap
```

---

# 193. Action Item Schema

```text
id
organizationId
sourceResourceType
sourceResourceId
title
ownerId
dueAt
status
evidenceRefs
createdAt
closedAt
```

---

# 194. Action Item Status

```text
OPEN
IN_PROGRESS
BLOCKED
COMPLETED
CANCELLED
OVERDUE
```

---

# 195. Governance Calendar

Expose:

```text
review due
expiry
report due
submission
model review
```

---

# 196. Governance Calendar API

### `GET /api/v1/governance/calendar`

Filters:

```text
date range
type
owner
status
```

---

# 197. Governance Owner Dashboard

Owner sees:

```text
pending reviews
actions
expiries
```

---

# 198. Governance Notifications

Potential:

```text
risk acceptance expiring
exception expiring
evidence stale
model approval due
report review due
regulatory submission due
integrity failure
```

Existing notification/scheduling infrastructure can be reused.

---

# 199. Governance Scheduler

Suggested jobs:

```text
EVIDENCE_EXPIRY_CHECK
RISK_ACCEPTANCE_EXPIRY_CHECK
EXCEPTION_EXPIRY_CHECK
MODEL_REVIEW_CHECK
REPORT_DUE_CHECK
INTEGRITY_VERIFICATION
LEDGER_RECONCILIATION
```

---

# 200. Governance Action Trace

For every action item, preserve:

```text
source
owner
due date
status transitions
closure evidence
```

---

# 201. Regulatory Evidence Package

For a regulatory package:

```text
framework version
control mapping
assessment
evidence
gaps
remediation
approvals
hash
```

---

# 202. Report Package Integrity

Rendered report itself can be hashed:

```text
PDF/HTML/file bytes
```

and the manifest can include:

```text
documentHash
```

---

# 203. Source Package vs Rendered Report

Keep separate:

```text
source data package hash
```

and:

```text
rendered document hash
```

A document can change formatting without changing underlying source facts.

---

# 204. Artifact Hash

```text
artifactHash = SHA-256(file bytes)
```

Store:

```text
mimeType
fileSize
artifactHash
```

---

# 205. Report Storage

Use existing secure report/document storage with metadata in PostgreSQL.

---

# 206. Report Access

Require:

```text
authenticated access
tenant scope
role
```

---

# 207. Report Download Audit

Log where required:

```text
REPORT_VIEWED
REPORT_DOWNLOADED
REPORT_SHARED
```

---

# 208. External Sharing

If supported:

```text
temporary signed link
expiration
recipient scope
download audit
```

---

# 209. Evidence Export

Authorized evidence export should include:

```text
resource
source
timestamps
hash
package relationship
```

and be audited.

---

# 210. Regulatory Submission Workflow

```text
report generation
   ->
validation
   ->
review
   ->
approval
   ->
package seal
   ->
submission
   ->
receipt
```

---

# 211. Submission Status Integrity

Only actual connector results may mark:

```text
SUBMITTED
ACKNOWLEDGED
REJECTED
```

---

# 212. Submission Mock Mode

For development:

```text
SUBMISSION_MODE=MOCK
```

and UI must display:

```text
Mock/Test Submission
```

---

# 213. Blockchain Demo Mode

For development/SIH:

```text
LEDGER_MODE=LOCAL/TEST
```

and UI should show the actual ledger mode.

---

# 214. No Fake Blockchain

Do not generate:

```text
fake transaction IDs
fake hashes
fake confirmations
```

for a production-like claim.

Use real SHA-256 and an actual configured test/local ledger if demonstrating anchoring.

---

# 215. Synthetic Governance Data

Demo records may be seeded with:

```text
origin = SYNTHETIC
```

and must remain clearly labeled.

---

# 216. Governance Demo Flow

```text
1. Calculate enterprise risk
2. Open risk driver
3. Trace to evidence
4. Open scenario
5. View investment portfolio
6. Create governance package
7. Seal package
8. Hash package
9. Anchor hash
10. Verify integrity
11. Show compliance mapping
12. Show investment approval
13. Show immutable timeline
```

---

# 217. Trust Model

P8 separates:

```text
Data provenance
Model reliability
Calculation integrity
Decision governance
```

Examples:

```text
provenance -> source evidence and lineage

model reliability -> P6 validation

calculation integrity -> hashes/package verification

decision governance -> review/approval/audit
```

---

# 218. Audit vs Blockchain

Audit answers:

```text
Who did what?
```

Blockchain anchoring answers:

```text
Was this package changed after anchoring?
```

Neither alone proves:

```text
the underlying risk model is correct.
```

---

# 219. Model Validity vs Integrity

P8 can prove:

```text
model artifact unchanged
```

It cannot prove:

```text
model is accurate
```

P6 validation is responsible for model quality.

---

# 220. Risk Result Integrity vs Correctness

P8 can prove:

```text
RiskRun result record unchanged.
```

P2 validation is responsible for mathematical correctness.

---

# 221. Compliance Evidence vs Compliance Conclusion

P8 can prove:

```text
evidence and mappings recorded.
```

It should not independently claim:

```text
legal compliance.
```

---

# 222. Historical Reconstruction

A historical RiskAssessment should reconstruct:

```text
RiskAssessment
 ->
RiskRun
 ->
InputStateHash
 ->
ModelBundle
 ->
ParameterBundle
 ->
Predictions
 ->
Drivers
 ->
Evidence
```

---

# 223. Historical Scenario Reconstruction

```text
Scenario
 ->
ScenarioChanges
 ->
ScenarioStateHash
 ->
ScenarioRun
 ->
ScenarioAssessment
 ->
Drivers
 ->
Evidence
```

---

# 224. Historical Portfolio Reconstruction

```text
OptimizationRun
 ->
OptimizationInputHash
 ->
Option Versions
 ->
Cost Versions
 ->
Constraints
 ->
Portfolio
 ->
P4 Validation
 ->
P2 Result
```

---

# 225. Historical AI Reconstruction

```text
Conversation
 ->
Tool Invocations
 ->
Structured Results
 ->
Prompt Policy
 ->
Response
```

Perfect textual reproduction is optional; factual source reconstruction is what matters.

---

# 226. Governance Diff

Compare two governance packages:

```text
package A
vs
package B
```

Output:

```text
resource added
resource removed
version changed
hash changed
approval changed
evidence changed
```

---

# 227. Governance Relationship Graph

```text
Evidence
   |
   v
Risk Driver
   |
   v
Scenario
   |
   v
Investment Option
   |
   v
Optimization Portfolio
   |
   v
Investment Decision
```

This is a core governance graph.

---

# 228. Compliance-to-Risk Trace

```text
Framework Gap
    |
    v
Risk Driver
    |
    v
Scenario
    |
    v
Investment Option
    |
    v
Portfolio
    |
    v
Decision
```

---

# 229. Regulatory-to-Risk Trace

```text
Regulatory Requirement
       |
       v
Evidence Requirement
       |
       v
Control State
       |
       v
Risk Exposure
       |
       v
Treatment
```

---

# 230. Model-to-Risk Trace

```text
Dataset
 ->
FeatureSet
 ->
TrainingRun
 ->
ModelVersion
 ->
Calibration
 ->
Deployment
 ->
Prediction
 ->
RiskRun
```

---

# 231. AI-to-Governance Trace

```text
User
 ->
AI Query
 ->
Tool Plan
 ->
Tool Invocation
 ->
Authoritative Result
 ->
AI Response
 ->
Governance Action
```

---

# 232. Full Governance Graph

```text
                     Evidence
                         |
                         v
                   Risk Driver
                         |
                         v
                    Scenario
                         |
                         v
                 Investment Option
                         |
                         v
                  Optimization
                         |
                         v
                    Portfolio
                         |
                         v
               Investment Decision
                         |
                         v
                       Report

Evidence also connects to:
    Compliance
    ML prediction
    RiskRun

All material nodes connect to:
    Governance Events
    Hashes
    Optional Ledger Anchors
```

---

# 233. Lineage API

Recommended:

### `GET /api/v1/governance/resources/{type}/{id}/lineage`

Returns:

```text
upstream
downstream
```

within authorized scope.

---

# 234. Lineage Security

The lineage endpoint must honor:

```text
resource-level authorization
```

at every node.

Restricted nodes should return:

```text
redacted/restricted placeholder
```

rather than sensitive data.

---

# 235. Governance Overview API

Optional:

### `GET /api/v1/governance/overview`

Returns:

```text
open reviews
risk acceptances
exceptions
evidence health
model governance
compliance
report status
integrity alerts
```

---

# 236. Governance Overview Freshness

Each aggregate widget should include:

```text
lastUpdated
```

---

# 237. Governance API Pagination

Use:

```text
cursor
limit
nextCursor
```

for:

```text
events
evidence
reports
```

---

# 238. Governance API Error Codes

Suggested:

```text
GOV-001 UNAUTHORIZED
GOV-002 RESOURCE_VERSION_CONFLICT
GOV-003 INTEGRITY_FAILURE
GOV-004 PACKAGE_INVALID
GOV-005 EVIDENCE_MISSING
GOV-006 APPROVAL_REQUIRED
GOV-007 APPROVAL_EXPIRED
GOV-008 LEDGER_ANCHOR_FAILED
GOV-009 REPORT_INCOMPLETE
GOV-010 COMPLIANCE_MAPPING_INVALID
GOV-011 CROSS_TENANT_RESOURCE
GOV-012 RETENTION_RESTRICTED
GOV-013 LEGAL_HOLD
```

---

# 239. Outbox Pattern

For external side effects:

```text
ledger anchor
notifications
regulatory submission
```

use:

```text
transactional outbox
```

where practical.

---

# 240. Outbox Event

Recommended:

```text
GovernanceOutboxEvent
```

fields:

```text
id
organizationId
type
payload
status
createdAt
processedAt
retryCount
```

---

# 241. Ledger Anchor Outbox

Workflow:

```text
seal package
+
outbox anchor request
```

within transaction.

Worker processes:

```text
ledger
```

---

# 242. Submission Outbox

Workflow:

```text
approve report
+
outbox submission request
```

then connector submits.

---

# 243. Notification Outbox

Workflow:

```text
governance state change
+
notification outbox
```

---

# 244. Connector Retries

Use bounded exponential backoff.

---

# 245. Poison Message Handling

After repeated failures:

```text
dead-letter
```

and:

```text
alert governance ops
```

---

# 246. Governance Worker Monitoring

Track:

```text
queue depth
job latency
failure
retry
dead-letter
```

---

# 247. Governance Testing

## Unit

```text
canonicalization
hashing
versioning
status transitions
retention
approval
mapping
```

## Integration

```text
governance DB
P2/P3/P4/P5/P6/P7 references
ledger
reports
```

## Security

```text
tenant
IDOR
approval bypass
hash tampering
credential access
```

---

# 248. Hash Test

For a known fixture:

```text
canonical object
```

assert:

```text
expected SHA-256
```

---

# 249. Canonicalization Test

Reorder object keys.

Expected:

```text
same hash
```

where canonicalization defines order independence.

---

# 250. Hash Chain Test

Tamper with:

```text
Event 2
```

Expected:

```text
Event 2 hash mismatch
Event 3 chain mismatch
```

---

# 251. Package Integrity Test

Change one resource reference.

Expected:

```text
package hash mismatch
```

---

# 252. Ledger Verification Test

Anchor fixture package to local/test ledger.

Then:

```text
verify
```

must return:

```text
VERIFIED
```

---

# 253. Ledger Mismatch Test

Change local package hash.

Expected:

```text
FAILED
```

---

# 254. Approval Version Test

Approve:

```text
resource v1
```

modify to:

```text
v2
```

Expected:

```text
v1 approval not applied to v2
```

---

# 255. Risk Acceptance Expiry Test

Past expiration:

```text
status = EXPIRED
```

---

# 256. Exception Expiry Test

Past expiry:

```text
exception = EXPIRED
```

---

# 257. Legal Hold Test

Attempt deletion:

```text
blocked
```

and:

```text
event logged
```

---

# 258. Compliance Mapping Test

Ensure:

```text
framework version
control ID
SentinelStack control
mapping type
```

are all valid.

---

# 259. Report Snapshot Test

Generate report against:

```text
RiskAssessment A
```

then create:

```text
RiskAssessment B
```

Report remains linked to A.

---

# 260. Regulatory Submission Test

Mock connector:

```text
submission accepted
```

Expected:

```text
SUBMITTED/ACKNOWLEDGED
```

Real submission occurs only through an actual authorized connector.

---

# 261. Tenant Security Test

Tenant A cannot access:

```text
governance package B
evidence B
report B
risk acceptance B
investment decision B
ledger anchor B
```

---

# 262. Governance Performance

Initial target:

```text
ordinary governance reads:
interactive

package generation:
async when large

report generation:
async

ledger anchoring:
async

integrity verification:
batch/async for large packages
```

Exact SLOs should be benchmarked.

---

# 263. Governance CI/CD

Required tests:

```text
lint
typecheck
unit
integration
contract
security
migration
hash fixtures
ledger adapter tests
report fixture tests
investment governance tests
```

---

# 264. Migration Strategy

## Phase A

Add:

```text
GovernanceEvent
GovernancePackage
RiskAcceptance
RiskException
```

## Phase B

Add:

```text
EvidenceVersion / Review
```

## Phase C

Add:

```text
Framework / Compliance
```

## Phase D

Add:

```text
Reports / Submission
```

## Phase E

Add:

```text
Ledger adapter
```

---

# 265. Existing AuditLog Compatibility

Do not delete:

```text
AuditLog
```

Use it for existing application operations.

Add analytical events and correlate them.

---

# 266. Existing ComplianceBadge Compatibility

Existing:

```text
ComplianceBadge
```

may continue for current product functionality.

P8 adds versioned:

```text
Framework
ComplianceAssessment
ControlMapping
ComplianceEvidence
```

---

# 267. Existing Reports Compatibility

Existing report generation remains functional.

P8 adds:

```text
report definition version
data snapshot hash
approval
artifact hash
submission state
```

---

# 268. Existing RiskSnapshot Compatibility

Keep as compatibility record.

P8 governance references canonical:

```text
RiskAssessment
RiskRun
```

when the migration is complete.

---

# 269. Existing RiskScenario Compatibility

Keep for compatibility until P4 migration completes.

Governance references canonical:

```text
Scenario
ScenarioRun
ScenarioAssessment
```

---

# 270. Governance Feature Flags

Recommended:

```text
GOVERNANCE_ENGINE_ENABLED
INTEGRITY_HASHING_ENABLED
HASH_CHAIN_ENABLED
RISK_ACCEPTANCE_ENABLED
EXCEPTION_WORKFLOW_ENABLED
COMPLIANCE_V2_ENABLED
REGULATORY_REPORTING_ENABLED
LEDGER_ENABLED
LEDGER_VERIFY_ENABLED
AI_GOVERNANCE_ENABLED
```

---

# 271. Rollback

Disable new governance workflow features without disabling:

```text
P2/P3/P4/P5/P6/P7
```

Historical governance data remains read-only.

---

# 272. Ledger Rollback

If ledger adapter fails:

```text
disable anchoring
```

while retaining:

```text
internal hashes
packages
events
```

---

# 273. Free-First Strategy

For SIH, the baseline can be:

```text
PostgreSQL
SHA-256
existing Docker
local/private test ledger
existing report infrastructure
```

with enterprise blockchain/storage integrations remaining optional.

---

# 274. Production vs Demo Modes

```text
DEMO
DEVELOPMENT
STAGING
PRODUCTION
```

must have clearly separated:

```text
ledger credentials
submission mode
synthetic data
approval policies
retention
```

---

# 275. Governance Security Requirements

Minimum:

```text
TLS in transit
authenticated APIs
RBAC
tenant isolation
secret management
restricted evidence access
audit
rate limiting
resource-version checks
```

---

# 276. Governance Security Threats

Primary threats:

```text
tampering
deletion
cross-tenant access
fake approval
fake evidence
hash substitution
ledger key compromise
report manipulation
AI-driven governance bypass
```

---

# 277. Tampering Mitigation

Use:

```text
append-only events
hashes
versioning
restricted writes
audit
backups
optional ledger
```

---

# 278. Fake Approval Mitigation

Use:

```text
RBAC
explicit approval event
actor identity
request hash
approved resource hash
```

---

# 279. Fake Evidence Mitigation

Use:

```text
source provenance
collection timestamp
content hash
connector identity
review status
```

---

# 280. Hash Substitution Mitigation

Governance packages should retain:

```text
historical package hash
```

and optional:

```text
ledger anchor
```

so the original hash can be independently checked.

---

# 281. Ledger Key Compromise

If signing key compromised:

```text
disable key
rotate
record incident
verify prior anchors
```

---

# 282. Report Manipulation Mitigation

Store:

```text
dataSnapshotHash
artifactHash
approvalHash
```

---

# 283. Governance Attack From AI

Potential:

```text
prompt injection -> approval bypass
```

Mitigation:

```text
AI never bypasses backend governance checks
```

---

# 284. Approval Tool Boundary

Approval actions should require:

```text
human user identity
authorized role
resource version/hash
confirmation
```

AI-generated prose cannot substitute for approval identity.

---

# 285. Resource Version Conflict

If user attempts to approve:

```text
Portfolio v1
```

while current is:

```text
Portfolio v2
```

backend rejects or requires re-review.

---

# 286. Historical Integrity

Historical package state remains:

```text
read-only
```

except through explicit correction/supersession flows.

---

# 287. Evidence Freshness vs Integrity

Separate:

```text
freshness
```

from:

```text
integrity
```

An old record can be intact.

A new record can be tampered.

---

# 288. Governance Status vs Risk Status

Do not interpret:

```text
ACCEPTED
```

as:

```text
low risk
```

and do not interpret:

```text
REVIEW_REQUIRED
```

as:

```text
high risk
```

without an explicit domain metric.

---

# 289. Audit Readiness

A package can expose:

```text
READY
READY_WITH_WARNINGS
INCOMPLETE
BLOCKED
```

based on explicit checklist rules.

---

# 290. Governance Checklist Engine

Create:

```text
src/services/governance/checklist.service.ts
```

It evaluates:

```text
required resources
evidence
review
approval
integrity
```

---

# 291. Checklist Versioning

Store:

```text
checklistVersion
```

for historical reproducibility.

---

# 292. Regulatory Checklist

Each report definition can reference:

```text
RegulatoryChecklist
```

with:

```text
required field
evidence
approval
```

---

# 293. Submission Readiness

A report may show:

```text
Ready to submit
```

only if:

```text
all required checklist items pass
```

This is a process state, not a guarantee of regulatory acceptance.

---

# 294. Governance Report Content

Recommended risk governance report sections:

```text
current risk
risk trend
drivers
evidence
scenarios
risk appetite
acceptances
exceptions
model status
```

---

# 295. Investment Governance Report

Recommended:

```text
objective
budget
portfolio
validated scenario
cost
modeled benefit
residual risk
ROSI
approval
```

---

# 296. Model Governance Report

Recommended:

```text
model purpose
data
training
validation
calibration
deployment
drift
limitations
approvals
```

---

# 297. Compliance Governance Report

Recommended:

```text
framework
scope
control mappings
evidence
gaps
remediation
review
```

---

# 298. Integrity Report

Recommended:

```text
package
hash
verification
ledger
transaction
```

---

# 299. Governance Package Example

```text
Audit Package
    |
    +-- RiskAssessment RA-001
    +-- RiskRun RUN-001
    +-- RiskDrivers DRV-001..010
    +-- Evidence EV-001..100
    +-- ModelBundle MB-003
    +-- Scenario SCN-009
    +-- Portfolio P-004
    +-- Decision DEC-002
    +-- Governance Events
    +-- Package Hash
    +-- Ledger Anchor
```

---

# 300. Full-Chain Acceptance Fixture

Create one controlled organization with:

```text
assets
vulnerabilities
controls
evidence
risk
scenario
investment
portfolio
decision
framework
report
```

Then execute the full governance path.

Expected:

```text
all references valid
all hashes valid
audit trail complete
package sealed
ledger anchor verified
report approved
```

---

# Appendix A — Full SentinelStack Governance Chain

```text
SOURCE SYSTEM
    |
    v
INGESTION
    |
    v
EVIDENCE
    |
    +--------------------+
    |                    |
    v                    v
P6 ML                  P2 Risk
    |                    |
    v                    v
Prediction           RiskAssessment
    |                    |
    +---------+----------+
              |
              v
         P3 Drivers
              |
              v
          P4 Scenario
              |
              v
     P5 Investment Analysis
              |
              v
         Portfolio
              |
              v
     Investment Decision
              |
              v
        Governance Review
              |
              v
          Report
              |
              v
      Governance Package
              |
              v
          SHA-256
              |
              v
      Optional Ledger
              |
              v
       Verification
```

---

# Appendix B — Risk Assessment Governance Example

```text
RiskAssessment RA-001
    |
    +-- RiskRun RUN-001
    +-- ModelBundle MB-003
    +-- Drivers DRV-001..010
    +-- Evidence EV-001..020
    +-- Review REV-001
    +-- Acceptance ACC-001
    +-- Package GP-001
    +-- PackageHash sha256:...
    +-- LedgerAnchor LA-001
```

Illustrative identifiers.

---

# Appendix C — Investment Decision Governance Example

```text
Risk Driver
    |
    v
Scenario
    |
    v
Investment Option
    |
    v
Optimization Run
    |
    v
Portfolio P-001
    |
    +-- Cost ₹...
    +-- Avoided EAL ₹...
    +-- Residual EAL ₹...
    +-- Validated Scenario SCN-001
    |
    v
Decision DEC-001
    |
    +-- Reviewer
    +-- Approval
    +-- Conditions
    |
    v
Governance Package GP-002
```

Values are illustrative.

---

# Appendix D — Compliance Governance Example

```text
Framework:
Configured Framework v2026

Control:
CTRL-X

SentinelStack mapping:
SecurityControl CTRL-009

Evidence:
EV-101
EV-102

Assessment:
CA-001

Gap:
EVIDENCE_STALE

Treatment:
InvestmentOption INV-009

Scenario:
SCN-020
```

The exact framework/control/evidence values must come from the configured framework catalogue and assessment data.

---

# Appendix E — Integrity Verification Example

```text
Stored Package Hash:
sha256:ABC

Recomputed Hash:
sha256:ABC

Ledger Anchored Hash:
sha256:ABC

Status:
VERIFIED
```

Illustrative.

---

# Appendix F — Integrity Failure Example

```text
Stored Package Hash:
sha256:ABC

Recomputed Hash:
sha256:XYZ

Ledger Anchored Hash:
sha256:ABC

Status:
FAILED

Meaning:
the current package bytes/resources do not match the sealed package hash.
```

This does not independently identify the cause.

---

# Appendix G — Governance Timeline Example

```text
09:00
Risk assessment calculated

09:10
Risk reviewed

09:20
Residual risk accepted until 31 Dec

10:00
Scenario created

10:30
Scenario validated

11:00
Optimization completed

11:30
Portfolio approved for review

12:00
Governance package sealed

12:05
Package anchored

12:07
Integrity verified
```

Illustrative.

---

# Appendix H — Regulatory Package Example

```text
Regulatory Report
    |
    +-- Definition Version
    +-- Assessment
    +-- Control Mapping
    +-- Evidence
    +-- Gaps
    +-- Reviewer
    +-- Approval
    +-- Artifact Hash
    +-- Package Hash
    +-- Submission Receipt
```

---

# Appendix I — P8 Repository Map

```text
src/services/governance/
    governanceEvent.service.ts
    governancePackage.service.ts
    governanceReview.service.ts
    riskAcceptance.service.ts
    exception.service.ts
    checklist.service.ts
    policyEvaluation.service.ts
    historicalReconstruction.service.ts
    actionItem.service.ts

src/services/provenance/
    integrityHash.service.ts
    integrityVerification.service.ts
    evidenceGovernance.service.ts
    ledger/
        ledger.interface.ts
        ledger.service.ts
        localLedger.adapter.ts
        evmLedger.adapter.ts

src/services/compliance/
    framework.service.ts
    frameworkVersion.service.ts
    controlMapping.service.ts
    complianceAssessment.service.ts
    complianceEvidence.service.ts
    complianceGap.service.ts

src/services/reporting/
    regulatoryReport.service.ts
    reportGovernance.service.ts
    reportSubmission.service.ts

src/services/investment/
    investmentDecision.service.ts

src/routes/
    governance.routes.ts
    integrity.routes.ts
    risk-acceptance.routes.ts
    exception.routes.ts
    regulatory-report.routes.ts
    investment-decision.routes.ts

tests/governance/
tests/provenance/
tests/compliance/
tests/reporting/
tests/investment/
```

Use existing repository modules where equivalent.

---

# Appendix J — P8 Implementation Sequence

```text
P8.1
GovernanceEvent + state transitions
        |
        v
P8.2
Evidence version/review/retention
        |
        v
P8.3
Canonicalization + SHA-256
        |
        v
P8.4
Governance Package
        |
        v
P8.5
Risk Acceptance + Exception
        |
        v
P8.6
Compliance Framework + Mapping
        |
        v
P8.7
Report Definition + Governance
        |
        v
P8.8
Investment Decision Governance
        |
        v
P8.9
Model Governance Integration
        |
        v
P8.10
AI Governance Integration
        |
        v
P8.11
Ledger Adapter
        |
        v
P8.12
Historical Reconstruction
        |
        v
P8.13
Governance Center UI
        |
        v
P8.14
Full-chain Integration Tests
        |
        v
P8.15
SIH Governance/Blockchain Demo
```

---

# Appendix K — P8 Guardrails

```text
DO:
- keep PostgreSQL/application data as operational truth
- use immutable/versioned records
- hash governed records/packages
- store canonicalization version
- preserve exact resource versions
- distinguish observed/modelled/hypothetical/human decisions
- make approvals explicit
- make risk acceptance separate from risk calculation
- make exceptions separate from risk calculation
- version compliance frameworks
- snapshot report inputs
- audit external submissions
- use blockchain as integrity anchor
- keep sensitive data off-chain
- verify hashes independently
- preserve historical reconstruction
- enforce tenant/role access
- label synthetic demo data

DO NOT:
- put raw telemetry on-chain
- put PII/secrets on-chain
- use blockchain as the risk engine
- claim blockchain proves model correctness
- claim a mapping automatically proves compliance
- overwrite historical risk assessments
- overwrite historical evidence
- let approval apply to a changed resource version
- mark a ledger anchor confirmed before confirmation
- mark a report submitted without a real receipt
- let AI bypass governance controls
- let risk acceptance alter EAL/VaR/Risk Score
- invent audit events for historical facts
- fabricate regulatory evidence
- fabricate blockchain transaction IDs
- silently repair integrity failures
```

---

# Status

**P8 Governance, Evidence Integrity, Blockchain Anchoring, Compliance Evidence & Regulatory Reporting Implementation Specification:** READY

P8 completes the governance and trust layer around the quantitative platform:

```text
P2  -> Quantify
P3  -> Attribute + Evidence
P4  -> Simulate
P5  -> Optimize
P6  -> Predict
P7  -> Explain / Interact
P8  -> Govern / Verify / Audit / Report
```

The complete PS-26105 architecture is now:

```text
Security Sources
      |
      v
Continuous Ingestion / Digital Twin
      |
      v
P2 Quantitative Risk Engine
      |
      +--> EAL
      +--> VaR
      +--> Risk Score
      |
      v
P3 Risk Drivers + Evidence
      |
      v
P4 Scenario / What-If Engine
      |
      v
P5 Investment Optimization
      |
      v
P6 Predictive ML
      |
      v
P7 Grounded AI Copilot
      |
      v
P8 Governance / Compliance / Integrity
      |
      +--> Audit
      +--> Risk Acceptance
      +--> Investment Decision
      +--> Regulatory Reporting
      +--> Evidence Packages
      +--> Hash Verification
      +--> Optional Blockchain Anchor
```

The next implementation phase is:

```text
P9 — Continuous Ingestion, Connector Framework, Telemetry Normalization, Digital Twin Synchronization, Event-Driven Risk Recalculation, Observability & Production Hardening
```

P9 will operationalize the end-to-end loop so the platform can continuously ingest changing vulnerability, SIEM, IAM, EDR, CSPM, threat-intelligence and asset/business-context data; normalize it into the Digital Twin; detect material changes; trigger ML/P2 recalculation; preserve lineage; and operate reliably in production.
